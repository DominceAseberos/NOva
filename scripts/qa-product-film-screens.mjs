import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const story = JSON.parse(fs.readFileSync("src/story/nova-story.json","utf8"));
const ranges = new Map();
let cursor = 0;
for (const section of story.sections) {
  ranges.set(section.id,{start:cursor,duration:Number(section.duration)||1});
  cursor += Number(section.duration)||1;
}
const defaultIds = [
  "perf-explode","perf-board","perf-gpu","perf-cpu","perf-memory","perf-storage",
  "perf-cooling","perf-battery","perf-reassemble",
  "ext-screen-thin","ext-profile","ext-keyboard-a","ext-keyboard-b","ext-touchpad",
  "hw-ports-a","hw-ports-b","hw-exhaust","hw-speakers",
  "design-hinge","design-edge","design-closeup",
  "final-open","final-close-start","final-close-end","final-nova"
];
const ids = process.argv.slice(2).length ? process.argv.slice(2) : defaultIds;
const keys = new Map(story.tracks.product.map(k=>[k.id,k]));
const outDir = ".qa-product-film";
fs.mkdirSync(outDir,{recursive:true});

const browser = await chromium.launch({
  headless:true,
  executablePath:"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  args:["--use-angle=swiftshader"]
});
const page = await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
const errors=[];
page.on("pageerror",e=>errors.push("page: "+e.message));
page.on("console",m=>{if(m.type()==="error") errors.push("console: "+m.text())});
await page.goto("http://127.0.0.1:5173/",{waitUntil:"domcontentloaded"});
await page.addStyleTag({content:"*,*::before,*::after{transition:none!important;animation:none!important}"});
await page.waitForFunction(()=>document.body.classList.contains("nova-persistent-3d-ready"),null,{timeout:20000});

const results=[];
for (const id of ids) {
  const k=keys.get(id);
  if(!k) continue;
  const r=ranges.get(k.section);
  const time=r.start+r.duration*Number(k.progress||0);
  await page.evaluate(async (t)=>{
    const bridge=await import("/src/scroll-story/runtime/editorBridge.js");
    const math=await import("/src/scroll-story/core/storyMath.js");
    const storyModule=await import("/src/story/novaStoryStore.js");
    const api=bridge.getStoryRuntimeApi();
    api?.clearEditorPreview?.();
    api?.scrollToTime?.(t);
    const liveStory=storyModule.novaStoryStore.get();
    api?.previewProductState?.(math.evaluateProductTrack(liveStory,t));
    const cameraState=math.evaluateCameraTrack(liveStory,t);
    if(cameraState) api?.previewCameraState?.(cameraState);
  },time);
  await page.waitForFunction(
    (chapter) => document.body.dataset.storyChapter === chapter,
    k.chapter,
    { timeout: 3500 }
  ).catch(()=>{});
  await page.waitForFunction(
    (chapter) => {
      const panel = document.querySelector('[data-story-panel="' + chapter + '"]');
      return !panel || Number.parseFloat(getComputedStyle(panel).opacity || "0") > 0.96;
    },
    k.chapter,
    { timeout: 5000 }
  ).catch(()=>{});
  await page.waitForTimeout(120);
  const chapter=await page.evaluate(()=>document.body.dataset.storyChapter||"UNKNOWN");
  const safe=id.replace(/[^a-z0-9_-]/gi,"_");
  const file=path.join(outDir,safe+".png");
  await page.screenshot({path:file,fullPage:false});
  results.push({id,chapter,time,file});
}
console.log(JSON.stringify({results,errors},null,2));
await browser.close();
if(errors.length) process.exitCode=1;
