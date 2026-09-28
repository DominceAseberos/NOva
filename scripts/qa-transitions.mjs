import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const browser = await chromium.launch({
  headless: true,
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  args: ["--disable-gpu"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(500);

const dir = path.resolve(".qa-transition");
fs.mkdirSync(dir, { recursive: true });

const selectors = ["#performance","#display","#mobility","#design","#final"];
for (let i=0;i<selectors.length;i++) {
  const top = await page.locator(selectors[i]).evaluate((el) => el.offsetTop);
  const y = Math.max(0, top - Math.round(900 * 0.52));
  await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y);
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(dir, String(i+1).padStart(2,"0") + ".png") });
}
await browser.close();
