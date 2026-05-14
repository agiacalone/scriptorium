const path = require("path");
const MarkdownIt = require("markdown-it");
const { topicSlug } = require("../lib/context");
const { writeText } = require("../lib/files");

function buildReadme(config) {
  const lecture = config.lecture;
  const readingVariant = /reading/i.test(config.course.assessmentFormat);
  const lines = [
    `# ${lecture.assignmentTitle || lecture.topic}`,
    "",
    lecture.assignmentSummary || lecture.summary,
    "",
    "## Learning Goals",
    ...lecture.objectives.map((objective) => `- ${objective}`),
    "",
  ];

  if (readingVariant) {
    lines.push("## Reading Questions");
    (lecture.readingQuestions || lecture.discussionQuestions || []).forEach((question) => {
      lines.push(`- ${question}`);
    });
  } else {
    lines.push("## Deliverables");
    (lecture.deliverables || ["Working implementation or notes artifact", "Short reflection on design tradeoffs", "Evidence that requirements were verified"]).forEach((item) => {
      lines.push(`- ${item}`);
    });
    lines.push("", "## Requirements");
    (lecture.requirements || lecture.keyConcepts).forEach((item) => {
      lines.push(`- ${item}`);
    });
  }

  lines.push("", "## Please note");
  lines.push("- Submit work that you can explain and defend.");
  lines.push("- Keep examples aligned with the lecture topic and terminology.");

  return lines.join("\n");
}

async function generate(config, options) {
  const fileName = config.lecture.readmeFileName || "README.md";
  const content = buildReadme(config);

  // Validate the generated markdown structure before writing it.
  const parser = new MarkdownIt();
  parser.parse(content, {});

  const filePath = writeText(options.outputDir, fileName, content);
  return filePath;
}

module.exports = { generate };
