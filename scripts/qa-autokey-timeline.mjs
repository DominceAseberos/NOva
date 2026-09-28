import { chromium } from "playwright-core";

const browser = await chromium.launch({
  headless: true,
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  args: ["--use-angle=swiftshader"],
});

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
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

await page.evaluate(async () => {
  const bridge = await import("/src/scroll-story/runtime/editorBridge.js");
  bridge.getStoryRuntimeApi()?.scrollToTime?.(30);
});
await page.waitForTimeout(350);

await page.getByRole("button", { name: "Expand" }).click();
const beforeCount = await page.locator(".sse-keyframe").count();

const xInput = page.locator(".sse-fields .sse-field input").first();
const beforeX = Number(await xInput.inputValue());
const editedX = Number((beforeX + 0.27).toFixed(3));
await xInput.fill(String(editedX));
await page.waitForTimeout(350);

const afterCount = await page.locator(".sse-keyframe").count();

const storeState = await page.evaluate(async () => {
  const { novaStoryStore } = await import("/src/story/novaStoryStore.js");
  const story = novaStoryStore.get();
  const custom = [...(story.tracks?.product || [])]
    .reverse()
    .find((item) => item.id.startsWith("product-top-"));
  return {
    count: story.tracks?.product?.length || 0,
    custom: custom
      ? {
          id: custom.id,
          section: custom.section,
          progress: custom.progress,
          x: custom.state?.x,
        }
      : null,
  };
});

await page.evaluate(async () => {
  const bridge = await import("/src/scroll-story/runtime/editorBridge.js");
  bridge.getStoryRuntimeApi()?.scrollToTime?.(60.9);
});
await page.waitForTimeout(450);

const away = await page.evaluate(async () => {
  const bridge = await import("/src/scroll-story/runtime/editorBridge.js");
  return bridge.getStoryRuntimeApi()?.captureProductState?.()?.x ?? null;
});

await page.locator(".sse-keyframe").last().click();
await page.waitForTimeout(220);

const clicked = await page.evaluate(async () => {
  const bridge = await import("/src/scroll-story/runtime/editorBridge.js");
  const api = bridge.getStoryRuntimeApi();
  const state = api?.captureProductState?.();
  return {
    x: state?.x ?? null,
    chapter: document.body.dataset.storyChapter || null,
  };
});

console.log(
  JSON.stringify(
    {
      beforeCount,
      afterCount,
      beforeX,
      editedX,
      storeState,
      away,
      clicked,
      errors,
    },
    null,
    2
  )
);

await browser.close();

if (
  afterCount !== beforeCount + 1 ||
  !storeState.custom ||
  Math.abs(storeState.custom.x - editedX) > 0.01 ||
  Math.abs(clicked.x - editedX) > 0.03 ||
  errors.length
) {
  process.exitCode = 1;
}
