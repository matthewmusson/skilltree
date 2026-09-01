// Skilltree graph UI. Layered DAG, left-to-right: layer = longest prereq path.
// No dependencies; SVG built by hand so the layout stays fully ours.
const SVG = "http://www.w3.org/2000/svg";
const NODE_W = 172, NODE_H = 32, COL_GAP = 110, ROW_GAP = 14, PAD = 60;

const state = { data: null, selected: null, major: "" };

// Branch colors that are too light to hold white text get graphite text chips.
const LIGHT = new Set(["#E69F00", "#56B4E9", "#F0E442", "#8B8000"]);

async function main() {
  state.data = await (await fetch("data.json")).json();
  const { nodes, branches, majors } = state.data;
  state.byId = Object.fromEntries(nodes.map((n) => [n.id, n]));

  // legend
  const legend = document.getElementById("legend");
  for (const [id, b] of Object.entries(branches)) {
    const s = document.createElement("span");
    s.innerHTML = `<span class="swatch" style="background:${b.color}"></span>${b.name}`;
    legend.appendChild(s);
  }
  // major dropdown
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

// ---- layout ----------------------------------------------------------------
function layout() {
  const { nodes } = state.data;
  const branchOrder = Object.keys(state.data.branches);
  const layers = [];
  for (const n of nodes) (layers[n.layer] ??= []).push(n);

  // initial order: by branch, stable
  for (const L of layers)
    L.sort((a, b) => branchOrder.indexOf(a.branch) - branchOrder.indexOf(b.branch));

  // two barycenter passes to pull children toward parents
  const pos = {};
  const place = (L) => L.forEach((n, i) => (pos[n.id] = i));
  layers.forEach(place);
  for (let pass = 0; pass < 2; pass++) {
    for (let li = 1; li < layers.length; li++) {
      layers[li].sort((a, b) => bary(a) - bary(b) || branchOrder.indexOf(a.branch) - branchOrder.indexOf(b.branch));
      place(layers[li]);
    }
  }
  function bary(n) {
    const ps = n.prereqs.filter((p) => state.byId[p]);
    if (!ps.length) return pos[n.id];
    return ps.reduce((s, p) => s + pos[p], 0) / ps.length;
  }

  const maxRows = Math.max(...layers.map((L) => L.length));
  for (let li = 0; li < layers.length; li++) {
    const L = layers[li];
    const totalH = L.length * (NODE_H + ROW_GAP);
    const y0 = PAD + ((maxRows * (NODE_H + ROW_GAP)) - totalH) / 2;
    L.forEach((n, i) => {
      n.x = PAD + li * (NODE_W + COL_GAP);
      n.y = y0 + i * (NODE_H + ROW_GAP);
    });
  }
  state.layers = layers;
  state.w = PAD * 2 + layers.length * (NODE_W + COL_GAP);
  state.h = PAD * 2 + maxRows * (NODE_H + ROW_GAP);
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
  if (!svg.dataset.vb) {
    svg.dataset.vb = "1";
    svg.setAttribute("viewBox", `0 0 ${state.w} ${state.h}`);
  }
  const { branches } = state.data;
  const cov = coverage();
  const sel = state.selected;
  const keep = sel ? ancestorsOf(sel).add(sel) : null;

  const gEdges = document.createElementNS(SVG, "g");
  const gNodes = document.createElementNS(SVG, "g");
  svg.append(gEdges, gNodes);

  for (const n of state.data.nodes) {
    for (const p of n.prereqs) {
      const a = state.byId[p];
      if (!a) continue;
      const path = document.createElementNS(SVG, "path");
      const x1 = a.x + NODE_W, y1 = a.y + NODE_H / 2, x2 = n.x, y2 = n.y + NODE_H / 2;
      const mx = (x1 + x2) / 2;
      path.setAttribute("d", `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`);
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
    const color = branches[n.branch].color;

    const rect = document.createElementNS(SVG, "rect");
    rect.setAttribute("width", NODE_W);
    rect.setAttribute("height", NODE_H);
    rect.setAttribute("rx", 6);
    rect.setAttribute("stroke", color);

    if (cov) {
      const c = cov[n.id];
      if (c === "teaches") rect.setAttribute("fill", color + "26");
      else if (c === "touches") { g.classList.add("covered-touches"); }
      else g.classList.add("dimmed");
    }
    if (keep && !keep.has(n.id)) g.classList.add("dimmed");
    if (sel === n.id) g.classList.add("selected");

    const chip = document.createElementNS(SVG, "rect");
    chip.setAttribute("x", 8); chip.setAttribute("y", NODE_H / 2 - 4);
    chip.setAttribute("width", 8); chip.setAttribute("height", 8);
    chip.setAttribute("rx", 2); chip.setAttribute("fill", color);

    const label = document.createElementNS(SVG, "text");
    label.setAttribute("x", 22); label.setAttribute("y", NODE_H / 2 + 4);
    label.textContent = n.title.length > 24 ? n.title.slice(0, 23) + "…" : n.title;

    g.append(rect, chip, label);
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
function select(id) {
  state.selected = id;
  render();
  const n = state.byId[id];
  const b = state.data.branches[n.branch];
  const tagClass = LIGHT.has(b.color) ? "branch-tag light-text-dark" : "branch-tag";
  const el = document.getElementById("panel-body");
  const demos = n.demos.map((d) => {
    const space = state.data.makerspaces.find((s) => s.id === d.space);
    return `<li><strong>${space.name}</strong>: ${esc(d.note)}</li>`;
  }).join("");
  el.innerHTML = `
    <h2>${esc(n.title)}</h2>
    <span class="${tagClass}" style="background:${b.color}">${b.name}</span>
    ${n.acquisition.on_the_job_only ? `<p class="otj">Learned on the job — no class or makerspace path covers this.</p>` : ""}
    <section><h3>What it is</h3><p>${esc(n.overview)}</p></section>
    <section><h3>Proficient means you can</h3>
      <ul>${n.proficiency.map((p) => `<li>${esc(p)}</li>`).join("")}</ul></section>
    ${n.prereqs.length ? `<section><h3>Prerequisites</h3><p>${n.prereqs
        .map((p) => `<span class="prereq-link" data-id="${p}">${esc(state.byId[p]?.title ?? p)}</span>`)
        .join(" · ")}</p></section>` : ""}
    ${n.classes.length ? `<section><h3>Stanford classes</h3>
      <ul>${n.classes.map((c) => `<li><span class="class-code">${esc(c.id)}</span> ${esc(c.title)} <span class="depth">(${c.depth})</span></li>`).join("")}</ul></section>` : ""}
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
  state.selected = null;
  document.getElementById("panel").hidden = true;
  render();
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ---- pan / zoom ------------------------------------------------------------
function initPanZoom() {
  const svg = document.getElementById("graph");
  const wrap = document.getElementById("graph-wrap");
  let vb = [0, 0, state.w, state.h];
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
