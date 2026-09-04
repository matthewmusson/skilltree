# Design brief — Makerspaces tab

Status: confirmed direction (2026-09-03), implementation paused by Matthew.
Discovery answers: YouTube click-to-play media · catalog by category with space
badges · full field-manual entries.

## 1. What it is

A third tab, `Makerspaces`, holding a universal catalog of hardware-lab tools
(the college-agnostic layer), with Stanford's two spaces (PRL, Lab64) mapped on
as badges (the overlay layer). Each tool gets a full field-manual entry: name,
one-sentence purpose, a YouTube click-to-play demo clip, links to the skill
nodes it demonstrates, and access notes such as PRL training requirements.

## 2. Primary user action

Scan a category, watch a short demo of an unfamiliar tool, and jump to the
skill it serves.

## 3. Data model (mirrors the existing layer separation)

- `data/tools.yaml` — universal:
  `id, name, category, purpose, demonstrates: [skill ids], youtube: <video id>,
  typical_shop: true/false`. One file, not per-tool files; entries are short.
- `data/stanford/makerspaces.yaml` extends with per-space inventories:
  `{tool: <id>, access: "requires PRL green-card training"}`.
- `scripts/build.mjs` validates every reference (tool→skill, space→tool) and
  emits the catalog into `data.json`.
- Categories: subtractive (mills, lathes, saws), additive (FDM/SLA printers),
  cutting (laser, waterjet), electronics (soldering, rework, scopes, bench
  instruments), joining (welding, sheet metal), metrology (calipers,
  micrometers), hand tools. Roughly 30–40 tools.

## 4. Layout

Not a card grid. Field-manual inventory: quiet category headings, then dense
hairline-separated rows — tool name and badges (`PRL` / `LAB64` / `SHOP` in
mono) on the left with the purpose sentence and skill links, a small 16:9
thumbnail on the right. Clicking the thumbnail swaps it for the player.

## 5. Media mechanics

- Thumbnail from `img.youtube.com/vi/<id>/hqdefault.jpg`.
- Click replaces the facade with a `youtube-nocookie.com` iframe (autoplay).
  No player script loads until a click.
- One player at a time: starting a clip collapses the previous one back to its
  thumbnail.
- The facade is a real `<button>` (keyboard accessible).

## 6. States

- Tool without a clip: entry renders with a "no demo clip yet" slot, so entries
  ship before every video is curated.
- Thumbnail 404: fall back to `mqdefault.jpg`, then to the empty slot.
- A tool with no space badge still appears — the catalog is universal first.

## 7. Content sourcing

Tool list and purpose lines drafted from the PRL and Lab64 public pages plus
standard shop inventory; one canonical YouTube demo per tool curated via web
search. Matthew skims the video picks afterward.

## Scope

Production quality, one tab. Skill-panel back-links (skill → its tools) ride
along since `demonstrations` already render in the panel.
