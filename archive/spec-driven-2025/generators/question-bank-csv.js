"use strict";

// CSV question bank generator.
// Parallels generators/question-bank.js (which emits .md). The CSV is
// spreadsheet-friendly — sort, filter, diff per-question across semesters,
// and query from Obsidian via Dataview's dv.io.csv().
//
// Columns: id, type, difficulty, subtopic, prompt, options, answer, explanation
// (options is "|"-joined for MC/TF/code; empty for SA/FIB.)

const fs = require("fs");
const path = require("path");
const { topicSlug } = require("../lib/context");

// RFC-4180-ish escape: wrap in quotes if the field contains comma, quote, or
// newline; double any embedded quotes.
function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvRow(cells) {
  return cells.map(csvEscape).join(",");
}

// Convert star difficulty (★ / ★★ / ★★★) to integer for sortability.
// Leave already-numeric values alone.
function normalizeDifficulty(d) {
  if (typeof d === "number") return d;
  const s = String(d || "");
  const stars = (s.match(/★/g) || []).length;
  if (stars > 0) return stars;
  const asInt = parseInt(s, 10);
  return Number.isFinite(asInt) ? asInt : "";
}

function deriveEntries(config) {
  if (Array.isArray(config.lecture.questionBank) && config.lecture.questionBank.length > 0) {
    return config.lecture.questionBank;
  }
  // Fallback mirrors question-bank.js so the CSV stays in sync with the MD
  // stub when no bank is authored into the spec.
  const entries = [];
  config.lecture.sections.forEach((section, index) => {
    entries.push({
      id: `mc-${index + 1}`,
      type: "mc",
      difficulty: "★",
      subtopic: section.title,
      prompt: `Which statement best captures the main idea of ${section.title}?`,
      answer: "Provide one correct option plus three plausible distractors.",
    });
    entries.push({
      id: `sa-${index + 1}`,
      type: "sa",
      difficulty: "★★",
      subtopic: section.title,
      prompt: `Explain one tradeoff or design decision from ${section.title}.`,
      answer: "A strong answer names the tradeoff, context, and consequence.",
    });
  });
  return entries;
}

function generate(config, options) {
  const slug = topicSlug(config);
  const outPath = path.join(options.outputDir, `${slug}_question_bank.csv`);
  const entries = deriveEntries(config);

  const header = ["id", "type", "difficulty", "subtopic", "prompt", "options", "answer", "explanation"];
  const lines = [header.join(",")];

  entries.forEach((e) => {
    const options = Array.isArray(e.options) ? e.options.join(" | ") : (e.options || "");
    lines.push(csvRow([
      e.id || "",
      e.type || "",
      normalizeDifficulty(e.difficulty),
      e.subtopic || "",
      e.prompt || "",
      options,
      e.answer || "",
      e.explanation || e.rubric || "",
    ]));
  });

  // Trailing newline per POSIX text-file convention.
  fs.writeFileSync(outPath, lines.join("\n") + "\n");
  return outPath;
}

module.exports = { generate };
