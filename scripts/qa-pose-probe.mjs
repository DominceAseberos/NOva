import fs from "node:fs";
import { chromium } from "playwright-core";
fs.mkdirSync(".qa-pose-probe",{recursive:true});
const story=JSON.parse(fs.readFileSync("src/story/nova-story.json","utf8"));
let cursor=0;
const ranges=new Map();
for(const section of story.sections){
  ranges.set(section.id,{start:cursor,duration:section.duration});
  cursor+=section.duration;
}
const probeKey=story.tracks.product.find((item)=>item.id==="hw-ports-a");
const range=ranges.get(probeKey.section);
const probeTime=range.start+range.duration*probeKey.progress;

const browser=await chromium.launch({headless:true,executablePath:"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",args:["--use-angle=swiftshader"]});
const page=await browser.newPage({viewport:{width:1440,height:900}});
await page.goto("http://127.0.0.1:5173/",{waitUntil:"domcontentloaded"});
await page.waitForFunction(()=>document.body.classList.contains("nova-persistent-3d-ready"),null,{timeout:20000});
await page.evaluate(async (time)=>{
  const bridge=await import("/src/scroll-story/runtime/editorBridge.js");
  bridge.getStoryRuntimeApi()?.scrollToTime?.(time);
},probeTime);
await page.waitForFunction(()=>document.body.dataset.storyChapter==="PORTS_RIGHT",null,{timeout:5000}).catch(()=>{});

const poses=[
 ["a",0,0,0,.03,1.04,1.20],
 ["b",0,1.57,0,.03,1.04,1.20],
 ["c",0,-1.57,0,.03,1.04,1.20],
 ["d",1.20,0,0,.03,1.04,1.20],
 ["e",-1.20,0,0,.03,1.04,1.20],
 ["f",.20,3.12,0,.03,1.04,1.20]
];
for(const [name,rx,ry,rz,lid,x,scale] of poses){
 await page.evaluate(async ({rx,ry,rz,lid,x,scale})=>{
   const bridge=await import("/src/scroll-story/runtime/editorBridge.js");
   const api=bridge.getStoryRuntimeApi();
   const base=api.captureProductState();
   api.previewProductState({...base,chapter:"PORTS_RIGHT",x,y:-.02,z:0,rx,ry,rz,scale,lid,keyboardLight:0,explode:0,parts:{}});
   api.previewCameraState({position:[0,.96,3.70],target:[.18,-.02,0],fov:25});
 },{rx,ry,rz,lid,x,scale});
 await page.waitForTimeout(500);
 await page.screenshot({path:".qa-pose-probe/"+name+".png"});
}
await browser.close();
