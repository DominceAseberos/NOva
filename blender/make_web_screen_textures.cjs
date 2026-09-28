const sharp = require("sharp");
const fs = require("fs");
fs.mkdirSync("assets/3d/textures/web", { recursive: true });

(async () => {
  await sharp("assets/3d/textures/nova_screen.png")
    .resize(1024, 640, { fit: "cover" })
    .webp({ quality: 90 })
    .toFile("assets/3d/textures/web/screen-hero.webp");

  await sharp("assets/display/display-screen-visual.webp")
    .resize(1024, 640, { fit: "cover" })
    .webp({ quality: 88 })
    .toFile("assets/3d/textures/web/screen-display.webp");

  await sharp("assets/mobility/mobility-background.webp")
    .resize(1024, 640, { fit: "cover", position: "centre" })
    .webp({ quality: 85 })
    .toFile("assets/3d/textures/web/screen-mobility.webp");

  await sharp("assets/final/final-background.webp")
    .resize(1024, 640, { fit: "cover", position: "centre" })
    .webp({ quality: 88 })
    .toFile("assets/3d/textures/web/screen-final.webp");

  const perf = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="640">
  <defs>
    <radialGradient id="g"><stop stop-color="#12334d"/><stop offset="1" stop-color="#03070b"/></radialGradient>
    <linearGradient id="l"><stop stop-color="#62c5ff" stop-opacity=".08"/><stop offset=".5" stop-color="#62c5ff" stop-opacity=".8"/><stop offset="1" stop-color="#ff8a4a" stop-opacity=".12"/></linearGradient>
  </defs>
  <rect width="1024" height="640" fill="url(#g)"/>
  <g fill="none" stroke="url(#l)" stroke-width="8" opacity=".9">
    <path d="M-80 430 C180 190 310 540 540 310 S840 160 1120 320"/>
    <path d="M-80 500 C220 280 330 590 560 360 S840 220 1120 390" stroke-width="3"/>
  </g>
  <g fill="#78d5ff" opacity=".18"><circle cx="710" cy="160" r="90"/><circle cx="760" cy="180" r="48"/></g>
</svg>`;

  await sharp(Buffer.from(perf))
    .webp({ quality: 88 })
    .toFile("assets/3d/textures/web/screen-performance.webp");

  console.log("screen textures ready");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
