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

const state = {
  data: null, selected: null, major: "",
  // SVG text measurement returns 0 on display:none elements, so each tab's
  // view renders only while visible; dirty flags defer the hidden one.
  tab: "graph", graphDirty: true, cmDirty: true, panZoomInit: false,
};

// ---- theming ---------------------------------------------------------------
// Three branch colors sit below 3:1 against the dark background; these are the
// contrast-verified lightened variants used only in dark mode.
const THEME_KEY = "skilltree-theme";
const DARK_BRANCH = { math: "#5d6168", robotics: "#6659a6", "supply-chain": "#9a436f" };
const themePref = () => localStorage.getItem(THEME_KEY) ?? "system";
const effectiveDark = () => {
  const p = themePref();
  return p === "dark" || (p === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
};
const bcolor = (id) =>
  effectiveDark() ? DARK_BRANCH[id] ?? state.data.branches[id].color : state.data.branches[id].color;
function applyTheme() {
  const p = themePref();
  if (p === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = p;
  const btn = document.getElementById("theme-toggle");
  btn.textContent = { system: "◐ Auto", light: "○ Light", dark: "● Dark" }[p];
  btn.setAttribute("aria-label", `Color theme: ${p}. Click to change.`);
  btn.title = p === "system" ? "Theme follows your OS setting" : `Theme: ${p}`;
}

// ---- tabs ------------------------------------------------------------------
function showTab(which) {
  state.tab = which;
  document.getElementById("graph-wrap").hidden = which !== "graph";
  document.getElementById("class-map").hidden = which !== "classes";
  document.getElementById("tab-graph").setAttribute("aria-current", which === "graph" ? "page" : "false");
  document.getElementById("tab-classes").setAttribute("aria-current", which === "classes" ? "page" : "false");
  if (location.hash !== (which === "classes" ? "#classes" : ""))
    history.replaceState(null, "", which === "classes" ? "#classes" : location.pathname);
  refreshTab();
}
function refreshTab() {
  if (state.tab === "graph") {
    if (state.graphDirty) { render(); state.graphDirty = false; }
    if (!state.panZoomInit) { initPanZoom(); state.panZoomInit = true; }
  } else if (state.cmDirty) {
    renderClassDag(document.getElementById("cm-branch").value || "robotics");
    state.cmDirty = false;
  }
}

async function main() {
  const wrap = document.getElementById("graph-wrap");
  try {
    const res = await fetch(`data.json?v=${window.ASSET_V ?? ""}`);
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
    const btn = document.createElement("button");
    btn.type = "button";
    btn.innerHTML = `<span class="swatch" data-branch="${id}" style="background:${bcolor(id)}"></span>${b.name}`;
    btn.setAttribute("aria-label", `Go to ${b.name} branch`);
    btn.addEventListener("click", () => { showTab("graph"); flyToBand(id); });
    legend.appendChild(btn);
  }

  const rerenderAll = () => {
    state.graphDirty = state.cmDirty = true;
    refreshTab();
    for (const sw of legend.querySelectorAll(".swatch"))
      sw.style.background = bcolor(sw.dataset.branch);
  };
  applyTheme();
  document.getElementById("theme-toggle").addEventListener("click", () => {
    const next = { system: "dark", dark: "light", light: "system" }[themePref()];
    if (next === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, next);
    applyTheme();
    rerenderAll();
  });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", rerenderAll);
  const sel = document.getElementById("major");
  const ogUG = document.createElement("optgroup");
  ogUG.label = "Undergraduate";
  for (const m of majors) {
    const o = document.createElement("option");
    o.value = m.id; o.textContent = m.name;
    ogUG.appendChild(o);
  }
  const ogGrad = document.createElement("optgroup");
  ogGrad.label = "Graduate (auto-derived, partial)";
  for (const p of state.data.gradPrograms) {
    const o = document.createElement("option");
    o.value = "grad:" + p.id; o.textContent = p.name;
    ogGrad.appendChild(o);
  }
  sel.append(ogUG, ogGrad);
  sel.addEventListener("change", () => {
    state.major = sel.value;
    document.getElementById("overlay-key").hidden = !state.major;
    state.graphDirty = true;
    refreshTab();
  });
  document.getElementById("panel-close").addEventListener("click", closePanel);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closePanel(); });

  layout();

  const cmSel = document.getElementById("cm-branch");
  for (const bid of BAND_ORDER) {
    if (!branches[bid]) continue;
    const o = document.createElement("option");
    o.value = bid; o.textContent = branches[bid].name;
    cmSel.appendChild(o);
  }
  cmSel.value = "robotics";
  cmSel.addEventListener("change", () => renderClassDag(cmSel.value));

  document.getElementById("tab-graph").addEventListener("click", () => showTab("graph"));
  document.getElementById("tab-classes").addEventListener("click", () => showTab("classes"));
  showTab(location.hash === "#classes" ? "classes" : "graph");
}

