import fs from "node:fs";

const path = "src/story/nova-story.json";
const story = JSON.parse(fs.readFileSync(path, "utf8"));

story.sections = [
  { id: "top", label: "Hero", selector: "#top", stageSelector: ".hero-stage", duration: 320, pin: { enabled: true } },
  { id: "performance", label: "Internals", selector: "#performance", stageSelector: ".scene-stage", duration: 520, pin: { enabled: true } },
  { id: "display", label: "Exterior", selector: "#display", stageSelector: ".scene-stage", duration: 330, pin: { enabled: true } },
  { id: "mobility", label: "Hardware", selector: "#mobility", stageSelector: ".scene-stage", duration: 220, pin: { enabled: true } },
  { id: "design", label: "Design", selector: "#design", stageSelector: ".scene-stage", duration: 220, pin: { enabled: true } },
  { id: "final", label: "Final", selector: "#final", stageSelector: ".scene-stage", duration: 180, pin: { enabled: true } },
];

const defaultState = {
  x: 0.82, y: 0.02, z: 0,
  rx: -0.06, ry: -0.12, rz: 0.01,
  scale: 0.86,
  lid: 1,
  keyboardLight: 1,
  explodeEnabled: true,
  explode: 0,
  parts: {},
  screen: 0,
  cool: 2.8,
  warm: 1.1,
  ambient: 1.25,
  shadow: 0.5,
  opacity: 1,
};

const S = (overrides = {}) => ({ ...structuredClone(defaultState), ...overrides });
const P = (visible = true, position = [0,0,0], scale = [1,1,1], rotation = [0,0,0]) => ({
  visible, position, rotation, scale
});
const K = (id, section, progress, chapter, state, ease = "smooth") => ({
  id, section, progress, chapter, ease, state
});

const oldTop = (story.tracks?.product || [])
  .filter((k) => k.section === "top")
  .map((k) => ({
    ...k,
    state: {
      ...S(k.state || {}),
      ...(k.state || {}),
      lid: k.id === "arrival" ? 0.08 : 1,
      keyboardLight: k.id === "arrival" ? 0 : 1,
    },
  }))
  .sort((a,b) => a.progress - b.progress);

const arrival = oldTop[0] || K("arrival", "top", 0, "ARRIVAL", S({x:1.1,y:.08,z:.58,rx:.75,ry:-.69,rz:.61,scale:.74,lid:.08,keyboardLight:0}));
const heroOpen = K("hero-open", "top", 0.10, "ARRIVAL", S({...arrival.state, lid: 1, keyboardLight: .15}));
const heroLight = K("hero-light", "top", 0.18, "ARRIVAL", S({...arrival.state, lid: 1, keyboardLight: 1}));
const preservedTop = oldTop.filter((k) => k.progress > 0.20).map((k) => ({
  ...k,
  chapter: "ARRIVAL",
  state:{...k.state,lid:1,keyboardLight:1}
}));

const internalBase = S({
  x: .88, y: -.04, z: 0,
  rx: 2.7085, ry: -.93827, rz: 2.80746,
  scale: .58, explode: 1, lid: 1, keyboardLight: .25,
  cool: 3.0, warm: .65, ambient: 1.08, shadow: .32
});

