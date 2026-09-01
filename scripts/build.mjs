// Build: validate the data layer and compile docs/data.json for the site.
// Fails loudly on any broken reference or cycle; a graph that builds is a graph
// you can trust.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as yaml from "js-yaml";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const errors = [];

// ---- load skills -----------------------------------------------------------
const skillsDir = path.join(root, "data/skills");
const skills = {};
for (const f of fs.readdirSync(skillsDir).filter((f) => f.endsWith(".yaml"))) {
  const doc = yaml.load(fs.readFileSync(path.join(skillsDir, f), "utf8"));
  if (!doc?.id) { errors.push(`${f}: missing id`); continue; }
  if (doc.id + ".yaml" !== f) errors.push(`${f}: id '${doc.id}' does not match filename`);
  if (skills[doc.id]) errors.push(`duplicate skill id '${doc.id}'`);
  for (const k of ["title", "branch", "prereqs", "overview", "proficiency"])
    if (doc[k] === undefined) errors.push(`${doc.id}: missing field '${k}'`);
  skills[doc.id] = doc;
}

const BRANCHES = {
  math:        { name: "Math",            color: "#4b4f57" },
  physics:     { name: "Physics",         color: "#0072B2" },
  meche:       { name: "MechE",           color: "#D55E00" },
  "ee-circuits": { name: "EE · Circuits", color: "#E69F00" },
  "ee-digital":  { name: "EE · Digital",  color: "#CC79A7" },
  "cs-systems":  { name: "CS · Systems",  color: "#56B4E9" },
  "cs-ml":       { name: "CS · ML",       color: "#009E73" },
  robotics:      { name: "Robotics",      color: "#332288" },
  "supply-chain": { name: "Supply Chain", color: "#882255" },
  "bio-chem":    { name: "BioE / ChemE",  color: "#8B8000" },
};
// NOTE: 10 branches now exceed the 7-hue Okabe-Ito set; indigo/wine/dark-yellow
// extensions are draft. The deuteranopia-simulation gate is still owed.

for (const s of Object.values(skills)) {
  if (!BRANCHES[s.branch]) errors.push(`${s.id}: unknown branch '${s.branch}'`);
  for (const p of s.prereqs ?? [])
    if (!skills[p]) errors.push(`${s.id}: prereq '${p}' does not exist`);
}

// ---- acyclicity + layers (longest path from a root) ------------------------
const layer = {};
const visiting = new Set();
function depth(id, stack = []) {
  if (layer[id] !== undefined) return layer[id];
  if (visiting.has(id)) {
    errors.push(`cycle detected: ${[...stack, id].join(" -> ")}`);
    return 0;
  }
  visiting.add(id);
  const ps = (skills[id]?.prereqs ?? []).filter((p) => skills[p]);
  layer[id] = ps.length ? 1 + Math.max(...ps.map((p) => depth(p, [...stack, id]))) : 0;
  visiting.delete(id);
  return layer[id];
}
Object.keys(skills).forEach((id) => depth(id));

// ---- load stanford overlay -------------------------------------------------
const loadYaml = (p) => yaml.load(fs.readFileSync(path.join(root, p), "utf8"));
const { classes } = loadYaml("data/stanford/classes.yaml");
const { majors } = loadYaml("data/stanford/majors.yaml");
const { makerspaces, demonstrations } = loadYaml("data/stanford/makerspaces.yaml");

const classIds = new Set();
for (const c of classes) {
  if (classIds.has(c.id)) errors.push(`duplicate class '${c.id}'`);
  classIds.add(c.id);
  for (const cov of c.covers ?? []) {
    if (!skills[cov.skill]) errors.push(`class ${c.id}: skill '${cov.skill}' does not exist`);
    if (!["teaches", "touches"].includes(cov.depth))
      errors.push(`class ${c.id}: bad depth '${cov.depth}'`);
  }
}
for (const c of classes)
  for (const p of c.prereqs ?? [])
    if (!classIds.has(p)) errors.push(`class ${c.id}: prereq class '${p}' not in classes.yaml`);