// ---- fly-to-branch camera --------------------------------------------------
function flyToBand(id) {
  const band = state.bands.find((b) => b.id === id);
  if (!band || !state.view) return;
  const wrap = document.getElementById("graph-wrap");
  const aspect = wrap.clientWidth / wrap.clientHeight || 1;
  let vbW = band.w + 2 * BAND_GAP;
  let vbH = vbW / aspect;
  if (vbH < state.h * 0.9) { vbH = state.h * 0.9; vbW = vbH * aspect; }
  const target = [band.x0 + band.w / 2 - vbW / 2, (state.h - vbH) / 2, vbW, vbH];
  state.view.animateTo(target);
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
  let classIds;
  if (state.major.startsWith("grad:")) {
    const p = state.data.gradPrograms.find((g) => "grad:" + g.id === state.major);
    classIds = new Set(p.classes);
  } else {
    const major = state.data.majors.find((m) => m.id === state.major);
    classIds = new Set(major.sequence.flatMap((y) => y.classes));
  }
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

  // band shading + labels (labels sit above the top row)
  state.bands.forEach((b) => {
    const tint = document.createElementNS(SVG, "rect");
    tint.setAttribute("x", b.x0 - GAP_X / 2);
    tint.setAttribute("y", PAD - 6);
    tint.setAttribute("width", b.w + GAP_X);
    tint.setAttribute("height", state.h - 2 * PAD + 12);
    tint.setAttribute("rx", 10);
    tint.setAttribute("fill", bcolor(b.id) + (effectiveDark() ? "14" : "0D"));
    gChrome.appendChild(tint);

    const g = document.createElementNS(SVG, "g");
    const chip = document.createElementNS(SVG, "rect");
    const label = document.createElementNS(SVG, "text");
    const name = branches[b.id].name.toUpperCase();
    label.setAttribute("class", "band-label");
    label.textContent = name;
    label.setAttribute("x", b.x0 + b.w / 2);
    label.setAttribute("y", PAD + 12);
    label.setAttribute("text-anchor", "middle");
    chip.setAttribute("x", b.x0 + b.w / 2 - name.length * 3.6 - 16);
    chip.setAttribute("y", PAD + 4);
    chip.setAttribute("width", 9); chip.setAttribute("height", 9);
    chip.setAttribute("rx", 2);
    chip.setAttribute("fill", bcolor(b.id));
    g.setAttribute("class", "band-head");
    g.setAttribute("role", "button");
    g.setAttribute("tabindex", "0");
    g.setAttribute("aria-label", `Go to ${branches[b.id].name} branch`);
    g.style.cursor = "pointer";
    g.addEventListener("click", () => flyToBand(b.id));
    g.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flyToBand(b.id); }
    });
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

  // reading order = tab order: left band to right band, bottom layer to top
  const ordered = [...state.data.nodes].sort((a, b) => a.x - b.x || b.y - a.y);
  for (const n of ordered) {
    const g = document.createElementNS(SVG, "g");
    g.setAttribute("class", "node");
    g.setAttribute("transform", `translate(${n.x},${n.y})`);
    g.setAttribute("tabindex", "0");
    g.setAttribute("role", "button");
    g.setAttribute("aria-label", n.title);
    const color = bcolor(n.branch);

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
    label.textContent = n.title;

    // full title on hover for truncated labels
    const tip = document.createElementNS(SVG, "title");
    tip.textContent = n.title;

    g.append(tip, rect, chip, label);
    const pick = () => select(n.id);
    g.addEventListener("click", pick);
    g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } });
    gNodes.appendChild(g);
  }
  // trim labels by measured width, never by character count (glyph widths vary)
  for (const label of gNodes.querySelectorAll("g.node > text"))
    fitText(label, NODE_W - 24 - 8);
}

