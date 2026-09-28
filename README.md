# NOVA — Persistent 3D Laptop Story

NOVA is a responsive React/Vite product landing page built around one persistent Three.js laptop that travels through the entire scroll story.

## Experience

The same NOVA model is carried continuously through:

```text
Hero arrival
→ face the viewer
→ Performance landing
→ real 3D exploded internals
→ reassembly
→ Display screen swap
→ Mobility side / rear reveal
→ Design macro-detail pass
→ Final NOVA landing
```

The scenic worlds remain high-resolution layered assets and the typography stays real HTML. The laptop itself is a GLB rendered in one persistent WebGL canvas and animated from scroll state.

## Production architecture

```text
HTML content + scenic WebP layers
              +
     GSAP section motion
              +
 Persistent Three.js product
              +
  scroll-driven story states
```

Important behavior:

- Static product imagery paints immediately as a fallback.
- The Three.js engine is lazy-loaded after first paint.
- The web GLB is export-optimized with merged assemblies, export-only decimation, and EXT_meshopt_compression while the editable Blender source remains full-detail.
- When the GLB is ready, the fallback product images crossfade out.
- One model persists through all chapters instead of reloading per section.
- Foreground rocks are mostly framing anchors; they do not freely drift with scroll.
- Display artwork is swapped as a real screen texture.
- Performance uses real separated 3D groups rather than the previous flattened exploded PNG.
- Reduced-motion mode keeps the product in a stable presentation state.

## 3D source

Editable Blender source:

```text
assets/3d/NOVA_Canonical_Laptop.blend
```

Web model:

```text
assets/3d/NOVA_Canonical_Laptop.glb
```

Blender generator:

```text
blender/build_nova_laptop.py
```

The current model contains:

- canonical graphite chassis
- lid / display / notch / hinge
- keyboard / speakers / trackpad
- canonical visible side cutouts
- motherboard and compute package
- SSD module
- segmented battery cells
- dual fan assemblies with visible blades
- curved copper heatpipes
- heatsink fin arrays
- internal carrier plate

The 3D model is reconstructed from the available NOVA imagery. Visible design cues are constrained to the canonical references, but unseen geometry should not be treated as engineering CAD.

### Rebuild the Blender + GLB assets

On the configured Windows workstation:

```bat
"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" --background --python blender\build_nova_laptop.py
```

This updates the editable `.blend`, web `.glb`, and reference renders under `assets/3d/renders/`.

## Run locally

```bash
npm install
npm run dev
```

Default local URL:

```text
http://127.0.0.1:5173/
```

## Production build

```bash
npm run build
```

Output:

```text
dist/
```

The main app and the Three.js product engine are code-split. The 3D engine/model does not block the first static hero paint.

## QA

Complete production regression:

```bash
npm run qa:all
```

Individual checks:

```bash
npm run qa:layout
npm run qa:motion
npm run qa:story
npm run qa:performance
npm run qa:desktop
npm run qa:mobile
npm run qa:transitions
```

The story regression performs incremental human-style scrolling and verifies that chapter order never reverses, the persistent WebGL shell stays connected, there is no horizontal overflow, and both desktop and mobile reach the final NOVA state without runtime errors.

## Canonical product identity

See:

```text
NOVA_PRODUCT_BIBLE.md
```

`assets/hero/hero-laptop.png` remains the canonical physical-design reference for future generated or modeled product views.


## Scroll Story visual editor

The NOVA 3D choreography is now authored from:

```text
src/story/nova-story.json
```

The persistent Three.js runtime reads that JSON instead of hardcoding scroll anchors in the component.

Open the development-only visual editor at:

```text
http://127.0.0.1:5173/?editor=1
```

The editor supports live WYSIWYG product transform gizmos, Auto-Key creation/update on transform changes, continuous Product and Camera tracks, clickable pose keyframes, frame-accurate drag scrubbing of the live webpage, transport play/pause, a time ruler/playhead, direct keyframe deletion (Delete/Backspace, transport button, or right-click), screen/explosion/lighting state, draggable keyframes, resizable section duration, section pin toggles, live `P`-hold pin-duration capture, Preview mode, undo/redo, draft persistence, JSON export, validation, and direct save-back to the project story file. Product keyframes also carry `explodeEnabled` plus per-component overrides. The Parts tab can attach the real Three.js gizmo to 18 internal assemblies—including the motherboard, combined compute assembly, individual CPU, GPU+VRAM, two SO-DIMMs, SSD, dual fans, heatpipes, heatsinks, batteries, and midplate—toggle each part visible/hidden, edit local position/rotation/scale, reset a part, and Auto-Key those overrides into the same Product timeline. The physical display geometry remains unchanged while its runtime content is a single centered `NOVA` title across the whole story. Section duration is authoritative physical scroll length: pinned sections get one viewport plus that duration of sticky travel, non-pinned sections use that duration as their minimum scroll height, and hidden CSS overlap offsets are neutralized by the story layout controller. In editor mode the WebGL scene is isolated as the topmost interactive site layer; page text, images, links, navigation, and other DOM content are non-selectable/non-interactive while the editor UI remains above the canvas.

The editor is excluded from production builds. See:

```text
src/scroll-story/README.md
```

for the reusable engine/editor architecture and future-project integration.
