import { chromium } from "playwright-core";

const browser = await chromium.launch({
  headless: true,
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  args: ["--use-angle=swiftshader"],
});

const page = await browser.newPage({ viewport: { width: 1500, height: 980 } });
const errors = [];
page.on("pageerror", (error) => errors.push("page: " + error.message));
page.on("console", (message) => {
  if (message.type() === "error") errors.push("console: " + message.text());
});

await page.goto("http://127.0.0.1:5173/?editor=1", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);

const state = await page.evaluate(() => ({
  editor: Boolean(document.querySelector(".sse")),
  ready: document.body.classList.contains("nova-persistent-3d-ready"),
  editorClass: document.body.classList.contains("scroll-story-editor-active"),
  chapter: document.body.dataset.storyChapter || null,
  sectionHeights: [...document.querySelectorAll("[data-story-section]")].map((el) => ({
    id: el.dataset.storySection,
    height: Math.round(el.getBoundingClientRect().height),
  })),
  canvasPointerEvents: getComputedStyle(document.querySelector(".persistent-product")).pointerEvents,
}));

await page.screenshot({ path: ".qa-scroll-story-editor.png", fullPage: false });
console.log(JSON.stringify({ state, errors }, null, 2));

await browser.close();
