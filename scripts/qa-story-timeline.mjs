import fs from "node:fs";
import { chromium } from "playwright-core";

const story = JSON.parse(fs.readFileSync("src/story/nova-story.json", "utf8"));
const sections = new Map();
let cursor = 0;
for (const section of story.sections) {
  const duration = Math.max(1, Number(section.duration) || 1);
  sections.set(section.id, { start: cursor, duration });
  cursor += duration;
}

const checkpoints = (story.tracks?.product || [])
  .map((keyframe) => {
    const section = sections.get(keyframe.section);
    return {
      id: keyframe.id,
      chapter: keyframe.chapter,
      time: section.start + section.duration * Number(keyframe.progress || 0),
    };
  })
  .sort((a, b) => a.time - b.time);

const browser = await chromium.launch({
  headless: true,
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  args: ["--use-angle=swiftshader"],
});

async function audit(viewport, label) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on("pageerror", (e) => errors.push("page: " + e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push("console: " + m.text());
  });

  await page.goto("http://127.0.0.1:5173/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => document.body.classList.contains("nova-persistent-3d-ready"),
    null,
    { timeout: 15000 }
  );

  const actual = [];
  for (const checkpoint of checkpoints) {
    await page.evaluate(async (time) => {
      const bridge = await import("/src/scroll-story/runtime/editorBridge.js");
      bridge.getStoryRuntimeApi()?.scrollToTime?.(time);
    }, checkpoint.time);
    await page
      .waitForFunction(
        (expectedChapter) =>
          document.body.dataset.storyChapter === expectedChapter,
        checkpoint.chapter,
        { timeout: 2500 }
      )
      .catch(() => {});

    const state = await page.evaluate(() => ({
      y: Math.round(window.scrollY),
      chapter: document.body.dataset.storyChapter || null,
      ready: document.body.classList.contains("nova-persistent-3d-ready"),
      connected: document.querySelector(".persistent-product")?.isConnected ?? false,
      overflowX:
        Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) >
        window.innerWidth + 1,
    }));
    actual.push({
      id: checkpoint.id,
      expectedChapter: checkpoint.chapter,
      time: checkpoint.time,
      ...state,
    });
  }

  const chapters = actual.map((item) => item.chapter);
  const expected = checkpoints.map((item) => item.chapter);
  const exactOrder =
    chapters.length === expected.length &&
    chapters.every((chapter, index) => chapter === expected[index]);

  await page.close();
  return {
    label,
    viewport,
    exactOrder,
    expected,
    actual: actual.map(
      ({ id, expectedChapter, chapter, time, y, ready, connected, overflowX }) => ({
        id,
        expectedChapter,
        chapter,
        time,
        y,
        ready,
        connected,
        overflowX,
      })
    ),
    errors,
  };
}

const report = [
  await audit({ width: 1440, height: 900 }, "desktop"),
  await audit({ width: 390, height: 844 }, "mobile"),
];

console.log(JSON.stringify(report, null, 2));

const failures = report.flatMap((item) => {
  const issues = [];
  if (!item.exactOrder) issues.push(item.label + ": chapter order mismatch");
  if (item.errors.length) issues.push(item.label + ": runtime errors");
  if (item.actual.some((state) => !state.ready || !state.connected)) {
    issues.push(item.label + ": persistent 3D runtime disconnected");
  }
  if (item.actual.some((state) => state.overflowX)) {
    issues.push(item.label + ": horizontal overflow");
  }
  return issues;
});

await browser.close();
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
}
