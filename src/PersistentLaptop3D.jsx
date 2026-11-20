import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

import { createThreeTransformAdapter } from "./scroll-story/adapters/three/createThreeTransformAdapter.js";
import {
  evaluateCameraTrack,
  evaluateProductTrack,
  getSectionRanges,
  lerpAngle,
  locateStoryTime,
} from "./scroll-story/core/storyMath.js";
import {
  publishStoryRuntimeState,
  registerStoryRuntimeApi,
} from "./scroll-story/runtime/editorBridge.js";
import { getActiveLenis } from "./scroll-story/runtime/lenisBridge.js";
import { isStoryEditorMode, novaStoryStore } from "./story/novaStoryStore.js";

import novaModelUrl from "../assets/3d/NOVA_Canonical_Laptop.glb?url";
import screenDisplayUrl from "../assets/3d/textures/web/screen-display.webp?url";
import screenFinalUrl from "../assets/3d/textures/web/screen-final.webp?url";

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smooth = (v) => {
  const t = clamp01(v);
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;

const S = (overrides = {}) => ({
  x: 0.75,
  y: 0,
  z: 0,
  rx: -0.06,
  ry: -0.12,
  rz: 0.01,
  scale: 0.9,
  lid: 1,
  keyboardLight: 1,
  explodeEnabled: true,
  explode: 0,
  parts: {},
  screen: 0,
  cool: 2.8,
  warm: 1.1,
  ambient: 1.25,
  shadow: 0.55,
  opacity: 1,
  ...overrides,
});

const EDITABLE_PARTS = [
  { id: "motherboard", label: "Motherboard", object: "Motherboard" },
  { id: "cpuGpu", label: "Compute assembly", object: "CPU_GPU_Package" },
  { id: "cpu", label: "CPU package", object: "CPU_Package" },
  { id: "gpu", label: "GPU + VRAM", object: "GPU_Package" },
  { id: "ram1", label: "SO-DIMM 1", object: "RAM_SODIMM_1" },
  { id: "ram2", label: "SO-DIMM 2", object: "RAM_SODIMM_2" },
  { id: "ssd", label: "SSD module", object: "SSD_Module" },
  { id: "fanLeft", label: "Fan — Left", object: "Fan_L" },
  { id: "fanRight", label: "Fan — Right", object: "Fan_R" },
  { id: "heatPipe1", label: "Heatpipe — Left", object: "HeatPipe_1" },
  { id: "heatPipe2", label: "Heatpipe — Right", object: "HeatPipe_2" },
  { id: "heatsinkLeft", label: "Heatsink — Left", object: "Heatsink_L" },
  { id: "heatsinkRight", label: "Heatsink — Right", object: "Heatsink_R" },
  { id: "battery1", label: "Battery cell 1", object: "Battery_Cell_1" },
  { id: "battery2", label: "Battery cell 2", object: "Battery_Cell_2" },
  { id: "battery3", label: "Battery cell 3", object: "Battery_Cell_3" },
  { id: "battery4", label: "Battery cell 4", object: "Battery_Cell_4" },
  { id: "midplate", label: "Internal midplate", object: "Internal_Midplate" },
];

const FOCUS_PARTS_BY_CHAPTER = {
  MOTHERBOARD: ["motherboard"],
  GPU: ["gpu"],
  CPU: ["cpu"],
  MEMORY: ["ram1", "ram2"],
  STORAGE: ["ssd"],
  COOLING: ["fanLeft", "fanRight", "heatPipe1", "heatPipe2", "heatsinkLeft", "heatsinkRight"],
  BATTERY: ["battery1", "battery2", "battery3", "battery4"],
};

const FOCUS_HIGHLIGHT_BY_CHAPTER = {
  MOTHERBOARD: { color: 0x34e8c4, emissive: 0.42, light: 3.4 },
  GPU:         { color: 0x45f59c, emissive: 0.52, light: 4.2 },
  CPU:         { color: 0x56c8ff, emissive: 0.52, light: 4.2 },
  MEMORY:      { color: 0x7cd8ff, emissive: 0.48, light: 3.8 },
  STORAGE:     { color: 0x93c5fd, emissive: 0.50, light: 3.8 },
  COOLING:     { color: 0xff9248, emissive: 0.44, light: 4.0 },
  BATTERY:     { color: 0xfbbf24, emissive: 0.46, light: 3.8 },
};

const FEATURE_CAMERA_FOCUS = {
  MOTHERBOARD: { object: "Motherboard", offset: [-0.10, 0.00, 0.00] },
  GPU: { object: "GPU_Package", offset: [-0.08, 0.00, 0.00] },
  CPU: { object: "CPU_Package", offset: [-0.08, 0.00, 0.00] },
  MEMORY: { object: "RAM_SODIMM_1", offset: [-0.08, 0.00, 0.00] },
  STORAGE: { object: "SSD_Module", offset: [-0.08, 0.00, 0.00] },
  COOLING: { object: "HeatPipe_1", offset: [-0.08, 0.00, 0.00] },
  BATTERY: { object: "Battery_Cell_2", offset: [-0.08, 0.00, 0.00] },
  SCREEN_THIN: { object: "Focus_Screen_Edge", offset: [-0.26, 0.00, 0.00] },
  KEYBOARD: { object: "Focus_Keyboard", offset: [-0.24, 0.00, 0.00] },
  TOUCHPAD: { object: "Focus_Touchpad", offset: [-0.24, 0.00, 0.00] },
  PORTS_RIGHT: { object: "Focus_Ports_Right", offset: [-0.24, 0.00, 0.00] },
  PORTS_LEFT: { object: "Focus_Ports_Left", offset: [-0.24, 0.00, 0.00] },
  EXHAUST: { object: "Focus_Exhaust", offset: [-0.24, 0.00, 0.00] },
  SPEAKERS: { object: "Focus_Speaker_R", offset: [-0.22, 0.00, 0.00] },
  HINGE: { object: "Focus_Hinge", offset: [-0.24, 0.00, 0.00] },
  EDGE: { object: "Focus_Edge", offset: [-0.24, 0.00, 0.00] },
};

const DEFAULT_PART_OVERRIDE = Object.freeze({
  visible: true,
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
});

const normalizePartOverride = (value = {}) => ({
  ...DEFAULT_PART_OVERRIDE,
  ...value,
  position: [...(value.position || DEFAULT_PART_OVERRIDE.position)],
  rotation: [...(value.rotation || DEFAULT_PART_OVERRIDE.rotation)],
  scale: [...(value.scale || DEFAULT_PART_OVERRIDE.scale)],
});

export default function PersistentLaptop3D() {
  const canvasRef = useRef(null);
  const shellRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [chapter, setChapter] = useState("ARRIVAL");

  useEffect(() => {
    const canvas = canvasRef.current;
    const shell = shellRef.current;
    if (!canvas || !shell) return undefined;

    const homeParent = shell.parentElement;
    const editorMode = isStoryEditorMode();
    let story = novaStoryStore.get();
    const unsubscribeStory = novaStoryStore.subscribe((nextStory) => {
      story = nextStory;
      editorPreviewState = null;
      editorCameraPreviewState = null;
    });

    const hostForSection = (sectionId) => {
      if (sectionId === "top") {
        return document.querySelector("#top .hero-stage");
      }
      if (["performance", "display", "mobility", "design", "final"].includes(sectionId)) {
        return document.querySelector("#" + sectionId + " .scene-stage");
      }
      return homeParent;
    };

    const hostForChapter = (name) => {
      if (["ARRIVAL", "HERO", "LIFT"].includes(name)) {
        return document.querySelector("#top .hero-stage");
      }
      if (["PERFORMANCE", "EXPLODE", "MOTHERBOARD", "GPU", "CPU", "MEMORY", "STORAGE", "COOLING", "BATTERY", "REASSEMBLE"].includes(name)) {
        return document.querySelector("#performance .scene-stage");
      }
      if (["DISPLAY", "SCREEN_THIN", "PROFILE", "KEYBOARD", "TOUCHPAD"].includes(name)) {
        return document.querySelector("#display .scene-stage");
      }
      if (["PORTS_RIGHT", "PORTS_LEFT", "EXHAUST", "SPEAKERS"].includes(name)) {
        return document.querySelector("#mobility .scene-stage");
      }
      if (["HINGE", "EDGE", "CLOSEUP"].includes(name)) {
        return document.querySelector("#design .scene-stage");
      }
      if (["FINAL", "CLOSE", "SETTLE", "NOVA"].includes(name)) {
        return document.querySelector("#final .scene-stage");
      }
      return homeParent;
    };

    const attachToSection = (sectionId, chapter) => {
      // Authoring mode must keep the WebGL viewport outside section stacking
      // contexts so the real 3D object is always the topmost page-content layer.
      const host = editorMode
        ? homeParent
        : hostForSection(sectionId) || hostForChapter(chapter);

      if (host && shell.parentElement !== host) {
        host.appendChild(shell);
      }
    };

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
    } catch {
      document.body.classList.add("nova-persistent-3d-fallback");
      shell.classList.add("persistent-product--fallback");
      return undefined;
    }

    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.14;

    const scene = new THREE.Scene();

    // Synthesize a luxury studio softbox HDRI environment map via PMREMGenerator.
    // Metallic anodized aluminum, diamond-cut silver chamfers, copper heatpipes,
    // silicon dies, and etched trackpad glass require studio reflections to read
    // like real CNC-machined hardware instead of flat matte plastic.
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x06090f);

    const addLightformer = (color, intensity, pos, scale, rot = [0, 0, 0]) => {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(color).multiplyScalar(intensity),
          side: THREE.DoubleSide,
        })
      );
      mesh.position.set(...pos);
      mesh.scale.set(...scale);
      mesh.rotation.set(...rot);
      envScene.add(mesh);
    };

    // Broad overhead studio softbox strip (creates sleek sheen across aluminum & glass)
    addLightformer(0xeef5ff, 3.6, [0, 7.5, 1.5], [14, 3.8, 1], [Math.PI / 2, 0, 0]);
    // Front-top key strip for clean metallic bevel catchlights
    addLightformer(0xffffff, 2.8, [2.2, 4.2, 7.2], [9, 2.2, 1], [0.42, -0.25, 0]);
    // Cool slate-cyan architectural side panel (left fill)
    addLightformer(0x8ec5ff, 2.4, [-8.0, 2.5, 2.0], [6, 5.5, 1], [0, Math.PI / 2.2, 0]);
    // Warm champagne-gold horizon rim strip (right/rear architectural accent)
    addLightformer(0xffbe88, 2.2, [7.8, 2.2, -3.5], [5.5, 4.5, 1], [0, -Math.PI * 0.65, 0]);
    // Rear crown edge kicker for thin lid & hinge definition
    addLightformer(0xd4e6ff, 2.6, [0, 3.8, -8.0], [11, 2.0, 1], [-0.3, Math.PI, 0]);
    // Subtle dark-slate floor bounce
    addLightformer(0x182230, 0.9, [0, -6.0, 0], [16, 16, 1], [-Math.PI / 2, 0, 0]);

    const envRT = pmrem.fromScene(envScene, 0.035);
    scene.environment = envRT.texture;
    envScene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    });
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(34, 1, 0.01, 40);
    camera.position.set(0, 1.05, 4.35);
    const cameraTarget = new THREE.Vector3(0, -0.05, 0);
    camera.lookAt(cameraTarget);

    const storyRoot = new THREE.Group();
    const modelRoot = new THREE.Group();
    storyRoot.add(modelRoot);
    scene.add(storyRoot);

    let transformAdapter = null;
    let selectedPartId = null;
    let partDragStart = null;
    let editorManipulating = false;
    let editorPreviewState = null;
    let editorCameraPreviewState = null;
    const partTargets = new Map();
    const partBaseTransforms = new Map();

    if (editorMode) {
      transformAdapter = createThreeTransformAdapter({
        camera,
        domElement: renderer.domElement,
        scene,
        target: storyRoot,
        mode: "translate",
        space: "world",
        size: 0.72,
        onStart: () => {
          editorManipulating = true;

          if (selectedPartId) {
            const target = partTargets.get(selectedPartId);
            const evaluated = editorPreviewState || getStoryState();
            if (target) {
              partDragStart = {
                id: selectedPartId,
                position: target.position.clone(),
                rotation: target.rotation.clone(),
                scale: target.scale.clone(),
                override: normalizePartOverride(
                  evaluated.parts?.[selectedPartId]
                ),
              };
            }
          } else {
            editorPreviewState = null;
          }
        },
        onEnd: () => {
          if (selectedPartId && partDragStart?.id === selectedPartId) {
            const target = partTargets.get(selectedPartId);
            if (target) {
              const start = partDragStart;
              const nextOverride = {
                visible: target.visible,
                position: start.override.position.map(
                  (value, index) =>
                    value +
                    [target.position.x, target.position.y, target.position.z][index] -
                    [start.position.x, start.position.y, start.position.z][index]
                ),
                rotation: start.override.rotation.map(
                  (value, index) =>
                    value +
                    [target.rotation.x, target.rotation.y, target.rotation.z][index] -
                    [start.rotation.x, start.rotation.y, start.rotation.z][index]
                ),
                scale: start.override.scale.map((value, index) => {
                  const before = [start.scale.x, start.scale.y, start.scale.z][index] || 1;
                  const after = [target.scale.x, target.scale.y, target.scale.z][index];
                  return value * (after / before);
                }),
              };
              const base = editorPreviewState || getStoryState();
              editorPreviewState = {
                ...base,
                parts: {
                  ...(base.parts || {}),
                  [selectedPartId]: nextOverride,
                },
              };
            }
            partDragStart = null;
          } else {
            // Preserve the authored product pose after the drag ends.
            editorPreviewState = captureProductState();
          }

          editorManipulating = false;
        },
      });
    }

    const hemi = new THREE.HemisphereLight(0xd6e8ff, 0x10141c, 0.85);
    scene.add(hemi);

    const key = new THREE.DirectionalLight(0xeaf4ff, 2.4);
    key.position.set(3.4, 4.6, 4.8);
    scene.add(key);

    const rim = new THREE.DirectionalLight(0xffb47d, 1.35);
    rim.position.set(-3.8, 2.2, -3.4);
    scene.add(rim);

    const fill = new THREE.PointLight(0x8bc2ff, 12, 12, 2);
    fill.position.set(-2.6, 1.5, 3.0);
    scene.add(fill);

    const warmFill = new THREE.PointLight(0xffa064, 6, 10, 2);
    warmFill.position.set(3.0, 1.1, -2.0);
    scene.add(warmFill);

    const cameraFill = new THREE.DirectionalLight(0xe4efff, 0.95);
    cameraFill.position.set(0.4, 2.4, 5.4);
    scene.add(cameraFill);

    // Dynamic 3D hardware spotlight that smoothly tracks and illuminates the
    // currently highlighted internal component during teardown chapters.
    const focusSpotLight = new THREE.PointLight(0x56c8ff, 0, 2.2, 1.8);
    focusSpotLight.position.set(0.65, 0.45, 0.85);
    scene.add(focusSpotLight);
    const focusHighlightColor = new THREE.Color();
    const focusSpotTargetPos = new THREE.Vector3();

    // Soft radial feathered ground shadow (never a harsh detached dark disc).
    const shadowCanvas = document.createElement("canvas");
    shadowCanvas.width = 256;
    shadowCanvas.height = 256;
    const sCtx = shadowCanvas.getContext("2d");
    const sGrad = sCtx.createRadialGradient(128, 128, 8, 128, 128, 124);
    sGrad.addColorStop(0, "rgba(2, 5, 10, 0.72)");
    sGrad.addColorStop(0.45, "rgba(2, 5, 10, 0.28)");
    sGrad.addColorStop(1, "rgba(2, 5, 10, 0)");
    sCtx.fillStyle = sGrad;
    sCtx.fillRect(0, 0, 256, 256);
    const shadowTexture = new THREE.CanvasTexture(shadowCanvas);

    const shadowGeo = new THREE.PlaneGeometry(2.2, 1.2);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTexture,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(0.68, -0.58, -0.1);
    scene.add(shadow);

    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const textureLoader = new THREE.TextureLoader();
    const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy?.() || 1);

    const configureScreenTex = (tex, isCanvas = false) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.flipY = !isCanvas ? false : false;
      tex.anisotropy = maxAniso;
      tex.needsUpdate = true;
      return tex;
    };

    // Screen 0: Luxury Hero Cosmic Ringed Planet OLED Artwork (high-res procedural)
    const makeHeroCosmicScreen = () => {
      const c = document.createElement("canvas");
      c.width = 1600;
      c.height = 1000;
      const ctx = c.getContext("2d");

      // Deep OLED obsidian space backdrop with rich atmospheric nebula glow
      const bg = ctx.createRadialGradient(840, 480, 40, 800, 500, 960);
      bg.addColorStop(0, "#112238");
      bg.addColorStop(0.38, "#07101c");
      bg.addColorStop(0.75, "#03070e");
      bg.addColorStop(1, "#010205");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, c.width, c.height);

      // Subtle starfield
      let seed = 4219;
      const rand = () => {
        seed = (seed * 16807) % 2147483647;
        return (seed - 1) / 2147483646;
      };
      for (let i = 0; i < 420; i += 1) {
        const sx = rand() * c.width;
        const sy = rand() * c.height;
        const sr = rand() < 0.88 ? 0.6 + rand() * 0.9 : 1.4 + rand() * 1.1;
        const sa = 0.18 + rand() * 0.65;
        ctx.fillStyle = `rgba(218, 234, 255, ${sa.toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
      }

      // Back arc of cosmic planetary rings
      ctx.save();
      ctx.translate(800, 505);
      ctx.rotate(-0.34);
      for (let r = 0; r < 5; r += 1) {
        ctx.beginPath();
        ctx.ellipse(0, 0, 390 + r * 28, 108 + r * 9, 0, Math.PI, Math.PI * 2);
        ctx.strokeStyle = `rgba(175, 206, 240, ${(0.22 - r * 0.032).toFixed(3)})`;
        ctx.lineWidth = r === 1 ? 14 : 6;
        ctx.stroke();
      }
      ctx.restore();

      // Atmospheric halo behind planet
      const halo = ctx.createRadialGradient(730, 440, 140, 800, 505, 340);
      halo.addColorStop(0, "rgba(155, 210, 255, 0.34)");
      halo.addColorStop(0.55, "rgba(70, 128, 196, 0.12)");
      halo.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(800, 505, 340, 0, Math.PI * 2);
      ctx.fill();

      // Sculpted planet sphere with crisp sunlit limb
      ctx.save();
      ctx.beginPath();
      ctx.arc(800, 505, 215, 0, Math.PI * 2);
      ctx.clip();
      const sphere = ctx.createRadialGradient(695, 405, 22, 775, 495, 255);
      sphere.addColorStop(0, "#d7ebff");
      sphere.addColorStop(0.18, "#6da3d8");
      sphere.addColorStop(0.42, "#1c3654");
      sphere.addColorStop(0.72, "#09131f");
      sphere.addColorStop(1, "#02050a");
      ctx.fillStyle = sphere;
      ctx.fillRect(560, 270, 480, 480);

      // Subtle atmospheric cloud bands across lit crescent
      ctx.strokeStyle = "rgba(185, 220, 255, 0.14)";
      ctx.lineWidth = 18;
      ctx.beginPath();
      ctx.ellipse(760, 470, 230, 62, -0.26, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255, 212, 168, 0.08)";
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.ellipse(785, 520, 210, 50, -0.26, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Razor-crisp crescent rim highlight
      ctx.save();
      ctx.beginPath();
      ctx.arc(800, 505, 215, Math.PI * 0.92, Math.PI * 1.62);
      ctx.strokeStyle = "rgba(232, 245, 255, 0.85)";
      ctx.lineWidth = 3.2;
      ctx.shadowColor = "rgba(140, 205, 255, 0.95)";
      ctx.shadowBlur = 22;
      ctx.stroke();
      ctx.restore();

      // Front arc of planetary rings crossing over planet
      ctx.save();
      ctx.translate(800, 505);
      ctx.rotate(-0.34);
      for (let r = 0; r < 5; r += 1) {
        ctx.beginPath();
        ctx.ellipse(0, 0, 390 + r * 28, 108 + r * 9, 0, 0, Math.PI);
        ctx.strokeStyle = `rgba(204, 226, 250, ${(0.34 - r * 0.048).toFixed(3)})`;
        ctx.lineWidth = r === 1 ? 15 : 6;
        ctx.stroke();
      }
      ctx.restore();

      return configureScreenTex(new THREE.CanvasTexture(c), true);
    };

    // Screen 2: Stealth Performance Obsidian Studio Screen
    const makePerformanceScreen = () => {
      const c = document.createElement("canvas");
      c.width = 1600;
      c.height = 1000;
      const ctx = c.getContext("2d");

      const bg = ctx.createRadialGradient(800, 480, 30, 800, 500, 920);
      bg.addColorStop(0, "#101e30");
      bg.addColorStop(0.5, "#060c14");
      bg.addColorStop(1, "#020408");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, c.width, c.height);

      // Subtle geometric studio horizon rings
      ctx.strokeStyle = "rgba(130, 190, 255, 0.14)";
      ctx.lineWidth = 2;
      for (let i = 1; i <= 4; i += 1) {
        ctx.beginPath();
        ctx.arc(800, 500, 120 * i, 0, Math.PI * 2);
        ctx.stroke();
      }
      // Subtle copper-cyan energy horizon line
      const lineGrad = ctx.createLinearGradient(220, 500, 1380, 500);
      lineGrad.addColorStop(0, "rgba(110, 185, 255, 0)");
      lineGrad.addColorStop(0.3, "rgba(120, 200, 255, 0.55)");
      lineGrad.addColorStop(0.7, "rgba(255, 165, 102, 0.45)");
      lineGrad.addColorStop(1, "rgba(255, 165, 102, 0)");
      ctx.strokeStyle = lineGrad;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(220, 500);
      ctx.lineTo(1380, 500);
      ctx.stroke();

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = '300 72px "Inter", "Helvetica Neue", sans-serif';
      ctx.fillStyle = "rgba(236, 244, 255, 0.88)";
      ctx.letterSpacing = "26px";
      ctx.fillText("N O V A", c.width / 2, c.height / 2 - 42);

      return configureScreenTex(new THREE.CanvasTexture(c), true);
    };

    const screenTextures = [
      makeHeroCosmicScreen(),
      configureScreenTex(textureLoader.load(screenDisplayUrl)),
      makePerformanceScreen(),
      configureScreenTex(textureLoader.load(screenFinalUrl)),
    ];

    let loadedScene = null;
    let lidGroup = null;
    let lidHinge = null;
    let lidOpenRotation = -Math.PI / 12;
    let topGroup = null;
    let internalGroup = null;
    let lowerGroup = null;
    let screenMesh = null;
    let screenMaterial = null;
    let currentScreen = -1;
    let screenFade = 0;
    let normalizedScale = 1;
    const basePositions = new Map();
    const componentBase = new Map();
    const focusBox = new THREE.Box3();
    const focusPartBox = new THREE.Box3();
    const focusCenterWorld = new THREE.Vector3();
    const focusAnchorWorld = new THREE.Vector3();
    const focusLocalA = new THREE.Vector3();
    const focusLocalB = new THREE.Vector3();
    const focusParentInverse = new THREE.Matrix4();
    const keyboardGlowMaterials = new Set();
    const keyboardLegendMaterials = new Set();
    const featureTargets = new Map();
    const featureWorld = new THREE.Vector3();
    const featureAim = new THREE.Vector3();

    const prepareMaterial = (material) => {
      const m = material.clone();
      m.transparent = false;
      m.opacity = 1;
      m.envMapIntensity = 1.45;

      if (m.name === "NOVA Graphite") {
        m.color.setRGB(0.11, 0.122, 0.142);
        m.metalness = 0.84;
        m.roughness = 0.27;
        m.envMapIntensity = 1.75;
      } else if (m.name === "NOVA Dark Edge") {
        m.color.setRGB(0.055, 0.062, 0.075);
        m.metalness = 0.72;
        m.roughness = 0.30;
        m.envMapIntensity = 1.5;
      } else if (m.name === "Machined Chamfer" || m.name === "Machined Silver") {
        m.color.setRGB(0.68, 0.72, 0.78);
        m.metalness = 0.94;
        m.roughness = 0.17;
        m.envMapIntensity = 2.05;
      } else if (m.name === "NOVA Lid Emblem Metal") {
        m.color.setRGB(0.46, 0.50, 0.57);
        m.metalness = 0.96;
        m.roughness = 0.14;
        m.envMapIntensity = 2.15;
      } else if (m.name === "NOVA Lid Emblem Glow") {
        m.color.setRGB(0.58, 0.65, 0.76);
        if (m.emissive) m.emissive.setRGB(0.32, 0.45, 0.66);
        m.emissiveIntensity = 0.22;
        m.metalness = 0.90;
        m.roughness = 0.16;
        m.envMapIntensity = 2.0;
      } else if (m.name === "Motherboard PCB") {
        m.color.setRGB(0.014, 0.042, 0.036);
        m.metalness = 0.14;
        m.roughness = 0.40;
        m.envMapIntensity = 1.1;
      } else if (m.name === "RAM PCB") {
        m.color.setRGB(0.012, 0.022, 0.026);
        m.metalness = 0.10;
        m.roughness = 0.42;
        m.envMapIntensity = 1.05;
      } else if (m.name === "Contact Gold") {
        m.color.setRGB(0.86, 0.62, 0.18);
        m.metalness = 0.94;
        m.roughness = 0.18;
        m.envMapIntensity = 2.0;
      } else if (m.name === "Copper") {
        m.color.setRGB(0.84, 0.38, 0.16);
        m.metalness = 0.92;
        m.roughness = 0.20;
        m.envMapIntensity = 1.95;
      } else if (m.name === "Fan Dark") {
        m.color.setRGB(0.032, 0.038, 0.048);
        m.metalness = 0.36;
        m.roughness = 0.36;
        m.envMapIntensity = 1.25;
      } else if (m.name === "Battery Black" || m.name === "Battery Foil") {
        m.color.setRGB(0.028, 0.033, 0.042);
        m.metalness = 0.24;
        m.roughness = 0.44;
        m.envMapIntensity = 1.15;
      } else if (m.name === "Silicon Package") {
        m.color.setRGB(0.032, 0.042, 0.055);
        m.metalness = 0.28;
        m.roughness = 0.32;
        m.envMapIntensity = 1.2;
      } else if (m.name === "Silicon Die") {
        m.color.setRGB(0.26, 0.32, 0.40);
        m.metalness = 0.92;
        m.roughness = 0.12;
        m.envMapIntensity = 2.25;
      } else if (m.name === "Key Black") {
        m.color.setRGB(0.018, 0.021, 0.026);
        m.metalness = 0.06;
        m.roughness = 0.56;
        m.envMapIntensity = 0.85;
      } else if (m.name === "Keyboard Underlight") {
        m.color.setRGB(0.012, 0.016, 0.024);
        if (m.emissive) m.emissive.setRGB(0.28, 0.42, 0.66);
        m.emissiveIntensity = 0.42;
        m.metalness = 0.0;
        m.roughness = 0.42;
      } else if (m.name === "Keyboard Per-Key Glow") {
        m.color.setRGB(0.14, 0.18, 0.26);
        if (m.emissive) m.emissive.setRGB(0.62, 0.78, 1.0);
        m.emissiveIntensity = 1.25;
        keyboardGlowMaterials.add(m);
      } else if (m.name === "Keyboard Legend Glow") {
        m.color.setRGB(0.76, 0.82, 0.92);
        if (m.emissive) m.emissive.setRGB(0.80, 0.89, 1.0);
        m.emissiveIntensity = 1.15;
        m.metalness = 0.0;
        m.roughness = 0.28;
        keyboardLegendMaterials.add(m);
      } else if (m.name === "Trackpad Glass") {
        m.color.setRGB(0.036, 0.042, 0.052);
        m.metalness = 0.18;
        m.roughness = 0.16;
        m.envMapIntensity = 1.65;
      } else if (m.name === "Trackpad Edge") {
        m.color.setRGB(0.24, 0.27, 0.32);
        m.metalness = 0.86;
        m.roughness = 0.20;
        m.envMapIntensity = 1.85;
      } else if (m.name === "Port Metal") {
        m.color.setRGB(0.38, 0.42, 0.48);
        m.metalness = 0.88;
        m.roughness = 0.22;
        m.envMapIntensity = 1.8;
      } else if (m.name === "Thermal Pad") {
        m.color.setRGB(0.06, 0.12, 0.16);
        m.metalness = 0.0;
        m.roughness = 0.62;
      } else if (m.name === "PCB Silkscreen") {
        m.color.setRGB(0.58, 0.64, 0.68);
        m.metalness = 0.0;
        m.roughness = 0.52;
      } else if (m.name === "VRM Inductor") {
        m.color.setRGB(0.052, 0.058, 0.068);
        m.metalness = 0.42;
        m.roughness = 0.32;
        m.envMapIntensity = 1.3;
      }

      if (m.emissive) {
        m.userData.baseEmissive = m.emissive.clone();
        m.userData.baseEmissiveIntensity = m.emissiveIntensity ?? 0;
      }

      return m;
    };

    loader.load(
      novaModelUrl,
      (gltf) => {
        loadedScene = gltf.scene;
        loadedScene.traverse((object) => {
          if (object.isMesh) {
            if (Array.isArray(object.material)) {
              object.material = object.material.map(prepareMaterial);
            } else if (object.material) {
              object.material = prepareMaterial(object.material);
            }
            object.frustumCulled = false;
          }
        });

        const box = new THREE.Box3().setFromObject(loadedScene);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        normalizedScale = 1.66 / maxDim;

        loadedScene.position.copy(center).multiplyScalar(-1);
        loadedScene.scale.setScalar(normalizedScale);
        modelRoot.add(loadedScene);

        lidGroup = loadedScene.getObjectByName("LID_GROUP");
        lidHinge = loadedScene.getObjectByName("Lid_Hinge");
        if (lidHinge) lidOpenRotation = lidHinge.rotation.x;
        topGroup = loadedScene.getObjectByName("TOP_DECK_GROUP");
        internalGroup = loadedScene.getObjectByName("INTERNAL_GROUP");
        lowerGroup = loadedScene.getObjectByName("LOWER_CHASSIS_GROUP");
        screenMesh = loadedScene.getObjectByName("Display_Active");

        Object.values(FEATURE_CAMERA_FOCUS).forEach(({ object }) => {
          if (featureTargets.has(object)) return;
          const target = loadedScene.getObjectByName(object);
          if (target) featureTargets.set(object, target);
        });

        const glassMesh = loadedScene.getObjectByName("Display_Glass");
        if (glassMesh) {
          const oldGlassMat = glassMesh.material;
          glassMesh.material = new THREE.MeshStandardMaterial({
            color: 0x0b1220,
            metalness: 0.15,
            roughness: 0.06,
            envMapIntensity: 1.9,
            transparent: true,
            opacity: 0.13,
            depthWrite: false,
          });
          glassMesh.renderOrder = 9;
          glassMesh.visible = true;
          if (Array.isArray(oldGlassMat)) oldGlassMat.forEach((m) => m?.dispose?.());
          else oldGlassMat?.dispose?.();
        }

        [lidGroup, topGroup, internalGroup, lowerGroup].forEach((group) => {
          if (group) basePositions.set(group, group.position.clone());
        });

        if (internalGroup) {
          internalGroup.traverse((object) => {
            if (object !== internalGroup) {
              componentBase.set(object, object.position.clone());
            }
          });
        }

        EDITABLE_PARTS.forEach((definition) => {
          const target = loadedScene.getObjectByName(definition.object);
          if (!target) return;
          partTargets.set(definition.id, target);
          partBaseTransforms.set(definition.id, {
            position: target.position.clone(),
            rotation: target.rotation.clone(),
            scale: target.scale.clone(),
          });
        });

        if (screenMesh?.material) {
          const oldScreenMaterials = Array.isArray(screenMesh.material)
            ? screenMesh.material
            : [screenMesh.material];

          screenMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 1,
            depthWrite: true,
            toneMapped: false,
            side: THREE.FrontSide,
          });
          screenMesh.renderOrder = 8;
          screenMesh.material = screenMaterial;

          oldScreenMaterials.forEach((material) => material?.dispose?.());
        }

        // Snap the GLB to the exact current chapter before exposing
        // the WebGL layer. This prevents the default centered/front-facing
        // Three.js transform from flashing for a frame on initial load.
        snapToCurrentStoryState();

        document.body.classList.remove("nova-persistent-3d-fallback");
        document.body.classList.add("nova-persistent-3d-ready");

        const heroFallback = document.querySelector(".hero-laptop");
        if (heroFallback) {
          heroFallback.style.setProperty("opacity", "0", "important");
          heroFallback.style.setProperty("visibility", "hidden", "important");
        }

        shell.classList.add("persistent-product--ready");
        setReady(true);
      },
      undefined,
      () => {
        document.body.classList.add("nova-persistent-3d-fallback");
        shell.classList.add("persistent-product--fallback");
      }
    );

    const setLid = (openAmount = 1) => {
      if (!lidHinge) return;
      const p = smooth(openAmount);
      const closedRotation = Math.PI / 2;
      lidHinge.rotation.x = THREE.MathUtils.lerp(closedRotation, lidOpenRotation, p);
    };

    const setKeyboardLight = (amount = 1) => {
      const p = clamp01(amount);
      keyboardGlowMaterials.forEach((material) => {
        material.emissiveIntensity = 0.02 + p * 1.55;
      });
      keyboardLegendMaterials.forEach((material) => {
        material.emissiveIntensity = 0.02 + p * 1.15;
      });
    };

    const setExplode = (progress) => {
      // Balanced architectural separation: lid and keyboard deck rise cleanly
      // above the sightline, lower milled unibody cradles below, and the full
      // internal hardware stack fans cleanly in the center with zero clipping.
      const p = smooth(progress) * 0.44;
      const apply = (group, dx, dy, dz) => {
        if (!group) return;
        const base = basePositions.get(group);
        if (!base) return;
        group.position.set(
          base.x + dx * p,
          base.y + dy * p,
          base.z + dz * p
        );
      };

      apply(lidGroup, 0, 0.40, -0.055);
      apply(topGroup, 0, 0.28, -0.015);
      apply(internalGroup, 0, 0.020, 0.045);
      apply(lowerGroup, 0, -0.215, -0.012);

      if (internalGroup) {
        const offsetObject = (object, dx, dy, dz) => {
          const base = componentBase.get(object);
          if (!object || !base) return;
          object.position.set(
            base.x + dx * p,
            base.y + dy * p,
            base.z + dz * p
          );
        };

        const offsetComponent = (name, dx, dy, dz) => {
          offsetObject(internalGroup.getObjectByName(name), dx, dy, dz);
        };

        const offsetPrefix = (prefix, dx, dy, dz) => {
          internalGroup.traverse((object) => {
            if (object !== internalGroup && object.name.startsWith(prefix)) {
              offsetObject(object, dx, dy, dz);
            }
          });
        };

        offsetComponent("Motherboard", 0, 0.022, 0);
        offsetPrefix("BoardDetail_", 0, 0.022, 0);
        offsetComponent("CPU_GPU_Package", 0, 0.048, 0);
        offsetComponent("RAM_SODIMM_1", -0.014, 0.048, 0.012);
        offsetComponent("RAM_SODIMM_2", -0.006, 0.056, 0.016);
        offsetComponent("SSD_Module", -0.012, 0.046, 0);
        offsetComponent("HeatPipe_1", 0, 0.072, 0.014);
        offsetComponent("HeatPipe_2", 0, 0.066, 0.012);

        offsetPrefix("Fan_L", -0.036, 0.064, 0.010);
        offsetPrefix("Fan_R", 0.036, 0.064, 0.010);
        offsetPrefix("Heatsink_L", -0.024, 0.078, 0.008);
        offsetPrefix("Heatsink_R", 0.024, 0.078, 0.008);

        for (let i = 1; i <= 4; i += 1) {
          const dy = -0.034 - (i % 2) * 0.006;
          offsetComponent("Battery_Cell_" + i, 0, dy, 0);
          offsetComponent("BatteryDetail_Seam_" + i, 0, dy, 0);
        }

        offsetComponent("Internal_Midplate", 0, -0.078, -0.006);
      }
    };

    const applyPartOverrides = (parts = {}) => {
      EDITABLE_PARTS.forEach((definition) => {
        const target = partTargets.get(definition.id);
        const base = partBaseTransforms.get(definition.id);
        if (!target || !base) return;

        const override = normalizePartOverride(parts?.[definition.id]);

        // Position already contains the current exploded baseline from
        // setExplode(). CPU/GPU are children of the compute assembly rather
        // than direct INTERNAL_GROUP children, so reset those local positions
        // explicitly before adding authored/focus offsets to prevent drift.
        if (definition.id === "cpu" || definition.id === "gpu") {
          target.position.copy(base.position);
        }
        target.position.x += override.position[0];
        target.position.y += override.position[1];
        target.position.z += override.position[2];

        target.rotation.set(
          base.rotation.x + override.rotation[0],
          base.rotation.y + override.rotation[1],
          base.rotation.z + override.rotation[2]
        );
        target.scale.set(
          base.scale.x * override.scale[0],
          base.scale.y * override.scale[1],
          base.scale.z * override.scale[2]
        );
        target.visible = override.visible !== false;
      });
    };

    const applyFocusPresentation = (chapter) => {
      const focusIds = FOCUS_PARTS_BY_CHAPTER[chapter];
      if (!focusIds?.length || !internalGroup) return;

      const targets = focusIds
        .map((id) => partTargets.get(id))
        .filter(Boolean);
      if (!targets.length) return;

      storyRoot.updateMatrixWorld(true);
      focusBox.makeEmpty();
      targets.forEach((target) => {
        target.updateWorldMatrix(true, true);
        focusPartBox.setFromObject(target);
        if (!focusPartBox.isEmpty()) focusBox.union(focusPartBox);
      });
      if (focusBox.isEmpty()) return;

      focusBox.getCenter(focusCenterWorld);
      internalGroup.getWorldPosition(focusAnchorWorld);

      // Translate the selected set as one preserved cluster toward the center
      // of the exposed internals. Keeping one shared world-space delta means
      // RAM pairs, cooling assemblies and battery cells never collapse onto
      // each other while still visibly floating into the presentation zone.
      const dx = (focusAnchorWorld.x - focusCenterWorld.x) * 0.62;
      const dy = (focusAnchorWorld.y - focusCenterWorld.y) * 0.62;
      const dz = (focusAnchorWorld.z - focusCenterWorld.z) * 0.62;

      targets.forEach((target) => {
        const parent = target.parent;
        if (!parent) return;
        focusParentInverse.copy(parent.matrixWorld).invert();
        focusLocalA.copy(focusCenterWorld).applyMatrix4(focusParentInverse);
        focusLocalB
          .set(
            focusCenterWorld.x + dx,
            focusCenterWorld.y + dy,
            focusCenterWorld.z + dz
          )
          .applyMatrix4(focusParentInverse);
        target.position.add(focusLocalB.sub(focusLocalA));
      });
    };

    const applyFocusDimming = (chapter, opacity = 1, now = 0) => {
      const focusIds = FOCUS_PARTS_BY_CHAPTER[chapter];
      const highlight = FOCUS_HIGHLIGHT_BY_CHAPTER[chapter];
      const setGroupOpacity = (group, nextOpacity, writeDepth) => {
        if (!group) return;
        group.traverse((object) => {
          if (!object.isMesh) return;
          if (object.name === "Display_Glass") {
            object.visible = nextOpacity > 0.5;
            return;
          }
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];
          materials.forEach((material) => {
            if (!material) return;
            if (material === screenMaterial) {
              material.opacity = nextOpacity;
              material.depthWrite = writeDepth;
              return;
            }
            material.transparent = nextOpacity < 0.99;
            material.opacity = nextOpacity;
            material.depthWrite = writeDepth;
          });
        });
      };

      const resetInternalEmissive = () => {
        EDITABLE_PARTS.forEach((definition) => {
          const target = partTargets.get(definition.id);
          if (!target) return;
          target.traverse((object) => {
            if (!object.isMesh) return;
            const materials = Array.isArray(object.material)
              ? object.material
              : [object.material];
            materials.forEach((material) => {
              if (!material || material === screenMaterial || !material.emissive) return;
              if (material.userData?.baseEmissive) {
                material.emissive.copy(material.userData.baseEmissive);
                material.emissiveIntensity = material.userData.baseEmissiveIntensity ?? 0;
              } else {
                material.emissive.setRGB(0, 0, 0);
                material.emissiveIntensity = 0;
              }
            });
          });
        });
      };

      if (!focusIds?.length) {
        setGroupOpacity(lidGroup, opacity, true);
        setGroupOpacity(topGroup, opacity, true);
        resetInternalEmissive();

        // For exterior hardware macro chapters (ports, exhaust, speakers, hinge,
        // edge), aim a crisp neutral-white studio macro key light at the exact
        // physical Focus_* marker so recessed cavities and fins gleam clearly.
        const extConfig =
          chapter === "HINGE" ? null : FEATURE_CAMERA_FOCUS[chapter];
        const extTarget = extConfig ? featureTargets.get(extConfig.object) : null;
        if (extTarget) {
          storyRoot.updateMatrixWorld(true);
          extTarget.getWorldPosition(focusCenterWorld);
          focusSpotTargetPos.set(
            focusCenterWorld.x + 0.28,
            focusCenterWorld.y + 0.14,
            focusCenterWorld.z + 0.48
          );
          focusSpotLight.position.lerp(focusSpotTargetPos, 0.25);
          focusSpotLight.color.setHex(0xe8f3ff);
          focusSpotLight.intensity = THREE.MathUtils.lerp(focusSpotLight.intensity, 1.45, 0.18);
        } else {
          focusSpotLight.intensity = THREE.MathUtils.lerp(focusSpotLight.intensity, 0, 0.18);
        }
        return;
      }

      // During deep internal hardware spotlight chapters, gracefully fade out
      // the upper lid and keyboard deck so the viewer gets an unobstructed,
      // studio-macro view of the real silicon, copper thermals, and PCB.
      setGroupOpacity(lidGroup, opacity * 0.04, false);
      setGroupOpacity(topGroup, opacity * 0.05, false);

      const focused = new Set(focusIds);
      const pulse = 0.86 + 0.14 * Math.sin(now * 0.0042);
      if (highlight) {
        focusHighlightColor.setHex(highlight.color);
      }

      // Compute world-space center of focused assembly so the 3D spotlight
      // tracks and illuminates the active component cleanly.
      storyRoot.updateMatrixWorld(true);
      focusBox.makeEmpty();

      EDITABLE_PARTS.forEach((definition) => {
        const target = partTargets.get(definition.id);
        if (!target) return;
        const isFocused = focused.has(definition.id);
        if (isFocused) {
          focusPartBox.setFromObject(target);
          if (!focusPartBox.isEmpty()) focusBox.union(focusPartBox);
        }
        const partOpacity = isFocused ? opacity : opacity * 0.24;

        target.traverse((object) => {
          if (!object.isMesh) return;
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];
          materials.forEach((material) => {
            if (!material || material === screenMaterial) return;
            material.transparent = !isFocused;
            material.opacity = partOpacity;
            material.depthWrite = isFocused;
            if (material.emissive) {
              if (isFocused && highlight) {
                material.emissive.copy(focusHighlightColor);
                material.emissiveIntensity = highlight.emissive * pulse;
              } else if (material.userData?.baseEmissive) {
                material.emissive.copy(material.userData.baseEmissive);
                material.emissiveIntensity = material.userData.baseEmissiveIntensity ?? 0;
              } else {
                material.emissive.setRGB(0, 0, 0);
                material.emissiveIntensity = 0;
              }
            }
          });
        });
      });

      if (!focusBox.isEmpty() && highlight) {
        focusBox.getCenter(focusCenterWorld);
        focusSpotTargetPos.set(
          focusCenterWorld.x,
          focusCenterWorld.y + 0.34,
          focusCenterWorld.z + 0.42
        );
        focusSpotLight.position.lerp(focusSpotTargetPos, 0.22);
        focusSpotLight.color.lerp(focusHighlightColor, 0.22);
        focusSpotLight.intensity = THREE.MathUtils.lerp(
          focusSpotLight.intensity,
          highlight.light * pulse,
          0.18
        );
      }
    };

    const applyFeatureCameraFocus = (state) => {
      if (!loadedScene || window.innerWidth < 820) return;
      if (FOCUS_PARTS_BY_CHAPTER[state?.chapter]) return;
      const config = FEATURE_CAMERA_FOCUS[state?.chapter];
      if (!config) return;
      const target = featureTargets.get(config.object);
      if (!target) return;

      storyRoot.updateMatrixWorld(true);
      target.getWorldPosition(featureWorld);
      featureAim.set(
        featureWorld.x + config.offset[0],
        featureWorld.y + config.offset[1],
        featureWorld.z + config.offset[2]
      );

      // Gentle lock onto the exact physical feature marker while respecting
      // our authored macro camera choreography.
      const focusBlend = editorMode || editorCameraPreviewState ? 1 : 0.18;
      cameraTarget.lerp(featureAim, focusBlend);
      camera.lookAt(cameraTarget);
      camera.updateProjectionMatrix();
    };

    const setScreen = (index, dt, opacityMultiplier = 1) => {
      if (!screenMaterial || !screenTextures.length) return;
      const safeIndex = Math.max(0, Math.min(screenTextures.length - 1, Math.round(index || 0)));
      const targetTex = screenTextures[safeIndex] || screenTextures[0];

      if (currentScreen !== safeIndex || screenMaterial.map !== targetTex) {
        currentScreen = safeIndex;
        screenMaterial.map = targetTex;
        screenMaterial.needsUpdate = true;
        screenFade = 1;
      }

      screenFade = Math.max(0, screenFade - dt / 0.36);
      const pulse = 1 - Math.sin(screenFade * Math.PI) * 0.16;
      const brightness = 0.94 + pulse * 0.06;
      screenMaterial.opacity = opacityMultiplier;
      screenMaterial.color.setRGB(brightness, brightness, brightness);
    };

    let lastChapter = "";
    let lastSection = "";
    let programmaticStoryTime = null;
    let programmaticScrollY = null;

    const getStoryTime = () => {
      if (
        programmaticStoryTime !== null &&
        programmaticScrollY !== null
      ) {
        if (Math.abs(window.scrollY - programmaticScrollY) <= 1) {
          return programmaticStoryTime;
        }
        programmaticStoryTime = null;
        programmaticScrollY = null;
      }
      const ranges = getSectionRanges(story);
      if (!ranges.length) return 0;

      // In the authoring engine, physical scroll position is the playhead.
      // scrollY === 0 must evaluate to story time 0 with no hidden viewport bias.
      const cursor = window.scrollY;

      const domRanges = ranges
        .map((range) => {
          const element = document.querySelector(range.selector || "#" + range.id);
          if (!element) return null;
          const top = element.offsetTop;
          const height = Math.max(1, element.offsetHeight);
          const travel = range.pin?.enabled
            ? Math.max(1, height - window.innerHeight)
            : height;
          return {
            range,
            element,
            top,
            bottom: top + height,
            height,
            travel,
          };
        })
        .filter(Boolean);

      if (!domRanges.length) return 0;

      if (cursor <= domRanges[0].top) return domRanges[0].range.start;

      const PIN_PORTION = 0.90;

      for (let index = 0; index < domRanges.length; index += 1) {
        const current = domRanges[index];
        const next = domRanges[index + 1];

        if (!next || cursor < next.top) {
          const offset = Math.max(0, cursor - current.top);
          let progress;
          if (!current.range.pin?.enabled || !next || offset <= current.travel) {
            const pinnedRatio = clamp01(offset / Math.max(1, current.travel));
            progress = next && current.range.pin?.enabled
              ? pinnedRatio * PIN_PORTION
              : pinnedRatio;
          } else {
            const unpinSpan = Math.max(1, next.top - (current.top + current.travel));
            const unpinRatio = clamp01((offset - current.travel) / unpinSpan);
            progress = PIN_PORTION + unpinRatio * (1 - PIN_PORTION);
          }
          return current.range.start + progress * current.range.duration;
        }
      }

      return ranges[ranges.length - 1].end;
    };

    const getStoryState = () => {
      const time = getStoryTime();
      const evaluated = evaluateProductTrack(story, time);
      const location = locateStoryTime(story, time);
      return {
        ...evaluated,
        storyTime: time,
        storyProgress: location.progress,
      };
    };

    const getPresentationTargets = (state) => {
      const mobile = window.innerWidth < 820;
      const phone = window.innerWidth < 520;
      const mobileX = phone ? 0.15 : mobile ? 0.32 : 1;
      const targetX = mobile ? state.x * mobileX : state.x;

      let mobileYOffset = -0.53;
      let mobileScale = 0.76;
      const section = state.section;

      // Section boundaries own layout framing. Chapter names are descriptive
      // keyframe metadata and may intentionally differ near a section exit.
      if (section === "top") {
        mobileYOffset = -0.76;
        mobileScale = 0.70;
      } else if (section === "performance") {
        mobileYOffset = -0.70;
        mobileScale = 0.66;
      } else if (section === "display") {
        mobileYOffset = -1.04;
        mobileScale = 0.57;
      } else if (section === "mobility") {
        mobileYOffset = -0.76;
        mobileScale = state.chapter === "REAR" ? 0.50 : 0.56;
      } else if (section === "design") {
        mobileYOffset = -0.76;
        mobileScale = 0.46;
      } else if (section === "final") {
        mobileYOffset = -0.72;
        mobileScale = 0.64;
      }

      const explodeAmount =
        state.explodeEnabled === false ? 0 : smooth(state.explode ?? 0);
      // Exploded assemblies extend mostly upward from the authored product
      // origin. Counter that growth at the presentation layer so the complete
      // lid-to-base stack remains centered in the viewport. Because this is
      // derived from explode progress it fades out naturally on reassembly and
      // does not alter any authored keyframe positions.
      const explodeYOffset =
        explodeAmount * (mobile ? -0.12 : -0.24);
      const explodeScale = lerp(1, mobile ? 0.90 : 0.82, explodeAmount);

      return {
        mobile,
        targetX,
        targetY:
          (mobile ? state.y + mobileYOffset : state.y) + explodeYOffset,
        targetScale:
          state.scale * (mobile ? mobileScale : 1) * explodeScale,
      };
    };

    const snapToCurrentStoryState = () => {
      if (!loadedScene) return;

      let state = getStoryState();

      if (reducedMotion) {
        const mobile = window.innerWidth < 820;
        state = S({
          x: mobile ? 0.1 : 0.72,
          y: mobile ? -0.52 : 0,
          ry: -0.12,
          scale: mobile ? 0.70 : 0.88,
          screen: state.screen,
          shadow: 0.48,
        });
        state.chapter = "ARRIVAL";
      }

      const { mobile, targetX, targetY, targetScale } =
        getPresentationTargets(state);

      storyRoot.position.set(targetX, targetY, state.z);
      storyRoot.rotation.set(state.rx, state.ry, state.rz);
      storyRoot.scale.setScalar(targetScale);

      let storyOpacity = state.opacity ?? 1;
      if (
        mobile && state.section === "design"
      ) {
        storyOpacity *= state.chapter === "RETURN" ? 0.45 : 0.16;
      }

      setLid(state.lid ?? 1);
      setKeyboardLight(state.keyboardLight ?? 1);
      setExplode(
        reducedMotion || state.explodeEnabled === false ? 0 : state.explode
      );
      applyPartOverrides(state.parts || {});
      // Component callout motion is authored explicitly in state.parts. The
      // selected part therefore moves relative to the exploded baseline and
      // can be positioned directly with the editor transform controls.
      setScreen(state.screen, 1, storyOpacity);

      hemi.intensity = state.ambient;
      key.intensity = state.cool;
      rim.intensity = state.warm;
      fill.intensity = state.cool * 5.0;
      warmFill.intensity = state.warm * 3.4;
      cameraFill.intensity = 0.85 + state.ambient * 0.55;

      shadow.position.x = targetX * 0.92;
      shadow.position.y = -0.62 + Math.min(0.18, Math.max(-0.12, targetY * 0.14));
      const shadowScale = lerp(0.55, 1.05, state.shadow);
      shadow.scale.set(shadowScale, shadowScale * 0.62, 1);
      const allowShadow =
        (state.shadow ?? 0) > 0.35 && (state.explode ?? 0) < 0.05;
      shadow.material.opacity = allowShadow
        ? Math.min(0.42, (state.shadow - 0.32) * 0.55)
        : 0;

      loadedScene.traverse((object) => {
        if (!object.isMesh || object.name === "Display_Glass") return;
        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        materials.forEach((material) => {
          if (material !== screenMaterial) {
            material.transparent = storyOpacity < 0.99;
            material.opacity = storyOpacity;
            material.depthWrite = storyOpacity >= 0.99;
          }
        });
      });
      applyFocusDimming(state.chapter, storyOpacity);

      lastChapter = state.chapter;
      lastSection = state.section;
      attachToSection(state.section, state.chapter);
      shell.dataset.chapter = state.chapter;
      document.body.dataset.storyChapter = state.chapter;
      setChapter(state.chapter);

      renderer.render(scene, camera);
    };

    const resize = () => {
      const width = Math.max(1, window.innerWidth);
      const height = Math.max(1, window.innerHeight);
      renderer.setPixelRatio(
        Math.min(window.devicePixelRatio || 1, width < 820 ? 1.2 : 1.55)
      );
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.position.z = width < 520 ? 5.65 : width < 820 ? 5.1 : 4.45;
      camera.position.y = width < 520 ? 1.36 : width < 820 ? 1.28 : 1.18;
      cameraTarget.set(0, width < 820 ? -0.15 : -0.08, 0);
      camera.lookAt(cameraTarget);
      camera.updateProjectionMatrix();
    };

    resize();
    window.addEventListener("resize", resize, { passive: true });

    const captureProductState = () => {
      const evaluated = editorPreviewState || getStoryState();
      const zero = getPresentationTargets({
        ...evaluated,
        x: 0,
        y: 0,
        scale: 1,
      });
      const unitX = getPresentationTargets({
        ...evaluated,
        x: 1,
        y: 0,
        scale: 1,
      });

      const xFactor = unitX.targetX - zero.targetX || 1;
      const scaleFactor = zero.targetScale || 1;

      return {
        ...evaluated,
        x: (storyRoot.position.x - zero.targetX) / xFactor,
        y: storyRoot.position.y - zero.targetY,
        z: storyRoot.position.z,
        rx: storyRoot.rotation.x,
        ry: storyRoot.rotation.y,
        rz: storyRoot.rotation.z,
        scale: storyRoot.scale.x / scaleFactor,
      };
    };

    const previewProductState = (nextState) => {
      const base = getStoryState();
      const next = { ...base, ...nextState };
      editorPreviewState = next;
      editorManipulating = false;

      const { targetX, targetY, targetScale } =
        getPresentationTargets(next);

      storyRoot.position.set(targetX, targetY, next.z);
      storyRoot.rotation.set(next.rx, next.ry, next.rz);
      storyRoot.scale.setScalar(targetScale);
      setLid(next.lid ?? 1);
      setKeyboardLight(next.keyboardLight ?? 1);
      setExplode(next.explodeEnabled === false ? 0 : next.explode);
      applyPartOverrides(next.parts || {});
      setScreen(next.screen, 1, next.opacity ?? 1);
    };

    const getEditableParts = () =>
      EDITABLE_PARTS.map((definition) => ({
        id: definition.id,
        label: definition.label,
        available: partTargets.has(definition.id),
      })).filter((part) => part.available);

    const selectEditablePart = (id = null) => {
      selectedPartId = id && partTargets.has(id) ? id : null;

      if (!transformAdapter) return selectedPartId;
      if (selectedPartId) {
        transformAdapter.attach(partTargets.get(selectedPartId));
        transformAdapter.setSpace("local");
      } else {
        transformAdapter.attach(storyRoot);
        transformAdapter.setSpace("world");
      }
      return selectedPartId;
    };

    const capturePartState = (id = selectedPartId) => {
      if (!id) return null;
      const evaluated = editorPreviewState || getStoryState();
      return normalizePartOverride(evaluated.parts?.[id]);
    };

    const previewPartState = (id, nextState) => {
      if (!id || !partTargets.has(id)) return;
      const base = editorPreviewState || getStoryState();
      const nextPart = {
        ...normalizePartOverride(base.parts?.[id]),
        ...nextState,
      };
      nextPart.position = [...(nextState.position || nextPart.position)];
      nextPart.rotation = [...(nextState.rotation || nextPart.rotation)];
      nextPart.scale = [...(nextState.scale || nextPart.scale)];

      editorPreviewState = {
        ...base,
        parts: {
          ...(base.parts || {}),
          [id]: nextPart,
        },
      };
      editorManipulating = false;

      setExplode(
        editorPreviewState.explodeEnabled === false
          ? 0
          : editorPreviewState.explode
      );
      applyPartOverrides(editorPreviewState.parts || {});
    };

    const captureCameraState = () => ({
      position: [
        camera.position.x,
        camera.position.y,
        camera.position.z,
      ],
      target: [
        cameraTarget.x,
        cameraTarget.y,
        cameraTarget.z,
      ],
      fov: camera.fov,
    });

    const previewCameraState = (nextState) => {
      editorCameraPreviewState = {
        ...(editorCameraPreviewState || captureCameraState()),
        ...nextState,
      };

      const position = editorCameraPreviewState.position || [0, 1.18, 4.45];
      const target = editorCameraPreviewState.target || [0, -0.08, 0];

      camera.position.set(position[0], position[1], position[2]);
      cameraTarget.set(target[0], target[1], target[2]);
      camera.fov = editorCameraPreviewState.fov ?? 36;
      camera.lookAt(cameraTarget);
      camera.updateProjectionMatrix();
    };

    const scrollToTime = (time) => {
      editorPreviewState = null;
      editorCameraPreviewState = null;
      const located = locateStoryTime(story, time);
      const section = located.section;
      if (!section) return;

      const element = document.querySelector(
        section.selector || "#" + section.id
      );
      if (!element) return;

      const PIN_PORTION = 0.90;
      const isLastSection =
        story.sections?.[story.sections.length - 1]?.id === section.id;
      const travel = section.pin?.enabled
        ? Math.max(1, element.offsetHeight - window.innerHeight)
        : element.offsetHeight;
      let pixelOffset;
      if (!section.pin?.enabled || isLastSection || located.progress <= PIN_PORTION) {
        const scaledProgress =
          !isLastSection && section.pin?.enabled
            ? located.progress / PIN_PORTION
            : located.progress;
        pixelOffset = scaledProgress * travel;
      } else {
        const unpinSpan = Math.max(1, element.offsetHeight - travel);
        const unpinRatio = (located.progress - PIN_PORTION) / (1 - PIN_PORTION);
        pixelOffset = travel + unpinRatio * unpinSpan;
      }
      const targetCursor = element.offsetTop + pixelOffset;
      const top = Math.max(0, targetCursor);

      // Timeline scrubbing must remain deterministic even when the shipped
      // page is running Lenis. Editor/QA jumps therefore update Lenis
      // immediately instead of passing through the smooth interpolation.
      // Set the deterministic playhead before moving the browser. Lenis emits
      // its scroll event synchronously for immediate jumps, so the first frame
      // at the destination must already evaluate the destination chapter.
      programmaticStoryTime = located.time;
      programmaticScrollY = top;

      const lenis = getActiveLenis();
      if (lenis) {
        lenis.scrollTo(top, { immediate: true, force: true });
      } else {
        window.scrollTo({ top, behavior: "instant" });
      }
    };

    const unregisterRuntimeApi = registerStoryRuntimeApi({
      captureProductState,
      previewProductState,
      getEditableParts,
      selectEditablePart,
      capturePartState,
      previewPartState,
      captureCameraState,
      previewCameraState,
      scrollToTime,
      clearEditorPreview(track = "all") {
        if (track === "all" || track === "product") {
          editorPreviewState = null;
        }
        if (track === "all" || track === "camera") {
          editorCameraPreviewState = null;
        }
      },
      setEditorEnabled(enabled) {
        if (!transformAdapter) return;
        transformAdapter.setEnabled(enabled);
        shell.style.pointerEvents = enabled ? "auto" : "";
      },
      setTransformMode(mode) {
        transformAdapter?.setMode(mode);
      },
      getStoryTime,
      getStory() {
        return story;
      },
    });

    // Subtle desktop pointer-reactive parallax for a tactile luxury feel.
    let ptrTargetX = 0;
    let ptrTargetY = 0;
    let ptrX = 0;
    let ptrY = 0;
    const onPointerMove = (event) => {
      if (editorMode || reducedMotion || window.innerWidth < 820) return;
      ptrTargetX = (event.clientX / Math.max(1, window.innerWidth) - 0.5) * 2;
      ptrTargetY = (event.clientY / Math.max(1, window.innerHeight) - 0.5) * 2;
    };
    const onPointerLeave = () => {
      ptrTargetX = 0;
      ptrTargetY = 0;
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave, { passive: true });

    let lastTime = performance.now();
    let frame = 0;
    const render = (now) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      if (loadedScene) {
        let state = getStoryState();
        const mobile = window.innerWidth < 820;

        if (editorPreviewState) {
          state = { ...state, ...editorPreviewState };
        }

        if (reducedMotion && !editorMode) {
          state = {
            ...state,
            ...S({
              x: mobile ? 0.1 : 0.72,
              y: mobile ? -0.52 : 0,
              ry: -0.12,
              scale: mobile ? 0.70 : 0.88,
              screen: state.screen,
              shadow: 0.48,
            }),
          };
        }

        const { targetX, targetY, targetScale } =
          getPresentationTargets(state);

        // Framerate-independent exponential damping for cinema-grade silkiness.
        const posDamp = editorMode ? 1 : 1 - Math.exp(-6.8 * dt);
        const rotDamp = editorMode ? 1 : 1 - Math.exp(-6.2 * dt);
        const ptrDamp = 1 - Math.exp(-3.6 * dt);
        ptrX = THREE.MathUtils.lerp(ptrX, ptrTargetX, ptrDamp);
        ptrY = THREE.MathUtils.lerp(ptrY, ptrTargetY, ptrDamp);

        if (!editorManipulating) {
          // Living multi-axis weightless float: gentle vertical breath plus
          // subtle roll/pitch sway that calms smoothly when resting on a pedestal.
          const isFloating = !reducedMotion && !editorMode;
          const floatAmp = (state.shadow ?? 0) > 0.55 ? 0.45 : 1.0;
          const floatY = isFloating
            ? Math.sin(now * 0.00095) * 0.015 * floatAmp
            : 0;
          const floatRoll = isFloating
            ? Math.sin(now * 0.00068 + 0.9) * 0.014 * floatAmp
            : 0;
          const floatPitch = isFloating
            ? Math.cos(now * 0.00075) * 0.010 * floatAmp
            : 0;

          storyRoot.position.x = THREE.MathUtils.lerp(
            storyRoot.position.x,
            targetX,
            posDamp
          );
          storyRoot.position.y = THREE.MathUtils.lerp(
            storyRoot.position.y,
            targetY + floatY,
            posDamp
          );
          storyRoot.position.z = THREE.MathUtils.lerp(
            storyRoot.position.z,
            state.z,
            posDamp
          );

          // Shortest-arc angular damping eliminates gimbal snapping.
          storyRoot.rotation.x = lerpAngle(
            storyRoot.rotation.x,
            state.rx + floatPitch,
            rotDamp
          );
          storyRoot.rotation.y = lerpAngle(
            storyRoot.rotation.y,
            state.ry,
            rotDamp
          );
          storyRoot.rotation.z = lerpAngle(
            storyRoot.rotation.z,
            state.rz + floatRoll,
            rotDamp
          );

          const scale = THREE.MathUtils.lerp(
            storyRoot.scale.x,
            targetScale,
            posDamp
          );
          storyRoot.scale.setScalar(scale);

          if (!editorMode && !reducedMotion && !mobile) {
            modelRoot.rotation.y = ptrX * 0.042;
            modelRoot.rotation.x = ptrY * 0.026;
          } else {
            modelRoot.rotation.set(0, 0, 0);
          }
        }

        const cameraState =
          editorCameraPreviewState ||
          evaluateCameraTrack(story, state.storyTime ?? getStoryTime());

        if (cameraState) {
          const cameraBlend = editorMode ? 0.32 : 1 - Math.exp(-6.2 * dt);
          camera.position.x = THREE.MathUtils.lerp(
            camera.position.x,
            cameraState.position[0],
            cameraBlend
          );
          camera.position.y = THREE.MathUtils.lerp(
            camera.position.y,
            cameraState.position[1],
            cameraBlend
          );
          camera.position.z = THREE.MathUtils.lerp(
            camera.position.z,
            cameraState.position[2],
            cameraBlend
          );
          cameraTarget.x = THREE.MathUtils.lerp(
            cameraTarget.x,
            cameraState.target[0],
            cameraBlend
          );
          cameraTarget.y = THREE.MathUtils.lerp(
            cameraTarget.y,
            cameraState.target[1],
            cameraBlend
          );
          cameraTarget.z = THREE.MathUtils.lerp(
            cameraTarget.z,
            cameraState.target[2],
            cameraBlend
          );
          camera.fov = THREE.MathUtils.lerp(
            camera.fov,
            cameraState.fov,
            cameraBlend
          );
          camera.lookAt(cameraTarget);
          camera.updateProjectionMatrix();
        }

        let storyOpacity = state.opacity ?? 1;
        if (
          mobile && state.section === "design"
        ) {
          storyOpacity *= state.chapter === "RETURN" ? 0.45 : 0.16;
        }

        if (!editorManipulating) {
          setLid(state.lid ?? 1);
          setKeyboardLight(state.keyboardLight ?? 1);
          setExplode(
            reducedMotion || state.explodeEnabled === false ? 0 : state.explode
          );
          applyPartOverrides(state.parts || {});
        }
        setScreen(state.screen, dt, storyOpacity);
        applyFeatureCameraFocus(state);

        const lightDamp = 1 - Math.exp(-4.5 * dt);
        hemi.intensity = THREE.MathUtils.lerp(
          hemi.intensity,
          state.ambient * 0.72,
          lightDamp
        );
        key.intensity = THREE.MathUtils.lerp(
          key.intensity,
          state.cool * 0.85,
          lightDamp
        );
        rim.intensity = THREE.MathUtils.lerp(
          rim.intensity,
          state.warm * 1.1,
          lightDamp
        );
        fill.intensity = THREE.MathUtils.lerp(
          fill.intensity,
          state.cool * 4.2,
          lightDamp
        );
        warmFill.intensity = THREE.MathUtils.lerp(
          warmFill.intensity,
          state.warm * 3.0,
          lightDamp
        );
        cameraFill.intensity = THREE.MathUtils.lerp(
          cameraFill.intensity,
          0.75 + state.ambient * 0.45,
          lightDamp
        );

        shadow.position.x = THREE.MathUtils.lerp(
          shadow.position.x,
          targetX * 0.92,
          posDamp
        );
        shadow.position.y = THREE.MathUtils.lerp(
          shadow.position.y,
          -0.62 + Math.min(0.18, Math.max(-0.12, targetY * 0.14)),
          posDamp
        );
        const shadowScale = lerp(0.55, 1.05, state.shadow);
        shadow.scale.set(shadowScale, shadowScale * 0.62, 1);
        const allowShadow =
          (state.shadow ?? 0) > 0.35 && (state.explode ?? 0) < 0.05;
        shadow.material.opacity = THREE.MathUtils.lerp(
          shadow.material.opacity,
          allowShadow ? Math.min(0.42, (state.shadow - 0.32) * 0.55) : 0,
          posDamp
        );

        const opacity = storyOpacity;
        loadedScene.traverse((object) => {
          if (!object.isMesh || object.name === "Display_Glass") return;
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];
          materials.forEach((material) => {
            if (material !== screenMaterial) {
              material.transparent = opacity < 0.99;
              material.opacity = opacity;
              material.depthWrite = opacity >= 0.99;
            }
          });
        });
        applyFocusDimming(state.chapter, opacity, now);

        if (
          lastChapter !== state.chapter ||
          lastSection !== state.section
        ) {
          lastChapter = state.chapter;
          lastSection = state.section;
          attachToSection(state.section, state.chapter);
          shell.dataset.chapter = state.chapter;
          document.body.dataset.storyChapter = state.chapter;
          setChapter(state.chapter);
        }

        publishStoryRuntimeState({
          time: state.storyTime ?? getStoryTime(),
          section: state.section,
          progress: state.storyProgress ?? 0,
          chapter: state.chapter,
          manipulating: editorManipulating,
          ready: true,
        });
      }

      renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    };

    frame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
      unregisterRuntimeApi();
      unsubscribeStory();

      transformAdapter?.dispose();

      if (homeParent && shell.parentElement !== homeParent) {
        homeParent.appendChild(shell);
      }
      document.body.classList.remove("nova-persistent-3d-ready");
      document.body.classList.remove("nova-persistent-3d-fallback");

      const heroFallback = document.querySelector(".hero-laptop");
      if (heroFallback) {
        heroFallback.style.removeProperty("opacity");
        heroFallback.style.removeProperty("visibility");
      }

      delete document.body.dataset.storyChapter;

      if (loadedScene) {
        loadedScene.traverse((object) => {
          if (object.geometry) object.geometry.dispose?.();
          if (object.material) {
            const materials = Array.isArray(object.material)
              ? object.material
              : [object.material];
            materials.forEach((material) => material?.dispose?.());
          }
        });
      }
      screenTextures.forEach((t) => t?.dispose?.());
      envRT.dispose();
      shadowTexture.dispose();
      shadowGeo.dispose();
      shadowMat.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      className={"persistent-product " + (ready ? "is-ready" : "")}
      ref={shellRef}
      aria-hidden="true"
    >
      <canvas className="persistent-product-canvas" ref={canvasRef} />
      <div className="persistent-product-hud">
        <span>{chapter}</span>
        <i />
      </div>
    </div>
  );
}
