import { chromium } from "playwright-core";

const browser = await chromium.launch({
  headless: true,
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  args: ["--disable-gpu"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.addInitScript(() => {
  window.__qa = { lcp: 0, cls: 0, longTasks: [] };
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) window.__qa.lcp = Math.max(window.__qa.lcp, e.startTime);
  }).observe({ type: "largest-contentful-paint", buffered: true });
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      if (!e.hadRecentInput) window.__qa.cls += e.value;
    }
  }).observe({ type: "layout-shift", buffered: true });
  if (PerformanceObserver.supportedEntryTypes.includes("longtask")) {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__qa.longTasks.push(e.duration);
    }).observe({ type: "longtask", buffered: true });
  }
});

const qaUrl = process.env.QA_URL || "http://127.0.0.1:5173/";
await page.goto(qaUrl, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);

const result = await page.evaluate(() => {
  const resources = performance.getEntriesByType("resource");
  const sameOrigin = resources.filter((r) => r.name.startsWith(location.origin));
  const images = sameOrigin.filter((r) => r.initiatorType === "img");
  const scripts = sameOrigin.filter((r) => r.initiatorType === "script");
  const styles = sameOrigin.filter((r) => r.initiatorType === "link" || r.initiatorType === "css");
  const sum = (items, key) => items.reduce((n, r) => n + (r[key] || 0), 0);

  return {
    navigationMs: performance.getEntriesByType("navigation")[0]?.duration ?? null,
    totalSameOriginTransferKB: Math.round(sum(sameOrigin, "transferSize") / 1024),
    imageTransferKB: Math.round(sum(images, "transferSize") / 1024),
    scriptTransferKB: Math.round(sum(scripts, "transferSize") / 1024),
    styleTransferKB: Math.round(sum(styles, "transferSize") / 1024),
    loadedImageCount: images.length,
    lcpMs: Math.round(window.__qa.lcp),
    cls: Number(window.__qa.cls.toFixed(4)),
    longTaskCount: window.__qa.longTasks.length,
    longestTaskMs: Math.round(Math.max(0, ...window.__qa.longTasks)),
  };
});

console.log(JSON.stringify(result, null, 2));
await browser.close();
