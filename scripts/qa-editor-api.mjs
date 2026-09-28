import { chromium } from "playwright-core";
const browser=await chromium.launch({headless:true,executablePath:"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",args:["--use-angle=swiftshader"]});
const page=await browser.newPage({viewport:{width:1500,height:980}});
await page.goto("http://127.0.0.1:5173/?editor=1",{waitUntil:"domcontentloaded"});
await page.waitForFunction(()=>document.body.classList.contains("nova-persistent-3d-ready"),null,{timeout:15000});
await page.waitForTimeout(500);
const result=await page.evaluate(async()=>{
 const m=await import("/src/scroll-story/runtime/editorBridge.js");
 const api=m.getStoryRuntimeApi();
 return {
   hasApi:!!api,
   runtime:m.getStoryRuntimeState(),
   capture:api?.captureProductState?.(),
   camera:api?.captureCameraState?.()
 };
});
console.log(JSON.stringify(result,null,2));
await browser.close();