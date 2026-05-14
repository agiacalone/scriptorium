const path = require("path");
const { topicSlug } = require("../lib/context");
const { writeText } = require("../lib/files");

function deriveEntries(config) {
  if (Array.isArray(config.lecture.questionBank) && config.lecture.questionBank.length > 0) {
    return config.lecture.questionBank;
  }

  const entries = [];
  config.lecture.sections.forEach((section, index) => {
    entries.push({
      type: "mc",
      difficulty: "★",
      prompt: `Which statement best captures the main idea of ${section.title}?`,
      answer: "Provide one correct option plus three plausible distractors.",
      subtopic: section.title,
      id: `mc-${index + 1}`,
    });
    entries.push({
      type: "sa",
      difficulty: "★★",
      prompt: `Explain one tradeoff or design decision from ${section.title}.`,
      answer: "A strong answer names the tradeoff, context, and consequence.",
      subtopic: section.title,
      id: `sa-${index + 1}`,
    });
  });
  return entries;
}

async function generate(config, options) {
  const slug = topicSlug(config);
  const filePath = path.join(options.outputDir, `${slug}_question_bank.md`);
  const lines = [
    `# ${config.lecture.topic} Question Bank`,
    "",
    `Course: ${config.course.code} - ${config.course.name}`,
    "",
  ];

  deriveEntries(config).forEach((entry) => {
    lines.push(`## ${entry.id}`);
    lines.push(`- type: ${entry.type}`);
    lines.push(`- difficulty: ${entry.difficulty}`);
    lines.push(`- subtopic: ${entry.subtopic}`);
    lines.push(`- prompt: ${entry.prompt}`);
    lines.push(`- answer: ${entry.answer}`);
    lines.push("");
  });

  return writeText(options.outputDir, path.basename(filePath), lines.join("\n"));
}

module.exports = { generate };
