// Study-questions generator — kept-artifact emitter for `<topic>_study_questions.md`.
//
// V1 strategy: emit `byRole.get('self-quiz')` items in source order as a flat
// numbered list. The fixture's #self-quiz prompts are already 10-and-tiered by
// the author (recall → apply → analyze) so we don't auto-classify here. Future
// v2 may group by `#bloom/*` tags once authors start adding them to self-quiz
// items.
//
// Output structure (matches the kept artifact contract — see vault file
// classes/326/file_systems_abstraction_study_questions.md):
//   ---
//   <frontmatter>
//   ---
//   # <Topic> — Study Questions
//   **Course:** <course> — <topic>
//   ## Reading Assignment
//   <boilerplate>
//   1. <Q1>
//   ...
//   ## Adversarial — required        (only if adversarial-thinking: true AND
//                                     #self-quiz #adversarial items exist)
//   1. ...
//   ## Deliverables
//   <boilerplate>

import { applyTermFilter } from './_filter.js';

const READING_BLURB =
  'Answer the following questions based on your reading and class participation in *%TOPIC%*. ' +
  'Be complete with your answers. You may work on these questions with one or two other partners, ' +
  "but *all* students must submit individually in their own repositories along with each student's " +
  'name documented with the submission.';

const DELIVERABLES = [
  '- Markdown writeup; submit individually in your own GitHub Classroom repo.',
  '- Any included images or screenshots in `*.jpg`, `*.png`, or `*.gif`, included individually as files (no binary documents with embedded images).',
  '- Screenshots may be linked in the writeup if you wish.',
];

// Strip the leading `Qn.` (with backticks) or bare `Qn.` prefix from a self-quiz prompt.
function stripQPrefix(text) {
  return text
    .replace(/^`Q\d+\.`\s*/, '')
    .replace(/^Q\d+\.\s*/, '')
    .trim();
}

function buildTags(fm) {
  const out = new Set();
  const rawTags = fm.raw && Array.isArray(fm.raw.tags) ? fm.raw.tags : [];
  for (const t of rawTags) {
    // Skip type tags from the source (e.g., `lecture-main`).
    if (t === 'lecture-main' || t === 'study-questions') continue;
    out.add(t);
  }
  // Course slug, if not already present.
  if (fm.course) {
    const slug = fm.course.toLowerCase().replace(/\s+/g, '');
    out.add(slug);
  }
  out.add('study-questions');
  return [...out];
}

function frontmatterBlock(fm) {
  const now = new Date().toISOString();
  const title = fm.title || 'Lecture';
  const course = fm.course || '';
  const tags = buildTags(fm);
  const lines = ['---'];
  lines.push(`title: ${title} — Study Questions`);
  if (course) lines.push(`course: ${course}`);
  lines.push('type: study-questions');
  lines.push(`created: ${now}`);
  lines.push(`updated: ${now}`);
  lines.push('visibility: private');
  lines.push(`tags: [${tags.join(', ')}]`);
  lines.push('icon: LiGraduationCap');
  lines.push('iconColor: var(--text-normal)');
  lines.push('---');
  return lines.join('\n');
}

export function generateStudyQuestions(parsed, options = {}) {
  const fm = parsed.frontmatter || {};
  const title = fm.title || 'Lecture';
  const course = fm.course || '';
  const selfQuiz = applyTermFilter(parsed.byRole.get('self-quiz') ?? [], options);

  // Adversarial branch: items tagged both #self-quiz and #adversarial.
  const adversarialItems = fm.adversarialThinking
    ? selfQuiz.filter((i) => i.tags && i.tags.has && i.tags.has('adversarial'))
    : [];
  const adversarialSet = new Set(adversarialItems);
  const mainItems = selfQuiz.filter((i) => !adversarialSet.has(i));

  const out = [];
  out.push(frontmatterBlock(fm));
  out.push('');
  out.push(`# ${title} — Study Questions`);
  out.push('');
  if (course) {
    out.push(`**Course:** ${course} — ${title}`);
    out.push('');
  }

  out.push('## Reading Assignment');
  out.push('');
  out.push(READING_BLURB.replace('%TOPIC%', title));
  out.push('');

  mainItems.forEach((item, i) => {
    const text = stripQPrefix(item.text || '');
    out.push(`${i + 1}. ${text}`);
  });
  out.push('');

  if (adversarialItems.length > 0) {
    out.push('## Adversarial — required');
    out.push('');
    adversarialItems.forEach((item, i) => {
      const text = stripQPrefix(item.text || '');
      out.push(`${i + 1}. ${text}`);
    });
    out.push('');
  }

  out.push('## Deliverables');
  out.push('');
  for (const d of DELIVERABLES) out.push(d);
  out.push('');

  return out.join('\n');
}

export default generateStudyQuestions;
