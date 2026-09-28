# Gemini / Antigravity — NOVA Remaining Image Delta

## Purpose

One image-generation issue remains after candidate verification: the existing performance product image still represents a different industrial design from the canonical NOVA laptop.

Do not regenerate any already-approved candidate asset.

Do not modify website code.

Do not overwrite production assets.

Create only the performance product candidate described below.

## Mandatory References

Open and visually inspect:

- `NOVA_PRODUCT_BIBLE.md`
- `assets/hero/hero-laptop.png`
- `assets/ref/sections/02_performance.png`
- `assets/performance/performance-laptop.png`
- `assets/candidates/performance/performance-background-v2.webp`

The hero laptop image is the physical-design authority.

Do not infer product details from filenames or from old audit prose.

## Required Output

Create:

`assets/candidates/performance/performance-laptop-v2.png`

## Visual Goal

Recreate the exploded performance view from the existing performance section, but make the outer hardware unmistakably the exact same NOVA machine shown in `assets/hero/hero-laptop.png`.

Preserve the useful exploded-storytelling concept:

- upper display/lid assembly,
- keyboard/top deck,
- internal cooling assembly,
- copper heat pipes,
- blower/fan,
- heatsink,
- lower chassis tub.

But normalize all visible exterior hardware to the canonical hero product.

## Product Identity Requirements

Match the hero image itself for:

- chassis proportions,
- display aspect ratio,
- corner radii,
- dark-graphite material,
- centered camera-notch treatment when the front display bezel is visible,
- speaker-grille placement when the keyboard deck is visible,
- trackpad size/proportions,
- hinge language,
- exterior edge/chamfer treatment,
- visible port cutout pattern when a canonical side is shown.

Do not invent port names or layouts from text. If a side is visible, copy the actual visible geometry from the hero reference.

Do not introduce:

- wedge redesign,
- alternate MacBook-like chassis,
- cylindrical external hinge pod,
- gaming vents,
- RGB,
- unrelated logos,
- text,
- labels,
- UI,
- extra accessories.

## Composition

Keep the exploded product primarily on the right/center-right so the left side remains usable for HTML copy.

The object should work cleanly over:

`assets/candidates/performance/performance-background-v2.webp`

Lighting:

- dark graphite,
- cool controlled rim light,
- subtle cyan/copper technical highlights,
- no bright white studio wash.

## Isolation

Final file must be RGBA PNG with real transparency.

Requirements:

- zero opaque studio background,
- no gray/white halo,
- no fog crossing silhouette,
- no rectangular plate,
- no ground plane,
- no contact shadow baked across the canvas,
- no cut-off components.

If generation requires a temporary isolation backdrop, use a high-contrast pale neutral matte background and remove it completely afterward.

## Animation Decision

For now generate ONE complete exploded static product asset.

Do NOT generate four modular component layers yet.

The website can animate this whole exploded arrangement with CSS/GSAP as a single object.

Only create separate component layers later if the implementation specifically requires the individual parts to move apart independently.

## Verification

Before marking PASS, compare side-by-side with `assets/hero/hero-laptop.png`.

Check:

1. Same manufactured chassis language.
2. Same display proportions.
3. Same notch treatment where applicable.
4. Same speaker arrangement where applicable.
5. Same trackpad geometry.
6. Same hinge language.
7. Visible side cutouts match hero geometry rather than an invented layout.
8. Same dark-graphite material.
9. Transparent alpha is clean.
10. No unrelated environment/text/logo.
11. Exploded components still align plausibly into one laptop.
12. It fits the performance section reference composition.

Output a short verification report with PASS / REWORK.

Do not promote to production filename. Save only as:

`assets/candidates/performance/performance-laptop-v2.png`
