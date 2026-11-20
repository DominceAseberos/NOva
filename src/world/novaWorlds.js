import heroBg from "../../assets/hero/hero-background.webp";
import heroMid from "../../assets/hero/hero-midground.webp";
import heroAtmosphere from "../../assets/web/hero-atmosphere.webp";
import heroFgLeft from "../../assets/web/hero-foreground-left.webp";
import heroFgRight from "../../assets/web/hero-foreground-right.webp";

import perfBg from "../../assets/performance/performance-background.webp";
import perfFg from "../../assets/performance/performance-foreground.png";
import perfAirflow from "../../assets/web/performance-airflow.webp";

import displayBg from "../../assets/display/display-background.webp";
import displayFg from "../../assets/display/display-foreground.png";

import mobilityBg from "../../assets/mobility/mobility-background.webp";
import mobilityArch from "../../assets/web/mobility-architecture.webp";

import finalBg from "../../assets/final/final-background.webp";
import finalFg from "../../assets/final/final-foreground.png";

export const WORLDS = {
  top: {
    id: "top",
    name: "Cosmic Ascent",
    ambientLight: 0.95,
    keyColor: 0xffd2a6,
    keyIntensity: 2.8,
    keyPosition: [5.5, 3.2, 4.8],
    rimColor: 0xffa458,
    rimIntensity: 1.8,
    rimPosition: [6.8, 1.8, -4.2],
    fillColor: 0x82b4ea,
    fillIntensity: 3.2,
    fillPosition: [-6.5, 2.0, 3.0],
    fogColor: 0x090e15,
    fogNear: 12,
    fogFar: 68,
    layers: [
      { id: "hero-sky", type: "bg", src: heroBg, z: -32, scale: 3.8, opacity: 1, speed: 0.04, parallaxFactor: 0.05 },
      { id: "hero-mid", type: "mid", src: heroMid, z: -18, scale: 2.4, opacity: 0.92, speed: 0.16, parallaxFactor: 0.18 },
      { id: "hero-atmo", type: "atmo", src: heroAtmosphere, z: -8, scale: 1.8, opacity: 0.72, blend: "screen", drift: [0.015, 0.002], parallaxFactor: 0.35 },
      { id: "hero-fgl", type: "fg", src: heroFgLeft, z: 1.8, scale: 0.92, anchor: [-1.45, -0.68, 0], opacity: 1, blur: 0.4, parallaxFactor: 2.1 },
      { id: "hero-fgr", type: "fg", src: heroFgRight, z: 1.6, scale: 0.96, anchor: [1.42, -0.72, 0], opacity: 1, blur: 0.4, parallaxFactor: 2.3 },
    ],
    particles: { count: 480, color: 0xffe6cb, size: 0.038, bounds: [-4, 4, -2, 3, -15, 3] },
  },

  performance: {
    id: "performance",
    name: "Subsystem Core",
    ambientLight: 0.82,
    keyColor: 0x9ed8ff,
    keyIntensity: 3.2,
    keyPosition: [3.2, 4.5, 5.2],
    rimColor: 0x38e8c6,
    rimIntensity: 2.4,
    rimPosition: [-5.5, 3.0, -3.8],
    fillColor: 0x4878a8,
    fillIntensity: 2.6,
    fillPosition: [-4.0, 1.5, 3.5],
    fogColor: 0x04070c,
    fogNear: 8,
    fogFar: 45,
    layers: [
      { id: "perf-bg", type: "bg", src: perfBg, z: -28, scale: 3.4, opacity: 0.95, speed: 0.05, parallaxFactor: 0.06 },
      { id: "perf-flow", type: "atmo", src: perfAirflow, z: -10, scale: 2.1, opacity: 0.65, blend: "additive", drift: [-0.02, 0.01], parallaxFactor: 0.38 },
      { id: "perf-fg", type: "fg", src: perfFg, z: 2.0, scale: 1.1, anchor: [0.1, -0.85, 0], opacity: 0.95, blur: 0.3, parallaxFactor: 2.0 },
    ],
    particles: { count: 620, color: 0x64d2ff, size: 0.032, bounds: [-4, 4, -2, 3, -12, 3] },
  },

  display: {
    id: "display",
    name: "Luminous Precision",
    ambientLight: 0.9,
    keyColor: 0xffffff,
    keyIntensity: 2.9,
    keyPosition: [2.5, 4.8, 5.8],
    rimColor: 0x90c8ff,
    rimIntensity: 1.8,
    rimPosition: [6.2, 2.2, -3.5],
    fillColor: 0x6ca0d0,
    fillIntensity: 2.4,
    fillPosition: [-5.0, 2.0, 3.0],
    fogColor: 0x050910,
    fogNear: 10,
    fogFar: 55,
    layers: [
      { id: "disp-bg", type: "bg", src: displayBg, z: -30, scale: 3.6, opacity: 1, speed: 0.04, parallaxFactor: 0.05 },
      { id: "disp-fg", type: "fg", src: displayFg, z: 1.9, scale: 1.05, anchor: [0.05, -0.88, 0], opacity: 1, blur: 0.35, parallaxFactor: 2.15 },
    ],
    particles: { count: 420, color: 0xd8eeff, size: 0.035, bounds: [-4, 4, -2, 3, -14, 3] },
  },

  mobility: {
    id: "mobility",
    name: "Architectural Rigor",
    ambientLight: 0.98,
    keyColor: 0xf4f8fc,
    keyIntensity: 2.6,
    keyPosition: [3.8, 4.2, 5.0],
    rimColor: 0xd8e4ee,
    rimIntensity: 1.6,
    rimPosition: [-6.0, 2.5, -4.0],
    fillColor: 0xa8c2d8,
    fillIntensity: 2.2,
    fillPosition: [-4.5, 1.8, 2.8],
    fogColor: 0xd2dce6,
    fogNear: 12,
    fogFar: 60,
    layers: [
      { id: "mob-bg", type: "bg", src: mobilityBg, z: -30, scale: 3.6, opacity: 1, speed: 0.04, parallaxFactor: 0.05 },
      { id: "mob-arch", type: "mid", src: mobilityArch, z: -14, scale: 2.2, anchor: [0.35, -0.1, 0], opacity: 0.88, speed: 0.22, parallaxFactor: 0.28 },
    ],
    particles: { count: 320, color: 0x88a2bc, size: 0.03, bounds: [-4, 4, -2, 3, -12, 3] },
  },

  design: {
    id: "design",
    name: "Obsidian Craft",
    ambientLight: 0.86,
    keyColor: 0xe0ecf8,
    keyIntensity: 3.1,
    keyPosition: [2.0, 5.2, 5.0],
    rimColor: 0xffb272,
    rimIntensity: 2.1,
    rimPosition: [6.4, 2.4, -3.8],
    fillColor: 0x547290,
    fillIntensity: 2.4,
    fillPosition: [-5.2, 2.0, 3.2],
    fogColor: 0x05070a,
    fogNear: 9,
    fogFar: 50,
    layers: [
      { id: "des-bg", type: "bg", src: perfBg, z: -32, scale: 3.7, opacity: 0.65, speed: 0.04, parallaxFactor: 0.05 },
      { id: "des-fg", type: "fg", src: perfFg, z: 2.1, scale: 1.05, anchor: [0.2, -0.9, 0], opacity: 0.85, blur: 0.4, parallaxFactor: 2.05 },
    ],
    particles: { count: 380, color: 0xffaa66, size: 0.028, bounds: [-4, 4, -2, 3, -12, 3] },
  },

  final: {
    id: "final",
    name: "Celestial Monolith",
    ambientLight: 0.92,
    keyColor: 0xffdcba,
    keyIntensity: 2.7,
    keyPosition: [4.8, 3.6, 5.2],
    rimColor: 0xff984a,
    rimIntensity: 2.2,
    rimPosition: [6.8, 2.0, -4.5],
    fillColor: 0x769ecc,
    fillIntensity: 2.5,
    fillPosition: [-5.5, 2.0, 3.0],
    fogColor: 0x070b12,
    fogNear: 11,
    fogFar: 65,
    layers: [
      { id: "fin-bg", type: "bg", src: finalBg, z: -30, scale: 3.6, opacity: 1, speed: 0.04, parallaxFactor: 0.05 },
      { id: "fin-fg", type: "fg", src: finalFg, z: 1.85, scale: 1.08, anchor: [0.0, -0.84, 0], opacity: 1, blur: 0.38, parallaxFactor: 2.2 },
    ],
    particles: { count: 520, color: 0xffcf9e, size: 0.034, bounds: [-4, 4, -2, 3, -15, 3] },
  },
};
