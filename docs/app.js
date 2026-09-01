// Skilltree graph UI. Bottom-up layered DAG: foundations on the bottom row,
// each branch a labeled vertical band, prerequisite edges flowing upward.
// No dependencies; SVG built by hand so the layout stays fully ours.
const SVG = "http://www.w3.org/2000/svg";
const NODE_W = 176, NODE_H = 34, GAP_X = 30, GAP_Y = 120, BAND_GAP = 64, PAD = 72, LABEL_H = 46;

// Left-to-right band order, chosen to keep cross-branch edges short:
// math sits centrally because everything drinks from it.
const BAND_ORDER = [
  "supply-chain", "meche", "bio-chem", "physics", "math",
  "ee-circuits", "ee-digital", "cs-systems", "cs-ml", "robotics",
];

const state = { data: null, selected: null, major: "" };

async function main() {
  const wrap = document.getElementById("graph-wrap");
  try {
    const res = await fetch("data.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.data = await res.json();
  } catch (err) {
    wrap.innerHTML = `<div class="load-error" role="alert">
      <p>Could not load the skill graph (${esc(err.message)}).</p>
      <button id="retry">Try again</button></div>`;
    document.getElementById("retry").addEventListener("click", () => location.reload());
    return;
  }
  document.getElementById("loading")?.remove();

  const { nodes, branches, majors } = state.data;
  state.byId = Object.fromEntries(nodes.map((n) => [n.id, n]));

  const legend = document.getElementById("legend");
  for (const id of BAND_ORDER) {
    const b = branches[id];
    if (!b) continue;
    const s = document.createElement("span");
    s.innerHTML = `<span class="swatch" style="background:${b.color}"></span>${b.name}`;
    legend.appendChild(s);
  }
  const sel = document.getElementById("major");
  for (const m of majors) {
    const o = document.createElement("option");
    o.value = m.id; o.textContent = m.name;
    sel.appendChild(o);
  }
  sel.addEventListener("change", () => { state.major = sel.value; render(); });
  document.getElementById("panel-close").addEventListener("click", closePanel);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closePanel(); });

  layout();
  render();
  initPanZoom();
}

// ---- layout: branch bands (x) × layers bottom-up (y) -----------------------
// A layer wider than SLOT_CAP nodes wraps into sub-rows inside its band, so no
// single branch can stretch the whole graph into an unreadable strip.
const SLOT_CAP = 3, SUBROW_GAP = 12;

