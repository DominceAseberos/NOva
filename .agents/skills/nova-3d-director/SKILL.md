---
name: nova-3d-director
description: >-
  Project-specific Creative & Technical Direction skill for the NOVA Persistent 3D
  Laptop Scroll Story. Governs Blender 5.2 high-detail asset generation, Three.js
  luxury studio HDRI PBR rendering, gimbal-free scroll choreography, exploded
  hardware visibility, layered scenic parallax (nova-parallax-depth standard),
  and mandatory AI-in-the-loop vision critic audits (ui-vision-critic standard).
---

# NOVA 3D Luxury Product Direction & Engineering Skill

Use this skill whenever designing, modeling, lighting, choreographing, or visually auditing the NOVA 3D landing page (`c:\Users\user\OneDrive\Desktop\Projects\NOva`).

> [!NOTE]
> This skill operates in tandem with:
> - **nova-parallax-depth**: Multi-plane WebGL depth (L0–L5) and optical speed invariants.
> - **ui-vision-critic**: Adversarial 9-point layout criticism and screenshot measurement.

---

## 1. Luxury Visual North Star (Flagship Pro Workstation Standard)

NOVA must read like a **\$3,500 flagship industrial-design launch film** (Apple MacBook Pro / Razer Blade Studio / ASUS ProArt / Teenage Engineering):

- **Chassis Material**: Deep CNC-milled Space-Black / Dark Graphite anodized aluminum (`metalness: 0.82–0.88`, `roughness: 0.24–0.30`) accented by a razor-thin diamond-cut satin-silver perimeter chamfer that catches studio rim highlights.
- **No Cheap Gaming Aesthetics**: Zero garish orange/neon stickers, zero jagged vents, zero washed-out flat grey plastics. Keep the lid emblem refined machined dark-titanium/chrome with subtle edge glint.
- **Real OLED Screen Artwork**: Never leave the screen as flat plain text unless explicitly requested. Use high-contrast cosmic/alpine OLED artwork per section (`screen-hero`, `screen-display`, `screen-performance`, `screen-final`) beneath a subtle physical reflection glass coat (`Display_Glass`).
- **Studio HDRI Is Mandatory**: Metallic PBR surfaces in Three.js look like dead flat navy plastic without an environment map. Always synthesize a studio softbox HDRI via `THREE.PMREMGenerator` (overhead specular strip, cool left key softbox, warm right architectural kicker, subtle dark bounce) and assign it to `scene.environment`.

---

## 2. Blender 5.2 High-Detail Asset Pipeline (`blender/build_nova_laptop.py`)

Rebuild `.blend`, web `.glb`, and diagnostic renders via:
```powershell
& "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" --background --python blender\build_nova_laptop.py
```

### Mandatory Geometry & Structural Rules
1. **Preserve All Runtime Node Names**: Never break the contract names expected by `src/PersistentLaptop3D.jsx` and `ScrollStoryEditor`:
   - Top groups: `LID_GROUP`, `Lid_Hinge`, `TOP_DECK_GROUP`, `INTERNAL_GROUP`, `LOWER_CHASSIS_GROUP`
   - Screen meshes: `Display_Active`, `Display_Glass`
   - 18 editable internal assemblies: `Motherboard`, `CPU_GPU_Package`, `CPU_Package`, `GPU_Package`, `RAM_SODIMM_1`, `RAM_SODIMM_2`, `SSD_Module`, `Fan_L`, `Fan_R`, `HeatPipe_1`, `HeatPipe_2`, `Heatsink_L`, `Heatsink_R`, `Battery_Cell_1..4`, `Internal_Midplate`
   - Focus markers: `Focus_Screen_Edge`, `Focus_Keyboard`, `Focus_Touchpad`, `Focus_Ports_Right`, `Focus_Ports_Left`, `Focus_Exhaust`, `Focus_Speaker_R`, `Focus_Hinge`, `Focus_Edge`
2. **Zero Paper-Thin Exploded Shells**: Both `TOP_DECK_GROUP` and `LOWER_CHASSIS_GROUP` must have physical CNC structural depth (underside ribs, acoustic chambers, milled cavity walls) when separated in exploded views.
3. **Zero Clipping Internals**: Copper heatpipes must route cleanly *around* blower fan impeller zones into the rear heatsink fin stacks—never piercing through spinning fan blades.
4. **High-Detail Component Density**:
   - Dual centrifugal blowers: sculpted circular volute shroud, machined metallic center hub, 28–32 curved aerodynamic blades.
   - Heatsinks: 26–32 crisp thin copper fins per bank with dark retaining rail.
   - Silicon: exposed mirror-finish CPU (`CORE ULTRA 9`) & GPU (`NVIDIA RTX 5070`) dies with micro gold decoupling caps, 6 surrounding GDDR7 VRAM packages, and copper coldplate blocks.
   - Batteries: deep matte-obsidian prismatic LiPo cells with silver retention ribs and BMS connector strip (never light-grey flat tiles).

