import { chromium } from "playwright-core";

const browser = await chromium.launch({
  headless: true,
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  args: ["--disable-gpu", "--use-gl=swiftshader"],
});

const expected = [
  "ARRIVAL","HERO","LIFT",
  "PERFORMANCE","EXTRACT","INTERNALS","REASSEMBLE",
  "DISPLAY","SCREEN","DEPART",
  "MOBILITY","REAR","GLIDE",
  "DETAILS","MECHANICS","RETURN",
  "FINAL","SETTLE","NOVA",
];

function orderedSubset(actual, expectedOrder) {
  let cursor = -1;
  for (const name of actual) {
    const idx = expectedOrder.indexOf(name);
    if (idx < 0) continue;
    if (idx < cursor) return false;
    cursor = idx;
  }
  return true;
}

async function audit(viewport, label) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on("pageerror", e => errors.push("pageerror: " + e.message));
  page.on("console", m => {
    if (m.type() === "error") errors.push("console: " + m.text());
  });

  await page.goto("http://127.0.0.1:5173/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1400);

  const dimensions = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    innerHeight: window.innerHeight,
    width: window.innerWidth,
    overflowX: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) > window.innerWidth + 1,
  }));

  const seen = [];
  let previous = "";
  let loops = 0;
  const step = viewport.width < 600 ? 190 : 260;

  while (loops < 80) {
    const state = await page.evaluate(() => ({
      y: Math.round(window.scrollY),
      max: Math.max(0, document.documentElement.scrollHeight - window.innerHeight),
      chapter: document.querySelector(".persistent-product")?.dataset.chapter || "",
      ready: document.body.classList.contains("nova-persistent-3d-ready"),
      shellConnected: document.querySelector(".persistent-product")?.isConnected ?? false,
    }));

    if (state.chapter && state.chapter !== previous) {
      seen.push(state.chapter);
      previous = state.chapter;
    }

    if (state.y >= state.max - 2) break;
    await page.mouse.wheel(0, step);
    await page.waitForTimeout(12);
    loops += 1;
  }

  await page.waitForTimeout(500);
  const end = await page.evaluate(() => ({
    y: Math.round(window.scrollY),
    max: Math.max(0, document.documentElement.scrollHeight - window.innerHeight),
    chapter: document.querySelector(".persistent-product")?.dataset.chapter || "",
    ready: document.body.classList.contains("nova-persistent-3d-ready"),
    shellConnected: document.querySelector(".persistent-product")?.isConnected ?? false,
  }));
  if (end.chapter && end.chapter !== previous) seen.push(end.chapter);

  const expectedMilestones = ["ARRIVAL","PERFORMANCE","INTERNALS","DISPLAY","MOBILITY","REAR","MECHANICS","FINAL","NOVA"];
  const missing = expectedMilestones.filter(x => !seen.includes(x));

  await page.close();
  return {
    label,
    viewport,
    dimensions,
    end,
    chapterSequence: seen,
    orderValid: orderedSubset(seen, expected),
    missingMilestones: missing,
    errors,
  };
}

const report = [
  await audit({ width: 1440, height: 900 }, "desktop"),
  await audit({ width: 390, height: 844 }, "mobile"),
];

console.log(JSON.stringify(report, null, 2));
await browser.close();