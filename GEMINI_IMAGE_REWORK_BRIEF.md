# Gemini / Antigravity — NOVA Image Regeneration Handoff

## Mission

Regenerate only the NOVA visual assets that require new image synthesis or reconstruction.

This is an image-generation/art-direction task, not a website implementation task.

Do not edit HTML, CSS, JavaScript, React, package files, or production code.

Do not regenerate assets already approved as KEEP unless they are needed as direct visual references.

## Mandatory References

Read first:

- `NOVA_PRODUCT_BIBLE.md`
- `assets/ref/full_landingpage.png`
- all `assets/ref/sections/*.png`

Canonical product reference:

- `assets/hero/hero-laptop.png`

Approved environmental/product references where relevant:

- `assets/hero/hero-background.webp`
- `assets/display/display-background.webp`
- `assets/display/display-screen-visual.webp`
- `assets/final/final-background.webp`

Do not infer content from filenames. Open and visually inspect references.

## Core Rule

The hero laptop is the canonical NOVA laptop.

Every regenerated product view must look like the exact same physical machine from a different camera angle.

Do not create a new laptop design for each section.

Preserve:

- dark graphite squared unibody,
- centered display notch,
- upward speaker grilles beside keyboard,
- large centered trackpad,
- integrated dark hinge,
- right-side SD slot + 2× USB-C when visible,
- same proportions,
- same material,
- same corner radii,
- same display proportions.

If a side is not visible in the canonical reference, avoid exposing/inventing it unless necessary.

## Deliverables

Generate/rebuild only these assets.

### 1. Performance background

Target:

`assets/performance/performance-background.webp`

Reference:

`assets/ref/sections/02_performance.png`

Requirements:

- dark abstract high-tech environment,
- fractured/cracked glass planes,
- carbon/metal reflections,
- technical depth,
- no kitchen/lab/countertop room,
- no product,
- no text,
- no UI,
- no fake labels,
- left-side negative space preserved for HTML,
- product zone on right remains uncluttered.

Output should be a clean opaque environment plate.

### 2. Display laptop

Target replacement:

`assets/display/display-laptop.png`

References:

- `assets/hero/hero-laptop.png` for exact chassis identity,
- `assets/ref/sections/03_display.png` for angle/composition,
- `assets/display/display-screen-visual.webp` for screen art.

Requirements:

- same NOVA machine as hero,
- front 3/4 right view appropriate to display section,
- canonical notch,
- canonical speaker grilles,
- canonical right-side SD + 2× USB-C if visible,
- no USB-A,
- no headphone jack,
- no wedge-body redesign,
- transparent background,
- clean alpha,
- no white/gray fringe,
- screen art consistent with provided display visual,
- no text/UI/logos.

### 3. Display foreground

Target replacement:

`assets/display/display-foreground.png`

Reference:

`assets/ref/sections/03_display.png`

Requirements:

- isolate only the near-camera rock/ledge foreground actually needed for parallax,
- preserve natural irregular rock silhouette,
- clean sub-pixel alpha,
- no polygonal/lasso facets,
- no circular punch-hole artifacts,
- no rectangular photo edges,
- no laptop,
- no text,
- no large background region baked in.

### 4. Mobility background

Target replacement:

`assets/mobility/mobility-background.webp`

Reference:

`assets/ref/sections/04_mobility.png`

Requirements:

- reconstruct the canonical alpine/cloud wilderness,
- soft daylight,
- mountain ridge,
- distant monolith/spire language,
- circular/ring architecture consistent with the reference,
- no dense skyscraper metropolis,
- no freeway/cloverleaf city,
- no laptop,
- no text,
- preserve left-side HTML text zone,
- preserve center/right product zone.

Important:
If the ring architecture is intended to remain separately parallaxed using `mobility-architecture.png`, generate the base background WITHOUT that foreground ring so it is not duplicated.

### 5. Mobility laptop

Target replacement:

`assets/mobility/mobility-laptop.png`

