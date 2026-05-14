// Quiz generator — emits a 5-question pop quiz LaTeX source plus a separate
// answer-key version. The two share the same body; toggling \keytrue/\keyfalse
// in the preamble flips \ifkey ... \fi blocks between blank space and answers.
//
// Selection (deterministic, source-order):
//   2 recall      — #difficulty/1, type ∈ {mc, tf, fib}
//   1 apply       — #difficulty/2, type ∈ {mc, sa}
//   1 analyze     — #difficulty/3, type ∈ {sa, code}
//   1 code-or-fib — any difficulty, type ∈ {code, fib}
//
// Falls back to the next-easier tier with a soft warning if a tier is empty.

import { createRequire } from 'node:module';
import { applyTermFilter } from './_filter.js';
const require = createRequire(import.meta.url);
const tex = require('../lib/tex-helpers.js');
const { texPreamble, texEscape } = tex;

const DEFAULT_PTS = { mc: 1, tf: 1, code: 1, sa: 2, fib: 1 };

function tagValue(item, prefix) {
  for (const t of item.tags) {
    if (t.startsWith(prefix)) return t.slice(prefix.length);
  }
  return null;
}

function qType(item) {
  return tagValue(item, 'type/');
}

function qDifficulty(item) {
  const d = tagValue(item, 'difficulty/');
  return d ? Number(d) : null;
}

function qPoints(item) {
  const t = qType(item);
  const f = item.fields && item.fields.get && item.fields.get('points');
  if (f != null && f !== '') return Number(f);
  return DEFAULT_PTS[t] || 1;
}

function qAnswer(item) {
  return (item.fields && item.fields.get && item.fields.get('answer')) || '';
}

// Stem text — drop a leading "Stem: " prefix if present.
function qStem(item) {
  return String(item.text || '').replace(/^Stem:\s*/i, '');
}

// Pick the first item matching a predicate, in source order, that is not
// already in the `taken` Set. Mutates `taken`.
function pickFirst(pool, taken, pred) {
  for (const item of pool) {
    if (taken.has(item)) continue;
    if (pred(item)) {
      taken.add(item);
      return item;
    }
  }
  return null;
}

function pickFive(questions, warnings) {
  const sorted = [...questions].sort((a, b) => (a.sourceLine || 0) - (b.sourceLine || 0));
  const taken = new Set();
  const picks = [];

  // Tier 1: 2 recall — diff=1, type in {mc, tf, fib}
  for (let i = 0; i < 2; i++) {
    const p = pickFirst(sorted, taken, (q) =>
      qDifficulty(q) === 1 && ['mc', 'tf', 'fib'].includes(qType(q))
    ) || pickFirst(sorted, taken, (q) =>
      qDifficulty(q) === 2 && ['mc', 'tf', 'fib'].includes(qType(q))
    );
    if (p) picks.push(p);
    else warnings.push(`recall slot ${i + 1}: no eligible item found`);
  }

  // Tier 2: 1 apply — diff=2, type in {mc, sa}
  {
    const p = pickFirst(sorted, taken, (q) =>
      qDifficulty(q) === 2 && ['mc', 'sa'].includes(qType(q))
    ) || pickFirst(sorted, taken, (q) =>
      qDifficulty(q) === 1 && ['mc', 'sa'].includes(qType(q))
    );
    if (p) picks.push(p);
    else warnings.push('apply slot: no eligible item found');
  }

  // Tier 3: 1 analyze — diff=3, type in {sa, code}
  {
    const p = pickFirst(sorted, taken, (q) =>
      qDifficulty(q) === 3 && ['sa', 'code'].includes(qType(q))
    ) || pickFirst(sorted, taken, (q) =>
      qDifficulty(q) === 2 && ['sa', 'code'].includes(qType(q))
    );
    if (p) picks.push(p);
    else warnings.push('analyze slot: no eligible item found');
  }

  // Tier 4: 1 code-or-fib — any difficulty
  {
    const p = pickFirst(sorted, taken, (q) => ['code', 'fib'].includes(qType(q)));
    if (p) picks.push(p);
    else warnings.push('code-or-fib slot: no eligible item found');
  }

  // Maintain quiz order = source order of picks
  picks.sort((a, b) => (a.sourceLine || 0) - (b.sourceLine || 0));
  return picks;
}

// --- Renderers ---

function isMCSection(t) {
  return t === 'mc' || t === 'tf' || t === 'code';
}

function isSASection(t) {
  return t === 'sa' || t === 'fib';
}

