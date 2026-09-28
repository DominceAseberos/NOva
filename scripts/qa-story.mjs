import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const browser = await chromium.launch({
  headless: true,
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  args: ["--disable-gpu", "--use-gl=swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });

await page.goto("http://127.0.0.1:5173/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1600);
await page.evaluate(() => document.fonts.ready);

const out = path.resolve(".qa-story");
fs.mkdirSync(out, { recursive: true });

const defs = [
  ["hero-arrival", "top", 0.08],
  ["hero-face", "top", 0.42],
  ["hero-lift", "top", 0.84],
  ["performance-land", "performance", 0.16],
  ["performance-extract", "performance", 0.42],
  ["performance-internals", "performance", 0.62],
  ["performance-reassemble", "performance", 0.88],
  ["display", "display", 0.42],
  ["mobility-side", "mobility", 0.30],
  ["mobility-rear", "mobility", 0.70],
  ["design", "design", 0.50],
  ["final", "final", 0.72],
];

const report = [];
for (const [name, id, fraction] of defs) {
  const metrics = await page.locator("#" + id).evaluate((el) => ({
    top: el.offsetTop,
    height: el.offsetHeight,
  }));
  const desiredCenter = metrics.top + metrics.height * fraction;
  const y = Math.max(0, desiredCenter - 900 * 0.52);
  await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y);
  await page.waitForTimeout(420);
  const state = await page.evaluate(() => ({
    chapter: document.querySelector(".persistent-product")?.dataset.chapter || "",
    ready: document.body.classList.contains("nova-persistent-3d-ready"),
    scrollY: Math.round(window.scrollY),
  }));
  report.push({ name, ...state });
  await page.screenshot({ path: path.join(out, name + ".png") });
}

console.log(JSON.stringify({ report, errors }, null, 2));
await browser.close();
process.exit(0);
