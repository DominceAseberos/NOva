import { chromium } from "playwright-core";

const browser = await chromium.launch({
  headless: true,
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  args: ["--use-angle=swiftshader"],
});

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (error) => errors.push("pageerror: " + error.message));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push("console: " + msg.text());
});

await page.goto("http://127.0.0.1:5173/", { waitUntil: "domcontentloaded" });
await page.waitForFunction(
  () =>
    document.documentElement.classList.contains("lenis") &&
    document.documentElement.classList.contains("nova-lenis-active") &&
    document.body.classList.contains("nova-persistent-3d-ready"),
  null,
  { timeout: 20000 }
);

const initial = await page.evaluate(() => ({
  y: window.scrollY,
  chapter: document.body.dataset.storyChapter || null,
  lenis: document.documentElement.classList.contains("lenis"),
  smooth: document.documentElement.classList.contains("lenis-smooth"),
}));

await page.evaluate(() => {
  window.dispatchEvent(
    new WheelEvent("wheel", {
      deltaY: 900,
      deltaMode: 0,
      bubbles: true,
      cancelable: true,
    })
  );
});

const samples = [];
for (const delay of [20, 45, 80, 140, 240, 400]) {
  await page.waitForTimeout(delay);
  samples.push(
    await page.evaluate(async () => {
      const { getActiveLenis } = await import(
        "/src/scroll-story/runtime/lenisBridge.js"
      );
      const lenis = getActiveLenis();
      return {
        y: Math.round(window.scrollY),
        animated: Math.round(lenis?.animatedScroll ?? -1),
        target: Math.round(lenis?.targetScroll ?? -1),
        scrolling: lenis?.isScrolling ?? false,
        chapter: document.body.dataset.storyChapter || null,
        heroTransform: getComputedStyle(
          document.querySelector(".hero-bg")
        ).transform,
      };
    })
  );
}

const positions = samples.map((sample) => sample.animated);
const monotonic = positions.every(
  (value, index) => index === 0 || value >= positions[index - 1]
);
const target = samples.at(-1)?.target ?? 0;
const interpolated =
  target > 0 &&
  positions.some((value) => value > 0 && value < target) &&
  samples.some((sample) => sample.scrolling === "smooth");

const runtimeJump = await page.evaluate(async () => {
  const bridge = await import("/src/scroll-story/runtime/editorBridge.js");
  const api = bridge.getStoryRuntimeApi();
  const before = window.scrollY;
  api?.scrollToTime?.(520);
  await new Promise((resolve) => requestAnimationFrame(resolve));
  return {
    before: Math.round(before),
    after: Math.round(window.scrollY),
    chapter: document.body.dataset.storyChapter || null,
  };
});

const report = {
  initial,
  samples,
  monotonic,
  interpolated,
  runtimeJump,
  errors,
};

console.log(JSON.stringify(report, null, 2));

await browser.close();

if (
  !initial.lenis ||
  !monotonic ||
  !interpolated ||
  runtimeJump.after === runtimeJump.before ||
  errors.length
) {
  process.exitCode = 1;
}
