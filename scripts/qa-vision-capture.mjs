import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import sharp from "sharp";

const story = JSON.parse(fs.readFileSync("src/story/nova-story.json", "utf8"));
const sections = new Map();
let totalDuration = 0;
for (const section of story.sections) {
  const duration = Math.max(1, Number(section.duration) || 1);
  sections.set(section.id, { start: totalDuration, duration });
  totalDuration += duration;
}

const outDir = path.resolve("qa-artifacts/vision/latest");
const rawDir = path.join(outDir, "raw");
const gridDir = path.join(outDir, "grid");
const sheetDir = path.join(outDir, "sheets");

fs.mkdirSync(rawDir, { recursive: true });
fs.mkdirSync(gridDir, { recursive: true });
fs.mkdirSync(sheetDir, { recursive: true });

// Build checkpoint list from story keyframes
const rawCheckpoints = (story.tracks?.product || [])
  .map((k) => {
    const s = sections.get(k.section) || { start: 0, duration: 100 };
    return {
      id: k.id,
      chapter: k.chapter || k.id,
      section: k.section,
      time: s.start + s.duration * Number(k.progress || 0),
    };
  })
  .sort((a, b) => a.time - b.time);

// Deduplicate by chapter name to keep an essential set of representative keyframes
const seenChapters = new Set();
const checkpoints = [];
for (const c of rawCheckpoints) {
  if (!seenChapters.has(c.chapter)) {
    seenChapters.add(c.chapter);
    checkpoints.push(c);
  }
}

console.log(`Prepared ${checkpoints.length} primary chapter checkpoints for vision audit.`);

const browser = await chromium.launch({
  headless: true,
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto("http://127.0.0.1:5173/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => document.body.classList.contains("nova-persistent-3d-ready"),
    null,
    { timeout: 25000 }
  );
  await page.waitForTimeout(2000);

  const manifest = [];
  const framesBySection = new Map();

  // Create an SVG grid overlay for measurement (12 columns, Nav Safe Zone, Copy Zone, Visual Stage)
  const gridSvg = Buffer.from(`
    <svg width="1440" height="900" viewBox="0 0 1440 900" xmlns="http://www.w3.org/2000/svg">
      <!-- Nav Safe Zone (0-80px) -->
      <rect x="0" y="0" width="1440" height="80" fill="none" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="4 4" opacity="0.6"/>
      <text x="16" y="24" fill="#ef4444" font-family="sans-serif" font-size="11" font-weight="bold" opacity="0.75">NAV SAFE ZONE (0-80px)</text>

      <!-- Copy Column Safe Zone (36-520px) -->
      <rect x="36" y="90" width="484" height="780" fill="none" stroke="#3b82f6" stroke-width="1.5" stroke-dasharray="4 4" opacity="0.5"/>
      <text x="44" y="112" fill="#3b82f6" font-family="sans-serif" font-size="11" font-weight="bold" opacity="0.75">EDITORIAL COPY ZONE (Cols 1-5)</text>

      <!-- 3D Visual Stage Zone (540-1400px) -->
      <rect x="540" y="90" width="860" height="780" fill="none" stroke="#10b981" stroke-width="1.5" stroke-dasharray="4 4" opacity="0.5"/>
      <text x="548" y="112" fill="#10b981" font-family="sans-serif" font-size="11" font-weight="bold" opacity="0.75">PRIMARY 3D STAGE (Cols 6-12)</text>

      <!-- 12-Column Layout Lines -->
      ${Array.from({ length: 11 }, (_, i) => {
        const x = (i + 1) * 120;
        return `<line x1="${x}" y1="0" x2="${x}" y2="900" stroke="#64748b" stroke-width="0.5" stroke-dasharray="2 4" opacity="0.3"/>`;
      }).join("")}
    </svg>
  `);

  for (let idx = 0; idx < checkpoints.length; idx++) {
    const cp = checkpoints[idx];
    const prefix = String(idx).padStart(2, "0");
    const rawPath = path.join(rawDir, `${prefix}_${cp.chapter}.png`);
    const gridPath = path.join(gridDir, `${prefix}_${cp.chapter}_grid.png`);

    await page.evaluate(async (time) => {
      const bridge = await import("/src/scroll-story/runtime/editorBridge.js");
      bridge.getStoryRuntimeApi()?.scrollToTime?.(time);
    }, cp.time);

    await page.waitForTimeout(1400);

    const frameInfo = await page.evaluate(() => {
      const activePanel = document.querySelector(".story-panel.is-active") ||
        document.querySelector(`.story-panel[data-story-panel="${document.body.dataset.storyChapter}"]`);
      return {
        activeChapter: document.body.dataset.storyChapter || "",
        panelTitle: activePanel?.querySelector("h2")?.textContent?.trim() || "",
        panelEyebrow: activePanel?.querySelector(".eyebrow")?.textContent?.trim() || "",
        hudLabel: document.querySelector(".persistent-product-hud span")?.textContent?.trim() || "",
        scrollY: window.scrollY,
      };
    });

    await page.screenshot({ path: rawPath });

    // Composite measurement grid overlay
    await sharp(rawPath)
      .composite([{ input: gridSvg, top: 0, left: 0 }])
      .toFile(gridPath);

    const meta = {
      index: idx,
      chapter: cp.chapter,
      section: cp.section,
      time: cp.time,
      rawFile: `${prefix}_${cp.chapter}.png`,
      gridFile: `${prefix}_${cp.chapter}_grid.png`,
      ...frameInfo,
    };
    manifest.push(meta);

    if (!framesBySection.has(cp.section)) {
      framesBySection.set(cp.section, []);
    }
    framesBySection.get(cp.section).push(rawPath);

    console.log(`[${prefix}/${checkpoints.length - 1}] Captured: ${cp.chapter} (Section: ${cp.section})`);
  }

  // Generate stitched contact sheets per section using sharp
  for (const [sectionId, fileList] of framesBySection.entries()) {
    if (fileList.length === 0) continue;
    const thumbs = await Promise.all(
      fileList.map((f) => sharp(f).resize({ width: 480 }).toBuffer())
    );
    const cols = Math.min(3, thumbs.length);
    const rows = Math.ceil(thumbs.length / cols);
    const cellW = 480;
    const cellH = 300; // 480 * (900/1440) = 300
    const composites = thumbs.map((buf, i) => ({
      input: buf,
      left: (i % cols) * cellW,
      top: Math.floor(i / cols) * cellH,
    }));

    const sheetPath = path.join(sheetDir, `sheet_${sectionId}.jpg`);
    await sharp({
      create: {
        width: cols * cellW,
        height: rows * cellH,
        channels: 3,
        background: { r: 10, g: 14, b: 20 },
      },
    })
      .composite(composites)
      .jpeg({ quality: 88 })
      .toFile(sheetPath);

    console.log(`Generated Contact Sheet: ${sheetPath}`);
  }

  fs.writeFileSync(
    path.join(outDir, "manifest.json"),
    JSON.stringify({ timestamp: new Date().toISOString(), totalFrames: manifest.length, frames: manifest }, null, 2)
  );
  console.log(`\nVision QA capture suite successfully generated in: ${outDir}\n`);
} finally {
  await browser.close();
}