const performance = [
  K("perf-intro","performance",0.02,"PERFORMANCE",S({x:.76,y:.03,z:.18,rx:.34,ry:.02,rz:-.01,scale:.82,lid:1,keyboardLight:1,explode:0})),
  K("perf-explode","performance",0.11,"EXPLODE",internalBase),
  K("perf-board","performance",0.22,"MOTHERBOARD",S({...internalBase,scale:.62,parts:{motherboard:P(true,[0,0,0],[1.32,1.32,1.32])}})),
  K("perf-gpu","performance",0.34,"GPU",S({...internalBase,scale:.67,parts:{gpu:P(true,[0,0,0],[4.0,4.0,4.0])}})),
  K("perf-cpu","performance",0.45,"CPU",S({...internalBase,scale:.67,parts:{cpu:P(true,[0,0,0],[4.0,4.0,4.0])}})),
  K("perf-memory","performance",0.56,"MEMORY",S({...internalBase,scale:.64,parts:{
    ram1:P(true,[0,0,0],[2.25,2.25,2.25]),
    ram2:P(true,[0,0,0],[2.25,2.25,2.25])
  }})),
  K("perf-storage","performance",0.66,"STORAGE",S({...internalBase,scale:.66,parts:{ssd:P(true,[0,0,-0.060],[3.8,3.8,3.8])}})),
  K("perf-cooling","performance",0.77,"COOLING",S({...internalBase,scale:.61,parts:{
    fanLeft:P(true,[0,0,0],[1.30,1.30,1.30]),
    fanRight:P(true,[0,0,0],[1.30,1.30,1.30]),
    heatPipe1:P(true,[0,0,0],[1.20,1.20,1.20]),
    heatPipe2:P(true,[0,0,0],[1.20,1.20,1.20]),
    heatsinkLeft:P(true,[0,0,0],[1.24,1.24,1.24]),
    heatsinkRight:P(true,[0,0,0],[1.24,1.24,1.24])
  }})),
  K("perf-battery","performance",0.87,"BATTERY",S({...internalBase,scale:.61,parts:{
    battery1:P(true,[0,0,0],[1.20,1.20,1.20]),
    battery2:P(true,[0,0,0],[1.20,1.20,1.20]),
    battery3:P(true,[0,0,0],[1.20,1.20,1.20]),
    battery4:P(true,[0,0,0],[1.20,1.20,1.20])
  }})),
  K("perf-reassemble","performance",0.98,"REASSEMBLE",S({x:.83,y:.03,z:0,rx:.24,ry:-.28,rz:-.04,scale:.76,lid:1,keyboardLight:1,explode:0}))
];

const display = [
  K("ext-display","display",0.02,"DISPLAY",S({x:.82,y:.02,rx:-.07,ry:-.16,rz:.01,scale:.9,lid:1,keyboardLight:1})),
  K("ext-screen-thin","display",0.24,"SCREEN_THIN",S({x:1.05,y:.01,rx:0,ry:-1.57,rz:0,scale:1.18,lid:1,keyboardLight:.28,shadow:.28})),
  K("ext-profile","display",0.44,"PROFILE",S({x:1.04,y:.02,rx:0,ry:-1.57,rz:0,scale:1.22,lid:.02,keyboardLight:0,shadow:.24})),
  K("ext-keyboard-a","display",0.60,"KEYBOARD",S({x:1.05,y:-.10,rx:.62,ry:-.18,rz:-.03,scale:1.58,lid:.78,keyboardLight:1,shadow:.28})),
  K("ext-keyboard-b","display",0.76,"KEYBOARD",S({x:.72,y:-.10,rx:.62,ry:-.12,rz:-.02,scale:1.62,lid:.78,keyboardLight:1,shadow:.28})),
  K("ext-touchpad","display",0.94,"TOUCHPAD",S({x:.96,y:.10,rx:.68,ry:-.10,rz:-.02,scale:1.48,lid:.82,keyboardLight:.45,shadow:.26}))
];

const mobility = [
  K("hw-ports-a","mobility",0.05,"PORTS_RIGHT",S({x:1.04,y:-.02,rx:0,ry:-1.57,rz:0,scale:1.20,lid:.03,keyboardLight:0,shadow:.18,cool:2.2,warm:.62,ambient:1.05})),
  K("hw-ports-b","mobility",0.30,"PORTS_LEFT",S({x:1.04,y:-.02,rx:0,ry:1.57,rz:0,scale:1.20,lid:.03,keyboardLight:0,shadow:.18,cool:2.2,warm:.62,ambient:1.05})),
  K("hw-exhaust","mobility",0.58,"EXHAUST",S({x:1.12,y:-.02,rx:.42,ry:3.06,rz:0,scale:1.02,lid:.56,keyboardLight:.06,shadow:.18,cool:2.5,warm:.82,ambient:1.0})),
  K("hw-speakers","mobility",0.86,"SPEAKERS",S({x:1.12,y:-.06,rx:.88,ry:-.08,rz:-.03,scale:.98,lid:.66,keyboardLight:.48,shadow:.20,cool:2.0,warm:.55,ambient:1.1}))
];

const design = [
  K("design-hinge","design",0.08,"HINGE",S({x:1.10,y:-.01,rx:.38,ry:3.02,rz:0,scale:1.04,lid:.62,keyboardLight:.08,shadow:.16,cool:2.45,warm:.9,ambient:1.0})),
  K("design-edge","design",0.46,"EDGE",S({x:1.10,y:.04,rx:.10,ry:1.28,rz:.02,scale:1.03,lid:.42,keyboardLight:.10,shadow:.20,cool:2.6,warm:1.0})),
  K("design-closeup","design",0.84,"CLOSEUP",S({x:1.00,y:0,rx:.42,ry:-.36,rz:-.04,scale:1.02,lid:.92,keyboardLight:.78,shadow:.38,cool:2.9,warm:1.15}))
];

