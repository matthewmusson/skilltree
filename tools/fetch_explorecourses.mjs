// Fetch official titles + prerequisite text for every class in classes.yaml
// from ExploreCourses (the machine-readable face of the Stanford bulletin).
// Writes data/stanford/explorecourses-cache.json for human reconciliation;
// this script never edits classes.yaml itself.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as yaml from "js-yaml";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const { classes } = yaml.load(
  fs.readFileSync(path.join(root, "data/stanford/classes.yaml"), "utf8")
);

const decode = (s) =>
  s.replace(/&#0?39;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
   .replace(/&gt;/g, ">").replace(/&quot;/g, '"');

async function fetchClass(id) {
  const [subject, code] = [id.replace(/\s+\S+$/, ""), id.match(/\S+$/)[0]];
  const url =
    `https://explorecourses.stanford.edu/search?view=xml-20140630&q=` +
    encodeURIComponent(subject + code) +
    `&filter-departmentcode-${encodeURIComponent(subject)}=on&filter-coursestatus-Active=on`;
  const xml = await (await fetch(url)).text();
  for (const block of xml.match(/<course>[\s\S]*?<\/course>/g) ?? []) {
    const s = block.match(/<subject>(.*?)<\/subject>/)?.[1];
    const c = block.match(/<code>(.*?)<\/code>/)?.[1];
    if (s !== subject || c !== code) continue;
    const title = decode(block.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "");
    const desc = decode(block.match(/<description>([\s\S]*?)<\/description>/)?.[1] ?? "");
    const pre = desc.match(/pre-?requisites?:?\s*([\s\S]*?)(?:\.\s+[A-Z]|$)/i)?.[1]?.trim() ?? null;
    const codes = [...new Set([...(pre ?? "").matchAll(/([A-Z]{2,8})\s*(\d+[A-Z]{0,2})/g)]
      .map((m) => `${m[1]} ${m[2]}`))];
    return { id, found: true, title, prereqText: pre, prereqCodes: codes };
  }
  return { id, found: false };
}

const out = [];
for (const c of classes) {
  const r = await fetchClass(c.id);
  out.push({ ...r, ourTitle: c.title, ourPrereqs: c.prereqs ?? [] });
  console.log(
    r.found
      ? `${c.id}: "${r.title}"${r.prereqText ? " | prereq: " + r.prereqText.slice(0, 90) : " | no prereq text"}`
      : `${c.id}: NOT FOUND`
  );
  await new Promise((res) => setTimeout(res, 250));
}
fs.writeFileSync(
  path.join(root, "data/stanford/explorecourses-cache.json"),
  JSON.stringify(out, null, 1)
);
console.log(`\n${out.filter((r) => r.found).length}/${out.length} found -> data/stanford/explorecourses-cache.json`);