function layout() {
  const { nodes, branches } = state.data;
  const maxLayer = Math.max(...nodes.map((n) => n.layer));
  const bands = BAND_ORDER.filter((b) => branches[b]);

  // bucket nodes per band per layer
  const byBand = {};
  for (const b of bands) byBand[b] = Array.from({ length: maxLayer + 1 }, () => []);
  for (const n of nodes) byBand[n.branch]?.[n.layer].push(n);

  // band column count = widest layer in that band, capped
  const cols = {};
  for (const b of bands)
    cols[b] = Math.max(1, ...byBand[b].map((L) => Math.min(L.length, SLOT_CAP)));

  // x extents per band
  let x = PAD;
  state.bands = [];
  for (const b of bands) {
    const w = cols[b] * (NODE_W + GAP_X) - GAP_X;
    state.bands.push({ id: b, x0: x, w });
    x += w + BAND_GAP;
  }
  const bandX = Object.fromEntries(state.bands.map((b) => [b.id, b]));

  // per-layer height = tallest sub-row stack across bands at that layer
  const layerH = [];
  for (let li = 0; li <= maxLayer; li++) {
    let maxSub = 1;
    for (const b of bands) {
      const count = byBand[b][li].length;
      if (count) maxSub = Math.max(maxSub, Math.ceil(count / cols[b]));
    }
    layerH[li] = maxSub * (NODE_H + SUBROW_GAP) - SUBROW_GAP;
  }
  // stack top-down: highest layer at the top, foundations at the bottom
  const yTop = [];
  let y = PAD + LABEL_H;
  for (let li = maxLayer; li >= 0; li--) {
    yTop[li] = y;
    y += layerH[li] + GAP_Y;
  }

  // place: within a band-layer, order by prereq barycenter for shorter edges
  for (let pass = 0; pass < 2; pass++) {
    for (const b of bands) {
      for (let li = 0; li <= maxLayer; li++) {
        const row = byBand[b][li];
        if (!row.length) continue;
        row.sort((m, n) => bary(m) - bary(n));
        const nCols = Math.min(row.length, cols[b]);
        const rowW = nCols * (NODE_W + GAP_X) - GAP_X;
        const x0 = bandX[b].x0 + (bandX[b].w - rowW) / 2;
        row.forEach((n, i) => {
          n.x = x0 + (i % nCols) * (NODE_W + GAP_X);
          n.y = yTop[li] + Math.floor(i / nCols) * (NODE_H + SUBROW_GAP);
        });
      }
    }
  }
  function bary(n) {
    const ps = n.prereqs.filter((p) => state.byId[p]?.x !== undefined);
    if (!ps.length) return n.x ?? 0;
    return ps.reduce((s, p) => s + state.byId[p].x, 0) / ps.length;
  }

  state.w = x - BAND_GAP + PAD;
  state.h = y - GAP_Y + PAD;
  state.maxLayer = maxLayer;
  state.yTop = yTop;
  state.layerH = layerH;
}

// ---- major coverage --------------------------------------------------------
function coverage() {
  if (!state.major) return null;
  const major = state.data.majors.find((m) => m.id === state.major);
  const classIds = new Set(major.sequence.flatMap((y) => y.classes));
  const cov = {};
  for (const n of state.data.nodes)
    for (const c of n.classes)
      if (classIds.has(c.id))
        cov[n.id] = cov[n.id] === "teaches" ? "teaches" : c.depth;
  return cov;
}

