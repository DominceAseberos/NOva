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
  bridge.getStoryRuntimeApi()?.scrollToTime?.(40);
});
await page.waitForTimeout(300);

const beforeCount = await page.locator(".sse-keyframe").count();

const edited = await page.evaluate(async () => {
  const bridge = await import("/src/scroll-story/runtime/editorBridge.js");
  const api = bridge.getStoryRuntimeApi();
  const before = api.captureProductState();
  const next = { ...before, x: before.x + 0.31 };
  api.previewProductState(next);
  await new Promise((resolve) => setTimeout(resolve, 80));
  bridge.publishStoryRuntimeState({ manipulating: true });
  await new Promise((resolve) => setTimeout(resolve, 40));
  bridge.publishStoryRuntimeState({ manipulating: false });
  return { beforeX: before.x, editedX: next.x };
});

await page.waitForTimeout(350);

const afterCount = await page.locator(".sse-keyframe").count();
const storeState = await page.evaluate(async () => {
  const { novaStoryStore } = await import("/src/story/novaStoryStore.js");
  const story = novaStoryStore.get();
  const custom = [...story.tracks.product]
    .reverse()
    .find((item) => item.id.startsWith("product-top-"));
  return {
    count: story.tracks.product.length,
    custom: custom
      ? { id: custom.id, progress: custom.progress, x: custom.state.x }
      : null,
  };
});

const autoKeyBadge = await page.locator(".sse-autokey-badge").textContent();

console.log(
  JSON.stringify(
    { beforeCount, afterCount, edited, storeState, autoKeyBadge, errors },
    null,
    2
  )
);

await browser.close();

if (
  afterCount !== beforeCount + 1 ||
  !storeState.custom ||
  Math.abs(storeState.custom.x - edited.editedX) > 0.02 ||
  autoKeyBadge?.trim() !== "AUTO KEY ON" ||
  errors.length
) {
  process.exitCode = 1;
}
