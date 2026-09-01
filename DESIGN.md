<!-- SEED: re-run /impeccable document once there's code to capture the actual tokens and components. -->

---
name: Skilltree
description: An interactive prerequisite DAG of expert-verifiable engineering skills, with Stanford classes and makerspaces mapped on top.
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
- **Graphite** [to be resolved during implementation]: ink and primary UI weight. Body text ≥7:1 against the background.

### Neutral
- **Background / surface family** [to be resolved during implementation]: pure or near-pure neutral, chroma at or near zero. No warm cream tint.

### Named Rules
**The Data-Owns-Color Rule.** Branch hues appear only on graph nodes, edges, and their direct legends/labels. UI chrome never borrows a branch color. If a toolbar, button, or panel is colorful, it is wrong.

**The One Accent Rule.** A single accent color for interactive emphasis (selection, links, focus), used on ≤10% of any screen. Its rarity is the point.

**The Colorblind Floor Rule.** Branch identity is never carried by hue alone; every branch pairs its color with position or a text label. The branch palette must survive deuteranopia simulation before it ships.

## 3. Typography

**Body/UI Font:** technical sans [font pairing to be chosen at implementation]
**Identifier/Data Font:** monospace [to be chosen at implementation]

**Character:** Datasheet energy without terminal cosplay. The sans carries prose and UI at high density; the mono marks anything that is an identifier — class codes (`CS 107`), skill slugs, unit counts — so the eye can separate names from prose instantly.

### Hierarchy
[to be resolved during implementation; body line length capped at 65–75ch in detail panels]

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
