# Product

## Register

product

## Users

Primary: Matthew, a Stanford Engineering Physics undergrad planning what to learn across ME, EE, CS, physics, and bioE/chemE. Context: choosing classes each quarter, choosing projects for the PRL and Lab64 makerspaces, deciding what to defer to on-the-job learning.

Later: other Stanford engineering students doing the same planning for their own majors, each with their own profile and progress (v2+, behind SSO).

The job to be done: look at a college-agnostic map of real engineering skills, see which Stanford classes and makerspace projects acquire each one, and plan a path. The user is in a deliberate planning workflow, not a casual browsing one.

## Product Purpose

An interactive prerequisite DAG of expert-verifiable engineering skills. Nodes are skills defined the way a hiring manager would ("can lay out a 4-layer PCB and get it fabbed"), not course titles. Stanford classes, majors, and makerspaces are an overlay mapped onto the universal graph.

Success: a student can select a major, see exactly which skills its sequence covers and at what depth, see the gaps, and know for each gap whether a class, a makerspace project, or only a job will fill it.

## Brand Personality

Engineering handbook. Precise, dense, quietly confident. Feels like a well-typeset reference manual or datasheet: the authority comes from the content being correct and complete, not from visual persuasion. Emotional goal: the calm of holding an accurate map of a large territory.

## Anti-references

- **SaaS dashboard**: card grids, hero metrics, gradient accents, generic admin chrome.
- **Gamified edu-app**: Duolingo-style mascots, streaks, badges, candy colors, infantilizing tone.
- **University portal**: bureaucratic web chrome, Axess/Canvas energy, cramped tables.
- **Obsidian graph view**: a floating force-directed hairball of dots. The graph must read as a layered DAG with legible structure, never a decorative constellation.

## Design Principles

1. **The graph is the interface.** Structure must be legible at a glance: layers, branches, and cross-branch prerequisite edges all readable without interaction. Layout is information, not decoration.
2. **Density is respect.** The user reads fast and hates filler. Prefer one dense, well-organized panel over three airy ones. Every sentence in a skill description must survive an expert's review.
3. **Claims are verifiable.** Skill copy is written as a falsifiable job description ("can do X"), never as vibes ("understands Y deeply"). The UI presents it that way: lists of capabilities, not paragraphs of praise.
4. **Honest acquisition.** When no class or makerspace path reaches a skill, the UI says "on the job only" plainly. No pretending the curriculum covers everything.
5. **Content outlives chrome.** The data model (skills, classes, majors) is the asset; the UI renders it. Nothing in the visual layer should ever constrain what the data can express.

## Accessibility & Inclusion

WCAG AA contrast throughout. `prefers-reduced-motion` honored on all graph animation. Graph navigable by keyboard (focus moves along edges; detail panel reachable without a pointer). Branch color palette must be colorblind-safe; branch identity never carried by hue alone (pair with position or labeling).
