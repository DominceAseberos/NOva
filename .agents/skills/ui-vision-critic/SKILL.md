---
name: ui-vision-critic
description: >-
  Strict AI-in-the-loop UI/UX visual criticism and adversarial layout audit protocol: forbids
  vague "looks good" praise, mandates precise coordinate-grid measurements, scores 9-point
  objective rubrics across three professional personas (Art Director, UX Architect, QA Lead),
  and enforces contact-sheet continuity testing to eradicate AI slop, visual clutter, text collisions,
  and dead zones.
---

# UI/UX Vision Critic & Layout Adversarial Protocol

Use this skill whenever auditing, reviewing, or validating screenshots of web UI layouts, interactive 3D landing pages, canvas viewports, and responsive designs.

---

## 1. The Zero-Tolerance Policy on "AI Slop" & Sycophancy

**Rule Zero**: Never state that a screenshot "looks great", "clean", or "sleek" without evaluating every pixel against an objective rubric. Automated models naturally tend toward generic praise; this protocol enforces **adversarial doubt**. Assume a layout is cluttered, misaligned, or boring until proven otherwise by measured pixels.

### Cardinal Violations
1. **The Ghosting/Collision Defect**: Copy layers overlapping each other, text intersecting 3D models or prominent hardware features, or navigation elements clipping top crowns/lids.
2. **The Redundant Triplication Clutter**: Repeating the same piece of information in 3 different spots on screen (e.g. corner pill, vertical HUD spine, section index badge).
3. **The Dead-Zone Void**: Unintentional empty black voids covering >35% of the viewport with no compositional purpose, gradient, or lighting support.
4. **Copy-Visual Dishonesty**: The headline proclaims "WIRED. POWERED. LEFT PORTS." while the visual camera angle points at the top lid with zero ports visible.
5. **Floating/Detached Subject**: A physical hardware subject hovering in vacuum without contact shadows, ground occlusion, or realistic lighting relationship to its environment.

---

## 2. Mandatory Coordinate-Grid Measurement Protocol

When evaluating screenshots:
1. **Viewport Calibration**: All desktop screenshots must be captured at standard reference resolution (e.g. 1440×900 or 1920×1080).
2. **Grid Partitioning**: Divide the canvas into 12 vertical columns and 3 horizontal tiers:
   - **Top Nav Safe Zone**: $Y \in [0, 80\text{px}]$. Zero hero product geometry or prominent typography may collide with or sit underneath the navigation bar.
   - **Copy Reading Column**: Typically Columns 1–5 ($X \in [36\text{px}, 520\text{px}]$). Must have high-contrast, uncluttered backgrounds.
   - **Primary Visual Stage**: Typically Columns 6–12 ($X \in [540\text{px}, 1400\text{px}]$). The 3D product must sit comfortably centered within this volume with at least 8% margins from viewport borders.
3. **Citation Requirement**: Every criticism must cite concrete bounding coordinates or relative locations (e.g. *"Lid top edge clips at Y=48px, penetrating the 64px fixed nav header"*).

---

## 3. The 9-Point Objective Evaluation Rubric

Every frame or key state is scored from **0 (Failing / Broken)** to **3 (Flawless Benchmark)**:

| # | Criterion | Score 0 (Fail) | Score 3 (Benchmark) |
|---|---|---|---|
| **R1** | **Collision & Safe Margins** | Text overlaps 3D model or nav bar clips subject. | Generous ≥48px breathing room between all elements. |
| **R2** | **Visual Hierarchy** | Eye darts erratically between competing bright tags. | Single clear focal anchor → secondary copy → tertiary specs. |
| **R3** | **Information Economy & Clutter** | 3+ duplicate labels and redundant HUD tags. | Exactly 1 authoritative chapter tag and clean metrics. |
| **R4** | **Copy-to-Visual Truth** | Copy describes left I/O ports; image shows closed top lid. | Visual camera angle directly frames the described feature. |
| **R5** | **Material & Lighting Plausibility** | Subject looks like flat washed-out plastic with no rim. | Physical anodized metal with crisp studio specular catchlights. |
| **R6** | **Spatial Grounding & Depth** | Model floats awkwardly in front of a flat sticker plate. | Multi-plane parallax with contact shadows or pedestal seating. |
| **R7** | **Atmosphere & Compositional Life** | Pure pitch-black empty void; feels sterile or broken. | Atmospheric haze, depth-banded particles, and warm key reflections. |
| **R8** | **Typographic Legibility** | Ghosted previous chapter text visible behind active copy. | 100% crisp typography with clean entrance/exit sequencing. |
| **R9** | **Continuous Flow / Transitions** | Hard jarring snap or abrupt texture pop between sections. | Smooth cinematic camera handoff and coherent visual rhythm. |

---

## 4. The Three-Persona Adversarial Audit

When running this audit, adopt three distinct professional personas in sequence:

### Persona A: The Luxury Art Director
- *Critique Focus*: Aesthetic prestige, lighting drama, luxury materials, color grading, and emotional resonance.
- *Key Question*: *Does this look like an Apple/Porsche \$3,500 flagship launch, or does it look like a low-budget student template?*

### Persona B: The Senior UX Architect
- *Critique Focus*: Reading ergonomics, typographic hierarchy, mental model, scanability, and cognitive load.
- *Key Question*: *Can a busy human grasp the narrative in 2 seconds without squinting or fighting visual noise?*

### Persona C: The Hardened QA Engineer
- *Critique Focus*: Edge clipping, layout breakage, text overlap, canvas aspect distortion, state synchronization, and z-index bleeding.
- *Key Question*: *What breaks when the user scrubs rapidly, resizes the browser, or pauses mid-transition?*

---

## 5. Automated Vision QA Loop Standard

1. **Deterministic Multi-Angle / Multi-Chapter Capture**:
   Execute `node scripts/qa-vision-capture.mjs` to capture every chapter and transition frame with calibrated metadata.
2. **Contact Sheet Audit**:
   Generate composite contact sheets to inspect sequential continuity across chapters.
3. **Severity Classification**:
   - **P0 (Blocker)**: Text collision, canvas crash, upside-down camera flip, or severe edge clipping.
   - **P1 (Critical Visual Defect)**: Out-of-sync ghosted copy, copy-visual mismatch, or washed-out plastic materials.
   - **P2 (Polish & Balance)**: Suboptimal margin, slight lighting imbalance, or excessive label repetition.
   - **P3 (Micro-Polish)**: Minor particle density adjustment or subtle easing tweak.
4. **Enforcement**: Any run with **P0 or P1 findings fails automated certification** and must be resolved before landing code changes.
