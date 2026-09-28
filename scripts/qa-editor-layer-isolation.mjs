import { chromium } from "playwright-core";

const browser = await chromium.launch({
  headless: true,
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  args: ["--use-angle=swiftshader"],
});

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => localStorage.clear());

const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});

await page.goto("http://127.0.0.1:5173/?editor=1", {
  waitUntil: "domcontentloaded",
});

await page.waitForFunction(
  () => document.body.classList.contains("nova-persistent-3d-ready"),
  null,
  { timeout: 15000 }
);
await page.waitForTimeout(350);

const result = await page.evaluate(() => {
  const product = document.querySelector(".persistent-product");
  const canvas = document.querySelector(".persistent-product-canvas");
  const editor = document.querySelector(".sse");
  const main = document.querySelector("main");
  const nav = document.querySelector(".site-nav");
  const footer = document.querySelector(".footer");
  const heading = document.querySelector(".hero-copy h1");

  const numericZ = (element) => {
    if (!element) return null;
    const raw = getComputedStyle(element).zIndex;
    const value = Number(raw);
    return Number.isFinite(value) ? value : 0;
  };

  const pageElements = [...document.querySelectorAll("body *")].filter(
    (element) =>
      !element.closest(".sse") &&
      !element.closest(".persistent-product")
  );

  const pageZ = pageElements
    .map((element) => ({
      tag: element.tagName,
      cls: element.className,
      z: numericZ(element),
    }))
    .filter((item) => item.z !== null)
    .sort((a, b) => b.z - a.z);

  const pointInfo = (x, y) => {
    const el = document.elementFromPoint(x, y);
    return {
      tag: el?.tagName || null,
      cls: el?.className || null,
      isCanvas: el === canvas,
      inEditor: Boolean(el?.closest?.(".sse")),
    };
  };

  const headingRect = heading?.getBoundingClientRect();
  const navRect = nav?.getBoundingClientRect();
  const editorRect = editor?.getBoundingClientRect();

  return {
    productParentClass: product?.parentElement?.className || null,
    productZ: numericZ(product),
    editorZ: numericZ(editor),
    maxPageZ: pageZ[0] || null,
    pointerEvents: {
      product: product ? getComputedStyle(product).pointerEvents : null,
      canvas: canvas ? getComputedStyle(canvas).pointerEvents : null,
      main: main ? getComputedStyle(main).pointerEvents : null,
      nav: nav ? getComputedStyle(nav).pointerEvents : null,
      footer: footer ? getComputedStyle(footer).pointerEvents : null,
    },
    selection: {
      main: main ? getComputedStyle(main).userSelect : null,
      heading: heading ? getComputedStyle(heading).userSelect : null,
    },
    points: {
      heroText: headingRect
        ? pointInfo(
            headingRect.left + Math.min(100, headingRect.width / 2),
            headingRect.top + Math.min(60, headingRect.height / 2)
          )
        : null,
      nav: navRect
        ? pointInfo(navRect.left + navRect.width / 2, navRect.top + 30)
        : null,
      editor: editorRect
        ? pointInfo(editorRect.left + 120, editorRect.top + 24)
        : null,
    },
    errors: [],
  };
});

result.errors = errors;
console.log(JSON.stringify(result, null, 2));

await browser.close();

if (
  !result.productParentClass?.includes("app-shell") ||
  result.productZ <= (result.maxPageZ?.z ?? 0) ||
  result.editorZ <= result.productZ ||
  result.pointerEvents.main !== "none" ||
  result.pointerEvents.nav !== "none" ||
  result.pointerEvents.footer !== "none" ||
  result.selection.main !== "none" ||
  !result.points.heroText?.isCanvas ||
  !result.points.nav?.isCanvas ||
  !result.points.editor?.inEditor ||
  errors.length
) {
  process.exitCode = 1;
}
