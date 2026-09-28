# Scroll Story

Reusable scroll-driven 3D choreography authoring/runtime layer.

NOVA is the first consumer, but nothing under this folder depends on NOVA assets or object names.

## Architecture

```text
project story JSON
      |
      v
core/storyMath.js
      |
      +--> production runtime
      |
      +--> development editor

Three.js / DOM / future renderers connect through runtime adapters.
```

The JSON is the source of truth. The editor authors data; production reads the same data.

## Current reusable capabilities

- versioned JSON story schema
- ordered sections with editable virtual duration
- full-section pin/sticky control
- continuous product keyframe track
- continuous camera keyframe track
- interpolation across section boundaries
- transform state: position, rotation, scale
- product-specific scalar state: explode, screen, opacity
- lighting state: cool, warm, ambient, shadow
- camera position, look target, and FOV
- live timeline scrubbing
- draggable keyframes
- resizable section timeline blocks
- hold `P` while scrolling to add pin duration
- undo / redo
- local editor draft persistence
- JSON export
- dev-only save-to-project endpoint
- schema validation
- clean Preview mode

## Editor

The editor is development-only and is not emitted into the production build.

Open:

```text
http://127.0.0.1:5173/?editor=1
```

Shortcuts:

```text
W     translate product
E     rotate product
R     scale product
K     save/update keyframe
P     hold while scrolling to add pin duration
Space toggle Preview/Edit
Ctrl+Z undo
Ctrl+Shift+Z redo
```

The Product track uses Three.js `TransformControls` against the actual rendered scene object.

The Camera track currently uses numeric camera position, look target, and FOV controls.

## Story shape

Minimal example:

```json
{
  "schemaVersion": "1.0",
  "project": {
    "id": "example",
    "name": "Example"
  },
  "sections": [
    {
      "id": "hero",
      "label": "Hero",
      "selector": "#hero",
      "stageSelector": ".stage",
      "duration": 120,
      "pin": { "enabled": true }
    }
  ],
  "tracks": {
    "product": [
      {
        "id": "arrival",
        "section": "hero",
        "progress": 0,
        "chapter": "ARRIVAL",
        "ease": "smooth",
        "state": {
          "x": 1,
          "y": 0,
          "z": 0,
          "rx": 0,
          "ry": 0.5,
          "rz": 0,
          "scale": 0.8,
          "explode": 0,
          "screen": 0,
          "cool": 2.8,
          "warm": 1.1,
          "ambient": 1.25,
          "shadow": 0.5,
          "opacity": 1
        }
      }
    ],
    "camera": []
  }
}
```

### Section duration

`duration` is expressed in viewport-height units used by the authoring timeline.

For a pinned section, increasing duration increases the sticky scroll travel:

```text
duration 80  -> shorter pinned sequence
duration 300 -> much longer pinned sequence
```

Keyframes use `section + progress`, so section durations may be stretched without rewriting every keyframe.

### Continuous keyframes

Keyframes are continuous across sections.

The runtime computes each keyframe's global story time from:

```text
sum(previous section durations)
+
current section duration * keyframe progress
```

If no later keyframe exists, the last state is held.

## Files

```text
scroll-story/
  core/
    createStoryStore.js
    storyMath.js
    validateStory.js
  editor/
    ScrollStoryEditor.jsx
    editor.css
  runtime/
    editorBridge.js
    StoryLayoutController.jsx
  index.js
```

Project-specific files should live outside this folder. NOVA uses:

```text
src/story/nova-story.json
src/story/nova-story.editor.json
src/story/novaStoryStore.js
```

## Reuse in another project

1. Copy or package `src/scroll-story/`.
2. Create a project story JSON.
3. Create a store with `createStoryStore()`.
4. Mount `StoryLayoutController`.
5. Connect the project's renderer to the generic runtime bridge/evaluators.
6. Mount `ScrollStoryEditor` only in development.
7. Provide the project's save path to the editor.

Reusable Three.js gizmo integration lives in `scroll-story/adapters/three/createThreeTransformAdapter.js`. Project-specific scene mapping still lives beside each project's renderer (for NOVA, `PersistentLaptop3D.jsx`), while the JSON schema, editor timeline, store, layout controller, and Three transform adapter are reusable unchanged.
