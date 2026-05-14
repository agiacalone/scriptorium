"use strict";

// Obsidian-flavored Markdown quiz generator.
// Parallels generators/quiz.js (which emits .tex + student/key .pdf). The
// Markdown version carries the questions + answer key in one file, with
// the key hidden behind a collapsed Obsidian callout for easy review.
//
// Philosophy: Markdown is the kept, versioned canonical. The printable
// PDF is regenerated from the spec each semester; the .md accumulates as
// a teaching artifact reference.

const fs = require("fs");
const path = require("path");
const { topicSlug } = require("../lib/context");

const PTS = { mc: 1, tf: 1, code: 1, sa: 2 };

function slugifyTag(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function buildFrontmatter(config) {
  const { course, lecture } = config;
  const tags = [
    slugifyTag(course.code).replace(/-/g, ""),
    slugifyTag(course.name),
    slugifyTag(lecture.topic),
    "quiz",
  ];
  const seen = new Set();
  const unique = tags.filter((t) => t && !seen.has(t) && seen.add(t));
  return [
    "---",
    `title: ${lecture.topic}`,
    `course: ${course.code} — ${course.name}`,
    `type: quiz`,
    `tags:`,
    ...unique.map((t) => `  - ${t}`),
    "---",
    "",
  ].join("\n");
}

function totalPoints(questions) {
  return questions.reduce((sum, q) => sum + (PTS[q.type] || 1), 0);
}

// Mirror the fallback quiz in quiz.js so the .md stays in sync with the
// .pdf version when no quizQuestions are provided in the spec.
function deriveQuiz(config) {
  if (Array.isArray(config.lecture.quizQuestions) && config.lecture.quizQuestions.length > 0) {
    return config.lecture.quizQuestions;
  }
  const concept = config.lecture.keyConcepts[0] || "the primary concept";
  const section0 = (config.lecture.sections[0] && config.lecture.sections[0].title) || "the first section";
  return [
    {
      type: "mc",
      prompt: `Which statement best captures ${concept}?`,
      options: [
        "The mechanism that prevents the associated failure mode.",
        "The abstraction layer that hides physical resource management.",
        "The failure mode produced by ignoring the mechanism.",
        "The policy that governs resource allocation decisions.",
      ],
      answer: "b",
      rubric: "1 point for correct selection; no partial credit. Distractors represent common misconceptions.",
    },
    {
      type: "mc",
      prompt: "Which failure mode does the lecture warn about most strongly?",
      options: [
        "Starvation under an unfair scheduling policy.",
        "The failure mode introduced in the lecture's opening case study.",
        "Deadlock arising from circular resource dependency.",
        "Data corruption under unsynchronized concurrent writes.",
      ],
      answer: "b",
      rubric: "1 point for correct selection; no partial credit.",
    },
    {
      type: "sa",
      prompt: `Explain the most important tradeoff in ${section0}.`,
      rubric: "2 points: name the tradeoff (1 pt), defend one side with a concrete example from lecture (1 pt).",
    },
    {
      type: "sa",
      prompt: "Use one case study from class to justify a design decision. Name the case study, state the decision, and defend it.",
      rubric: "2 points: identify the case study by name (1 pt), state and defend the decision with lecture-specific reasoning (1 pt).",
    },
    {
      type: "sa",
      prompt: "State one takeaway from today's lecture and explain how you would apply it in a system you might build or operate.",
      rubric: "1 point for a specific, lecture-aligned takeaway with a plausible application. Generic answers receive 0.",
    },
  ];
}

function renderMC(q, num) {
  const lines = [];
  lines.push(`${num}. ${q.prompt}`);
  (q.options || []).forEach((opt, i) => {
    const letter = "abcdefghij"[i];
    lines.push(`   ${letter}. ${opt}`);
  });
  lines.push("");
  return lines.join("\n");
}

function renderSA(q, num) {
  return `${num}. ${q.prompt}\n`;
}

function renderAnswerKey(questions) {
  const lines = [];
  lines.push("> [!note]- Answer Key");
  lines.push("> *Collapse this callout for the student-facing version; expand for grading.*");
  lines.push(">");
  questions.forEach((q, i) => {
    const num = i + 1;
    if (q.type === "sa") {
      lines.push(`> **${num}.** ${q.rubric || "(no rubric provided)"}`);
    } else {
      const letter = String(q.answer || "?").trim().replace(/[().]/g, "").toLowerCase();
      lines.push(`> **${num}. ${letter}** — ${q.rubric || "(no rubric provided)"}`);
    }
  });
  lines.push("");
  return lines.join("\n");
}

function generate(config, options) {
  const slug = topicSlug(config);
  const outPath = path.join(options.outputDir, `${slug}_quiz.md`);
  const { course, lecture } = config;
  const courseLabel = `${course.code} — ${course.name}`;
  const questions = deriveQuiz(config);
  const pts = totalPoints(questions);

  const mcQ = questions.filter((q) => q.type === "mc" || q.type === "tf" || q.type === "code");
  const saQ = questions.filter((q) => q.type === "sa");

  const parts = [];
  parts.push(buildFrontmatter(config));

  parts.push(`# ${lecture.topic} — Pop Quiz (${pts} pts)`);
  parts.push(`**${courseLabel}**`);
  parts.push("");
  parts.push("**Name:** _______________________    **Date:** _____________");
  parts.push("");
  parts.push("---");
  parts.push("");
  parts.push("## Directions");
  parts.push("");
  parts.push("*All questions are directly answerable from lecture and slide content. You may use your Cornell handout.*");
  parts.push("");
  parts.push("---");
  parts.push("");

  // MC section
  if (mcQ.length > 0) {
    const mcPts = mcQ.reduce((s, q) => s + (PTS[q.type] || 1), 0);
    parts.push(`## Multiple Choice (${mcPts === mcQ.length ? "1 pt" : "varies"} each)`);
    parts.push("");
    parts.push("*Circle the best answer.*");
    parts.push("");
    mcQ.forEach((q, i) => parts.push(renderMC(q, i + 1)));
    parts.push("---");
    parts.push("");
  }

  // SA section (continued numbering)
  if (saQ.length > 0) {
    parts.push("## Short Answer (2 pts each)");
    parts.push("");
    parts.push("*Answer completely but as briefly as possible. Partial credit is given for incomplete answers.*");
    parts.push("");
    saQ.forEach((q, i) => parts.push(renderSA(q, mcQ.length + i + 1)));
    parts.push("---");
    parts.push("");
  }

  // Answer key as collapsed callout
  parts.push(renderAnswerKey(questions));

  const output = parts.join("\n").replace(/\n{3,}/g, "\n\n").replace(/\s+$/, "") + "\n";
  fs.writeFileSync(outPath, output);
  return outPath;
}

module.exports = { generate };
