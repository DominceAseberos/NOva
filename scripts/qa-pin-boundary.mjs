import { chromium } from "playwright-core";

const browser = await chromium.launch({
  headless: true,
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  args: ["--use-angle=swiftshader"],
});

const page = await browser.newPage({ viewport: { width: 1536, height: 626 } });
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

const storyInfo = await page.evaluate(async () => {
  const { novaStoryStore } = await import("/src/story/novaStoryStore.js");
  const story = novaStoryStore.get();
  const hero = story.sections.find((s) => s.id === "top");
  return {
    total: story.sections.reduce((sum, s) => sum + Number(s.duration || 0), 0),
    heroDuration: Number(hero.duration),
  };
});

const points = [0.5, 0.9, 0.99, 0.999, 1];
const samples = [];

for (const progress of points) {
  const time = storyInfo.heroDuration * progress;
  await page.evaluate(async (t) => {
    const bridge = await import("/src/scroll-story/runtime/editorBridge.js");
    bridge.getStoryRuntimeApi()?.scrollToTime?.(t);
  }, time);

  await page.waitForTimeout(120);

  samples.push(
    await page.evaluate(({ progress, time }) => {
      const hero = document.querySelector("#top");
      const stage = hero?.querySelector(".hero-stage");
      const perf = document.querySelector("#performance");
      const heroRect = hero?.getBoundingClientRect();
      const stageRect = stage?.getBoundingClientRect();
      const perfRect = perf?.getBoundingClientRect();

      return {
        progress,
        time,
        scrollY: window.scrollY,
        viewportH: window.innerHeight,
        heroHeight: heroRect?.height ?? null,
        heroBottom: heroRect?.bottom ?? null,
        stageTop: stageRect?.top ?? null,
        stageHeight: stageRect?.height ?? null,
        perfTop: perfRect?.top ?? null,
        chapter: document.body.dataset.storyChapter || null,
        sectionAtCenter:
          document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2)
            ?.closest("section")?.id || null,
      };
    }, { progress, time })
  );
}

console.log(JSON.stringify({ storyInfo, samples, errors }, null, 2));

await browser.close();

const beforeEnd = samples.slice(0, -1);
const end = samples.at(-1);

if (
  errors.length ||
  beforeEnd.some((s) => s.stageTop < -1 || s.stageTop > 1) ||
  beforeEnd.some((s) => s.perfTop < s.viewportH - 1) ||
  beforeEnd.some((s) => s.stageHeight < s.viewportH - 1 || s.stageHeight > s.viewportH + 1) ||
  end.perfTop > 1
) {
  process.exitCode = 1;
}
