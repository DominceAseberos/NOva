import { chromium } from "playwright-core";

const browser = await chromium.launch({
  headless: true,
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  args: ["--disable-gpu"],
});

const widths = [390, 768, 1024, 1440, 1920];
const report = [];

for (const width of widths) {
  const height = width <= 500 ? 844 : width <= 800 ? 1024 : 900;
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);

  const metrics = await page.evaluate(() => {
    const sections = [...document.querySelectorAll("main > section")];
    const headings = [...document.querySelectorAll("h1,h2")];
    return {
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      overflowX: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) > window.innerWidth + 1,
      sectionCount: sections.length,
      headingCount: headings.length,
      navVisible: getComputedStyle(document.querySelector(".site-nav")).display !== "none",
      footerVisible: !!document.querySelector(".footer"),
    };
  });

  report.push({ width, height, ...metrics, errors });
  await page.close();
}

console.log(JSON.stringify(report, null, 2));
await browser.close();