const final = [
  K("final-open","final",0.05,"FINAL",S({x:.78,y:.03,rx:-.06,ry:-.18,rz:.01,scale:.88,lid:1,keyboardLight:1,shadow:.5})),
  K("final-close-start","final",0.34,"CLOSE",S({x:.52,y:.04,rx:-.02,ry:.55,rz:.01,scale:1.0,lid:1,keyboardLight:1,shadow:.42})),
  K("final-close-end","final",0.68,"CLOSE",S({x:.30,y:.08,rx:.01,ry:.9,rz:0,scale:1.08,lid:0,keyboardLight:0,shadow:.32})),
  K("final-nova","final",0.90,"NOVA",S({x:.46,y:.04,rx:.08,ry:-.62,rz:-.02,scale:1.0,lid:0,keyboardLight:0,shadow:.38,cool:2.4,warm:1.2,ambient:1.0}))
];

story.tracks = story.tracks || {};
story.tracks.product = [arrival, heroOpen, heroLight, ...preservedTop, ...performance, ...display, ...mobility, ...design, ...final];

const C = (id, section, progress, position, target, fov = 36) => ({
  id, section, progress, ease: "smooth", state: { position, target, fov }
});
story.tracks.camera = [
  C("cam-hero","top",0,[0,1.18,4.45],[0,-.08,0],36),
  C("cam-perf","performance",0.02,[0,1.12,4.25],[0,-.06,0],34),
  C("cam-board","performance",0.22,[0.02,1.00,3.82],[.18,-.02,0],27),
  C("cam-gpu","performance",0.34,[0.02,.98,3.68],[.20,-.02,0],25),
  C("cam-cpu","performance",0.45,[0.02,.98,3.68],[.20,-.02,0],25),
  C("cam-memory","performance",0.56,[0.02,1.00,3.78],[.20,-.02,0],26),
  C("cam-storage","performance",0.66,[0.02,.96,3.58],[.22,-.02,0],24),
  C("cam-cooling","performance",0.77,[0.02,1.00,3.78],[.20,-.02,0],26),
  C("cam-battery","performance",0.87,[0.02,1.00,3.82],[.20,-.04,0],27),
  C("cam-perf-end","performance",0.96,[0,1.12,4.3],[0,-.06,0],34),
  C("cam-display","display",0.02,[0,1.12,4.2],[0,-.07,0],33),
  C("cam-screen-thin","display",0.24,[0,.98,3.70],[.20,-.01,0],25),
  C("cam-profile","display",0.44,[0,.98,3.70],[.20,-.01,0],25),
  C("cam-keyboard-left","display",0.60,[-.14,1.00,3.78],[.12,-.10,0],27),
  C("cam-keyboard-right","display",0.76,[.14,1.00,3.78],[.20,-.10,0],27),
  C("cam-touchpad","display",0.94,[.04,.98,3.76],[.18,-.14,0],27),
  C("cam-ports-right","mobility",0.05,[0,.96,3.70],[.20,-.02,0],25),
  C("cam-ports-left","mobility",0.30,[0,.96,3.70],[.20,-.02,0],25),
  C("cam-exhaust","mobility",0.58,[0,.90,3.58],[.18,.10,0],24),
  C("cam-speakers","mobility",0.86,[0,.92,3.72],[.18,-.10,0],26),
  C("cam-hinge","design",0.08,[0,.88,3.52],[.18,.10,0],24),
  C("cam-edge","design",0.46,[0,.96,3.68],[.18,-.02,0],26),
  C("cam-closeup","design",0.84,[0,1.00,3.82],[.18,-.08,0],28),
  C("cam-final","final",0.05,[0,1.16,4.35],[0,-.07,0],34),
  C("cam-close","final",0.50,[0,1.02,4.0],[0,-.02,0],30),
  C("cam-nova","final",0.90,[0,1.12,4.25],[0,-.04,0],33)
];

fs.writeFileSync(path, JSON.stringify(story, null, 2) + "\n");
console.log("Rebuilt NOVA product-film story:", story.tracks.product.length, "product keys /", story.tracks.camera.length, "camera keys");