// ---- render ----------------------------------------------------------------
function render() {
  const svg = document.getElementById("graph");
  svg.innerHTML = "";
  const { branches } = state.data;
  const cov = coverage();
  const sel = state.selected;
  const keep = sel ? ancestorsOf(sel).add(sel) : null;

  const gChrome = document.createElementNS(SVG, "g");
  const gEdges = document.createElementNS(SVG, "g");
  const gNodes = document.createElementNS(SVG, "g");
  svg.append(gChrome, gEdges, gNodes);

  // band separators + labels (labels sit above the top row)
  state.bands.forEach((b, i) => {
    if (i > 0) {
      const line = document.createElementNS(SVG, "line");
      const xSep = b.x0 - BAND_GAP / 2;
      line.setAttribute("x1", xSep); line.setAttribute("x2", xSep);
      line.setAttribute("y1", PAD - 10); line.setAttribute("y2", state.h - PAD + 10);
      line.setAttribute("class", "band-sep");
      gChrome.appendChild(line);
    }
    const g = document.createElementNS(SVG, "g");
    const chip = document.createElementNS(SVG, "rect");
    const label = document.createElementNS(SVG, "text");
    const name = branches[b.id].name.toUpperCase();
    label.setAttribute("class", "band-label");
    label.textContent = name;
    label.setAttribute("x", b.x0 + b.w / 2);
    label.setAttribute("y", PAD + 12);
    label.setAttribute("text-anchor", "middle");
    chip.setAttribute("class", "band-chip");
    chip.setAttribute("x", b.x0 + b.w / 2 - name.length * 3.6 - 16);
    chip.setAttribute("y", PAD + 4);
    chip.setAttribute("width", 9); chip.setAttribute("height", 9);
    chip.setAttribute("rx", 2);
    chip.setAttribute("fill", branches[b.id].color);
    g.append(chip, label);
    gChrome.appendChild(g);
  });

  // layer guide labels down the left edge: L0 = foundations at the bottom
  for (let li = 0; li <= state.maxLayer; li++) {
    const t = document.createElementNS(SVG, "text");
    t.setAttribute("class", "layer-label");
    t.setAttribute("x", 14);
    t.setAttribute("y", state.yTop[li] + state.layerH[li] / 2 + 3);
    t.textContent = "L" + li + (li === 0 ? " · foundations" : "");
    gChrome.appendChild(t);
  }

  for (const n of state.data.nodes) {
    for (const p of n.prereqs) {
      const a = state.byId[p];
      if (!a) continue;
      const path = document.createElementNS(SVG, "path");
      const x1 = a.x + NODE_W / 2, y1 = a.y;                 // top of prereq
      const x2 = n.x + NODE_W / 2, y2 = n.y + NODE_H;        // bottom of dependent
      const d = Math.max(30, (y1 - y2) * 0.45);
      path.setAttribute("d", `M${x1},${y1} C${x1},${y1 - d} ${x2},${y2 + d} ${x2},${y2}`);
      path.setAttribute("class", "edge");
      if (keep) {
        if (keep.has(n.id) && keep.has(p)) path.classList.add("hl");
        else path.classList.add("dimmed");
      }
      gEdges.appendChild(path);
    }
  }

  for (const n of state.data.nodes) {
    const g = document.createElementNS(SVG, "g");
    g.setAttribute("class", "node");
    g.setAttribute("transform", `translate(${n.x},${n.y})`);
    g.setAttribute("tabindex", "0");
    g.setAttribute("role", "button");
    g.setAttribute("aria-label", n.title);
    const color = state.data.branches[n.branch].color;

    const rect = document.createElementNS(SVG, "rect");
    rect.setAttribute("width", NODE_W);
    rect.setAttribute("height", NODE_H);
    rect.setAttribute("rx", 6);
    rect.setAttribute("stroke", color);

    if (cov) {
      const c = cov[n.id];
      if (c === "teaches") rect.setAttribute("fill", color + "26");
      else if (c === "touches") g.classList.add("covered-touches");
      else g.classList.add("dimmed");
    }
    if (keep && !keep.has(n.id)) g.classList.add("dimmed");
    if (sel === n.id) g.classList.add("selected");

    const chip = document.createElementNS(SVG, "rect");
    chip.setAttribute("x", 9); chip.setAttribute("y", NODE_H / 2 - 4);
    chip.setAttribute("width", 8); chip.setAttribute("height", 8);
    chip.setAttribute("rx", 2); chip.setAttribute("fill", color);

    const label = document.createElementNS(SVG, "text");
    label.setAttribute("x", 24); label.setAttribute("y", NODE_H / 2 + 4);
    label.textContent = n.title.length > 24 ? n.title.slice(0, 23) + "…" : n.title;

    // full title on hover for truncated labels
    const tip = document.createElementNS(SVG, "title");
    tip.textContent = n.title;

    g.append(tip, rect, chip, label);
    const pick = () => select(n.id);
    g.addEventListener("click", pick);
    g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } });
    gNodes.appendChild(g);
  }
}

function ancestorsOf(id) {
  const out = new Set();
  const walk = (i) => {
    for (const p of state.byId[i]?.prereqs ?? [])
      if (state.byId[p] && !out.has(p)) { out.add(p); walk(p); }
  };
  walk(id);
  return out;
}

// ---- selection + panel -----------------------------------------------------
const LIGHT = new Set(["#E69F00", "#56B4E9", "#F0E442", "#8B8000"]);

