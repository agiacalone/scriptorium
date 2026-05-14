"use strict";

// Obsidian-flavored Markdown lecture notes generator.
// Mirrors generators/lecture-notes.js (which emits LaTeX/PDF) but produces
// a vault-ready .md file with Obsidian callouts. Consumes the same spec JSON;
// no field changes are required.

const fs = require("fs");
const path = require("path");
const { topicSlug } = require("../lib/context");

const ROMAN = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII","XIII","XIV","XV","XVI","XVII","XVIII","XIX","XX"];

// Map spec callout labels → Obsidian callout types. Labels not in the map
// fall back to [!note] — consistent with the LaTeX generator's KEY fallback.
const CALLOUT_MAP = {
  KEY:      "note",
  THESIS:   "abstract",
  DEMO:     "example",
  WARNING:  "warning",
  TIP:      "tip",
  INFO:     "info",
  QUOTE:    "quote",
  SUMMARY:  "summary",
  PROMPT:   "question",
  ASK:      "question",
};

function calloutType(label) {
  if (!label) return "note";
  return CALLOUT_MAP[label.toUpperCase()] || "note";
}

function slugifyTag(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Build YAML frontmatter. Tags auto-derive from course code, course name,
// topic, and artifact type. Users can edit post-generation.
function buildFrontmatter(config) {
  const { course, lecture } = config;
  const tags = [
    slugifyTag(course.code).replace(/-/g, ""), // "CECS 326" → "cecs326"
    slugifyTag(course.name),                   // "Operating Systems" → "operating-systems"
    slugifyTag(lecture.topic),                 // "Buffer Overflow Attacks" → "buffer-overflow-attacks"
    "lecture-notes",
  ];
  // Dedupe while preserving order
  const seen = new Set();
  const uniqueTags = tags.filter((t) => t && !seen.has(t) && seen.add(t));
  const lines = [
    "---",
    `title: ${lecture.topic}`,
    `course: ${course.code} — ${course.name}`,
    `type: lecture-notes`,
    `tags:`,
    ...uniqueTags.map((t) => `  - ${t}`),
    "---",
    "",
  ];
  return lines.join("\n");
}

function bulletList(items) {
  if (!items || items.length === 0) return "";
  return items.map((it) => `- ${it}`).join("\n") + "\n";
}

// Multi-line blockquote. Each input line is prefixed with "> ".
function blockquote(text) {
  return String(text).split("\n").map((l) => `> ${l}`.trimEnd()).join("\n");
}

// Emit an Obsidian callout. `label` is shown after the type (preserves the
// instructor's categorical hint like "TALKING POINTS" or "KEY").
function mdCallout(type, label, bodyLines) {
  const header = label ? `> [!${type}] ${label}` : `> [!${type}]`;
  if (!bodyLines || bodyLines.length === 0) return header + "\n";
  const body = bodyLines.map((l) => `> ${l}`).join("\n");
  return `${header}\n${body}\n`;
}

function generate(config, options) {
  const slug = topicSlug(config);
  const outPath = path.join(options.outputDir, `${slug}_lecture_notes.md`);
  const { course, lecture } = config;
  const courseLabel = `${course.code} — ${course.name}`;

  const parts = [];

  // Frontmatter
  parts.push(buildFrontmatter(config));

  // Title block
  parts.push(`# ${lecture.topic}`);
  parts.push(`*Lecture Notes — with Talking Points*`);
  parts.push(`**${courseLabel}**`);
  parts.push("");
  parts.push("---");
  parts.push("");

  // Opening hook → [!tip] HOOK
  const hook = lecture.openingHook ||
    `Frame ${lecture.topic} as a practical systems problem before introducing formal vocabulary.`;
  parts.push(mdCallout("tip", "HOOK — open with this story", [hook]));
  parts.push("---");
  parts.push("");

  // Learning Objectives
  parts.push("## Learning Objectives");
  parts.push("");
  parts.push(bulletList(lecture.objectives));
  parts.push("---");
  parts.push("");

  // Sections
  lecture.sections.forEach((section, index) => {
    const roman = ROMAN[index] || String(index + 1);
    const minutes = section.minutes ? ` (${section.minutes} min)` : "";
    parts.push(`## ${roman}. ${section.title}${minutes}`);
    parts.push("");

    // Overview as italic blockquote
    if (section.overview) {
      parts.push(`> *${section.overview}*`);
      parts.push("");
    }

    // Points → bullet list
    if (section.points && section.points.length > 0) {
      parts.push(bulletList(section.points));
    }

    // Talking points → [!warning] TALKING POINTS callout
    const talkingPoints = section.talkingPoints || section.speakerNotes;
    if (talkingPoints && talkingPoints.length > 0) {
      parts.push(mdCallout("warning", "TALKING POINTS", talkingPoints.map((t) => `- ${t}`)));
    }

    // Per-section callouts (KEY, THESIS, DEMO, etc.)
    (section.callouts || []).forEach((c) => {
      if (c && c.text) {
        parts.push(mdCallout(calloutType(c.label), c.label, [c.text]));
      }
    });

    // Comparison table (rare, but supported by spec)
    if (section.table && section.table.headers && section.table.rows) {
      const headers = section.table.headers;
      const rows = section.table.rows;
      parts.push(`| ${headers.join(" | ")} |`);
      parts.push(`| ${headers.map(() => "---").join(" | ")} |`);
      rows.forEach((r) => parts.push(`| ${r.join(" | ")} |`));
      parts.push("");
    }

    parts.push("---");
    parts.push("");
  });

  // Case Studies
  if (lecture.caseStudies && lecture.caseStudies.length > 0) {
    parts.push("## Case Studies");
    parts.push("");
    parts.push(bulletList(lecture.caseStudies));
    parts.push("---");
    parts.push("");
  }

  // Summary
  parts.push("## Summary");
  parts.push("");
  parts.push(bulletList(lecture.takeaways || lecture.objectives));
  parts.push("---");
  parts.push("");

  // Discussion Questions
  if (lecture.discussionQuestions && lecture.discussionQuestions.length > 0) {
    parts.push("## Discussion Questions");
    parts.push("");
    parts.push(bulletList(lecture.discussionQuestions));
    parts.push("---");
    parts.push("");
  }

  // References
  if (lecture.references && lecture.references.length > 0) {
    parts.push("## References");
    parts.push("");
    parts.push(bulletList(lecture.references));
  }

  // Normalize to single trailing newline and collapse runs of blank lines
  const output = parts.join("\n").replace(/\n{3,}/g, "\n\n").replace(/\s+$/, "") + "\n";
  fs.writeFileSync(outPath, output);
  return outPath;
}

module.exports = { generate };
