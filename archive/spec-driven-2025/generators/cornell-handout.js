"use strict";

const fs = require("fs");
const path = require("path");
const { topicSlug } = require("../lib/context");
const { compileLatex } = require("../lib/tex-helpers");
const {
  resolveSectionKind,
  cornellPreamble,
  cornellTitleBlock,
  cornellInstructionLine,
  cornellObjectivesBox,
  cornellVocabGrid,
  cornellSectionBanner,
  cornellTable,
  cornellKeyCallout,
  cornellComparisonTable,
  cornellSummaryStrip,
  cornellReferences,
} = require("../lib/cornell-tex");

// Derive a scaffold cue from a long point string (first 4 words, capped to 28
// chars). Keeps the cue column readable when the source point is verbose.
function pointCue(pointText) {
  const words = String(pointText).split(/\s+/);
  const raw = words.slice(0, 4).join(" ");
  return raw.length > 28 ? raw.slice(0, 25) + "…" : raw;
}

function generate(config, options) {
  const slug = topicSlug(config);
  const outputDir = options.outputDir;
  const texPath = path.join(outputDir, `${slug}_cornell_handout.tex`);
  const { course, lecture } = config;
  const courseLabel = `${course.code} — ${course.name}`;
  const headerRight = `${course.code} — ${course.name}`;
  const headerLeft = `${lecture.topic} — Cornell Handout`;

  // `fillable` is reserved for a future feature — emit AcroForm fields rather
  // than static writing space. For now the option flows through to the cell
  // helper but is ignored.
  const fillable = Boolean(options.fillable || (config.options && config.options.fillable));

  const lines = [];
  lines.push(cornellPreamble(headerLeft, headerRight));
  lines.push("\\begin{document}");
  lines.push("\\thispagestyle{fancy}");
  lines.push(cornellTitleBlock(lecture.topic, courseLabel));
  lines.push(cornellInstructionLine(
    "Fill in the highlighted (yellow) cells during lecture. Complete the Summary strip after class."
  ));

  // Learning objectives
  lines.push(cornellObjectivesBox(lecture.objectives));

  // Vocabulary grid
  lines.push(cornellVocabGrid(lecture.vocabulary));

  // Per section
  const sections = lecture.sections || [];
  sections.forEach((section, index) => {
    const kind = resolveSectionKind(section, index, sections.length);

    lines.push(cornellSectionBanner(section.title, index, section.minutes, kind));

    // Cornell two-column table: blanks first (yellow fill-in), then up to 3
    // scaffold rows derived from section.points (gray prompt with embedded
    // blank). Mirrors the .docx generator's behavior.
    const rows = [];
    (section.blanks || []).forEach((blank) => {
      rows.push({ cue: blank.cue, notes: blank.template, fillIn: true });
    });
    (section.points || []).slice(0, 3).forEach((point) => {
      rows.push({
        cue: pointCue(point),
        notes: `${String(point).replace(/[.:]+$/, "")}: _______.`,
        fillIn: false,
      });
    });
    if (rows.length > 0) {
      lines.push(cornellTable(rows, kind, { fillable }));
    }

    // KEY callouts only — ASK / DEMO / THESIS are instructor-facing per the
    // existing skill convention.
    (section.callouts || []).forEach((c) => {
      if (c && c.label === "KEY" && c.text) {
        lines.push(cornellKeyCallout(c.text, kind));
      }
    });

    // Comparison table appears after the Cornell table for that section.
    if (section.table && section.table.headers && section.table.rows) {
      lines.push(cornellComparisonTable(section.table.headers, section.table.rows, kind));
    }
  });

  // Summary strip — always at the bottom of the lecture content.
  lines.push(cornellSummaryStrip());

  // References last, in small gray text.
  lines.push(cornellReferences(lecture.references));

  lines.push("\\end{document}\n");

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(texPath, lines.join("\n"));
  const pdfPath = compileLatex(texPath, outputDir);
  return pdfPath;
}

module.exports = { generate };
