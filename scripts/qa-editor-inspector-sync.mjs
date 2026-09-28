import { chromium } from "playwright-core";
const browser=await chromium.launch({headless:true,executablePath:"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",args:["--use-angle=swiftshader"]});
const page=await browser.newPage({viewport:{width:1500,height:980}});
await page.goto("http://127.0.0.1:5173/?editor=1",{waitUntil:"domcontentloaded"});
await page.waitForFunction(()=>document.body.classList.contains("nova-persistent-3d-ready"),null,{timeout:15000});
await page.getByRole("button",{name:"Expand"}).click();
for(const ms of [100,500,1500,3000]){
 await page.waitForTimeout(ms===100?100:ms-[100,500,1500,3000][[100,500,1500,3000].indexOf(ms)-1]);
 const vals=await page.locator(".sse-fields").first().locator("input").evaluateAll(els=>els.slice(0,9).map(e=>e.value));
 console.log(ms,JSON.stringify(vals));
}
await browser.close();