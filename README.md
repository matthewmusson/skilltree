# Skilltree

**Live site: https://matthewmusson.github.io/skilltree/**

An interactive prerequisite DAG (directed acyclic graph) of expert-verifiable
engineering skills across mechanical, electrical, software, physics, robotics,
supply chain, and bio branches, with Stanford's classes, majors, and
makerspaces mapped on top as an overlay.

**Status: early draft.** Node descriptions, class mappings, and the Engineering
Physics sequence are unverified first passes.

## Idea

- **Nodes are skills**, defined the way a hiring manager would verify them
  ("can lay out a 4-layer PCB and get it fabbed"), never course titles.
- **Edges are prerequisites.** The graph is a shallow, wide DAG; prerequisites
  cross branches freely.
- **Institutions are overlays.** A skill file never names a class. The Stanford
  layer (`data/stanford/`) maps classes onto skills with a `teaches`/`touches`
  depth, majors onto class sequences, and makerspaces (PRL, Lab64) onto the
  skills they can demonstrate. Coverage is derived at build time.
- **Honest acquisition.** Skills no class or makerspace reaches are flagged
  `on_the_job_only`.

## Structure

```
data/skills/*.yaml       one file per skill node (the universal layer)
data/stanford/*.yaml     classes, majors, makerspaces (the overlay)
scripts/build.mjs        validates everything, compiles docs/data.json
docs/                    static site (GitHub Pages serves this)
```

## Develop

```
npm install
npm run build      # validate + compile docs/data.json
npm run serve      # localhost:3001
```

Design context lives in `PRODUCT.md` (strategy) and `DESIGN.md` (visual system).