---

## 3. Smooth Scroll Choreography & Camera Rules (`src/story/nova-story.json`)

1. **Zero Gimbal Tumbling**: Keep Euler angles continuous across adjacent keyframes. Never flip `rx` or `rz` near `±π` (`±3.14`), which causes upside-down tumbling on scroll.
2. **Unobstructed Exploded Internals & Component Spotlight Highlighting**:
   - Never orient the laptop backwards during `EXPLODE`..`BATTERY` so the opaque back of the lid blocks the hardware.
   - Present internals from an elevated front-3/4 or top-3/4 angle (`rx: 0.44–0.98`, `ry: -0.54..+0.30`, `rz: ~0`).
   - During deep internal callouts (`MOTHERBOARD`, `GPU`, `CPU`, `MEMORY`, `STORAGE`, `COOLING`, `BATTERY`):
     - Fade obstructing upper shells (`LID_GROUP`, `TOP_DECK_GROUP`) to `0.04–0.05` opacity (`depthWrite: false`) and dim non-focused peers to `0.24`.
     - Physically lift the active component (`+0.036` to `+0.062`) and illuminate it with a per-chapter luxury emissive accent + dynamic world-tracking `THREE.PointLight` (`focusSpotLight`).
3. **Right-Stage Editorial Framing & Act-to-Act Choreography**:
   - Desktop copy lives in the left `~38%` column (`left: clamp(26px, 6.5vw, 118px)`).
   - Keep the 3D laptop framed cleanly in the right `~58%` stage with generous viewport margins—zero headline collision and zero edge cropping.
   - Use quintic smootherstep (`C²` continuous) in `storyMath.js`, framerate-independent exponential damping, shortest-arc `lerpAngle`, and multi-axis weightless float breath that calms smoothly when resting on pedestals. Every section must carry an entrance arc, settled showcase beat, and exit arc handing off momentum cleanly to the next act.
4. **Framerate-Independent Silkiness**:
   - Use `1 - Math.exp(-lambda * dt)` exponential damping and shortest-arc angular interpolation (`lerpAngle`) in the render loop.
   - Add subtle mouse-reactive 3D parallax (`±0.04 rad`) on desktop outside editor mode, and animate subtle blower fan rotation during thermal chapters.
5. **Exact Angle-to-Copy Alignment**:
   - `SCREEN_THIN` / `PROFILE`: True side edge-on profile (`ry ≈ -1.45`), lid smoothly closing to `0` for `14.8 mm CLOSED`.
   - `PORTS_RIGHT`: Clear right-wall view (`ry ≈ -1.38`) showing the dual machined USB-A openings.
   - `PORTS_LEFT`: Clear left-wall view (`ry ≈ +1.38`) showing the full RJ45/DC/USB-C/USB-A/Audio cluster.
   - `EXHAUST` / `HINGE`: Clear rear-3/4 elevated view (`ry ≈ 2.75`) showing concealed hinge exhaust fins & torque spine.
   - `FINAL` / `CLOSE` / `NOVA`: Hero dusk pose -> physical lid close -> serene closed obsidian monolith.

---

## 4. Mandatory Live WebGL Vision QA Loop

Never accept a build or Blender export without visually inspecting live browser screenshots:

1. Start Vite (`npm run dev`) and capture **12+ desktop (`1440×900`) live WebGL screenshots** via Playwright (`--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`) covering:
   - Hero arrival (`0%`), Hero mid (`45%`), Hero exit (`85%`)
   - Performance assembled, Performance exploded, Motherboard, GPU/CPU, Cooling, Battery
   - Display hero, 14.8 mm Closed Profile, Keyboard macro
   - Mobility Left/Right I/O, Design Edge/Hinge
   - Final open, Final closed monolith
2. Open every screenshot directly with `read_file` and verify:
   - [ ] Crisp metallic specular highlights (no flat navy-grey plastic).
   - [ ] Zero floating black shadow ovals.
   - [ ] Zero upside-down tumbling or backward-lid blocking of internals.
   - [ ] Every internal chapter clearly showcases its named hardware component.
   - [ ] Every exterior macro (`PROFILE`, `PORTS_LEFT`, `PORTS_RIGHT`, `EXHAUST`, `HINGE`) actually shows the described feature.
   - [ ] Zero text/laptop collision and zero viewport edge cropping.
3. Run regression tests: `npm run build` and `npm run qa:story` and `npm run qa:layout`.
4. If ANY visual defect appears, fix the root cause in Blender, Three.js lighting/materials, CSS, or `nova-story.json` and re-capture until 100% spotless.
