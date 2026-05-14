// README generator — kept-artifact emitter for `<topic>/README.md`.
//
// Produces the GitHub Classroom assignment README in two flavors:
//   - reading variant (default): students answer questions about a chapter
//   - lab variant: students build something against verifiable requirements
//
// Routing precedence for variant selection:
//   1. options.variant (explicit caller override)
//   2. parsed.frontmatter['assessment-format'] matching /reading|lab/i
//   3. default → 'reading'
//
// Section sources:
//   - title:               H1 from body, or frontmatter.title
//   - summary paragraph:   body's `## Summary` block contents
//   - Learning Goals:      parsed.byRole.get('objective') text
//   - Reading Questions:   parsed.byRole.get('self-quiz') text (backtick
//                          `Q\d+.` prefix stripped) — falls back to one prompt
//                          per section heading from bySection if empty.
//   - Requirements (lab):  one bullet per section title (`bySection` keys).
//
// Deliverables + Please note blocks are fixed boilerplate copied verbatim per
// the GitHub Classroom doctrine — those strings must not drift.

import { applyTermFilter } from './_filter.js';

const DELIVERABLES_READING = [
  'Your writeup file *must* be done in [Markdown](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax) format and must be included in the repository as a separate file. View the file [`README.md`](README.md?plain=1) for an example of Markdown.',
  "Any included images or screenshots should be done in `*.jpg`, `*.png`, or `*.gif` formats, and be included individually as files in your repository (i.e. no binary 'document' with the images pasted inside).",
  'Screenshots or images *may* be linked in your Markdown file writeup if you wish to do so.',
];

const DELIVERABLES_LAB = [
  'Working implementation that satisfies the requirements',
  'Short reflection on design tradeoffs',
  'Evidence that requirements were verified',
];

const PLEASE_NOTE = [
  'Submit work that you can explain and defend.',
  'Keep examples aligned with the lecture topic and terminology.',
];

const DEFAULT_SUMMARY =
  'See the lecture material set distributed in class for the topic background, examples, and discussion targets this assignment is paired with.';

function pickVariant(parsed, options) {
  if (options && options.variant) return options.variant;
  const fm = parsed.frontmatter && parsed.frontmatter['assessment-format'];
  if (fm && /lab/i.test(fm)) return 'lab';
  if (fm && /reading/i.test(fm)) return 'reading';
  return 'reading';
}

function pickTitle(parsed) {
  const body = parsed.body || '';
  const m = body.match(/^#\s+(.+?)\s*$/m);
  if (m) return m[1].trim();
  if (parsed.frontmatter && parsed.frontmatter.title) return parsed.frontmatter.title;
  return 'Assignment';
}

function extractSummary(parsed) {
  const body = parsed.body || '';
  const lines = body.split('\n');
  let i = 0;
  while (i < lines.length && !/^##\s+Summary\s*$/.test(lines[i])) i++;
  if (i >= lines.length) return DEFAULT_SUMMARY;
  i++; // skip the heading
  const out = [];
  while (i < lines.length && !/^##\s+/.test(lines[i])) {
    out.push(lines[i]);
    i++;
  }
  // strip leading/trailing blank lines, preserve internal newlines
  while (out.length && out[0].trim() === '') out.shift();
  while (out.length && out[out.length - 1].trim() === '') out.pop();
  if (out.length === 0) return DEFAULT_SUMMARY;
  return out.join('\n');
}

function objectiveBullets(parsed, options = {}) {
  const items = applyTermFilter((parsed.byRole && parsed.byRole.get('objective')) || [], options);
  return items.map((it) => `- ${it.text.trim()}`);
}

function stripQuizPrefix(text) {
  // strip a leading backtick-fenced `Q1.` / `Q12.` token plus whitespace
  return text.replace(/^`Q\d+\.`\s*/, '').trim();
}

function readingQuestionBullets(parsed, options = {}) {
  const items = applyTermFilter((parsed.byRole && parsed.byRole.get('self-quiz')) || [], options);
  if (items.length > 0) {
    return items.map((it) => `- ${stripQuizPrefix(it.text)}`);
  }
  // Fallback: one generic prompt per section title.
  const sections = sectionTitles(parsed);
  return sections.map((s) => `- Discuss the key idea from §${s.id} — ${s.title}.`);
}

function sectionTitles(parsed) {
  // bySection keys are normalized section ids ('I', 'II', 'vocab', etc.) —
  // pair them with the original heading text from the body for the bullet
  // label. We walk the body's H2s and pick the ones whose extracted id is
  // present in bySection (so we skip Vocab, Question Bank, Self-Quiz, etc.
  // when they don't carry tagged content for sections themselves) — actually
  // for the lab variant we want the lecture's own roman-numeral sections, so
  // filter to ids matching uppercase roman.
  const body = parsed.body || '';
  const out = [];
  const seen = new Set();
  const re = /^##\s+([IVX]+)\.\s+(.+?)\s*$/gm;
  let m;
  while ((m = re.exec(body)) !== null) {
    const id = m[1];
    if (seen.has(id)) continue;
    seen.add(id);
    // strip trailing parenthetical time budgets like "(15 min)"
    const title = m[2].replace(/\s*\(\s*\d+\s*min\s*\)\s*$/, '').trim();
    out.push({ id, title });
  }
  return out;
}

function requirementBullets(parsed) {
  const sections = sectionTitles(parsed);
  return sections.map((s) => `- §${s.id} — ${s.title}`);
}

export function generateReadme(parsed, options = {}) {
  const variant = pickVariant(parsed, options);
  const title = pickTitle(parsed);
  const summary = extractSummary(parsed);
  const goals = objectiveBullets(parsed, options);

  const lines = [];
  const suffix = variant === 'lab' ? 'Lab Assignment' : 'Reading Assignment';
  lines.push(`# ${title} — ${suffix}`);
  lines.push('');
  lines.push(summary);
  lines.push('');
  lines.push('## Learning Goals');
  lines.push('');
  lines.push(...goals);
  lines.push('');

  if (variant === 'lab') {
    lines.push('## Requirements');
    lines.push('');
    lines.push(...requirementBullets(parsed));
    lines.push('');
    lines.push('## Deliverables');
    lines.push('');
    lines.push(...DELIVERABLES_LAB.map((d) => `- ${d}`));
    lines.push('');
  } else {
    lines.push('## Reading Questions');
    lines.push('');
    lines.push(...readingQuestionBullets(parsed, options));
    lines.push('');
    lines.push('## Deliverables');
    lines.push('');
    lines.push(...DELIVERABLES_READING.map((d) => `- ${d}`));
    lines.push('');
  }

  lines.push('## Please note');
  lines.push('');
  lines.push(...PLEASE_NOTE.map((p) => `- ${p}`));
  lines.push('');

  return lines.join('\n');
}
