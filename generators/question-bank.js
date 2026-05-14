// Question bank generator — kept-artifact emitter for `<topic>_question_bank.md`.
//
// Walks parsed AST from parser/ over `byRole.get('question')` (top-level items
// only — option child-bullets are attached as item.children) and emits one
// markdown block per question in source order.
//
// Format (extends the spec-driven-2025 archived schema):
//   ## <typeletter><nn>             id-headed (m/t/c/f/s + 01-padded seq within type)
//   - type:                         mc|tf|code|fib|sa
//   - difficulty: 1|2|3
//   - section: I|II|III|...
//   - points: N                     (omitted if absent)
//   - exam-eligible: true|false
//   - tags: <space-joined custom tags>   (omitted if empty)
//   - adversarial: true             (only if #adversarial)
//   - prompt: |
//       <multi-line prompt>
//   - options:                      (mc only)
//       - A. ...
//       - B. ...
//   - answer: <answer>
//
// Source order: questions emit in the order they appear in the source main.md.
// Numbering is per-type 01-padded (m01..m07, t01..t03, etc.).
//
// Validator already handled the #type/fib + #exam-eligible mutation (strips
// exam-eligible and warns); this generator just reflects the resulting state.

import { applyTermFilter } from './_filter.js';

const TYPE_LETTER = { mc: 'm', tf: 't', code: 'c', fib: 'f', sa: 's' };

const META_TAGS = new Set(['question', 'adversarial', 'exam-eligible']);
const META_PREFIXES = ['type/', 'difficulty/', 'section/', 'bloom/', 'audience/'];

function isMetaTag(t) {
  if (META_TAGS.has(t)) return true;
  return META_PREFIXES.some((p) => t.startsWith(p));
}

function pickType(tags) {
  for (const t of tags) {
    if (t.startsWith('type/')) return t.slice('type/'.length);
  }
  return null;
}

function pickDifficulty(tags) {
  for (const t of tags) {
    if (t.startsWith('difficulty/')) return t.slice('difficulty/'.length);
  }
  return null;
}

function customTags(tags) {
  return [...tags].filter((t) => !isMetaTag(t));
}

// Indent every line of `s` by `pad` spaces.
function indentBlock(s, pad) {
  const prefix = ' '.repeat(pad);
  return s.split('\n').map((l) => prefix + l).join('\n');
}

function buildOptions(item) {
  // Prefer child bullets (parser-attached). Fall back to [options:: A; B; …].
  if (item.children && item.children.length > 0) {
    return item.children
      .map((c) => (c.text || '').trim())
      .filter(Boolean);
  }
  const f = item.fields && item.fields.get && item.fields.get('options');
  if (f) {
    return f
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s, i) => (/^[A-Z]\.\s/.test(s) ? s : `${String.fromCharCode(65 + i)}. ${s}`));
  }
  return [];
}

export function generateQuestionBank(parsed, options = {}) {
  const fm = parsed.frontmatter || {};
  const title = fm.title || 'Lecture';
  const courseLabel = [fm.course, title].filter(Boolean).join(' — ');
  const generated = new Date().toISOString();
  const sourcePath = (fm.raw && fm.raw['source-path']) || (parsed.sourcePath ?? '');

  const out = [];
  out.push(`# ${title} Question Bank`);
  out.push('');
  if (courseLabel) out.push(`Course: ${courseLabel}`);
  out.push(`Generated: ${generated}`);
  if (sourcePath) out.push(`Source: ${sourcePath}`);
  out.push('');

  const questions = applyTermFilter(parsed.byRole.get('question') ?? [], options);

  // Per-type running counter for id assignment.
  const counters = { mc: 0, tf: 0, code: 0, fib: 0, sa: 0 };

  for (const q of questions) {
    const type = pickType(q.tags);
    if (!type || !TYPE_LETTER[type]) continue;
    counters[type] += 1;
    const id = `${TYPE_LETTER[type]}${String(counters[type]).padStart(2, '0')}`;

    const difficulty = pickDifficulty(q.tags) || '';
    const section = q.section || '';
    const points = q.fields && q.fields.get && q.fields.get('points');
    const examEligible = q.tags.has('exam-eligible'); // already mutated by validator for fib
    const adversarial = q.tags.has('adversarial');
    const extras = customTags(q.tags);
    const answer = (q.fields && q.fields.get && q.fields.get('answer')) || '';
    const prompt = (q.text || '').trim();

    out.push(`## ${id}`);
    out.push('');
    out.push(`- type: ${type}`);
    if (difficulty) out.push(`- difficulty: ${difficulty}`);
    if (section) out.push(`- section: ${section}`);
    if (points) out.push(`- points: ${points}`);
    out.push(`- exam-eligible: ${examEligible ? 'true' : 'false'}`);
    if (extras.length > 0) out.push(`- tags: ${extras.join(' ')}`);
    if (adversarial) out.push('- adversarial: true');

    // Prompt — multi-line indent block under `prompt: |`.
    out.push('- prompt: |');
    out.push(indentBlock(prompt, 4));

    if (type === 'mc') {
      const opts = buildOptions(q);
      if (opts.length > 0) {
        out.push('- options:');
        for (const o of opts) {
          out.push(`    - ${o}`);
        }
      }
    }

    out.push(`- answer: ${answer}`);
    out.push('');
  }

  return out.join('\n');
}

export default generateQuestionBank;
