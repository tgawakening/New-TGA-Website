// Makes the Sīrah admin's hard-coded colours themeable without changing them.
//
//   color: #17324d;   ->   color: var(--ai-fg-17324d, #17324d);
//
// Each literal keeps itself as the var() fallback, so wherever the --ai-*
// variables are undefined (everywhere except [data-theme="indigo-admin"],
// see styles/admin-indigo.css) the computed style is exactly what it was.
// The role prefix (fg/bg/ln/sh) comes from the property, because a colour
// that is a background in the light theme needs a different dark value from
// the same colour used as text.
//
// node scripts/themeable-admin-colors.mjs [--check]   (--check: verify only)
import fs from "node:fs";

export const FILES = [
  "components/sirah/admin-shell.module.css",
  "components/sirah/admin-overview.module.css",
  "components/sirah/admin-students.module.css",
  "components/sirah/admin-scholarships.module.css",
  "components/sirah/admin-app.module.css",
  "components/sirah/classroom-pickers.module.css",
  "components/admin/admin-login.module.css",
];

const LITERAL = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|\b(?:white|black)\b/g;

function role(prop) {
  if (/^(background|background-color|background-image)$/.test(prop)) return "bg";
  if (/^(border|outline|column-rule|text-decoration)/.test(prop)) return "ln";
  if (/shadow$/.test(prop)) return "sh";
  return "fg"; // color, fill, stroke, caret-color, accent-color …
}

export function key(lit) {
  const l = lit.toLowerCase();
  if (l === "white") return "fff";
  if (l === "black") return "000";
  if (l.startsWith("#")) {
    const h = l.slice(1);
    return h.length === 3 ? h : h; // keep as written: distinct spellings stay distinct
  }
  return l.replace(/rgba?\(/, "").replace(/\)/, "").replace(/\s+/g, "").replace(/[.,/]/g, "_");
}

export function transform(css) {
  // Declarations only: `prop: value;` (also the last one before `}`), never selectors or comments.
  return css.replace(/(^|[;{\s])(-?[a-z-]+)(\s*:\s*)([^;{}]*?)(\s*(?:;|(?=\})))/g, (m, pre, prop, colon, value, end) => {
    if (prop.startsWith("--")) return m;
    if (!LITERAL.test(value)) return m;
    LITERAL.lastIndex = 0;
    const r = role(prop);
    // Comments inside a value are left alone.
    const parts = value.split(/(\/\*[\s\S]*?\*\/)/);
    const next = parts
      .map((part) => (part.startsWith("/*") ? part : part.replace(LITERAL, (lit) => `var(--ai-${r}-${key(lit)}, ${lit})`)))
      .join("");
    return `${pre}${prop}${colon}${next}${end}`;
  });
}

/** Removing every wrapper must give back the original file byte for byte. */
export function unwrap(css) {
  return css.replace(/var\(--ai-[a-z]+-[0-9a-z_]+, ([^()]*(?:\([^()]*\))?)\)/g, "$1");
}

if (process.argv[1] && process.argv[1].endsWith("themeable-admin-colors.mjs")) {
  const check = process.argv.includes("--check");
  const used = new Map();
  for (const file of FILES) {
    const src = fs.readFileSync(file, "utf8");
    const already = src.includes("var(--ai-");
    const original = already ? unwrap(src) : src;
    const out = transform(original);
    if (unwrap(out) !== original) throw new Error(`round-trip mismatch in ${file}`);
    for (const m of out.matchAll(/var\((--ai-[a-z]+-[0-9a-z_]+), ([^()]*(?:\([^()]*\))?)\)/g)) used.set(m[1], m[2]);
    if (!check && out !== src) fs.writeFileSync(file, out);
    console.log(`${check ? "checked" : "wrote"} ${file}`);
  }
  if (process.env.AI_USED_OUT) fs.writeFileSync(process.env.AI_USED_OUT, JSON.stringify(Object.fromEntries(used), null, 1));
  console.log(`${used.size} distinct --ai-* variables`);
}
