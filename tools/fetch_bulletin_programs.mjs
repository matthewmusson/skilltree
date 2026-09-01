// Scrape graduate program pages from bulletin.stanford.edu (server-rendered
// Coursedog catalog). For each program: official title + the course codes its
// requirements mention. Baseline codes appearing on the program LIST page are
// site chrome, not requirements, and are subtracted.
// Output: data/stanford/bulletin-programs-cache.json (curation source, not
// directly consumed by the build).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PROGRAMS = [
  "AA-ENG", "AA-MS", "AA-PMN", "AA-PHD", "APLPH-MS", "APLPH-PHD", "AEPHY-MS",
  "BMDS-PMN", "BMDS-MS", "BMDS-PHD", "BMP-PHD", "BIOPH-MS", "BIOPH-PHD",
  "CHEME-ENG", "CHEME-MS", "CHEME-PMN", "CHEME-PHD", "CEE-ENG", "CEE-MS",
  "CEE-PMN", "CEE-PHD", "CME-MS", "CME-PHD", "CME-PMN", "CS-MS", "CS-PMN",
  "CS-PHD", "DESIGN-MS", "EE-MS", "EE-PMN", "EE-PHD", "ENERGY-MS",
  "ENERGY-PMN", "ENERGY-PHD", "ENGR-MS", "LING-MA", "LING-PMN", "MATSC-ENG",
  "MATSC-MS", "MATSC-PMN", "MATSC-PHD", "MATH-MS", "MATH-PMN", "MATH-PHD",
  "ME-ENG", "ME-MS", "ME-PMN", "ME-PHD", "MGTSC-MS", "MGTSC-PHD", "MGTSC-PMN",
  "MUSIC-MA", "PHYS-MS", "PHYS-PMN", "SYMBO-MS",
];
const CODE_RE = /([A-Z]{2,8})\s?(\d{1,3}[A-Z]{0,2})\b/g;
const SUBJECTS = new Set(["AA","APPPHYS","BIO","BIOE","BMDS","BIOPHYS","CEE","CHEM","CHEMENG","CME","CS","DESIGN","EE","ENERGY","ENGR","MATH","MATSCI","ME","MS&E","PHYSICS","STATS","LINGUIST","MUSIC","SYMSYS","PSYCH","GENE"]);

const codesIn = (text) => {
  const out = new Set();
  for (const m of text.matchAll(CODE_RE))
    if (SUBJECTS.has(m[1])) out.add(`${m[1]} ${m[2]}`);
  return out;
};

const get = async (url) => await (await fetch(url)).text();

// baseline: codes present on the list page are chrome, not program content
const baseline = codesIn(await get("https://bulletin.stanford.edu/programs"));
console.log(`baseline noise codes: ${baseline.size}`);

const out = [];
for (const code of PROGRAMS) {
  try {
    const html = await get(`https://bulletin.stanford.edu/programs/${code}`);
    const title = (html.match(/<title>(.*?)\s*\|/)?.[1] ?? code).trim();
    const courses = [...codesIn(html)].filter((c) => !baseline.has(c)).sort();
    out.push({ code, title, courses });
    console.log(`${code}: "${title}" — ${courses.length} courses`);
  } catch (e) {
    out.push({ code, error: String(e) });
    console.log(`${code}: FAILED ${e}`);
  }
  await new Promise((r) => setTimeout(r, 200));
}
fs.writeFileSync(
  path.join(root, "data/stanford/bulletin-programs-cache.json"),
  JSON.stringify(out, null, 1)
);
console.log(`\n${out.filter((p) => !p.error).length}/${PROGRAMS.length} scraped`);
