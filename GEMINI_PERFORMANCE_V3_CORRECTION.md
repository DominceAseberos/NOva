# Gemini / Antigravity — NOVA Performance Laptop v2 Correction

## Scope

Edit only:

`assets/candidates/performance/performance-laptop-v2.png`

Do not regenerate the other candidates.
Do not touch production assets.
Do not change the exploded composition, cooling hardware, lighting, alpha silhouette, overall camera angle, or section placement.

The current candidate is close and should be corrected, not redesigned.

## Mandatory visual references

Open and compare directly:

- `assets/hero/hero-laptop.png`
- `assets/candidates/performance/performance-laptop-v2.png`
- `NOVA_PRODUCT_BIBLE.md`

The hero image itself is authoritative.

Do not rely on old textual assumptions about what the ports are called.

## Correction 1 — Right-side visible cutout geometry

The current performance candidate has too many visible openings on the right-side chassis edge.

Match the **exact visible cutout count, relative spacing, proportions, and ordering from `hero-laptop.png`**.

In the canonical hero crop, the visible side shows exactly THREE openings:

1. one long narrow horizontal slot,
2. one small rounded rectangular opening,
3. one larger rounded/trapezoidal opening nearest the hinge/rear.

Do not label these by port type.
Do not reinterpret them.
Just reproduce their visible geometry.

Remove the extra fourth opening currently present in the performance candidate.

Preserve:
- side-wall thickness,
- chamfer,
- graphite material,
- perspective,
- lighting,
- lower chassis shape.

## Correction 2 — Remove third-party keyboard branding

The current candidate contains a Windows-like four-pane icon on one keyboard key.

Remove that branded symbol.

Replace it with either:
- a neutral blank key,
- or a simple non-branded generic key legend consistent with the surrounding keyboard.

No Microsoft/Windows icon.
No Apple logo.
No third-party branding.
No readable product logos.

Do not alter the rest of the keyboard layout unnecessarily.

## Preserve all already-passing qualities

Keep unchanged:

- 2200 × 1642 canvas,
- RGBA transparency,
- exploded layer spacing,
- squared NOVA unibody,
- speaker grilles,
- trackpad proportions,
- copper heat pipes,
- blower fan,
- heatsink arrays,
- camera angle,
- dark graphite material,
- zero canvas-edge contact,
- clean alpha,
- low fringe level,
- lighting direction.

## Output

Save corrected file as:

`assets/candidates/performance/performance-laptop-v3.png`

Do NOT overwrite v2.

## Verification

Before marking PASS:

1. Compare the right-side crop directly against `hero-laptop.png`.
2. Confirm exactly three visible side openings matching the hero geometry.
3. Confirm no extra port opening remains.
4. Confirm no Windows-like or other third-party logo remains on the keyboard.
5. Confirm speaker grilles and trackpad remain intact.
6. Confirm alpha edges remain clean.
7. Confirm no new text, logo, watermark, or environment was introduced.
8. Confirm the exploded cooling composition is unchanged.

Return:

FILE
WHAT CHANGED
RIGHT-SIDE CUTOUT CHECK
BRANDING CHECK
ALPHA CHECK
STATUS: PASS / REWORK
