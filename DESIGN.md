<!-- SEED (tokens resolved 2026-08-31, contrast-verified): re-run /impeccable document once there's code to capture components. -->

---
name: Skilltree
description: An interactive prerequisite DAG of expert-verifiable engineering skills, with Stanford classes and makerspaces mapped on top.
colors:
  bg: "oklch(1 0 0)"
  surface: "oklch(0.97 0 0)"
  ink: "oklch(0.21 0.005 260)"
  muted: "oklch(0.50 0.01 260)"
  accent: "oklch(0.35 0.11 140)"
typography:
  body:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
  identifier:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
---

# Design System: Skilltree

## 1. Overview

**Creative North Star: "The Field Manual"**

A reference document you trust with your career, rendered as an interface. The system's authority comes from correctness and density, never from visual persuasion. It borrows its posture from The Art of Electronics (dense typeset authority, figures doing real work, zero decoration) and Tufte (high data-ink ratio, labels integrated with the marks they describe, a quiet palette that lets data carry the color).

The surface is restrained: near-neutral backgrounds, graphite ink, one sparing accent. All vividness belongs to the graph itself, where a colorblind-safe branch palette (ME / EE-circuits / EE-digital / CS-systems / CS-ML / physics / bioE-chemE) is functional encoding, not decoration. Motion is responsive: easing on pan/zoom and selection transitions, no orchestrated entrances, `prefers-reduced-motion` honored everywhere.

This system explicitly rejects, per PRODUCT.md: the SaaS dashboard (card grids, hero metrics, gradient accents), the gamified edu-app (mascots, streaks, candy colors), the university portal (bureaucratic chrome, cramped tables), and the Obsidian graph view (a force-directed hairball; this graph is a layered DAG whose layout is information).

**Key Characteristics:**
- Density is respect: one well-organized dense panel beats three airy ones
- Data owns the color; chrome stays graphite-and-neutral
- The graph reads as a layered DAG at a glance, structure legible without interaction
- Monospace for identifiers (class codes, skill slugs), sans for everything else
- Flat surfaces; depth only where state demands it

## 2. Colors

Restrained strategy: near-neutral surfaces and graphite ink, one accent at ≤10% of any screen, and a functional branch palette reserved exclusively for graph data.

### Primary
- **Graphite** (oklch(0.21 0.005 260), ≈#17181b): ink and all primary UI weight. 17.7:1 against the background — verified, not estimated.
- **Moss** (oklch(0.35 0.11 140), ≈#124703): the single accent. Links, focus rings, selection state. Deep enough to hold white text (10.9:1) and to read as ink-adjacent rather than decorative. 10.9:1 as link text on the background.

### Neutral
- **Paper** (oklch(1 0 0), #ffffff): the background. Pure white, chroma exactly zero — a field manual is printed on paper, not cream.
- **Surface** (oklch(0.97 0 0), ≈#f5f5f5): panels and wells, one visible step down from paper.
- **Muted** (oklch(0.50 0.01 260), ≈#606369): secondary text. 6.0:1 on paper, 5.5:1 on surface — above the 4.5:1 floor on both.

### Branch Palette (data only)
The Okabe-Ito colorblind-safe palette, the scientific-publishing standard: orange #E69F00, sky blue #56B4E9, bluish green #009E73, yellow #F0E442, blue #0072B2, vermillion #D55E00, reddish purple #CC79A7. Branch-to-color assignment locks when the branch list locks; the build validator runs a deuteranopia simulation as a hard gate. Light members (yellow, sky blue) take graphite text; dark members take white.

### Named Rules
**The Data-Owns-Color Rule.** Branch hues appear only on graph nodes, edges, and their direct legends/labels. UI chrome never borrows a branch color. If a toolbar, button, or panel is colorful, it is wrong.

**The One Accent Rule.** A single accent color for interactive emphasis (selection, links, focus), used on ≤10% of any screen. Its rarity is the point.

**The Colorblind Floor Rule.** Branch identity is never carried by hue alone; every branch pairs its color with position or a text label. The branch palette must survive deuteranopia simulation before it ships.

## 3. Typography

**Body/UI Font:** IBM Plex Sans (with system-ui fallback)
**Identifier/Data Font:** IBM Plex Mono (with ui-monospace fallback)

**Character:** Datasheet energy without terminal cosplay. Plex was designed by IBM for technical documentation; the sans holds up at density, and the mono is its metric sibling, so identifiers sit in prose without jolting the line. The mono marks anything that is an identifier — class codes (`CS 107`), skill slugs, unit counts — so the eye separates names from prose instantly. Both free, variable, self-hosted.

### Hierarchy
[sizes and weights resolved during implementation; body line length capped at 65–75ch in detail panels]

### Named Rules
**The Identifier Rule.** If a string is a code the university or the data model assigns (class code, skill ID, unit count), it is set in mono. If it is human language, it is set in sans. No exceptions, no mixing.

## 4. Elevation

Flat by default. Surfaces are distinguished by hairline borders and subtle background steps, not shadows. Depth appears only as a response to state: an opened detail panel or dropdown may cast one quiet shadow to establish stacking order. No decorative glows, no glassmorphism.

## 5. Components

Omitted — no components exist yet. Populated on the first scan-mode run once the UI is built.

## 6. Do's and Don'ts

### Do:
- **Do** keep all vivid color inside the graph; chrome stays graphite and neutral.
- **Do** set every class code, skill slug, and numeric identifier in monospace.
- **Do** make the DAG's layered structure legible at rest — layout is information.
- **Do** honor `prefers-reduced-motion` with instant or crossfade alternatives on every transition.
- **Do** hold body text to ≥7:1 contrast and detail-panel prose to 65–75ch.

### Don't:
- **Don't** build the "SaaS dashboard": card grids, hero metrics, gradient accents, generic admin-tool chrome (PRODUCT.md anti-reference, verbatim).
- **Don't** build the "gamified edu-app": mascots, streaks, badges, candy colors, infantilizing tone (PRODUCT.md anti-reference, verbatim).
- **Don't** build the "university portal": bureaucratic web chrome, Axess/Canvas energy, cramped tables (PRODUCT.md anti-reference, verbatim).
- **Don't** render the graph as an "Obsidian graph view" force-directed hairball; the layout is a layered DAG or it is a failure (PRODUCT.md anti-reference, verbatim).
- **Don't** use warm-cream backgrounds, gradient text, side-stripe borders, or glassmorphism.
- **Don't** let any UI element borrow a branch color for decoration.
