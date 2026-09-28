import { chromium } from "playwright-core";

const browser = await chromium.launch({
  headless: true,
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  args: ["--use-angle=swiftshader"],
});

const page = await browser.newPage({ viewport: { width: 1536, height: 720 } });
await page.addInitScript(() => localStorage.clear());

const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});

await page.goto("http://127.0.0.1:5173/?editor=1", { waitUntil: "domcontentloaded" });
await page.waitForFunction(
  () => document.body.classList.contains("nova-persistent-3d-ready"),
  null,
  { timeout: 15000 }
);
await page.waitForTimeout(300);

const read = () => page.evaluate(async () => {
  const bridge = await import("/src/scroll-story/runtime/editorBridge.js");
  const api = bridge.getStoryRuntimeApi();
  const state = api?.captureProductState?.();
  const runtime = bridge.getStoryRuntimeState();
  return {
    time: runtime.time,
    chapter: runtime.chapter,
    scrollY: window.scrollY,
    x: state?.x ?? null,
    ry: state?.ry ?? null,
  };
});

const before = await read();

const area = page.locator(".sse-time-area");
const box = await area.boundingBox();
if (!box) throw new Error("timeline area missing");

const y = box.y + 12;
await page.mouse.move(box.x + box.width * 0.08, y);
await page.mouse.down();
await page.mouse.move(box.x + box.width * 0.35, y, { steps: 5 });
const mid = await read();
await page.mouse.move(box.x + box.width * 0.68, y, { steps: 8 });
const during = await read();
await page.mouse.up();
await page.waitForTimeout(120);
const after = await read();

const beforeDelete = await page.locator(".sse-lane--keyframes").first().locator(".sse-keyframe").count();
const target = page.locator(".sse-lane--keyframes").first().locator(".sse-keyframe").nth(1);
await target.click();
await page.waitForTimeout(100);
const selectedBeforeDelete = await page.locator('.sse-keyframe[data-selected="true"]').count();
await page.getByRole("button", { name: "Delete keyframe" }).click();
await page.waitForTimeout(120);
const afterDelete = await page.locator(".sse-lane--keyframes").first().locator(".sse-keyframe").count();

await page.screenshot({ path: ".qa-video-editor-timeline.png" });

console.log(JSON.stringify({
  before, mid, during, after,
  beforeDelete, selectedBeforeDelete, afterDelete,
  trackLabels: await page.locator(".sse-track-label").allTextContents(),
  timecode: await page.locator(".sse-timecode").textContent(),
  errors
}, null, 2));

await browser.close();

if (
  mid.time <= before.time ||
  during.time <= mid.time ||
  after.time < during.time - 2 ||
  mid.scrollY === before.scrollY ||
  during.scrollY === mid.scrollY ||
  (mid.x === before.x && mid.ry === before.ry) ||
  beforeDelete - afterDelete !== 1 ||
  selectedBeforeDelete !== 1 ||
  errors.length
) {
  process.exitCode = 1;
}
