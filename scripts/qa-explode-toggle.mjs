import { chromium } from "playwright-core";

const browser = await chromium.launch({
  headless:true,
  executablePath:"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  args:["--use-angle=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]
});
const page=await browser.newPage({viewport:{width:1440,height:900}});
await page.addInitScript(()=>localStorage.clear());
const errors=[];
page.on("pageerror",e=>errors.push(e.message));
page.on("console",m=>{if(m.type()==="error")errors.push(m.text())});

await page.goto("http://127.0.0.1:5173/?editor=1",{waitUntil:"domcontentloaded"});
await page.waitForFunction(()=>document.body.classList.contains("nova-persistent-3d-ready"),null,{timeout:25000});

await page.evaluate(async()=>{
  const { novaStoryStore }=await import("/src/story/novaStoryStore.js");
  const bridge=await import("/src/scroll-story/runtime/editorBridge.js");
  const story=novaStoryStore.get();
  let start=0;
  for(const section of story.sections){
    if(section.id==="performance"){
      bridge.getStoryRuntimeApi()?.scrollToTime?.(start+section.duration*0.62);
      return;
    }
    start+=Number(section.duration||0);
  }
});
await page.waitForTimeout(250);

const apiStateOn=await page.evaluate(async()=>{
  const bridge=await import("/src/scroll-story/runtime/editorBridge.js");
  return bridge.getStoryRuntimeApi()?.captureProductState?.();
});
await page.screenshot({path:".qa-explode-on.png"});

await page.getByRole("button",{name:"Expand"}).click();
await page.getByRole("button",{name:"Product",exact:true}).click();
const toggle=page.locator(".sse-check--compact input");
if(await toggle.isChecked()) await toggle.uncheck();
await page.waitForTimeout(250);

const apiStateOff=await page.evaluate(async()=>{
  const bridge=await import("/src/scroll-story/runtime/editorBridge.js");
  return bridge.getStoryRuntimeApi()?.captureProductState?.();
});
await page.getByRole("button",{name:"Compact"}).click();
await page.screenshot({path:".qa-explode-off.png"});

console.log(JSON.stringify({
  on:{explode:apiStateOn?.explode,enabled:apiStateOn?.explodeEnabled},
  off:{explode:apiStateOff?.explode,enabled:apiStateOff?.explodeEnabled},
  errors
},null,2));

await browser.close();
if((apiStateOn?.explode||0)<0.8||apiStateOff?.explodeEnabled!==false||errors.length)process.exitCode=1;