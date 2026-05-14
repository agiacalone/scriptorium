const path = require("path");
const { writeText } = require("../lib/files");

function buildExamTex(config) {
  const exam = config.exam || {};
  const name = exam.name || "Exam";
  const questions = exam.questions || [];
  const lines = [
    "\\documentclass[11pt]{article}",
    "\\usepackage[margin=1in]{geometry}",
    "\\usepackage{enumitem}",
    "\\newif\\ifanswers",
    exam.includeAnswerKey ? "\\answerstrue" : "\\answersfalse",
    "\\begin{document}",
    `\\section*{${config.course.code} ${name}}`,
    `Topic focus: ${config.lecture.topic}\\\\`,
    `Total points: ${exam.totalPoints || "TBD"}`,
    "\\begin{enumerate}[leftmargin=*]",
  ];

  questions.forEach((question) => {
    const isSA = !question.type || question.type === "sa";
    if (isSA) lines.push("\\needspace{3in}");
    lines.push(`\\item ${question.prompt} (${question.points} pts)`);
    lines.push("\\ifanswers");
    lines.push(question.answer || "Answer key pending.");
    lines.push("\\else");
    lines.push(isSA ? "\\vspace{2.5in}" : "");
    lines.push("\\fi");
  });

  lines.push("\\end{enumerate}");
  lines.push("\\end{document}");
  return lines.join("\n");
}

async function generate(config, options) {
  const exam = config.exam || {};
  const baseName = exam.fileBase || `${String(config.course.code).replace(/\D+/g, "") || "course"}-exam-1-sp26`;
  const filePath = path.join(options.outputDir, `${baseName}.tex`);
  return writeText(options.outputDir, path.basename(filePath), buildExamTex(config));
}

module.exports = { generate };
