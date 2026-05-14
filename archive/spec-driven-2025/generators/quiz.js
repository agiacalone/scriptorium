"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { topicSlug } = require("../lib/context");
const { texPreamble, texEscape } = require("../lib/tex-helpers");

// Points per question type — mirrors exam conventions
const PTS = { mc: 1, tf: 1, code: 1, sa: 2 };

function totalPoints(questions) {
  return questions.reduce((sum, q) => sum + (PTS[q.type] || 1), 0);
}

// Derive questions from spec or fall back to generic stubs
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
      prompt: `Which failure mode does the lecture warn about most strongly?`,
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
      prompt: `Use one case study from class to justify a design decision. Name the case study, state the decision, and defend it.`,
      rubric: "2 points: identify the case study by name (1 pt), state and defend the decision with lecture-specific reasoning (1 pt).",
    },
    {
      type: "sa",
      prompt: `State one takeaway from today's lecture and explain how you would apply it in a system you might build or operate.`,
      rubric: "1 point for a specific, lecture-aligned takeaway with a plausible application. Generic answers receive 0.",
    },
  ];
}

// --- Renderers ---

function renderMC(q, num) {
  const letter = String(q.answer || "").trim().replace(/[().]/g, "").toLowerCase();
  const opts = (q.options || [])
    .map((opt, i) => `  \\item ${texEscape(opt)}`)
    .join("\n");
  return [
    `\\item ${texEscape(q.prompt)}`,
    `\\ifanswers\\quad\\textbf{Answer: ${texEscape(letter || "?")}}\\fi`,
    `\\begin{enumerate}[label=\\alph*.,topsep=2pt,itemsep=1pt,leftmargin=2em]`,
    opts,
    `\\end{enumerate}`,
    `\\medskip`,
  ].join("\n");
}

function renderSA(q, num) {
  const space = "\\vspace{2.5in}";
  return [
    `\\needspace{3in}`,  // eject page if < 3in remains (question text + 2.5in answer space)
    `\\item ${texEscape(q.prompt)}`,
    `\\ifanswers`,
    `  \\par\\medskip\\noindent\\textbf{Model answer:} ${texEscape(q.rubric || "")}`,
    `\\else`,
    `  ${space}`,
    `\\fi`,
    `\\medskip`,
  ].join("\n");
}

// --- Build TeX content string ---

function buildTex(config, questions) {
  const { course, lecture } = config;
  const courseLabel = `${course.code} \u2014 ${course.name}`;
  const pts = totalPoints(questions);

  const mcQuestions = questions.filter((q) => q.type === "mc" || q.type === "tf" || q.type === "code");
  const saQuestions = questions.filter((q) => q.type === "sa");

  const lines = [];

  // Preamble (standard settings — not instructor briefing mode)
  lines.push(texPreamble(lecture.topic, courseLabel));

  // Answer toggle — must be in preamble area, before \begin{document}
  lines.push("\\newif\\ifanswers");
  lines.push("\\answersfalse  % compiled twice: once false (student), once true (key)");

  lines.push("\\begin{document}");
  lines.push("\\thispagestyle{fancy}");

  // Header — matches exam format
  lines.push([
    `\\noindent\\textbf{Name:}~\\rule{0.45\\linewidth}{0.4pt}%`,
    `\\hspace{0.04\\linewidth}%`,
    `\\textbf{Date:}~\\rule{0.20\\linewidth}{0.4pt}`,
    ``,
    `\\medskip`,
    `\\noindent\\textbf{${texEscape(courseLabel)}: ${texEscape(lecture.topic)} --- Pop Quiz (${pts}~pts)}`,
    ``,
    `\\ifanswers`,
    `  \\begin{center}\\large\\textbf{*** ANSWER KEY --- NOT FOR DISTRIBUTION ***}\\end{center}`,
    `\\fi`,
  ].join("\n"));

  // Directions
  lines.push([
    `\\paragraph*{Directions.}`,
    `\\textit{All questions are directly answerable from lecture and slide content.`,
    `You may use your Cornell handout.}`,
  ].join("\n"));

  // MC section
  if (mcQuestions.length > 0) {
    const mcPts = mcQuestions.reduce((s, q) => s + (PTS[q.type] || 1), 0);
    lines.push([
      `\\paragraph*{Multiple Choice (${mcPts === mcQuestions.length ? "1" : "varies"}~pt each).`,
      `Circle the best answer.`,
      `\\textbf{Do not} write the letter in the margin---it will be marked incorrect.}`,
    ].join(" "));
    lines.push("\\begin{enumerate}");
    mcQuestions.forEach((q, i) => lines.push(renderMC(q, i + 1)));
    lines.push("\\end{enumerate}");
  }

  // SA section
  if (saQuestions.length > 0) {
    lines.push([
      `\\paragraph*{Short Answer (2~pts each).`,
      `Answer completely but as briefly as possible.`,
      `Partial credit is given for incomplete answers.}`,
    ].join(" "));
    // Continue numbering from MC section if both exist
    const resumeOpt = mcQuestions.length > 0 ? "[resume]" : "";
    lines.push(`\\begin{enumerate}${resumeOpt}`);
    saQuestions.forEach((q, i) => lines.push(renderSA(q, mcQuestions.length + i + 1)));
    lines.push("\\end{enumerate}");
  }

  lines.push("\\end{document}\n");
  return lines.join("\n");
}

// --- Double compile: student copy + answer key ---

function compileStudentAndKey(texContent, slug, outputDir) {
  const latexArgs = ["-interaction=nonstopmode", "-output-directory", outputDir];

  // Student copy (answersfalse)
  const studentTex = path.join(outputDir, `${slug}_quiz.tex`);
  fs.writeFileSync(studentTex, texContent);
  spawnSync("pdflatex", [...latexArgs, studentTex], { stdio: "ignore" });
  spawnSync("pdflatex", [...latexArgs, studentTex], { stdio: "ignore" });

  // Key copy (answerstrue)
  const keyContent = texContent.replace("\\answersfalse", "\\answerstrue");
  const keyTex = path.join(outputDir, `${slug}_quiz_key.tex`);
  fs.writeFileSync(keyTex, keyContent);
  spawnSync("pdflatex", [...latexArgs, keyTex], { stdio: "ignore" });
  spawnSync("pdflatex", [...latexArgs, keyTex], { stdio: "ignore" });

  const studentPdf = path.join(outputDir, `${slug}_quiz.pdf`);
  const keyPdf = path.join(outputDir, `${slug}_quiz_key.pdf`);

  if (!fs.existsSync(studentPdf)) {
    throw new Error(`Quiz student PDF not produced. Check ${studentTex} for errors.`);
  }
  if (!fs.existsSync(keyPdf)) {
    throw new Error(`Quiz key PDF not produced. Check ${keyTex} for errors.`);
  }

  return studentPdf;
}

// --- Entry point ---

function generate(config, options) {
  const slug = topicSlug(config);
  const questions = deriveQuiz(config);
  const texContent = buildTex(config, questions);
  return compileStudentAndKey(texContent, slug, options.outputDir);
}

module.exports = { generate };
