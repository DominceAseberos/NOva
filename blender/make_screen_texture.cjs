const sharp = require("sharp");
const fs = require("fs");

fs.mkdirSync("assets/3d/textures", { recursive: true });

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000">
  <defs>
    <radialGradient id="bg" cx="50%" cy="44%" r="72%">
      <stop offset="0" stop-color="#0b1725"/>
      <stop offset="0.48" stop-color="#07101a"/>
      <stop offset="1" stop-color="#020407"/>
    </radialGradient>
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="14" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <rect width="1600" height="1000" fill="url(#bg)"/>
  <text
    x="800"
    y="535"
    text-anchor="middle"
    font-family="Arial, Helvetica, sans-serif"
    font-size="310"
    font-weight="700"
    letter-spacing="24"
    fill="#f4f7fb"
    filter="url(#glow)"
  >NOVA</text>
</svg>`;

sharp(Buffer.from(svg))
  .png()
  .toFile("assets/3d/textures/nova_screen.png")
  .then(() => console.log("NOVA screen texture written"));
