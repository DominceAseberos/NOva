import { chromium } from "playwright-core";
import path from "node:path";
import fs from "node:fs";

const browser = await chromium.launch({
  headless: true,
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  args: ["--disable-gpu"],
});

const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(700);

const outDir = path.resolve(".qa-mobile");
fs.mkdirSync(outDir, { recursive: true });

const targets = [
  ["hero", "#top"],
  ["performance", "#performance"],
  ["display", "#display"],
  ["mobility", "#mobility"],
  ["design", "#design"],
  ["final", "#final"],
];

for (const [name, selector] of targets) {
  await page.locator(selector).scrollIntoViewIfNeeded();
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(outDir, name + ".png") });
}

await browser.close();
