import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const [name="shot", id="performance", fractionArg="0.5", widthArg="1440", heightArg="900"] = process.argv.slice(2);
const fraction = Number(fractionArg);
const width = Number(widthArg);
const height = Number(heightArg);

const browser = await chromium.launch({
  headless: true,
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  args: ["--disable-gpu", "--use-gl=swiftshader"],
});
const page = await browser.newPage({ viewport: { width, height } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

await page.goto("http://127.0.0.1:5173/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
const metrics = await page.locator("#" + id).evaluate((el) => ({ top: el.offsetTop, height: el.offsetHeight }));
const desired = metrics.top + metrics.height * fraction;
const y = Math.max(0, desired - height * 0.52);
await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y);
await page.waitForTimeout(900);

const out = path.resolve(".qa-story-single");
fs.mkdirSync(out, { recursive: true });
await page.screenshot({ path: path.join(out, name + ".png") });

const state = await page.evaluate(() => ({
  chapter: document.querySelector(".persistent-product")?.dataset.chapter || "",
  ready: document.body.classList.contains("nova-persistent-3d-ready"),
  bodyChapter: document.body.dataset.storyChapter || "",
  scrollY: Math.round(window.scrollY),
}));
console.log(JSON.stringify({ name, id, fraction, state, errors }, null, 2));
await browser.close();
process.exit(0);
