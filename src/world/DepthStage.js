import * as THREE from "three";
import { WORLDS } from "./novaWorlds.js";

/**
 * Generates a vertical linear-gradient alpha mask texture so every bottom-anchored
 * parallax horizon strip smoothly melts upward into the continuous gradient sky
 * with zero hard horizontal edges.
 */
function createHorizonFadeAlphaMap() {
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  // Both top (0.0) and bottom (1.0) fade smoothly to exact 0% opacity so every
  // horizon strip melts seamlessly into the continuous linear-gradient backdrop
  // with zero hard horizontal cutoffs.
  grad.addColorStop(0.0, "rgba(0, 0, 0, 1)");
  grad.addColorStop(0.10, "rgba(22, 22, 22, 1)");
  grad.addColorStop(0.28, "rgba(140, 140, 140, 1)");
  grad.addColorStop(0.46, "rgba(255, 255, 255, 1)");
  grad.addColorStop(0.68, "rgba(255, 255, 255, 1)");
  grad.addColorStop(0.84, "rgba(110, 110, 110, 1)");
  grad.addColorStop(0.95, "rgba(18, 18, 18, 1)");
  grad.addColorStop(1.0, "rgba(0, 0, 0, 1)");

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 4, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

export class DepthStage {
  constructor(scene, camera, renderer) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;

    this.stageRoot = new THREE.Group();
    this.stageRoot.name = "NOVA_DepthStage";
    this.scene.add(this.stageRoot);

    this.textureLoader = new THREE.TextureLoader();
    this.horizonAlphaMap = createHorizonFadeAlphaMap();
    this.worldNodes = new Map();

    this.activeWorldId = "top";
    this.targetWorldId = "top";
    this.transitionProgress = 1;

    this.baseCamPos = new THREE.Vector3(0, 1.05, 4.35);
    this.lastCamPos = new THREE.Vector3().copy(this.baseCamPos);

    this.initWorlds();
    this.initGlobalParticles();
    this.setupDepthInspectionHook();
  }

  /**
   * Sizes a bottom-anchored horizon strip preserving exact native texture aspect ratio
   * (zero horizontal stretching) while ensuring comfortable horizontal overscan.
   */
  fitHorizonStrip(mesh, texAspect) {
    const u = mesh.userData;
    const fov = 34;
    const viewportAspect = Math.max(
      0.6,
      window.innerWidth / Math.max(1, window.innerHeight)
    );
    const zDist = Math.abs(u.baseZ - this.baseCamPos.z);
    const frustumH = 2 * zDist * Math.tan((fov * Math.PI) / 360);
    const frustumW = frustumH * viewportAspect;

    // Target strip height as a fraction of viewport height (sits cleanly at bottom, NOT fullscreen)
    const targetH = frustumH * (u.stripHeight || 0.48);
    let planeH = targetH;
    let planeW = planeH * texAspect;

    // Ensure horizontal overscan (>= 1.28x viewport width) by scaling BOTH axes uniformly
    // so image aspect ratio is 100% preserved and never stretched.
    const minRequiredW = frustumW * 1.28;
    if (planeW < minRequiredW) {
      const uniformScale = minRequiredW / Math.max(0.001, planeW);
      planeW *= uniformScale;
      planeH *= uniformScale;
    }

    mesh.geometry.dispose();
    mesh.geometry = new THREE.PlaneGeometry(planeW, planeH);

    // Anchor cleanly along the lower band of the camera's actual downward sightline
    // so the scenic horizon strip rises organically from the bottom without clipping.
    const raySlope = (-0.05 - this.baseCamPos.y) / (0 - this.baseCamPos.z);
    const sightlineY = this.baseCamPos.y + raySlope * (u.baseZ - this.baseCamPos.z);
    u.baseY = sightlineY - frustumH * 0.14 + (u.yOffset || 0);
    mesh.position.y = u.baseY;
  }

  initWorlds() {
    const maxAnisotropy = Math.min(
      8,
      this.renderer?.capabilities?.getMaxAnisotropy?.() || 4
    );

    for (const [worldId, def] of Object.entries(WORLDS)) {
      const worldGroup = new THREE.Group();
      worldGroup.name = `World_${worldId}`;
      worldGroup.visible = worldId === "top";
      worldGroup.userData = { opacity: worldId === "top" ? 1 : 0 };

      const layerMeshes = [];

      for (const layerDef of def.layers) {
        const geo = new THREE.PlaneGeometry(1, 1);

        const mat = new THREE.MeshBasicMaterial({
          transparent: true,
          opacity: layerDef.opacity ?? 0.6,
          alphaMap: this.horizonAlphaMap,
          depthWrite: false,
          toneMapped: true,
        });

        if (layerDef.blend === "screen" || layerDef.blend === "additive") {
          mat.blending = THREE.AdditiveBlending;
        }

        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.z = layerDef.z;
        mesh.renderOrder = -10;

        mesh.userData = {
          id: layerDef.id,
          type: layerDef.type,
          baseZ: layerDef.z,
          baseX: 0,
          baseY: -2.0,
          stripHeight: layerDef.stripHeight || 0.48,
          yOffset: layerDef.yOffset || 0,
          parallaxFactor: layerDef.parallaxFactor || 0.14,
          speed: layerDef.speed || 0.1,
          drift: layerDef.drift || [0, 0],
          targetOpacity: layerDef.opacity ?? 0.6,
          texAspect: 16 / 9,
        };

        // Initial sizing with 16:9 default before texture finishes decoding
        this.fitHorizonStrip(mesh, 16 / 9);

        const tex = this.textureLoader.load(layerDef.src, (loadedTex) => {
          const img = loadedTex.image;
          if (img && img.width && img.height) {
            const aspect = img.width / img.height;
            mesh.userData.texAspect = aspect;
            this.fitHorizonStrip(mesh, aspect);
          }
        });
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.generateMipmaps = true;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.anisotropy = maxAnisotropy;
        mat.map = tex;
        mat.needsUpdate = true;

        worldGroup.add(mesh);
        layerMeshes.push(mesh);
      }

      this.stageRoot.add(worldGroup);
      this.worldNodes.set(worldId, { group: worldGroup, layers: layerMeshes, def });
    }
  }

  resize() {
    for (const node of this.worldNodes.values()) {
      for (const mesh of node.layers) {
        this.fitHorizonStrip(mesh, mesh.userData.texAspect || 16 / 9);
      }
    }
  }

  initGlobalParticles() {
    const pCount = 420;
    const pGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(pCount * 3);
    const speeds = new Float32Array(pCount * 3);

    for (let i = 0; i < pCount; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 12;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 6;
      // Confined strictly behind the laptop (z <= -2) so dust motes never
      // clip through the camera lens or occlude the product during macro inspection.
      positions[i * 3 + 2] = -22 + Math.random() * 20;

      speeds[i * 3 + 0] = (Math.random() - 0.5) * 0.0025;
      speeds[i * 3 + 1] = 0.001 + Math.random() * 0.0035;
      speeds[i * 3 + 2] = (Math.random() - 0.5) * 0.0015;
    }

    pGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    pGeo.setAttribute("velocity", new THREE.BufferAttribute(speeds, 3));

    const pCanvas = document.createElement("canvas");
    pCanvas.width = 64;
    pCanvas.height = 64;
    const ctx = pCanvas.getContext("2d");
    const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, "rgba(255, 255, 255, 0.92)");
    grad.addColorStop(0.3, "rgba(230, 245, 255, 0.55)");
    grad.addColorStop(1, "rgba(200, 225, 255, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);

    const pTex = new THREE.CanvasTexture(pCanvas);
    const pMat = new THREE.PointsMaterial({
      map: pTex,
      size: 0.04,
      transparent: true,
      opacity: 0.48,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.particleSystem = new THREE.Points(pGeo, pMat);
    this.particleSystem.renderOrder = -4;
    this.scene.add(this.particleSystem);
  }

  setWorld(worldId) {
    if (this.targetWorldId === worldId) return;
    this.activeWorldId = this.targetWorldId;
    this.targetWorldId = worldId;
    this.transitionProgress = 0;
  }

  update(dt, camera, state = {}, lights = {}) {
    if (this.transitionProgress < 1) {
      this.transitionProgress = Math.min(1, this.transitionProgress + dt * 2.2);
    }

    const t = this.transitionProgress;
    const camDeltaX = camera.position.x - this.baseCamPos.x;
    const camDeltaY = camera.position.y - this.baseCamPos.y;

    // Smoothly dissolve scenic horizon strips when zooming into macro hardware close-ups
    // so macro chapters sit on a pure, distraction-free studio gradient.
    const camZ = camera.position.z;
    const prodScale = state.scale ?? 1;
    const distFade = THREE.MathUtils.clamp((camZ - 2.95) / 1.05, 0, 1);
    const scaleFade = THREE.MathUtils.clamp((1.22 - prodScale) / 0.34, 0, 1);
    const macroStripFade = Math.min(distFade, scaleFade);

    for (const [wId, node] of this.worldNodes.entries()) {
      let worldWeight = 0;
      if (wId === this.targetWorldId) {
        worldWeight = t;
      } else if (wId === this.activeWorldId) {
        worldWeight = 1 - t;
      }

      const effectiveWeight = worldWeight * macroStripFade;
      node.group.visible = effectiveWeight > 0.005;
      if (!node.group.visible) continue;

      for (const mesh of node.layers) {
        const u = mesh.userData;
        mesh.material.opacity = u.targetOpacity * effectiveWeight;

        // Monotonic optical parallax: far horizon shifts gently, midground shifts faster
        const px = camDeltaX * u.parallaxFactor * 0.32;
        const py = camDeltaY * u.parallaxFactor * 0.24;

        mesh.position.x = u.baseX - px;
        mesh.position.y = u.baseY - py;

        if (u.drift[0] !== 0 || u.drift[1] !== 0) {
          u.baseX += u.drift[0] * dt;
          u.baseY += u.drift[1] * dt;
          if (Math.abs(u.baseX) > 2.0) u.baseX = -u.baseX;
        }
      }
    }

    // Adapt lights smoothly to active world palette
    const activeDef = WORLDS[this.targetWorldId] || WORLDS.top;
    if (lights.key && activeDef.keyColor) {
      lights.key.color.lerp(new THREE.Color(activeDef.keyColor), dt * 3.2);
    }
    if (lights.rim && activeDef.rimColor) {
      lights.rim.color.lerp(new THREE.Color(activeDef.rimColor), dt * 3.2);
    }
    if (lights.fill && activeDef.fillColor) {
      lights.fill.color.lerp(new THREE.Color(activeDef.fillColor), dt * 3.2);
    }
    if (this.scene.fog && activeDef.fogColor) {
      this.scene.fog.color.lerp(new THREE.Color(activeDef.fogColor), dt * 2.4);
    }

    // Animate background volumetric dust motes
    if (this.particleSystem) {
      const posAttr = this.particleSystem.geometry.attributes.position;
      const velAttr = this.particleSystem.geometry.attributes.velocity;
      const pos = posAttr.array;
      const vel = velAttr.array;

      const camMoveX = camera.position.x - this.lastCamPos.x;
      const camMoveY = camera.position.y - this.lastCamPos.y;

      for (let i = 0; i < pos.length; i += 3) {
        pos[i + 0] += vel[i + 0] * (dt * 60) - camMoveX * 0.12;
        pos[i + 1] += vel[i + 1] * (dt * 60) - camMoveY * 0.12;
        pos[i + 2] += vel[i + 2] * (dt * 60);

        if (pos[i + 1] > 3.5) pos[i + 1] = -2.5;
        if (pos[i + 0] > 6) pos[i + 0] = -6;
        if (pos[i + 0] < -6) pos[i + 0] = 6;
      }
      posAttr.needsUpdate = true;

      const currentCamDist = Math.hypot(
        camera.position.x,
        camera.position.y - 1.0,
        camera.position.z
      );
      const macroParticleFade = THREE.MathUtils.clamp(
        (currentCamDist - 2.8) / 1.2,
        0.18,
        1.0
      );
      this.particleSystem.material.opacity = 0.48 * macroParticleFade;
    }
    this.lastCamPos.copy(camera.position);
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
          camX: this.camera.position.x,
          camY: this.camera.position.y,
          camZ: this.camera.position.z,
          layers,
        };
      },
    };
  }

  dispose() {
    this.horizonAlphaMap?.dispose();
    for (const node of this.worldNodes.values()) {
      for (const mesh of node.layers) {
        mesh.geometry.dispose();
        mesh.material.map?.dispose();
        mesh.material.dispose();
      }
    }
    if (this.particleSystem) {
      this.particleSystem.geometry.dispose();
      this.particleSystem.material.map?.dispose();
      this.particleSystem.material.dispose();
    }
  }
}