References:

- `assets/hero/hero-laptop.png` for canonical identity,
- `assets/ref/sections/04_mobility.png` for pose.

Requirements:

- exact same physical NOVA laptop as hero,
- rear/side floating angle appropriate to reference,
- do not change hinge system,
- do not change chassis silhouette,
- do not invent USB-A/headphone ports inconsistent with canonical identity,
- transparent background,
- clean dark-edge alpha,
- absolutely no white studio fringe,
- no floor/shadow unless provided separately,
- no text/logo.

### 6. Final laptop

Target replacement:

`assets/final/final-laptop.png`

References:

- `assets/hero/hero-laptop.png` for canonical chassis,
- `assets/ref/sections/06_final.png` for composition,
- `assets/final/final-background.webp` for lighting/environment.

Requirements:

- exact same physical NOVA laptop as hero,
- camera angle compatible with final reference,
- dark cosmic/dusk screen content,
- screen must harmonize with final background,
- no bright daytime Matterhorn wallpaper,
- no gold/bronze permanent product redesign,
- canonical notch,
- canonical speaker layout,
- canonical chassis proportions,
- transparent background,
- clean alpha,
- no text/UI/logo.

### 7. Final foreground

Target replacement:

`assets/final/final-foreground.png`

Reference:

`assets/ref/sections/06_final.png`

Requirements:

- same intended foreground rock mass,
- transparent background,
- zero white studio halo,
- edge colors must be naturally premultiplied against the actual dark rock colors,
- clean antialiasing,
- no rectangular background,
- no text,
- no laptop.

## Optional: Performance modular layers

Only generate these if the intended site interaction is confirmed to use a true exploded animation:

- `performance-screen-lid.png`
- `performance-keyboard-deck.png`
- `performance-cooling-midframe.png`
- `performance-chassis-tub.png`

All parts must belong to one canonical NOVA chassis and align perfectly when stacked.

Do not create them merely because they are possible.

## Isolation Background Strategy During Generation

If the image generator cannot directly return clean transparency, render isolated objects on a neutral matte background chosen for high contrast.

For dark graphite NOVA hardware:

- use pale neutral warm gray / off-white,
- avoid black, navy, dark gray, blue.

Then remove the temporary background cleanly.

Do not allow:

- fog crossing the silhouette,
- studio-floor reflections merging with edge,
- contact shadow baked into product,
- background spill,
- white fringe.

## Product Consistency Regression

After generating each laptop asset, compare it side-by-side with:

`assets/hero/hero-laptop.png`

Check:

- notch,
- bezel thickness,
- speaker grille geometry,
- trackpad dimensions,
- chassis edge radius,
- hinge,
- visible port topology,
- material tone,
- screen aspect ratio.

If any visible physical feature changes, reject and regenerate.

"Same style" is not enough.
It must look like the same manufactured unit.

## Section Regression

After each generated asset:

1. Composite it mentally or in a temporary preview against the corresponding approved background/reference.
2. Verify that HTML text zones remain clear.
3. Verify lighting direction.
4. Verify ground/contact logic where applicable.
5. Verify product is not floating accidentally.
6. Verify foreground does not create a rectangular cutout look.
7. Verify no text or watermark exists.
8. Verify no unrelated elements were introduced.

## Output

Do not overwrite original production assets immediately.

First save candidates under:

`assets/candidates/<section>/`

Use clear names such as:

- `performance-background-v2.webp`
- `display-laptop-v2.png`
- `display-foreground-v2.png`
- `mobility-background-v2.webp`
- `mobility-laptop-v2.png`
- `final-laptop-v2.png`
- `final-foreground-v2.png`

Then provide an audit report:

FILE
REFERENCE USED
WHAT CHANGED
PRODUCT CONSISTENCY CHECK
ALPHA/EDGE CHECK
COMPOSITION CHECK
STATUS: PASS / REWORK

Do not promote a candidate to the production filename until every check passes.
