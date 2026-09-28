# NOVA Product Bible — Canonical Industrial Design

## Status

This document defines the single canonical NOVA laptop design to use across all website sections, replacement image generation, future product-motion generation, and 3D/frame-sequence work.

Canonical visual reference:

- `assets/hero/hero-laptop.png`

The current hero laptop is the baseline because it is already a clean isolated product asset and fits the canonical hero composition. Other section laptops must be brought into this same industrial-design language rather than treated as different models.

## Non-Negotiable Product Identity

### Overall form

- Premium thin dark-graphite aluminum laptop.
- Squared unibody with flat perimeter walls.
- Subtle polished/chamfered perimeter edge.
- Refined professional design, not gaming-oriented.
- No RGB lighting.
- No aggressive vents, fins, decorative cut lines, or gaming geometry.
- Realistic proportions and hinge mechanics.

### Display

- Slim dark bezel.
- Distinct centered camera notch intruding slightly into the active display area.
- No alternate straight-bezel/no-notch variants for other sections.
- Display proportions must remain consistent across all generated angles.

### Keyboard deck

- Full chiclet keyboard.
- Large centered glass trackpad.
- Dedicated upward-facing speaker grilles flanking the keyboard on left and right.
- Trackpad shape and front thumb-scoop/chassis detail must remain consistent.
- Do not replace speaker grilles with blank aluminum margins.

### Hinge

- Integrated dark hinge bar.
- Do not switch to a cylindrical dual-barrel hinge, visible pod hinge, or other alternate hinge design.

### Right-side ports

Do not infer port names from the audit text alone.

When the right side is visible, match the **exact visible cutout pattern, spacing, proportions, and placement from `assets/hero/hero-laptop.png`**. Treat the hero image itself as the authority.

Do not add, remove, rename, resize, or relocate visible port openings based only on a textual assumption.

### Left-side ports

The current evidence does not establish a complete canonical left-side layout with enough confidence.

Rule:

- Do not invent a visible left-side topology unless the generation angle requires it.
- If the left side must be exposed in a new generation, preserve the same chassis language and request a minimal professional port arrangement consistent with the hero design, then keep that arrangement fixed for all subsequent generations.
- Once one approved left-side view exists, update this document and use that exact topology everywhere.

### Cooling

- Cooling should remain visually restrained.
- Exterior exhaust is primarily concealed around the hinge/rear area.
- Do not introduce large gaming-style side vents on standard exterior views.
- The performance exploded view may reveal internal fans, copper heat pipes, heatsinks, and internal vent channels, but the exterior chassis must still match this canonical shell.

### Material and color

Primary:

- Space gray / dark graphite anodized aluminum.

Allowed lighting effects:

- cool silver edge highlights,
- subtle neutral rim light,
- restrained warm environmental reflections.

Not allowed as permanent product materials:

- gold chassis,
- bronze chassis,
- blue chassis,
- white chassis,
- highly reflective chrome.

Warm highlights may appear only as reflected scene lighting.

## Canonical Screen Language

The laptop body is one product. Screen artwork may change by section, but it must remain text-free.

### Hero

Use the existing dark cosmic ringed-planet visual from `hero-laptop.png`.

### Display

Use `assets/display/display-screen-visual.webp` as the high-resolution visual source, perspective-mapped into a laptop that otherwise uses the canonical hero chassis.

### Final

Use a dark cosmic/dusk visual consistent with the final environment.

Do not use:

- bright daytime snow-mountain wallpaper,
- text,
- UI,
- logos,
- watermarks.

## Angle Continuity Rules

A different camera angle is allowed.

A different laptop design is not.

Every new view must preserve:

- same chassis thickness,
- same corner radius,
- same screen proportions,
- same notch,
- same speaker grilles,
- same trackpad proportions,
- same right-side port topology,
- same hinge design,
- same material.

When a side is not visible, do not improvise details.

## Canonical Replacement Targets

The following current assets need visual correction to match this product bible:

### Display

`assets/display/display-laptop.png`

Keep:

- current front 3/4 right camera angle,
- current section composition,
- intended display content.

Replace/reconcile:

- no-notch bezel -> canonical notch,
- blank deck margins -> canonical speaker grilles,
- USB-A/audio-jack right-side layout -> canonical SD + 2× USB-C layout,
- wedge chassis -> canonical squared unibody.

### Mobility

`assets/mobility/mobility-laptop.png`

Keep:

- rear 3/4 floating angle,
- thin lightweight visual feeling.

Replace/reconcile:

- current alternate port layout,
- alternate hinge treatment,
- any white extraction halo,
- any chassis features that conflict with the hero baseline.

The final asset must retain a transparent background with clean dark-edge alpha.

### Final

`assets/final/final-laptop.png`

Keep:

- final section's general hero-product purpose.

Replace/reconcile:

- straight/no-notch bezel,
- warm/gold-looking permanent edge treatment,
- incompatible screen wallpaper,
- any inconsistent speaker/port/hinge details.

Prefer an angle that naturally fits `assets/ref/sections/06_final.png`, but use the canonical NOVA chassis.

### Performance

`assets/performance/performance-laptop.png`

The internal exploded hardware treatment is useful, but its exterior shell must be normalized to the canonical hero chassis.

For a true animated exploded view, a single flattened PNG is insufficient. Generate separate components only if the site will animate the explosion:

- `performance-screen-lid.png`
- `performance-keyboard-deck.png`
- `performance-cooling-midframe.png`
- `performance-chassis-tub.png`

All four must reconstruct one coherent canonical NOVA laptop when visually assembled.

## Website Motion Rule

Use static image + CSS/GSAP when the visible geometry does not change.

Allowed from static assets:

- translate,
- scale,
- small perspective tilt,
- subtle rotateX / rotateY,
- parallax,
- float,
- opacity,
- blur,
- masks.

Do not fake true viewpoint changes with CSS.

If motion reveals previously unseen geometry, use:

- generated product video,
- scroll-scrubbed image sequence,
- or a real 3D model.

Examples requiring true product motion:

- front 3/4 -> side -> rear,
- opening/closing lid,
- exposing underside,
- camera orbit,
- revealing hidden ports,
- physical exploded assembly.

## Approval Checklist for Any New Product Asset

Before accepting a generated NOVA laptop asset, verify:

1. Same notch as canonical hero.
2. Same speaker grilles.
3. Same squared chassis language.
4. Same trackpad proportions.
5. Same hinge type.
6. Right-side cutouts match `assets/hero/hero-laptop.png` exactly when visible.
7. No extra or missing ports are introduced relative to the canonical hero image.
8. Same dark graphite material.
9. No fake logo or text.
10. No white/bright alpha fringe.
11. No unrelated props or environment baked into the transparent product.
12. The view is physically plausible and usable in the target section.
13. If it is a different angle, it still unmistakably reads as the same laptop.

Any failed item means REWORK, not "close enough."
