import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

import { createThreeTransformAdapter } from "./scroll-story/adapters/three/createThreeTransformAdapter.js";
import {
  evaluateCameraTrack,
  evaluateProductTrack,
  getSectionRanges,
  locateStoryTime,
} from "./scroll-story/core/storyMath.js";
import {
  publishStoryRuntimeState,
  registerStoryRuntimeApi,
} from "./scroll-story/runtime/editorBridge.js";
import { getActiveLenis } from "./scroll-story/runtime/lenisBridge.js";
import { isStoryEditorMode, novaStoryStore } from "./story/novaStoryStore.js";

import novaModelUrl from "../assets/3d/NOVA_Canonical_Laptop.glb?url";

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

const FEATURE_CAMERA_FOCUS = {
  MOTHERBOARD: { object: "Motherboard", offset: [-0.10, 0.00, 0.00] },
  GPU: { object: "GPU_Package", offset: [-0.08, 0.00, 0.00] },
  CPU: { object: "CPU_Package", offset: [-0.08, 0.00, 0.00] },
  MEMORY: { object: "RAM_SODIMM_1", offset: [-0.08, 0.00, 0.00] },
  STORAGE: { object: "SSD_Module", offset: [-0.08, 0.00, 0.00] },
  COOLING: { object: "HeatPipe_1", offset: [-0.08, 0.00, 0.00] },
  BATTERY: { object: "Battery_Cell_2", offset: [-0.08, 0.00, 0.00] },
  SCREEN_THIN: { object: "Focus_Screen_Edge", offset: [-0.30, 0.00, 0.00] },
  KEYBOARD: { object: "Focus_Keyboard", offset: [-0.30, 0.00, 0.00] },
  TOUCHPAD: { object: "Focus_Touchpad", offset: [-0.28, 0.00, 0.00] },
  PORTS_RIGHT: { object: "Focus_Ports_Right", offset: [-0.30, 0.00, 0.00] },
  PORTS_LEFT: { object: "Focus_Ports_Left", offset: [-0.30, 0.00, 0.00] },
  EXHAUST: { object: "Focus_Exhaust", offset: [-0.30, 0.00, 0.00] },
  SPEAKERS: { object: "Focus_Speaker_R", offset: [-0.30, 0.00, 0.00] },
  HINGE: { object: "Focus_Hinge", offset: [-0.30, 0.00, 0.00] },
  EDGE: { object: "Focus_Edge", offset: [-0.30, 0.00, 0.00] },
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
    renderer.toneMappingExposure = 0.94;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.01, 40);
    camera.position.set(0, 1.18, 4.45);
    const cameraTarget = new THREE.Vector3(0, -0.08, 0);
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

    const hemi = new THREE.HemisphereLight(0xbad8ff, 0x12151b, 1.2);
    scene.add(hemi);

    const key = new THREE.DirectionalLight(0xcfe6ff, 3);
    key.position.set(3.2, 4.2, 4.4);
    scene.add(key);

    const rim = new THREE.DirectionalLight(0xff9355, 1.2);
    rim.position.set(-3.5, 1.8, -3.3);
    scene.add(rim);

    const fill = new THREE.PointLight(0x75b5ff, 18, 10, 2);
    fill.position.set(-2.2, 1.3, 2.8);
    scene.add(fill);

    const warmFill = new THREE.PointLight(0xff8b4f, 8, 9, 2);
    warmFill.position.set(2.8, 0.8, -1.8);
    scene.add(warmFill);

    const cameraFill = new THREE.DirectionalLight(0xdbe8ff, 1.25);
    cameraFill.position.set(0, 2.6, 5.2);
    scene.add(cameraFill);

    const shadowGeo = new THREE.CircleGeometry(1, 64);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x020407,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.scale.set(0.72, 0.16, 1);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(0.48, -0.64, -0.18);
    scene.add(shadow);

    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);

    // Screen artwork is intentionally independent from the physical display
    // geometry. Keep the existing bezel/notch/glass, but render one clean NOVA
    // title across every story chapter.
    const makeNovaScreenTexture = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 1600;
      canvas.height = 1000;
      const ctx = canvas.getContext("2d");

      const bg = ctx.createRadialGradient(800, 430, 40, 800, 500, 980);
      bg.addColorStop(0, "#0b1725");
      bg.addColorStop(0.46, "#07101a");
      bg.addColorStop(1, "#020407");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = '700 310px "Arial", "Helvetica", sans-serif';
      ctx.fillStyle = "#f4f7fb";
      ctx.shadowColor = "rgba(166, 211, 255, 0.18)";
      ctx.shadowBlur = 30;
      ctx.fillText("NOVA", canvas.width / 2, canvas.height / 2 + 10);

      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.flipY = false;
      texture.anisotropy = Math.min(
        8,
        renderer.capabilities.getMaxAnisotropy?.() || 1
      );
      texture.needsUpdate = true;
      return texture;
    };

    const novaScreenTexture = makeNovaScreenTexture();

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
      m.transparent = true;
      m.opacity = 1;

      if (m.name === "NOVA Graphite") {
        m.color.setRGB(0.085, 0.092, 0.105);
        m.metalness = 0.56;
        m.roughness = 0.34;
      } else if (m.name === "NOVA Dark Edge") {
        m.color.setRGB(0.028, 0.032, 0.038);
        m.metalness = 0.40;
        m.roughness = 0.42;
      } else if (m.name === "Motherboard PCB") {
        m.color.setRGB(0.010, 0.035, 0.031);
        m.metalness = 0.06;
        m.roughness = 0.46;
      } else if (m.name === "RAM PCB") {
        m.color.setRGB(0.006, 0.015, 0.016);
        m.metalness = 0.04;
        m.roughness = 0.48;
      } else if (m.name === "Contact Gold") {
        m.color.setRGB(0.62, 0.34, 0.07);
        m.metalness = 0.88;
        m.roughness = 0.20;
      } else if (m.name === "Copper") {
        m.color.setRGB(0.58, 0.18, 0.045);
        m.metalness = 0.78;
        m.roughness = 0.24;
      } else if (m.name === "Fan Dark") {
        m.color.setRGB(0.012, 0.018, 0.026);
        m.metalness = 0.14;
        m.roughness = 0.42;
      } else if (m.name === "Silicon Package") {
        m.color.setRGB(0.025, 0.032, 0.041);
        m.metalness = 0.24;
        m.roughness = 0.34;
      } else if (m.name === "Silicon Die") {
        m.color.setRGB(0.12, 0.145, 0.18);
        m.metalness = 0.70;
        m.roughness = 0.18;
      } else if (m.name === "Keyboard Underlight") {
        m.color.setRGB(0.010, 0.014, 0.020);
        if (m.emissive) m.emissive.setRGB(0.24, 0.36, 0.56);
        m.emissiveIntensity = 0.38;
        m.metalness = 0.0;
        m.roughness = 0.42;
      } else if (m.name === "Keyboard Legend Glow") {
        m.color.setRGB(0.50, 0.58, 0.70);
        if (m.emissive) m.emissive.setRGB(0.74, 0.84, 1.0);
        m.emissiveIntensity = 1.65;
        m.metalness = 0.0;
        m.roughness = 0.30;
      } else if (m.name === "Trackpad Glass") {
        m.color.setRGB(0.018, 0.022, 0.028);
        m.metalness = 0.05;
        m.roughness = 0.30;
      } else if (m.name === "Trackpad Edge") {
        m.color.setRGB(0.060, 0.070, 0.082);
        m.metalness = 0.62;
        m.roughness = 0.24;
      } else if (m.name === "Port Metal") {
        m.color.setRGB(0.20, 0.22, 0.26);
        m.metalness = 0.78;
        m.roughness = 0.25;
      } else if (m.name === "Thermal Pad") {
        m.color.setRGB(0.035, 0.070, 0.085);
        m.metalness = 0.0;
        m.roughness = 0.68;
      } else if (m.name === "PCB Silkscreen") {
        m.color.setRGB(0.28, 0.32, 0.32);
        m.metalness = 0.0;
        m.roughness = 0.74;
      } else if (m.name === "VRM Inductor") {
        m.color.setRGB(0.028, 0.032, 0.038);
        m.metalness = 0.24;
        m.roughness = 0.38;
      } else if (m.name === "Keyboard Per-Key Glow") {
        m.color.setRGB(0.12, 0.16, 0.24);
        if (m.emissive) m.emissive.setRGB(0.54, 0.70, 1.0);
        m.emissiveIntensity = 1.35;
        keyboardGlowMaterials.add(m);
      } else if (m.name === "Keyboard Legend Glow") {
        m.color.setRGB(0.70, 0.76, 0.86);
        if (m.emissive) m.emissive.setRGB(0.72, 0.84, 1.0);
        m.emissiveIntensity = 1.05;
        keyboardLegendMaterials.add(m);
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
        if (glassMesh) glassMesh.visible = false;

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
      // Keep the service/exploded view compact enough to read as one laptop.
      // The authored part relationships remain intact, but the previous full
      // offset range pulled the lid/deck/lower shell and internals so far apart
      // that the composition looked like unrelated floating slabs.
      const p = smooth(progress) * 0.34;
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

      apply(lidGroup, 0, 0.235, 0.026);
      apply(topGroup, 0, 0.245, 0.026);
      apply(internalGroup, 0, 0.000, 0);
      apply(lowerGroup, 0, -0.205, -0.012);

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

        offsetComponent("Motherboard", 0, 0.030, 0);
        offsetPrefix("BoardDetail_", 0, 0.030, 0);
        offsetComponent("CPU_GPU_Package", 0, 0.050, 0);
        offsetComponent("RAM_SODIMM_1", -0.018, 0.048, 0.010);
        offsetComponent("RAM_SODIMM_2", -0.006, 0.056, 0.014);
        offsetComponent("SSD_Module", -0.014, 0.042, 0);
        offsetComponent("HeatPipe_1", 0, 0.070, 0.018);
        offsetComponent("HeatPipe_2", 0, 0.060, 0.015);

        offsetPrefix("Fan_L", -0.052, 0.068, 0.014);
        offsetPrefix("Fan_R", 0.052, 0.068, 0.014);
        offsetPrefix("Heatsink_L", -0.036, 0.080, 0.010);
        offsetPrefix("Heatsink_R", 0.036, 0.080, 0.010);

        for (let i = 1; i <= 4; i += 1) {
          const dy = -0.042 - i * 0.006;
          offsetComponent("Battery_Cell_" + i, 0, dy, 0);
          offsetComponent("BatteryDetail_Seam_" + i, 0, dy, 0);
        }

        offsetComponent("Internal_Midplate", 0, -0.088, -0.008);
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

    const applyFocusDimming = (chapter, opacity = 1) => {
      const focusIds = FOCUS_PARTS_BY_CHAPTER[chapter];
      if (!focusIds?.length) return;
      const focused = new Set(focusIds);

      EDITABLE_PARTS.forEach((definition) => {
        const target = partTargets.get(definition.id);
        if (!target) return;
        const partOpacity = focused.has(definition.id)
          ? opacity
          : opacity * 0.16;

        target.traverse((object) => {
          if (!object.isMesh) return;
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];
          materials.forEach((material) => {
            if (!material || material === screenMaterial) return;
            material.transparent = true;
            material.opacity = partOpacity;
            material.depthWrite = focused.has(definition.id);
          });
        });
      });
    };

    const applyFeatureCameraFocus = (state) => {
      if (!loadedScene || window.innerWidth < 820) return;
      // Internal component callouts must stay spatially separated from the
      // exploded laptop. Do not chase the moved component with the camera;
      // the authored camera track holds the laptop while the selected part
      // visibly peels away and returns.
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

      // Preview/editor frames are exact for screenshot/authoring QA. The live
      // page eases toward the physical marker so scroll motion remains filmic.
      const focusBlend = editorMode || editorCameraPreviewState ? 1 : 0.26;
      cameraTarget.lerp(featureAim, focusBlend);
      camera.lookAt(cameraTarget);
      camera.updateProjectionMatrix();
    };

    const setScreen = (index, dt, opacityMultiplier = 1) => {
      if (!screenMaterial || !novaScreenTexture) return;

      if (currentScreen !== index || screenMaterial.map !== novaScreenTexture) {
        currentScreen = index;
        screenMaterial.map = novaScreenTexture;
        screenMaterial.needsUpdate = true;
        screenFade = 1;
      }

      screenFade = Math.max(0, screenFade - dt / 0.4);
      const pulse = 1 - Math.sin(screenFade * Math.PI) * 0.22;
      const brightness = 0.92 + pulse * 0.08;
      screenMaterial.opacity = (0.94 + pulse * 0.06) * opacityMultiplier;
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

      for (let index = 0; index < domRanges.length; index += 1) {
        const current = domRanges[index];
        const next = domRanges[index + 1];

        if (!next || cursor < next.top) {
          const progress = clamp01(
            (cursor - current.top) / Math.max(1, current.travel)
          );
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

      shadow.position.x = targetX * 0.80;
      shadow.position.y =
        -0.67 + Math.min(0.26, Math.max(-0.1, targetY * 0.12));
      const shadowScale = lerp(0.48, 0.82, state.shadow);
      shadow.scale.x = shadowScale;
      shadow.scale.y = 0.12 + state.shadow * 0.06;
      shadow.material.opacity = Math.min(
        0.022,
        0.002 + state.shadow * 0.018
      );

      loadedScene.traverse((object) => {
        if (!object.isMesh) return;
        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        materials.forEach((material) => {
          if (material !== screenMaterial) {
            material.transparent = true;
            material.opacity = storyOpacity;
            material.depthWrite = true;
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

      const travel = section.pin?.enabled
        ? Math.max(1, element.offsetHeight - window.innerHeight)
        : element.offsetHeight;
      const targetCursor =
        element.offsetTop + located.progress * travel;
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

        if (!editorManipulating) {
          // Authoring mode is frame-accurate: the scene must sit exactly
          // on the playhead while scrubbing instead of easing behind it.
          const blend = editorMode ? 1 : 0.075;
          storyRoot.position.x = THREE.MathUtils.lerp(
            storyRoot.position.x,
            targetX,
            blend
          );
          storyRoot.position.y = THREE.MathUtils.lerp(
            storyRoot.position.y,
            targetY +
              (reducedMotion || editorMode
                ? 0
                : Math.sin(now * 0.00065) * 0.012),
            editorMode ? 0.22 : 0.07
          );
          storyRoot.position.z = THREE.MathUtils.lerp(
            storyRoot.position.z,
            state.z,
            editorMode ? 0.22 : 0.07
          );

          storyRoot.rotation.x = THREE.MathUtils.lerp(
            storyRoot.rotation.x,
            state.rx,
            blend
          );
          storyRoot.rotation.y = THREE.MathUtils.lerp(
            storyRoot.rotation.y,
            state.ry,
            blend
          );
          storyRoot.rotation.z = THREE.MathUtils.lerp(
            storyRoot.rotation.z,
            state.rz,
            blend
          );

          const scale = THREE.MathUtils.lerp(
            storyRoot.scale.x,
            targetScale,
            blend
          );
          storyRoot.scale.setScalar(scale);
        }

        const cameraState =
          editorCameraPreviewState ||
          evaluateCameraTrack(story, state.storyTime ?? getStoryTime());

        if (cameraState) {
          const cameraBlend = editorMode ? 0.22 : 0.075;
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

        hemi.intensity = THREE.MathUtils.lerp(
          hemi.intensity,
          state.ambient,
          0.05
        );
        key.intensity = THREE.MathUtils.lerp(
          key.intensity,
          state.cool,
          0.05
        );
        rim.intensity = THREE.MathUtils.lerp(
          rim.intensity,
          state.warm,
          0.05
        );
        fill.intensity = THREE.MathUtils.lerp(
          fill.intensity,
          state.cool * 5.0,
          0.05
        );
        warmFill.intensity = THREE.MathUtils.lerp(
          warmFill.intensity,
          state.warm * 3.4,
          0.05
        );
        cameraFill.intensity = THREE.MathUtils.lerp(
          cameraFill.intensity,
          0.85 + state.ambient * 0.55,
          0.05
        );

        shadow.position.x = THREE.MathUtils.lerp(
          shadow.position.x,
          targetX * 0.80,
          0.06
        );
        shadow.position.y = THREE.MathUtils.lerp(
          shadow.position.y,
          -0.67 + Math.min(0.26, Math.max(-0.1, targetY * 0.12)),
          0.06
        );
        const shadowScale = lerp(0.48, 0.82, state.shadow);
        shadow.scale.x = shadowScale;
        shadow.scale.y = 0.12 + state.shadow * 0.06;
        shadow.material.opacity = Math.min(0.022, 0.002 + state.shadow * 0.018);

        const opacity = storyOpacity;
        loadedScene.traverse((object) => {
          if (!object.isMesh) return;
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];
          materials.forEach((material) => {
            if (material !== screenMaterial) {
              material.transparent = true;
              material.opacity = opacity;
              material.depthWrite = true;
            }
          });
        });
        applyFocusDimming(state.chapter, opacity);

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
      novaScreenTexture.dispose();
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
