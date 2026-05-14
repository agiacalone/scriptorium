"use strict";

// Obsidian-flavored Markdown Cornell handout generator.
// Parallels generators/cornell-handout.js (which emits .docx). The .docx
// carries print-lecture visual cues (colors, 2-column fill-in, yellow blanks);
// this .md carries the CONTENT — scaffolded text, blanks as `_______`, cue
// prompts, and KEY callouts — in a format that lives in the vault.
//
// Philosophy: Markdown is the kept, versioned canonical. The printable
// .docx is regenerated from the spec each semester; the .md accumulates
// as a teaching artifact reference.

const fs = require("fs");
const path = require("path");
const { topicSlug } = require("../lib/context");

const ROMAN = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII","XIII","XIV","XV","XVI","XVII","XVIII","XIX","XX"];

function slugifyTag(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function buildFrontmatter(config) {
  const { course, lecture } = config;
  const tags = [
    slugifyTag(course.code).replace(/-/g, ""),
    slugifyTag(course.name),
    slugifyTag(lecture.topic),
    "cornell-handout",
  ];
  const seen = new Set();
  const unique = tags.filter((t) => t && !seen.has(t) && seen.add(t));
  return [
    "---",
    `title: ${lecture.topic}`,
    `course: ${course.code} — ${course.name}`,
    `type: cornell-handout`,
    `tags:`,
    ...unique.map((t) => `  - ${t}`),
    "---",
    "",
  ].join("\n");
}

function bulletList(items) {
  if (!items || items.length === 0) return "";
  return items.map((it) => `- ${it}`).join("\n") + "\n";
}

function pointCue(pointText) {
  const words = String(pointText).split(/\s+/);
  const raw = words.slice(0, 4).join(" ");
  return raw.length > 28 ? raw.slice(0, 25) + "…" : raw;
}

// Table header + rows for the Cornell cue/notes structure. Blank rows keep
// the fill-in template with `_______` so the student can read it as prose.
function cornellSectionRows(section) {
  const rows = [];
  (section.blanks || []).forEach((b) => {
    rows.push({ cue: b.cue, text: b.template });
  });
  (section.points || []).slice(0, 3).forEach((p) => {
    rows.push({ cue: pointCue(p), text: `${p.replace(/[.:]+$/, "")}: _______.` });
  });
  return rows;
}

function renderCornellTable(rows) {
  if (rows.length === 0) return "";
  const lines = [];
  lines.push("| Cue | Notes |");
  lines.push("|---|---|");
  rows.forEach((r) => {
    // Pipe-escape the notes cell (wikilink/table ambiguity doesn't bite us
    // because spec text doesn't contain `|`, but be defensive).
    const safeNotes = String(r.text).replace(/\|/g, "\\|");
    lines.push(`| **${r.cue}** | ${safeNotes} |`);
  });
  lines.push("");
  return lines.join("\n");
}

function renderComparisonTable(tbl) {
  if (!tbl || !tbl.headers || !tbl.rows) return "";
  const lines = [];
  lines.push(`| ${tbl.headers.join(" | ")} |`);
  lines.push(`| ${tbl.headers.map(() => "---").join(" | ")} |`);
  tbl.rows.forEach((r) => {
    const cells = r.map((c) => (c === "" || String(c).includes("_______") ? "_______________" : String(c)));
    lines.push(`| ${cells.join(" | ")} |`);
  });
  lines.push("");
  return lines.join("\n");
}

function renderVocabulary(terms) {
  if (!terms || terms.length === 0) return "";
  const lines = [];
  lines.push("## Vocabulary — fill in during lecture");
  lines.push("");
  terms.forEach((t) => lines.push(`- **${t}** — _______`));
  lines.push("");
  return lines.join("\n");
}

function generate(config, options) {
  const slug = topicSlug(config);
  const outPath = path.join(options.outputDir, `${slug}_cornell_handout.md`);
  const { course, lecture } = config;
  const courseLabel = `${course.code} — ${course.name}`;

  const parts = [];

  parts.push(buildFrontmatter(config));

  parts.push(`# ${lecture.topic} — Cornell Handout`);
  parts.push(`**${courseLabel}**`);
  parts.push("");
  parts.push(`*Fill in the blanked (\`_______\`) cells during lecture. Complete the Summary at the end in your own words after class.*`);
  parts.push("");
  parts.push("---");
  parts.push("");

  // Learning objectives (read-only, for context)
  if (lecture.objectives && lecture.objectives.length > 0) {
    parts.push("## Learning Objectives");
    parts.push("");
    parts.push(bulletList(lecture.objectives));
    parts.push("---");
    parts.push("");
  }

  // Vocabulary (fill-in)
  const vocab = renderVocabulary(lecture.vocabulary);
  if (vocab) {
    parts.push(vocab);
    parts.push("---");
    parts.push("");
  }

  // Sections
  lecture.sections.forEach((section, index) => {
    const roman = ROMAN[index] || String(index + 1);
    const minutes = section.minutes ? ` (${section.minutes} min)` : "";
    parts.push(`## ${roman}. ${section.title}${minutes}`);
    parts.push("");

    const cornellRows = cornellSectionRows(section);
    const tbl = renderCornellTable(cornellRows);
    if (tbl) parts.push(tbl);

    // Comparison table (if any)
    if (section.table) {
      const cmp = renderComparisonTable(section.table);
      if (cmp) parts.push(cmp);
    }

    // KEY callouts only — student-facing (ASK / DEMO / THESIS are instructor-only)
    (section.callouts || []).forEach((c) => {
      if (c && c.label === "KEY" && c.text) {
        parts.push(`> [!note] KEY`);
        parts.push(`> ${c.text}`);
        parts.push("");
      }
    });

    parts.push("---");
    parts.push("");
  });

  // Summary (student fills in)
  parts.push("## Summary — write 3 key ideas in your own words after class");
  parts.push("");
  parts.push("1. _______");
  parts.push("2. _______");
  parts.push("3. _______");
  parts.push("");

  // References (small, at end)
  if (lecture.references && lecture.references.length > 0) {
    parts.push("---");
    parts.push("");
    parts.push("## References");
    parts.push("");
    parts.push(bulletList(lecture.references));
  }

  const output = parts.join("\n").replace(/\n{3,}/g, "\n\n").replace(/\s+$/, "") + "\n";
  fs.writeFileSync(outPath, output);
  return outPath;
}

module.exports = { generate };