// Width-aware truncation. Measures rendered glyphs; caches per title so the
// layout cost is paid once, not on every re-render.
const fitCache = new Map();
function fitText(el, max) {
  const full = el.textContent;
  const key = full + "|" + max + "|" + (el.getAttribute("class") ?? "");
  if (fitCache.has(key)) { el.textContent = fitCache.get(key); return; }
  // Unmeasurable (display:none subtree or hidden pane) — keep full text, no cache.
  if (full && el.getComputedTextLength() === 0) return;
  let s = full;
  while (s.length > 2 && el.getComputedTextLength() > max) {
    s = s.slice(0, -2).replace(/[\s·&-]+$/, "") + "…";
    el.textContent = s;
  }
  fitCache.set(key, s);
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

function select(id, opts = {}) {
  if (state.tab !== "graph") showTab("graph");
  state.selected = id;
  render();
  if (opts.fly) state.view?.flyToNode(id);
  const n = state.byId[id];
  const b = state.data.branches[n.branch];
  const tagColor = bcolor(n.branch);
  const tagClass = LIGHT.has(tagColor) ? "branch-tag light-text-dark" : "branch-tag";
  const el = document.getElementById("panel-body");
  const demos = n.demos.map((d) => {
    const space = state.data.makerspaces.find((s) => s.id === d.space);
    return `<li><strong>${esc(space.name)}</strong>: ${esc(d.note)}</li>`;
  }).join("");
  el.innerHTML = `
    <h2>${esc(n.title)}</h2>
    <span class="${tagClass}" style="background:${tagColor}">${esc(b.name)}</span>
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
    a.addEventListener("click", () => select(a.dataset.id, { fly: true })));
  const panel = document.getElementById("panel");
  const wasHidden = panel.hidden;
  panel.hidden = false;
  if (wasHidden) panel.focus();
}

function closePanel() {
  if (document.getElementById("panel").hidden) return;
  const last = state.selected;
  state.selected = null;
  document.getElementById("panel").hidden = true;
  render();
  // hand keyboard focus back to the node the panel was describing
  if (last) {
    const n = state.byId[last];
    if (n) document.querySelector(`#graph .node[aria-label="${CSS.escape(n.title)}"]`)?.focus();
  }
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
  wrap.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".node") || e.target.closest("#view-controls")) return;
    drag = { x: e.clientX, y: e.clientY, vb: [...vb] };
    wrap.setPointerCapture(e.pointerId);
    wrap.classList.add("dragging");
  });
  wrap.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const scale = vb[2] / wrap.clientWidth;
    vb[0] = drag.vb[0] - (e.clientX - drag.x) * scale;
    vb[1] = drag.vb[1] - (e.clientY - drag.y) * scale;
    apply();
  });
  const endDrag = () => { drag = null; wrap.classList.remove("dragging"); };
  wrap.addEventListener("pointerup", endDrag);
  wrap.addEventListener("pointercancel", endDrag);
  wrap.addEventListener("wheel", (e) => {
    e.preventDefault();
    zoomAt(e.deltaY > 0 ? 1.12 : 1 / 1.12, e.clientX, e.clientY);
  }, { passive: false });

  function zoomAt(f, cx, cy) {
    const r = wrap.getBoundingClientRect();
    const px = vb[0] + ((cx - r.left) / r.width) * vb[2];
    const py = vb[1] + ((cy - r.top) / r.height) * vb[3];
    vb = [px - (px - vb[0]) * f, py - (py - vb[1]) * f, vb[2] * f, vb[3] * f];
    apply();
  }
  const center = () => {
    const r = wrap.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  };
  document.getElementById("zoom-in").addEventListener("click", () => zoomAt(1 / 1.3, ...center()));
  document.getElementById("zoom-out").addEventListener("click", () => zoomAt(1.3, ...center()));
  document.getElementById("zoom-fit").addEventListener("click", () => {
    const a = wrap.clientWidth / wrap.clientHeight || 1;
    const fitW = Math.max(state.w, state.h * a);
    state.view.animateTo([(state.w - fitW) / 2, (state.h - fitW / a) / 2, fitW, fitW / a]);
  });

  let animId = null;
  state.view = {
    flyToNode(id) {
      const n = state.byId[id];
      if (!n) return;
      this.animateTo([n.x + NODE_W / 2 - vb[2] / 2, n.y + NODE_H / 2 - vb[3] / 2, vb[2], vb[3]]);
    },
    animateTo(target) {
      if (animId) cancelAnimationFrame(animId);
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
        vb = target; apply(); return;
      }
      const from = [...vb], t0 = performance.now(), DUR = 380;
      const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);
      const step = (now) => {
        const t = easeOutQuart(Math.min(1, (now - t0) / DUR));
        vb = from.map((v, i) => v + (target[i] - v) * t);
        apply();
        if (t < 1) animId = requestAnimationFrame(step);
      };
      animId = requestAnimationFrame(step);
    },
  };
}