function select(id) {
  state.selected = id;
  render();
  const n = state.byId[id];
  const b = state.data.branches[n.branch];
  const tagClass = LIGHT.has(b.color) ? "branch-tag light-text-dark" : "branch-tag";
  const el = document.getElementById("panel-body");
  const demos = n.demos.map((d) => {
    const space = state.data.makerspaces.find((s) => s.id === d.space);
    return `<li><strong>${esc(space.name)}</strong>: ${esc(d.note)}</li>`;
  }).join("");
  el.innerHTML = `
    <h2>${esc(n.title)}</h2>
    <span class="${tagClass}" style="background:${b.color}">${esc(b.name)}</span>
    ${n.acquisition.on_the_job_only ? `<p class="otj">Learned on the job — no class or makerspace path covers this.</p>` : ""}
    <section><h3>What it is</h3><p>${esc(n.overview)}</p></section>
    <section><h3>Proficient means you can</h3>
      <ul>${n.proficiency.map((p) => `<li>${esc(p)}</li>`).join("")}</ul></section>
    ${n.prereqs.length ? `<section><h3>Prerequisites</h3><p>${n.prereqs
        .map((p) => `<button class="prereq-link" data-id="${esc(p)}">${esc(state.byId[p]?.title ?? p)}</button>`)
        .join(" · ")}</p></section>` : ""}
    ${n.classes.length ? `<section><h3>Stanford classes</h3>
      <ul>${n.classes.map((c) => `<li><span class="class-code">${esc(c.id)}</span> ${esc(c.title)} <span class="depth">(${esc(c.depth)})</span></li>`).join("")}</ul></section>` : ""}
    ${demos ? `<section><h3>Makerspace demonstrations</h3><ul>${demos}</ul></section>` : ""}
    ${n.acquisition.notes ? `<section><h3>Honest note</h3><p class="note">${esc(n.acquisition.notes)}</p></section>` : ""}
    ${n.resources.length ? `<section><h3>Resources</h3>
      <ul>${n.resources.map((r) => `<li>${esc(r)}</li>`).join("")}</ul></section>` : ""}
  `;
  el.querySelectorAll(".prereq-link").forEach((a) =>
    a.addEventListener("click", () => select(a.dataset.id)));
  document.getElementById("panel").hidden = false;
}

function closePanel() {
  if (document.getElementById("panel").hidden) return;
  state.selected = null;
  document.getElementById("panel").hidden = true;
  render();
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ---- pan / zoom ------------------------------------------------------------
function initPanZoom() {
  const svg = document.getElementById("graph");
  const wrap = document.getElementById("graph-wrap");
  // initial view: fit the graph's height, center horizontally; the graph is
  // wider than any viewport, so panning covers the rest
  const aspect = wrap.clientWidth / wrap.clientHeight || 1;
  let vbW = Math.min(state.w, state.h * aspect);
  let vb = [(state.w - vbW) / 2, 0, vbW, state.h];
  const apply = () => svg.setAttribute("viewBox", vb.join(" "));
  apply();
  let drag = null;
  wrap.addEventListener("mousedown", (e) => {
    if (e.target.closest(".node")) return;
    drag = { x: e.clientX, y: e.clientY, vb: [...vb] };
    wrap.classList.add("dragging");
  });
  window.addEventListener("mousemove", (e) => {
    if (!drag) return;
    const scale = vb[2] / wrap.clientWidth;
    vb[0] = drag.vb[0] - (e.clientX - drag.x) * scale;
    vb[1] = drag.vb[1] - (e.clientY - drag.y) * scale;
    apply();
  });
  window.addEventListener("mouseup", () => { drag = null; wrap.classList.remove("dragging"); });
  wrap.addEventListener("wheel", (e) => {
    e.preventDefault();
    const f = e.deltaY > 0 ? 1.12 : 1 / 1.12;
    const r = wrap.getBoundingClientRect();
    const px = vb[0] + ((e.clientX - r.left) / r.width) * vb[2];
    const py = vb[1] + ((e.clientY - r.top) / r.height) * vb[3];
    vb = [px - (px - vb[0]) * f, py - (py - vb[1]) * f, vb[2] * f, vb[3] * f];
    apply();
  }, { passive: false });
}

main();
