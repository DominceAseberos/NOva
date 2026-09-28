import { chromium } from "playwright-core";
import fs from "node:fs";

const browser = await chromium.launch({
  headless:true,
  executablePath:"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  args:["--use-angle=swiftshader"]
});
const page = await browser.newPage({viewport:{width:1500,height:980}});
const errors=[];
page.on("pageerror",e=>errors.push("page: "+e.message));
page.on("console",m=>{if(m.type()==="error") errors.push("console: "+m.text())});

await page.goto("http://127.0.0.1:5173/?editor=1",{waitUntil:"domcontentloaded"});
await page.waitForFunction(()=>document.body.classList.contains("nova-persistent-3d-ready"),null,{timeout:15000});
await page.waitForTimeout(500);
await page.getByRole("button",{name:"Expand"}).click();
await page.waitForTimeout(100);

const before = await page.evaluate(()=>({
  chapter:document.body.dataset.storyChapter,
  keyframes:document.querySelectorAll(".sse-keyframe").length,
  heroHeight:Math.round(document.querySelector("#top").getBoundingClientRect().height),
  inspector:[...document.querySelectorAll(".sse-fields input")].map(i=>i.value)
}));

const duration = page.locator(".sse-section-panel input[type=number]").first();
await duration.fill("120");
await duration.press("Enter");
await page.waitForTimeout(150);

const xInput = page.locator(".sse-fields input").nth(0);
await xInput.fill("1.33");
await xInput.press("Enter");
await page.locator("[data-sse-save-keyframe]").click();
await page.waitForTimeout(150);

const afterEdit = await page.evaluate(()=>({
  keyframes:document.querySelectorAll(".sse-keyframe").length,
  heroHeight:Math.round(document.querySelector("#top").getBoundingClientRect().height),
  playhead:document.querySelector(".sse-playhead")?.style.left,
  selected:document.querySelector(".sse-keyframe[data-selected=true]")?.title||null
}));

await page.getByRole("button",{name:"Undo"}).click();
await page.waitForTimeout(100);
await page.getByRole("button",{name:"Undo"}).click();
await page.waitForTimeout(100);

const afterUndo = await page.evaluate(()=>({
  keyframes:document.querySelectorAll(".sse-keyframe").length,
  heroHeight:Math.round(document.querySelector("#top").getBoundingClientRect().height)
}));

const saveResult = await page.evaluate(async()=>{
  const response=await fetch("/__scroll-story/save",{
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({
      path:"src/story/qa-story-save.json",
      story:{schemaVersion:"qa",ok:true}
    })
  });
  return {status:response.status,body:await response.json()};
});

await page.screenshot({path:".qa-scroll-story-editor-ready.png"});
console.log(JSON.stringify({before,afterEdit,afterUndo,saveResult,errors},null,2));
await browser.close();