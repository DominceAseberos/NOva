import { chromium } from "playwright-core";
const browser = await chromium.launch({
  headless: true,
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  args: ["--use-angle=swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1500, height: 980 } });
const errors = [];
page.on("pageerror", e => errors.push("page: "+e.message));
page.on("console", m => { if(m.type()==="error") errors.push("console: "+m.text()); });
const responses=[];
page.on("response", r => { if(r.url().includes(".glb")) responses.push({url:r.url(),status:r.status()}); });
await page.goto("http://127.0.0.1:5173/?editor=1",{waitUntil:"domcontentloaded"});
for (const ms of [1000,3000,7000,12000]) {
  await page.waitForTimeout(ms===1000?1000:ms-[1000,3000,7000,12000][[1000,3000,7000,12000].indexOf(ms)-1]);
  const s=await page.evaluate(()=>({
    ready:document.body.classList.contains("nova-persistent-3d-ready"),
    fallback:document.body.classList.contains("nova-persistent-3d-fallback"),
    persistent:!!document.querySelector(".persistent-product"),
    canvas:!!document.querySelector(".persistent-product canvas"),
    chapter:document.body.dataset.storyChapter||null
  }));
  console.log(ms,JSON.stringify(s));
}
console.log("responses",JSON.stringify(responses));
console.log("errors",JSON.stringify(errors));
await browser.close();