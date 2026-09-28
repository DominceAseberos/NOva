import { chromium } from "playwright-core";

const browser = await chromium.launch({
  headless: true,
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  args: ["--use-angle=swiftshader"],
});

const page = await browser.newPage({ viewport: { width: 1440, height: 800 } });
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
  bridge.getStoryRuntimeApi()?.scrollToTime?.(60);
});
await page.waitForTimeout(120);

const read = () =>
  page.evaluate(async () => {
    const { novaStoryStore } = await import("/src/story/novaStoryStore.js");
    const story = novaStoryStore.get();
    const hero = story.sections.find((s) => s.id === "top");
    const root = document.querySelector("#top");
    return {
      duration: Number(hero.duration),
      pinned: Boolean(hero.pin?.enabled),
      scrollY: window.scrollY,
      height: root?.getBoundingClientRect().height ?? 0,
      status: document.querySelector(".sse-status")?.textContent || "",
    };
  });

const before = await read();

await page.keyboard.down("p");
await page.mouse.wheel(0, 400);
await page.waitForTimeout(80);
const during1 = await read();

await page.mouse.wheel(0, 600);
await page.waitForTimeout(80);
const during2 = await read();

await page.keyboard.up("p");
await page.waitForTimeout(120);
const after = await read();

console.log(JSON.stringify({ before, during1, during2, after, errors }, null, 2));

await browser.close();

if (
  errors.length ||
  during1.duration <= before.duration ||
  during2.duration <= during1.duration ||
  Math.abs(during1.scrollY - before.scrollY) > 1 ||
  Math.abs(during2.scrollY - before.scrollY) > 1 ||
  after.duration !== during2.duration ||
  after.height <= before.height
) {
  process.exitCode = 1;
}
