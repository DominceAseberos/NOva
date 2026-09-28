import { chromium } from "playwright-core";
const browser = await chromium.launch({
  headless:true,
  executablePath:"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  args:["--use-angle=swiftshader"]
});
const page = await browser.newPage({viewport:{width:1280,height:800}});
const logs=[];
page.on("console",m=>logs.push(m.type()+": "+m.text()));
page.on("pageerror",e=>logs.push("pageerror: "+e.message));
await page.goto("http://127.0.0.1:5173/?editor=1",{waitUntil:"domcontentloaded"});
await page.waitForTimeout(1200);
console.log(JSON.stringify({
  title:await page.title(),
  body:(await page.locator("body").innerText()).slice(0,2500),
  sse:await page.locator(".sse").count(),
  buttons:await page.locator("button").allTextContents(),
  logs
},null,2));
await browser.close();