"use strict";

const fs = require("fs");
const path = require("path");
const { topicSlug } = require("../lib/context");

// Fixed deliverables boilerplate — copied exactly from course template
const DELIVERABLES = `### Deliverables
* Your writeup file *must* be done in [Markdown](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax) format and must be included in the repository as a separate file. View the file [\`README.md\`](README.md?plain=1) for an example of Markdown.
* Any included images or screenshots should be done in \`*.jpg\`, \`*.png\`, or \`*.gif\` formats, and be included individually as files in your repository (i.e. no binary 'document' with the images pasted inside).
* Screenshots or images *may* be linked in your Markdown file writeup if you wish to do so.`;

function deriveQuestions(config) {
  if (Array.isArray(config.lecture.studyQuestions) && config.lecture.studyQuestions.length > 0) {
    return config.lecture.studyQuestions;
  }

  const concepts = config.lecture.keyConcepts;
  const sections = config.lecture.sections.map((s) => s.title);
  const c0 = concepts[0] || "the primary concept";
  const c1 = concepts[1] || c0;
  const s0 = sections[0] || "the first section";

  const questions = [
    `[Recall] Define ${c0}.`,
    `[Recall] Summarize the main idea behind ${c1}.`,
    `[Apply] Apply ${c0} to one of today's case studies.`,
    `[Apply] Explain how ${s0} would change under a different workload or constraint.`,
    `[Apply] Choose one tradeoff from the lecture and defend a decision.`,
    `[Analyze] Compare two approaches from the lecture and identify the stronger fit for a real system.`,
    `[Analyze] Identify the failure mode most likely to appear if the lecture's guardrails are ignored.`,
    `[Analyze] Evaluate how the lecture's design choices affect observability, performance, and correctness.`,
    `[Analyze] Build a short argument connecting the framework to an unfamiliar scenario.`,
    `[Analyze] Critique the lecture's case study and propose a better alternative.`,
  ];

  if (config.course.adversarialThinking) {
    questions[8] = "[Analyze] From an attacker's perspective, identify the most exploitable weakness in the design and justify it.";
  }

  return questions;
}

function generate(config, options) {
  const slug = topicSlug(config);
  const mdPath = path.join(options.outputDir, `${slug}_study_questions.md`);
  const { course, lecture } = config;
  const allQuestions = deriveQuestions(config);

  const lines = [];

  // Title — matches course README format
  lines.push(`# ${course.code} Reading Assignment: ${lecture.topic}`);
  lines.push("");

  // Assignment description
  const lectureRef = lecture.slug
    ? `*${lecture.topic}*`
    : `the lecture on ${lecture.topic}`;
  lines.push("### Assignment Description");
  lines.push(
    `Answer the following questions based on your reading and ${lectureRef}. ` +
    `Be complete with your answers. You may work on these questions with one or two other partners, ` +
    `but *all* students must submit the document individually in their own repositories along with ` +
    `each student's name documented with the submission.`
  );
  lines.push("");

  // Numbered questions — flat list, no Bloom's headers
  allQuestions.forEach((q, i) => {
    const text = q.replace(/^\[.*?\]\s*/, "");
    lines.push(`${i + 1}. ${text}`);
    lines.push("");
  });

  // Fixed deliverables boilerplate
  lines.push(DELIVERABLES);
  lines.push("");

  fs.writeFileSync(mdPath, lines.join("\n"));
  return mdPath;
}

module.exports = { generate };