function renderMCItem(q) {
  const t = qType(q);
  const stem = qStem(q);
  const lines = [];

  if (t === 'mc') {
    lines.push(`  \\item ${texEscape(stem)}`);
    const opts = (q.children || []).map((c) => {
      // Strip leading "A. " / "B. " prefixes — \alph* enumerate generates them.
      const text = String(c.text || '').replace(/^[A-Z][.)]\s*/, '');
      return `      \\item ${texEscape(text)}`;
    }).join('\n');
    lines.push('    \\begin{enumerate}[label=(\\alph*)]');
    if (opts) lines.push(opts);
    lines.push('    \\end{enumerate}');
    const ans = qAnswer(q).toString().trim().toLowerCase().replace(/[().]/g, '');
    lines.push(`    \\ifkey \\textbf{Answer:} ${texEscape(ans || '?')} \\fi`);
  } else if (t === 'tf') {
    lines.push(`  \\item (True / False) ${texEscape(stem)}`);
    const a = qAnswer(q).toString().trim().toUpperCase();
    const expanded = a.startsWith('T') ? 'True' : a.startsWith('F') ? 'False' : a || '?';
    lines.push(`    \\ifkey \\textbf{Answer:} ${texEscape(expanded)} \\fi`);
  } else if (t === 'code') {
    lines.push(`  \\item ${texEscape(stem)}`);
    const a = qAnswer(q).toString().trim();
    lines.push(`    \\ifkey \\textbf{Answer:} ${texEscape(a || '?')} \\fi`);
  }

  return lines.join('\n');
}

function renderSAItem(q) {
  const t = qType(q);
  const stem = qStem(q);
  const lines = [];
  lines.push(`  \\item ${texEscape(stem)}`);
  if (t === 'fib') {
    const a = qAnswer(q).toString().trim();
    lines.push(`    \\ifkey \\textit{Key:} ${texEscape(a || '(see lecture)')} \\else \\vspace{1.5cm} \\fi`);
  } else {
    // sa
    const a = qAnswer(q).toString().trim();
    lines.push(`    \\ifkey \\textit{Key:} ${texEscape(a || '(model answer — graded by rubric)')} \\else \\vspace{2.5cm} \\fi`);
  }
  return lines.join('\n');
}

function renderTex(parsed, picked, isKey) {
  const fm = parsed.frontmatter || {};
  const topic = fm.title || 'Lecture';
  const courseLabel = [fm.course, fm.term].filter(Boolean).join(' — ') || (fm.course || '');

  const totalPts = picked.reduce((s, q) => s + qPoints(q), 0);
  const mcItems = picked.filter((q) => isMCSection(qType(q)));
  const saItems = picked.filter((q) => isSASection(qType(q)));

  const out = [];
  out.push(texPreamble(topic, courseLabel));
  out.push('\\newif\\ifkey');
  out.push(isKey ? '\\keytrue' : '\\keyfalse');
  out.push('\\begin{document}');
  out.push('\\thispagestyle{fancy}');

  out.push(`\\section*{${texEscape(topic)} --- Pop Quiz (${totalPts} pts)}`);
  if (courseLabel) out.push(`\\textbf{${texEscape(courseLabel)}}\\par\\medskip`);
  out.push('\\noindent\\textbf{Name:} \\rule{6cm}{0.4pt} \\hfill \\textbf{Date:} \\rule{3cm}{0.4pt}');
  out.push('\\medskip');
  out.push('\\ifkey\\begin{center}\\large\\textbf{*** ANSWER KEY --- NOT FOR DISTRIBUTION ***}\\end{center}\\fi');

  out.push('\\section*{Directions}');
  out.push('\\textit{All questions are directly answerable from lecture and slide content. You may use your Cornell handout.}');

  if (mcItems.length > 0) {
    const mcPts = mcItems.reduce((s, q) => s + qPoints(q), 0);
    const each = mcItems.every((q) => qPoints(q) === 1) ? '1 pt each' : `${mcPts} pts total`;
    out.push(`\\section*{Multiple Choice (${each})}`);
    out.push('\\begin{enumerate}');
    for (const q of mcItems) out.push(renderMCItem(q));
    out.push('\\end{enumerate}');
  }

  if (saItems.length > 0) {
    const saPts = saItems.reduce((s, q) => s + qPoints(q), 0);
    const each = saItems.every((q) => qPoints(q) === 2) ? '2 pts each' : `${saPts} pts total`;
    const resume = mcItems.length > 0 ? '[resume]' : '';
    out.push(`\\section*{Short Answer (${each})}`);
    out.push(`\\begin{enumerate}${resume}`);
    for (const q of saItems) out.push(renderSAItem(q));
    out.push('\\end{enumerate}');
  }

  out.push('\\end{document}');
  return out.join('\n');
}

export function generateQuiz(parsed, options = {}) {
  const questions = applyTermFilter(parsed.byRole.get('question') || [], options);
  const warnings = [];
  const picked = pickFive(questions, warnings);
  if (warnings.length > 0 && !options.silent) {
    for (const w of warnings) console.warn(`quiz: ${w}`);
  }
  const quizTex = renderTex(parsed, picked, false);
  const keyTex = renderTex(parsed, picked, true);
  return { quizTex, keyTex, picked, warnings };
}

export default generateQuiz;
