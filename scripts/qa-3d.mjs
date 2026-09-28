import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const browser = await chromium.launch({
  headless: true,
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  args: ["--disable-gpu", "--use-gl=swiftshader"],
});

const out = path.resolve(".qa-3d");
fs.mkdirSync(out, { recursive: true });

async function run(viewport, prefix) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle" });
  await page.locator("#three-d").scrollIntoViewIfNeeded();
  await page.waitForTimeout(1400);

  const section = await page.locator("#three-d").evaluate((el) => ({
    top: el.offsetTop,
    height: el.offsetHeight,
    viewport: window.innerHeight,
  }));

  const range = Math.max(1, section.height - section.viewport);
  const stops = [
    ["front", section.top + 5],
    ["side", section.top + range * 0.5],
    ["rear", section.top + range - 5],
  ];

  const states = [];
  for (const [name, y] of stops) {
    await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y);
    await page.waitForTimeout(900);
    const state = await page.locator("#three-d").evaluate((el) => ({
      progress: getComputedStyle(el).getPropertyValue("--orbit-progress").trim(),
      canvasWidth: el.querySelector("canvas")?.getBoundingClientRect().width ?? 0,
      canvasHeight: el.querySelector("canvas")?.getBoundingClientRect().height ?? 0,
      loadingVisible: !!el.querySelector(".product3d-loading"),
    }));
    states.push({ name, ...state });
    await page.screenshot({ path: path.join(out, prefix + "-" + name + ".png") });
  }

  await page.close();
  return { prefix, states, errors };
}

const report = [
  await run({ width: 1440, height: 900 }, "desktop"),
  await run({ width: 390, height: 844 }, "mobile"),
];

console.log(JSON.stringify(report, null, 2));
await browser.close();
