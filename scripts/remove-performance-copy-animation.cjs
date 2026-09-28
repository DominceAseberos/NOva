const fs = require("fs");
let s = fs.readFileSync("src/App.jsx", "utf8");
const start = s.indexOf('      gsap.from(".performance-copy > *", {');
const endMarker = '      gsap.to(".display-bg", {';
const end = s.indexOf(endMarker, start);
if (start >= 0 && end > start) {
  s = s.slice(0, start) + endMarker + s.slice(end + endMarker.length);
}
fs.writeFileSync("src/App.jsx", s);