// ---- class-level DAG (bottom-up, same grammar as the skill graph) ----------
const C_W = 150, C_H = 44, C_GAP_X = 46, C_GAP_Y = 64, C_PAD = 24;

function renderClassDag(branchId) {
  const dag = state.data.classDags?.find((d) => d.branch === branchId);
  const svg = document.getElementById("class-graph");
  if (!svg) return;
  svg.parentElement.querySelector(".cm-empty")?.remove();
  if (!dag || !dag.nodes.length) {
    svg.innerHTML = "";
    svg.insertAdjacentHTML("beforebegin",
      `<p class="cm-empty">No Stanford classes are mapped to this branch yet — its skills are makerspace- or job-acquired.</p>`);
    return;
  }
  const { branches } = state.data;
  const byId = Object.fromEntries(dag.nodes.map((n) => [n.id, n]));
  const maxLayer = Math.max(...dag.nodes.map((n) => n.layer));

  const layers = [];
  for (const n of dag.nodes) (layers[n.layer] ??= []).push(n);
  const maxRow = Math.max(...layers.map((L) => L.length));
  const w = Math.max(maxRow * (C_W + C_GAP_X) - C_GAP_X + 2 * C_PAD, 600);
  const h = (maxLayer + 1) * (C_H + C_GAP_Y) - C_GAP_Y + 2 * C_PAD;
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  // let tall DAGs (math: 7 layers) keep readable node size instead of shrinking
  svg.style.height = Math.min(Math.max(h * 0.9, 300), 700) + "px";

  // order each layer by prereq barycenter, then center it
  const pos = {};
  layers.forEach((L) => L.forEach((n, i) => (pos[n.id] = i)));
  for (let pass = 0; pass < 2; pass++)
    for (const L of layers) {
      L.sort((a, b) => cb(a) - cb(b));
      L.forEach((n, i) => (pos[n.id] = i));
    }
  function cb(n) {
    const ps = n.prereqs.filter((p) => byId[p]);
    return ps.length ? ps.reduce((s, p) => s + pos[p], 0) / ps.length : pos[n.id];
  }
  for (const L of layers) {
    const rowW = L.length * (C_W + C_GAP_X) - C_GAP_X;
    L.forEach((n, i) => {
      n.x = (w - rowW) / 2 + i * (C_W + C_GAP_X);
      n.y = C_PAD + (maxLayer - n.layer) * (C_H + C_GAP_Y);
    });
  }

  svg.innerHTML = "";
  const gE = document.createElementNS(SVG, "g");
  const gN = document.createElementNS(SVG, "g");
  svg.append(gE, gN);
  for (const n of dag.nodes)
    for (const p of n.prereqs) {
      const a = byId[p];
      const path = document.createElementNS(SVG, "path");
      const x1 = a.x + C_W / 2, y1 = a.y, x2 = n.x + C_W / 2, y2 = n.y + C_H;
      const d = Math.max(24, (y1 - y2) * 0.45);
      path.setAttribute("d", `M${x1},${y1} C${x1},${y1 - d} ${x2},${y2 + d} ${x2},${y2}`);
      path.setAttribute("class", "edge");
      gE.appendChild(path);
    }
  for (const n of dag.nodes) {
    // border takes the branch color of the first skill the class covers
    const color = n.covers.length ? bcolor(n.covers[0].branch) : (effectiveDark() ? "#5d6168" : "#4b4f57");
    const g = document.createElementNS(SVG, "g");
    g.setAttribute("class", "cnode");
    g.setAttribute("transform", `translate(${n.x},${n.y})`);
    g.setAttribute("tabindex", "0");
    g.setAttribute("role", "button");
    g.setAttribute("aria-label", `${n.id}: ${n.title}`);
    const rect = document.createElementNS(SVG, "rect");
    rect.setAttribute("width", C_W); rect.setAttribute("height", C_H);
    rect.setAttribute("rx", 6); rect.setAttribute("stroke", color);
    const code = document.createElementNS(SVG, "text");
    code.setAttribute("class", "code");
    code.setAttribute("x", C_W / 2); code.setAttribute("y", 18);
    code.setAttribute("text-anchor", "middle");
    code.textContent = n.id;
    const name = document.createElementNS(SVG, "text");
    name.setAttribute("class", "cname");
    name.setAttribute("x", C_W / 2); name.setAttribute("y", 33);
    name.setAttribute("text-anchor", "middle");
    name.textContent = n.title;
    const tip = document.createElementNS(SVG, "title");
    tip.textContent = `${n.id} — ${n.title}`;
    g.append(tip, rect, code, name);
    const pick = () => selectClass(n);
    g.addEventListener("click", pick);
    g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } });
    gN.appendChild(g);
  }
  for (const label of gN.querySelectorAll("g.cnode > text.cname"))
    fitText(label, C_W - 14);
}

function selectClass(c) {
  const { branches } = state.data;
  const el = document.getElementById("panel-body");
  el.innerHTML = `
    <h2><span class="class-code">${esc(c.id)}</span></h2>
    <section><h3>Class</h3><p>${esc(c.title)}</p></section>
    ${c.covers.length ? `<section><h3>Skills it covers</h3>
      <ul>${c.covers.map((cov) => `<li><button class="prereq-link" data-id="${esc(cov.skill)}">${esc(state.byId[cov.skill]?.title ?? cov.skill)}</button> <span class="depth">(${esc(cov.depth)}, ${esc(branches[cov.branch].name)})</span></li>`).join("")}</ul></section>` : ""}
    ${c.prereqs.length ? `<section><h3>Prerequisite classes</h3>
      <p>${c.prereqs.map((p) => `<span class="class-code">${esc(p)}</span>`).join(" · ")}</p></section>` : ""}
    <p class="note">Class-level prerequisites are draft; verify against the bulletin.</p>
  `;
  el.querySelectorAll(".prereq-link").forEach((a) =>
    a.addEventListener("click", () => select(a.dataset.id, { fly: true })));
  document.getElementById("panel").hidden = false;
}

main();
