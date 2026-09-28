import { chromium } from "playwright-core";

const browser = await chromium.launch({
  headless: true,
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  args: ["--use-angle=swiftshader"],
});

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => localStorage.clear());

const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});

await page.goto("http://127.0.0.1:5173/?editor=1", {
  waitUntil: "domcontentloaded",
});

await page.waitForFunction(
  () => document.body.classList.contains("nova-persistent-3d-ready"),
  null,
  { timeout: 25000 }
);

await page.getByRole("button", { name: "Expand" }).click();
await page.getByRole("button", { name: "Parts", exact: true }).click();
await page.waitForTimeout(200);

const parts = await page.evaluate(async () => {
  const bridge = await import("/src/scroll-story/runtime/editorBridge.js");
  return bridge.getStoryRuntimeApi()?.getEditableParts?.() || [];
});

const select = page.locator(".sse-parts-panel select");
await select.selectOption("fanLeft");
await page.waitForTimeout(100);

const visibleToggle = page.locator(".sse-parts-panel .sse-check--inline input");
await visibleToggle.uncheck();
await page.waitForTimeout(260);

const partX = page.locator(".sse-fields--parts .sse-field input").nth(0);
await partX.fill("0.035");
await page.waitForTimeout(300);

const authored = await page.evaluate(async () => {
  const bridge = await import("/src/scroll-story/runtime/editorBridge.js");
  const { novaStoryStore } = await import("/src/story/novaStoryStore.js");
  const api = bridge.getStoryRuntimeApi();
  const story = novaStoryStore.get();
  const runtime = bridge.getStoryRuntimeState();
  const product = story.tracks.product;
  const selected = product.find((item) =>
    item.state?.parts?.fanLeft?.visible === false &&
    Math.abs((item.state.parts.fanLeft.position?.[0] || 0) - 0.035) < 0.005
  );
  return {
    runtimeTime: runtime.time,
    part: api?.capturePartState?.("fanLeft"),
    selected: selected
      ? {
          id: selected.id,
          section: selected.section,
          progress: selected.progress,
          fanLeft: selected.state.parts.fanLeft,
        }
      : null,
  };
});

await page.evaluate(async () => {
  const bridge = await import("/src/scroll-story/runtime/editorBridge.js");
  const api = bridge.getStoryRuntimeApi();
  api?.clearEditorPreview?.("product");
  api?.scrollToTime?.(420);
});
await page.waitForTimeout(160);

const away = await page.evaluate(async () => {
  const bridge = await import("/src/scroll-story/runtime/editorBridge.js");
  return bridge.getStoryRuntimeApi()?.capturePartState?.("fanLeft");
});

const selectedMarker = page.locator('.sse-keyframe[data-selected="true"]');
if (await selectedMarker.count()) {
  await selectedMarker.first().click();
  await page.waitForTimeout(160);
}

const recalled = await page.evaluate(async () => {
  const bridge = await import("/src/scroll-story/runtime/editorBridge.js");
  return bridge.getStoryRuntimeApi()?.capturePartState?.("fanLeft");
});

await page.getByRole("button", { name: "Product", exact: true }).click();
await page.waitForTimeout(100);

const explodeToggle = page.locator(".sse-check--compact input");
if (await explodeToggle.isChecked()) {
  await explodeToggle.uncheck();
}
await page.waitForTimeout(260);

const explodeState = await page.evaluate(async () => {
  const bridge = await import("/src/scroll-story/runtime/editorBridge.js");
  return bridge.getStoryRuntimeApi()?.captureProductState?.();
});

await page.getByRole("button", { name: "Compact" }).click();
await page.evaluate(async () => {
  const bridge = await import("/src/scroll-story/runtime/editorBridge.js");
  bridge.getStoryRuntimeApi()?.scrollToTime?.(55);
});
await page.waitForTimeout(250);
await page.screenshot({ path: ".qa-nova-screen-parts.png", fullPage: false });

console.log(JSON.stringify({
  partsCount: parts.length,
  partIds: parts.map((part) => part.id),
  authored,
  away,
  recalled,
  explodeEnabled: explodeState?.explodeEnabled,
  errors,
}, null, 2));

await browser.close();

const requiredPartIds = [
  "motherboard",
  "cpuGpu",
  "cpu",
  "gpu",
  "ram1",
  "ram2",
  "ssd",
  "fanLeft",
  "fanRight",
];

if (
  parts.length < 18 ||
  requiredPartIds.some(
    (id) => !parts.some((part) => part.id === id)
  ) ||
  !authored.selected ||
  authored.part?.visible !== false ||
  Math.abs((authored.part?.position?.[0] || 0) - 0.035) > 0.005 ||
  recalled?.visible !== false ||
  Math.abs((recalled?.position?.[0] || 0) - 0.035) > 0.005 ||
  explodeState?.explodeEnabled !== false ||
  errors.length
) {
  process.exitCode = 1;
}

