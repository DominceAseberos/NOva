---
name: minimal-modern-logo
description: >-
  Strict protocol for designing modern minimal luxury tech logos and brand marks:
  zero label text, mathematical reductionism, 16px-to-billboard optical scalability,
  semantic SVG authoring, negative-space chiseled geometry, and dark-mode favicon optimization.
---

# Minimal Modern Logo Design Protocol (No-Text / Iconography Standard)

Use this skill whenever designing, refining, vectorizing, or auditing modern minimal logos, brand emblems, favicons, or app icons for luxury tech hardware, workstations, or cutting-edge digital products.

---

## 1. The Zero-Label Philosophy (Pure Symbolic Mark)

In luxury industrial design and modern technology (e.g., Apple, Polestar, Nothing, Teenage Engineering, Leica, Starlink), **the graphic mark must never contain label text, acronyms, or embedded words**.

### Core Tenets
1. **Separation of Concerns**:
   - The **Mark / Emblem** is 100% non-verbal iconography. It carries the emotional silhouette, engineering precision, and symbolic essence of the brand.
   - The **Wordmark / Brand Name** is handled entirely in typography via semantic HTML (`<span className="brand-name">BRAND</span>`) or dedicated typographic layout.
2. **The "Laser-Cut / Milled Metal" Test**:
   - Ask: *If this mark were CNC-machined out of a 2mm block of aerospace titanium or laser-etched onto a laptop lid, would it look authentic and structurally viable?*
   - Tiny typography, fragile hairline text, and cramped slogans fail on physical hardware. Pure geometric forms excel.
3. **The Silhouette Test**:
   - When rendered in 100% solid flat black against a white background (or solid white against dark graphite), the mark must be instantly recognizable by its contour alone.

---

## 2. Geometric Principles & Mathematical Rigor

A modern minimal logo is not an illustration; it is an architectural vector system rooted in mathematical harmony.

### Recommended Vector Grids
- **Master Grid**: 64×64 or 512×512 coordinate box with centered origin `(cx, cy)`.
- **Favicon Grid**: 16×16, 24×24, 32×32 pixel-snapped increments.
- **Angular Symmetry**: Restrict angle changes to 15°, 30°, 45°, 60°, or 90° for sharp, deliberate lines.
- **Negative Space Channels**: Maintain uniform laser-cut kerf gaps (e.g. 1.5px to 2.5px on a 64×64 grid) between discrete facets so parts never visually smudge together.

### Proven Geometric Typologies for Luxury Tech
1. **The Chiseled Stellar / Celestial Prism** *(e.g., NOVA)*:
   - Cardinal blades with split dual-tone facets (specular light vs deep titanium shadow) creating 3D light-catch realism without raster drop shadows.
   - Central negative-space aperture with a floating core node.
2. **The Monolithic Interlock**:
   - Continuous geometric vector paths or overlapping isometric planes evoking architectural structures and precision cooling fins.
3. **The Golden Chevron Aperture**:
   - Opposing aerodynamic wedges spaced by Golden Ratio proportions, conveying speed, computational flow, and frictionless mechanics.

---

## 3. Micro-Scale Scalability & Favicon Protocol

A logo that only looks good on a 4K display is broken. It must survive down to a **16×16 pixel browser tab**.

| Scale | Use Case | Rendering Rule |
| :--- | :--- | :--- |
| **16×16 px** | Browser tab favicon | Silhouette must remain sharp. Eliminate micro-lines (< 1px). Use high-contrast facets or a luxury dark squircle container. |
| **24×24 px** | Global header / Navbar | Paired horizontally with HTML text. Crisp edge glint; optical balance with uppercase typography. |
| **48×48 px** | Mobile app icon / PWA tile | Rich metallic bevels and subtle luminous radial depth. |
| **512×512 px** | Hero asset / Master vector | Full vector perfection, precise chamfers, sub-millimeter negative-space channels. |

