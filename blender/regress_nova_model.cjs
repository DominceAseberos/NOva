const sharp=require('sharp'), fs=require('fs'), path=require('path');

const pairs=[
  {name:'front', ref:'assets/hero/hero-laptop.png', render:'assets/3d/renders/nova_front_alpha.png'},
  {name:'rear', ref:'assets/mobility/mobility-laptop.png', render:'assets/3d/renders/nova_rear_alpha.png'},
];

const OUT='assets/3d/regression';
fs.mkdirSync(OUT,{recursive:true});

async function alphaBBox(file, threshold=12){
  const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let minX=info.width,minY=info.height,maxX=-1,maxY=-1,count=0;
  for(let y=0;y<info.height;y++) for(let x=0;x<info.width;x++){
    const a=data[(y*info.width+x)*4+3];
    if(a>threshold){count++; if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;}
  }
  return {width:info.width,height:info.height,minX,minY,maxX,maxY,bboxW:maxX-minX+1,bboxH:maxY-minY+1,aspect:(maxX-minX+1)/(maxY-minY+1),coverage:count/(info.width*info.height)};
}

async function normalizedMask(file, W=900,H=600,threshold=12){
  const box=await alphaBBox(file,threshold);
  const {data}=await sharp(file)
    .extract({left:box.minX,top:box.minY,width:box.bboxW,height:box.bboxH})
    .ensureAlpha()
    .resize({width:W,height:H,fit:'contain',background:{r:0,g:0,b:0,alpha:0}})
    .raw().toBuffer({resolveWithObject:true});
  const mask=new Uint8Array(W*H);
  for(let i=0,p=0;i<data.length;i+=4,p++) mask[p]=data[i+3]>threshold?1:0;
  return {mask,box};
}

function iou(a,b){
  let inter=0,uni=0;
  for(let i=0;i<a.length;i++){const av=a[i],bv=b[i];if(av&&bv)inter++;if(av||bv)uni++;}
  return uni?inter/uni:0;
}

async function checkerboard(width,height){
  const cell=32; const buf=Buffer.alloc(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const c=((Math.floor(x/cell)+Math.floor(y/cell))%2)?42:26;
    const i=(y*width+x)*4;buf[i]=buf[i+1]=buf[i+2]=c;buf[i+3]=255;
  }
  return sharp(buf,{raw:{width,height,channels:4}}).png().toBuffer();
}

(async()=>{
  const report={};
  const bg=await checkerboard(1800,600);
  for(const p of pairs){
    const r1=await normalizedMask(p.ref);
    const r2=await normalizedMask(p.render);
    const metric=iou(r1.mask,r2.mask);
    report[p.name]={referenceBBox:r1.box,renderBBox:r2.box,normalizedSilhouetteIoU:Number(metric.toFixed(4))};

    const left=await sharp(p.ref).trim({background:{r:0,g:0,b:0,alpha:0}}).resize({width:860,height:560,fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer();
    const right=await sharp(p.render).trim({background:{r:0,g:0,b:0,alpha:0}}).resize({width:860,height:560,fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer();
    await sharp(bg).composite([
      {input:left,left:20,top:20},
      {input:right,left:920,top:20}
    ]).png().toFile(path.join(OUT,p.name+'_comparison.png'));
  }
  fs.writeFileSync(path.join(OUT,'silhouette_report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exit(1)});