for (const m of majors)
  for (const y of m.sequence)
    for (const cid of y.classes)
      if (!classIds.has(cid)) errors.push(`major ${m.id}: class '${cid}' not in classes.yaml`);
const spaceIds = new Set(makerspaces.map((s) => s.id));
for (const d of demonstrations) {
  if (!skills[d.skill]) errors.push(`demonstration: skill '${d.skill}' does not exist`);
  if (!spaceIds.has(d.space)) errors.push(`demonstration: space '${d.space}' unknown`);
}

if (errors.length) {
  console.error(`BUILD FAILED — ${errors.length} error(s):`);
  errors.forEach((e) => console.error("  - " + e));
  process.exit(1);
}

// ---- derive per-skill acquisition ------------------------------------------
const classesBySkill = {};
for (const c of classes)
  for (const cov of c.covers ?? [])
    (classesBySkill[cov.skill] ??= []).push({ id: c.id, title: c.title, depth: cov.depth });
const demosBySkill = {};
for (const d of demonstrations)
  (demosBySkill[d.skill] ??= []).push({ space: d.space, note: d.note });

const nodes = Object.values(skills).map((s) => ({
  id: s.id,
  title: s.title,
  branch: s.branch,
  layer: layer[s.id],
  prereqs: s.prereqs ?? [],
  overview: s.overview?.trim() ?? "",
  proficiency: s.proficiency ?? [],
  acquisition: s.acquisition ?? { on_the_job_only: false, notes: "" },
  resources: s.resources ?? [],
  classes: classesBySkill[s.id] ?? [],
  demos: demosBySkill[s.id] ?? [],
}));

// ---- class-level DAGs per branch -------------------------------------------
// Seed: classes covering any skill in the branch; expand through class prereqs.
const CLASS_DAG_BRANCHES = ["robotics"];
const classById = Object.fromEntries(classes.map((c) => [c.id, c]));
const classDags = CLASS_DAG_BRANCHES.map((branch) => {
  const set = new Set();
  const grow = (id) => {
    if (set.has(id)) return;
    set.add(id);
    (classById[id].prereqs ?? []).forEach(grow);
  };
  classes
    .filter((c) => (c.covers ?? []).some((cov) => skills[cov.skill]?.branch === branch))
    .forEach((c) => grow(c.id));
  const clayer = {};
  const cvisiting = new Set();
  const cd = (id) => {
    if (clayer[id] !== undefined) return clayer[id];
    if (cvisiting.has(id)) { errors.push(`class prereq cycle at ${id}`); return 0; }
    cvisiting.add(id);
    const ps = (classById[id].prereqs ?? []).filter((p) => set.has(p));
    clayer[id] = ps.length ? 1 + Math.max(...ps.map(cd)) : 0;
    cvisiting.delete(id);
    return clayer[id];
  };
  const dagNodes = [...set].map((id) => ({
    id,
    title: classById[id].title,
    layer: cd(id),
    prereqs: (classById[id].prereqs ?? []).filter((p) => set.has(p)),
    covers: (classById[id].covers ?? []).map((cov) => ({
      skill: cov.skill, depth: cov.depth, branch: skills[cov.skill].branch,
    })),
  }));
  return { branch, nodes: dagNodes };
});
if (errors.length) {
  console.error(`BUILD FAILED — ${errors.length} error(s):`);
  errors.forEach((e) => console.error("  - " + e));
  process.exit(1);
}

const out = { generated: null, branches: BRANCHES, nodes, majors, makerspaces, classDags };
fs.writeFileSync(path.join(root, "docs/data.json"), JSON.stringify(out, null, 1));
console.log(
  `OK: ${nodes.length} skills, ${classes.length} classes, ${majors.length} major(s), ` +
  `${Math.max(...Object.values(layer)) + 1} layers -> docs/data.json`
);