### Favicon Contrast Strategy
- **Transparent vs Squircle**:
  - Transparent marks can disappear on light browser tabs if drawn with pure white, or disappear on dark tabs if drawn with pure black.
  - **Best Practice for Luxury Tech Favicons**: Encase the mark inside a subtle, rounded dark squircle base (`fill="#0B0F17"`, `rx="14"`, subtle `stroke="#334155"`) with the gleaming platinum/titanium star centered within. This guarantees 100% contrast across Chrome, Safari, Edge, and Firefox in both dark and light modes.
  - In the site header / navbar, use the **pure transparent** version so the mark blends organically into the navbar glass backdrop.

---

## 4. Color & Material Palette Discipline

Reject garish multi-color gradients and cartoonish saturation. Luxury tech speaks in machined physical finishes:

- **Platinum Specular**: `#FFFFFF` $\to$ `#E2E8F0` (lightest facet catching key light)
- **Satin Titanium**: `#CBD5E1` $\to$ `#94A3B8` (machined face at 45° angle)
- **Deep Anodized Shadow**: `#64748B` $\to$ `#1E293B` (recessed bevel face)
- **Space Obsidian Base**: `#0B0F17` / `#05070A` (light-absorbing chassis background)
- **Celestial Energy Accent**: `#38BDF8` / `#BAE6FD` (subtle inner core luminance, $\le 5\%$ of total visual weight)

---

## 5. Semantic SVG Authoring Standard

Every logo SVG must be clean, lightweight, and hand-crafted:
- **Zero Bloat**: Strip Illustrator/Figma metadata, unneeded `<defs>`, and auto-generated editor IDs.
- **Responsive ViewBox**: Always specify `viewBox="0 0 64 64"` (or `32 32`), with `width="100%"` and `height="100%"` so the containing CSS controls physical dimensions.
- **Crisp Geometry**: Use exact integer or single-decimal coordinates (`points="32,4 27,27 32,29.5"`). Avoid messy 10-decimal curve strings.
- **Accessibility**: Include `aria-hidden="true"` when paired with adjacent HTML text to prevent screen readers from reading raw XML tags.

---

## 6. HTML Navbar Integration Standard

Never bake the brand name into the image. Always render them together in clean HTML:

```html
<a class="brand" href="#top" aria-label="NOVA Home">
  <!-- Minimalist Vector Mark (No Text) -->
  <svg class="brand-logo" viewBox="0 0 64 64" aria-hidden="true">
    ...
  </svg>
  <!-- Pure Semantic HTML Text -->
  <span class="brand-name">NOVA</span>
</a>
```

### CSS Requirements
- `.brand`: `display: inline-flex; align-items: center; gap: 12px; text-decoration: none;`
- `.brand-logo`: Fixed width/height (e.g. `20px` to `24px`), `flex-shrink: 0`, with subtle hover glint:
  ```css
  .brand-logo {
    width: 22px;
    height: 22px;
    transition: transform 280ms cubic-bezier(0.16, 1, 0.3, 1), filter 280ms ease;
  }
  .brand:hover .brand-logo {
    transform: scale(1.08) rotate(4deg);
    filter: drop-shadow(0 0 14px rgba(186, 215, 255, 0.45));
  }
  ```
- `.brand-name`: Uppercase, tracked letter-spacing (`0.24em` to `0.30em`), crisp optical alignment with the logo's horizontal centerline.

---

## 7. QA Verification Checklist

Before approving any minimal logo:
1. [ ] **No Text Check**: Is the logo mark 100% free of letters, abbreviations, and slogans?
2. [ ] **Favicon 16px Check**: Does the icon look sharp, identifiable, and unblurred on a 16px browser tab in both dark and light modes?
3. [ ] **HTML Text Check**: Is the brand name rendered in HTML text adjacent to the icon?
4. [ ] **Hover & Responsive Check**: Does hovering over the brand produce a smooth micro-interaction without jitter or layout shifts?
5. [ ] **File Size Check**: Is the SVG file size under 3 KB with clean, hand-authored markup?
