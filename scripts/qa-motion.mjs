import { chromium } from "playwright-core";

const browser = await chromium.launch({
  headless: true,
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  args: ["--disable-gpu"],
});

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (error) => errors.push("pageerror: " + error.message));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push("console: " + msg.text());
});

await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle" });
await page.waitForFunction(() => document.body.classList.contains("nova-persistent-3d-ready"), null, { timeout: 20000 });
await page.waitForTimeout(500);

// Hero motion is now background/parallax + the persistent 3D product. The
// retired static .hero-laptop element is intentionally no longer part of QA.
const heroStart = await page.locator(".hero-bg").evaluate((el) => getComputedStyle(el).transform);
await page.evaluate(() => window.scrollTo(0, 520));
await page.waitForTimeout(450);
const heroMoved = await page.locator(".hero-bg").evaluate((el) => getComputedStyle(el).transform);

const captureProduct = () => page.evaluate(async () => {
  const bridge = await import("/src/scroll-story/runtime/editorBridge.js");
  const state = bridge.getStoryRuntimeApi()?.captureProductState?.();
  if (!state) return null;
  return {
    x: state.x,
    y: state.y,
    z: state.z,
    rx: state.rx,
    ry: state.ry,
    rz: state.rz,
    scale: state.scale,
    explode: state.explode,
    lid: state.lid,
    keyboardLight: state.keyboardLight,
    chapter: document.body.dataset.storyChapter || "",
  };
});

const perfTop = await page.locator("#performance").evaluate((el) => el.offsetTop);
await page.evaluate((y) => window.scrollTo(0, y + 80), perfTop);
await page.waitForTimeout(700);
const perfStart = await captureProduct();
await page.evaluate((y) => window.scrollTo(0, y + 1150), perfTop);
await page.waitForTimeout(700);
const perfMoved = await captureProduct();

const reduced = await browser.newPage({ viewport: { width: 390, height: 844 } });
await reduced.emulateMedia({ reducedMotion: "reduce" });
await reduced.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle" });
const reducedStagePosition = await reduced.locator(".hero-stage").evaluate((el) => getComputedStyle(el).position);

console.log(JSON.stringify({
  heroTransformChanges: heroStart !== heroMoved,
  performanceTransformChanges: JSON.stringify(perfStart) !== JSON.stringify(perfMoved),
  heroStart,
  heroMoved,
  perfStart,
  perfMoved,
  reducedMotionHeroStagePosition: reducedStagePosition,
  errors,
}, null, 2));

await browser.close();
