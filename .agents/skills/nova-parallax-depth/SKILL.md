---
name: nova-parallax-depth
description: >-
  Strict architectural and mathematical protocol for multi-plane 3D parallax depth in the NOVA
  interactive scroll story: mandates unified WebGL camera-relative depth planes (L0 to L5),
  strictly increasing speed ratios (Speed ∝ 1/distance), overscan edge safety, aerial perspective,
  and numeric verification against flat-plane sliding.
---

# NOVA Multi-Plane Parallax Depth Protocol (L0–L5 Standard)

Use this skill whenever designing, authoring, layering, animating, or auditing scenic environments, depth planes, and scroll/pointer parallax in the NOVA 3D product story.

---

## 1. The Core Law of Optical Parallax

**Parallax is not a random 2D transform.** Real physical parallax is perspective projection: when an observer or camera moves laterally or vertically by $\Delta X, \Delta Y$, the apparent displacement on the projection screen $\Delta_{\text{screen}}$ for any object at distance $Z$ is inversely proportional to its depth:

$$\Delta_{\text{screen}} \approx \Delta_{\text{camera}} \cdot \frac{f}{Z}$$

### Absolute Speed Hierarchy
Every scene in the NOVA world must be composed of at least 3 to 5 discrete depth planes with strictly monotonic speed ratios:

| Layer ID | Name | Z-Depth Range | Parallax Speed Ratio ($S$) | Visual Content & Treatment |
|---|---|---|---|---|
| **L0** | Celestial / Deep Plate | $Z \in [45, 80]$ | $S \in [0.03, 0.08]$ | Nebulae, ringed planets, deep sky plate, cosmic horizons. Moves almost imperceptibly. |
| **L1** | Far Ridges / Skyline | $Z \in [20, 40]$ | $S \in [0.12, 0.22]$ | Distant mountain crests, planetary atmospheric limb, silhouette ridges. Light aerial haze. |
| **L2** | Midground Scenery | $Z \in [8, 18]$ | $S \in [0.35, 0.55]$ | Floating tectonic cliffs, architectural structures, server racks, pedestal bases. |
| **L3** | **Product Focal Stage** | $Z \in [3.8, 5.2]$ | $S \equiv 1.00$ | **NOVA 3D Laptop**. The benchmark frame of reference. |
| **L4** | Near Foreground | $Z \in [1.6, 2.8]$ | $S \in [1.80, 2.60]$ | Foreground volcanic rock outcroppings, floating carbon shards, architectural pillars. Must pass *in front* of camera view with shallow depth-of-field soft edge. |
| **L5** | Volumetric Atmosphere | Distributed ($Z \in [1.5, 30]$) | Variable drift + camera lead | Depth-banded micro dust motes, solar light shafts, thermal convective particles. |

> [!IMPORTANT]
> **Monotonic Speed Invariant**: Any scene where a background layer moves faster than a midground layer, or where foreground elements move at $1.0\times$, violates optical physics and instantly reads as artificial "cheap 2D sliding". In automated QA, `|Δ L0| < |Δ L1| < |Δ L2| < |Δ L3| < |Δ L4|` must evaluate to TRUE at all times.

---

## 2. Shared-Camera Space Architecture

Never composite separate decoupled 2D canvases or CSS image strips over an isolated 3D canvas unless in fallback mode. 

### Why Decoupled Layers Fail
1. **Camera Parallax Mismatch**: When the user moves their pointer or the camera orbits in Three.js, a CSS background does not rotate with the camera frustum, breaking the optical lock.
2. **Zero Spatial Occlusion**: 2D HTML layers cannot cleanly sandwich a 3D model without complex stacking hacks. Real depth requires L4 foreground geometry to realistically occlude corners of the laptop as the camera trucks past.
3. **Lighting Disconnect**: External HTML images do not cast or receive ambient environmental bounce onto the CNC anodized metal.

### The Unified WebGL Depth Stage
In Three.js, depth planes are rendered as true geometric planes or curved cycloramas oriented perpendicular to the viewing frustum or anchored in world coordinates:
- The plane dimension is calculated dynamically from camera field of view ($FOV$) and distance ($Z$):
  $$H_{\text{plane}} = 2 \cdot Z \cdot \tan\left(\frac{FOV \cdot \pi}{360}\right) \cdot (1 + \text{Overscan})$$
  $$W_{\text{plane}} = H_{\text{plane}} \cdot \text{Aspect}$$
- **Overscan Safety Rule**: Every depth plane must have at least **15% to 30% overscan margin** on all 4 borders so that maximum camera travel, auto-scroll bounds, and cursor micro-parallax never expose naked canvas seams or viewport cutoffs.

---

## 3. Aerial Perspective & Atmospheric Grading

In the physical world, distance reduces contrast and shifts colors toward the ambient haze (Rayleigh scattering):

1. **L0 / L1 Aerial Haze**: Far layers must be softened with exponential depth fog or shader haze mixing (`mix(texColor.rgb, fogColor.rgb, clamp(z / maxDist, 0.0, 0.65))`).
2. **L4 Foreground Bokeh & Contrast**: Foreground rock framing must be darker, rich in micro-texture, and carry a subtle optical lens blur or depth-of-field falloff so the human eye naturally focuses on the razor-sharp L3 product.
3. **World-Matched Ambient Illumination**:
   - In **Hero** (warm orbital sunrise), the key light former is golden-orange (`#ffcf9e`) from the right, matching the solar glare.
   - In **Performance** (technical compute void), lighting shifts to high-tech cyan/tungsten specular accents with dark obsidian floor bounce.
   - In **Display** (crisp high-contrast alpine), lighting is cool daylight studio balanced.
   - In **Mobility / Design / Final**, materials reflect clean architectural softboxes and horizon rim strips.

---

## 4. Single-Image Depth & Mesh Parallax

When full 3D geometry is unavailable for distant scenery:
- Use **2.5D Depth Displacement Shader**: An image plus a grayscale depth map texture ($Z_{\text{map}}$) is evaluated in a fragment shader:
  $$\vec{UV}_{\text{offset}} = \vec{UV} + (\vec{Pointer}_{\text{normalized}} + \vec{Camera}_{\Delta}) \cdot \mu \cdot (\text{Depth}(UV) - 0.5)$$
- This produces seamless continuous perspective depth without tearing or hollow cutouts.

---

## 5. Mandatory Verification Checklist

Before approving any scene or chapter motion:
- [ ] **Numeric Speed Hierarchy Check**: Run `node scripts/qa-parallax.mjs` — all 5 layers satisfy $S_{L0} < S_{L1} < S_{L2} < S_{L3} < S_{L4}$.
- [ ] **No Naked Viewport Seams**: Maximum pointer travel + scroll scrub does not reveal edges of any image plane.
- [ ] **Foreground Occlusion Verified**: Near rocks/structures in L4 realistically frame and partially overlap the non-essential perimeter of the stage during camera truck/pan.
- [ ] **Smooth Transition Continuity**: Transitioning between worlds (e.g. Hero to Performance) uses seamless camera dollies or matched focal cuts rather than sudden background pop-in.
- [ ] **Reduced Motion Respect**: When `prefers-reduced-motion: reduce` is active, layers remain statically pinned at zero displacement with comfortable framing.
