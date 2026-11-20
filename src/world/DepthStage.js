import * as THREE from "three";
import { WORLDS } from "./novaWorlds.js";

export class DepthStage {
  constructor(scene, camera, renderer) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;

    this.stageRoot = new THREE.Group();
    this.stageRoot.name = "NOVA_DepthStage";
    this.scene.add(this.stageRoot);

    this.textureLoader = new THREE.TextureLoader();
    this.worldNodes = new Map();
    this.particlesByWorld = new Map();

    this.activeWorldId = "top";
    this.targetWorldId = "top";
    this.transitionProgress = 1; // 0 to 1

    this.baseCamPos = new THREE.Vector3(0, 1.05, 4.35);
    this.lastCamPos = new THREE.Vector3().copy(this.baseCamPos);

    this.initWorlds();
    this.initGlobalParticles();
    this.setupDepthInspectionHook();
  }

  initWorlds() {
    const fov = 34;
    const aspect = Math.max(1, window.innerWidth / Math.max(1, window.innerHeight));

    for (const [worldId, def] of Object.entries(WORLDS)) {
      const worldGroup = new THREE.Group();
      worldGroup.name = `World_${worldId}`;
      worldGroup.visible = worldId === "top";
      worldGroup.userData = { opacity: worldId === "top" ? 1 : 0 };

      const layerMeshes = [];

      for (const layerDef of def.layers) {
        const zDist = Math.abs(layerDef.z);
        // Generous overscan for background & midground to prevent exposed seams on camera pitch
        const overscan = layerDef.type === "bg" ? 2.5 : layerDef.type === "mid" ? 2.1 : 1.45;
        const frustumH = 2 * zDist * Math.tan((fov * Math.PI) / 360) * overscan;
        const frustumW = frustumH * aspect * (layerDef.scale || 1.0);

        const geo = new THREE.PlaneGeometry(frustumW, frustumH);
        const tex = this.textureLoader.load(layerDef.src);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.generateMipmaps = true;
        tex.minFilter = THREE.LinearMipmapLinearFilter;

        const mat = new THREE.MeshBasicMaterial({
          map: tex,
          transparent: true,
          opacity: layerDef.opacity ?? 1,
          depthWrite: false,
          toneMapped: true,
        });

        if (layerDef.blend === "screen" || layerDef.blend === "additive") {
          mat.blending = THREE.AdditiveBlending;
        }

        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.z = layerDef.z;
        if (layerDef.anchor) {
          mesh.position.x = layerDef.anchor[0];
          mesh.position.y = layerDef.anchor[1];
        } else if (layerDef.type === "bg") {
          // Center along downward camera sightline
          mesh.position.y = -1.8;
        }

        // Store base reference
        mesh.userData = {
          id: layerDef.id,
          type: layerDef.type,
          baseZ: layerDef.z,
          baseX: mesh.position.x,
          baseY: mesh.position.y,
          parallaxFactor: layerDef.parallaxFactor || 0.1,
          speed: layerDef.speed || 0.1,
          drift: layerDef.drift || [0, 0],
          targetOpacity: layerDef.opacity ?? 1,
        };

        // Foreground layers render in front of standard scene depth
        if (layerDef.type === "fg") {
          mesh.renderOrder = 8;
        } else {
          mesh.renderOrder = -10;
        }

        worldGroup.add(mesh);
        layerMeshes.push(mesh);
      }

      this.stageRoot.add(worldGroup);
      this.worldNodes.set(worldId, { group: worldGroup, layers: layerMeshes, def });
    }
  }

  initGlobalParticles() {
    const pCount = 500;
    const pGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(pCount * 3);
    const speeds = new Float32Array(pCount * 3);

    for (let i = 0; i < pCount; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 10;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 6;
      positions[i * 3 + 2] = -15 + Math.random() * 18; // distributed from z=-15 to z=+3

      speeds[i * 3 + 0] = (Math.random() - 0.5) * 0.004;
      speeds[i * 3 + 1] = 0.002 + Math.random() * 0.005; // gentle upward thermal drift
      speeds[i * 3 + 2] = (Math.random() - 0.5) * 0.003;
    }

    pGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    pGeo.setAttribute("velocity", new THREE.BufferAttribute(speeds, 3));

    // Feathered circle particle texture
    const pCanvas = document.createElement("canvas");
    pCanvas.width = 64;
    pCanvas.height = 64;
    const ctx = pCanvas.getContext("2d");
    const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, "rgba(255, 255, 255, 0.95)");
    grad.addColorStop(0.3, "rgba(230, 245, 255, 0.6)");
    grad.addColorStop(1, "rgba(200, 225, 255, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);

    const pTex = new THREE.CanvasTexture(pCanvas);
    const pMat = new THREE.PointsMaterial({
      map: pTex,
      size: 0.045,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.particleSystem = new THREE.Points(pGeo, pMat);
    this.particleSystem.renderOrder = 4;
    this.scene.add(this.particleSystem);
  }

  setWorld(worldId) {
    if (this.targetWorldId === worldId) return;
    this.activeWorldId = this.targetWorldId;
    this.targetWorldId = worldId;
    this.transitionProgress = 0;
  }

  update(dt, camera, state = {}, lights = {}) {
    // Dynamic world transition cross-fade
    if (this.transitionProgress < 1) {
      this.transitionProgress = Math.min(1, this.transitionProgress + dt * 2.4);
    }

    const t = this.transitionProgress;
    const camDeltaX = camera.position.x - this.baseCamPos.x;
    const camDeltaY = camera.position.y - this.baseCamPos.y;

    // Update each world's visibility and multi-plane parallax
    for (const [wId, node] of this.worldNodes.entries()) {
      let worldWeight = 0;
      if (wId === this.targetWorldId) {
        worldWeight = t;
      } else if (wId === this.activeWorldId) {
        worldWeight = 1 - t;
      }

      node.group.visible = worldWeight > 0.005;
      if (!node.group.visible) continue;

      for (const mesh of node.layers) {
        const u = mesh.userData;
        mesh.material.opacity = u.targetOpacity * worldWeight;

        // Monotonic mathematical parallax:
        // L0/L1 move with subtle counter-shift; L4 moves fast across view
        const px = camDeltaX * u.parallaxFactor * 0.28;
        const py = camDeltaY * u.parallaxFactor * 0.22;

        mesh.position.x = u.baseX - px;
        mesh.position.y = u.baseY - py;

        if (u.drift[0] !== 0 || u.drift[1] !== 0) {
          u.baseX += u.drift[0] * dt;
          u.baseY += u.drift[1] * dt;
          // Wrap atmospheric drift
          if (Math.abs(u.baseX) > 2.5) u.baseX = -u.baseX;
        }
      }
    }

    // Adapt lights to active world lighting definition
    const activeDef = WORLDS[this.targetWorldId] || WORLDS.top;
    if (lights.key && activeDef.keyColor) {
      lights.key.color.lerp(new THREE.Color(activeDef.keyColor), dt * 3.5);
    }
    if (lights.rim && activeDef.rimColor) {
      lights.rim.color.lerp(new THREE.Color(activeDef.rimColor), dt * 3.5);
    }
    if (lights.fill && activeDef.fillColor) {
      lights.fill.color.lerp(new THREE.Color(activeDef.fillColor), dt * 3.5);
    }
    if (this.scene.fog && activeDef.fogColor) {
      this.scene.fog.color.lerp(new THREE.Color(activeDef.fogColor), dt * 2.5);
    }

    // Animate volumetric dust motes
    if (this.particleSystem) {
      const posAttr = this.particleSystem.geometry.attributes.position;
      const velAttr = this.particleSystem.geometry.attributes.velocity;
      const pos = posAttr.array;
      const vel = velAttr.array;

      for (let i = 0; i < pos.length; i += 3) {
        pos[i + 0] += vel[i + 0] * (dt * 60) - camDeltaX * 0.002;
        pos[i + 1] += vel[i + 1] * (dt * 60) - camDeltaY * 0.002;
        pos[i + 2] += vel[i + 2] * (dt * 60);

        // Particle volume boundary wrap
        if (pos[i + 1] > 3.5) pos[i + 1] = -2.5;
        if (pos[i + 0] > 5) pos[i + 0] = -5;
        if (pos[i + 0] < -5) pos[i + 0] = 5;
      }
      posAttr.needsUpdate = true;
    }
  }

  setupDepthInspectionHook() {
    window.__novaDepth = {
      sample: () => {
        const activeNode = this.worldNodes.get(this.targetWorldId);
        if (!activeNode) return { world: this.targetWorldId, layers: [] };

        const layers = activeNode.layers.map((l) => ({
          id: l.userData.id,
          type: l.userData.type,
          z: l.userData.baseZ,
          parallaxFactor: l.userData.parallaxFactor,
          posX: l.position.x,
          posY: l.position.y,
        }));

        return {
          world: this.targetWorldId,
          layers,
        };
      },
    };
  }

  dispose() {
    if (window.__novaDepth) delete window.__novaDepth;
    this.stageRoot.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    });
    if (this.particleSystem) {
      this.particleSystem.geometry.dispose();
      this.particleSystem.material.dispose();
      this.scene.remove(this.particleSystem);
    }
    this.scene.remove(this.stageRoot);
  }
}
