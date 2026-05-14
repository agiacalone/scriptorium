"use strict";

const fs = require("fs");
const path = require("path");
const { topicSlug } = require("../lib/context");
const {
  compileLatex,
  texBriefingSection,
  texBulletList,
  texCallout,
  texComparisonTable,
  texDocHeader,
  texHook,
  texPlainSection,
  texPreamble,
  texEscape,
} = require("../lib/tex-helpers");

function generate(config, options) {
  const slug = topicSlug(config);
  const texPath = path.join(options.outputDir, `${slug}_lecture_notes.tex`);
  const { course, lecture } = config;
  const courseLabel = `${course.code} \u2014 ${course.name}`;

  const lines = [];
  // Instructor notes: tight spacing, smaller font, narrower margins for quick-ref density
  lines.push(texPreamble(lecture.topic, courseLabel, { fontSize: "11pt", margin: "0.75in", tightSpacing: true }));
  lines.push("\\begin{document}");
  lines.push("\\thispagestyle{fancy}");
  lines.push(texDocHeader(lecture.topic, "Lecture Notes \u2014 with Talking Points", courseLabel));

  // Opening hook
  lines.push(texHook(
    lecture.openingHook ||
    `Frame ${lecture.topic} as a practical systems problem before introducing formal vocabulary.`
  ));

  // Learning objectives
  lines.push(texPlainSection("Learning Objectives"));
  lines.push(texBulletList(lecture.objectives));

  // Numbered sections — briefing two-column layout (points left, talking points right)
  lecture.sections.forEach((section, index) => {
    const talkingPoints = section.talkingPoints || section.speakerNotes;
    lines.push(texBriefingSection(
      section.title,
      index,
      section.minutes,
      section.overview,
      section.points,
      talkingPoints
    ));

    // Callouts and tables remain full-width below the two-column zone
    (section.callouts || []).forEach((c) => {
      if (c && c.text) {
        lines.push(texCallout(c.label, c.text));
      }
    });

    if (section.table && section.table.headers && section.table.rows) {
      lines.push(texComparisonTable(section.table.headers, section.table.rows));
    }
  });

  // Case studies
  if (lecture.caseStudies && lecture.caseStudies.length > 0) {
    lines.push(texPlainSection("Case Studies"));
    lines.push(texBulletList(lecture.caseStudies));
  }

  // Summary
  lines.push(texPlainSection("Summary"));
  lines.push(texBulletList(lecture.takeaways || lecture.objectives));

  // Discussion questions
  if (lecture.discussionQuestions && lecture.discussionQuestions.length > 0) {
    lines.push(texPlainSection("Discussion Questions"));
    lines.push(texBulletList(lecture.discussionQuestions));
  }

  // References
  if (lecture.references && lecture.references.length > 0) {
    lines.push(texPlainSection("References"));
    lines.push(texBulletList(lecture.references));
  }

  lines.push("\\end{document}\n");

  fs.writeFileSync(texPath, lines.join("\n"));
  const pdfPath = compileLatex(texPath, options.outputDir);
  return pdfPath;
}

module.exports = { generate };
