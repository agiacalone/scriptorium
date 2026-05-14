// Exam generator — assembles a multi-topic exam from one or more parsed
// `_lecture_main.md` documents. Pulls #question items tagged #exam-eligible
// across the supplied docs, applies optional difficulty quotas + topic
// weighting, and renders student + key LaTeX (toggled via \ifanswers).
//
// Section types follow the style guide: 'mc' accepts mc+tf+code; 'sa' accepts
// sa only. #type/fib is never on exams (defensively stripped).

import fs from 'node:fs';
import { createRequire } from 'node:module';
import { applyTermFilter } from './_filter.js';
const require = createRequire(import.meta.url);
const tex = require('../lib/tex-helpers.js');
const { texPreamble, texEscape } = tex;

// --- helpers ---

function tagValue(item, prefix) {
  for (const t of item.tags) {
    if (t.startsWith(prefix)) return t.slice(prefix.length);
  }
  return null;
}

function qType(item) { return tagValue(item, 'type/'); }

function qDifficulty(item) {
  const d = tagValue(item, 'difficulty/');
  return d ? Number(d) : null;
}

function qAnswer(item) {
  return (item.fields && item.fields.get && item.fields.get('answer')) || '';
}

function qStem(item) {
  return String(item.text || '').replace(/^Stem:\s*/i, '');
}

// If the question carries an attached code block (parser stashes fenced
// ```code``` blocks onto fields.get('code')), strip the fence markers and
// return just the body. Returns null when no code is attached.
function qCode(item) {
  if (!item.fields || typeof item.fields.get !== 'function') return null;
  const raw = item.fields.get('code');
  if (!raw) return null;
  // Strip ``` fences (with optional language) and trailing newline.
  return String(raw)
    .replace(/^```[a-zA-Z0-9_+-]*\n?/, '')
    .replace(/\n?```\s*$/, '')
    .replace(/```[a-zA-Z0-9_+-]*\n?/g, '')
    .replace(/```/g, '');
}

function isExamEligible(q) {
  for (const t of q.tags) if (t === 'exam-eligible') return true;
  return false;
}

// 4-byte mulberry32 PRNG — deterministic, no deps.
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5) | 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Section-type → accepted question types
function acceptsForSection(sectionType) {
  if (sectionType === 'mc') return new Set(['mc', 'tf', 'code']);
  if (sectionType === 'sa') return new Set(['sa']);
  // Future: 'code' | 'tf' as their own section types
  return new Set([sectionType]);
}

// --- pool construction ---

function buildPool(parsedDocs, filterOptions) {
  const pool = [];
  const excludeTags = new Set((filterOptions && filterOptions.excludeTags) || []);
  for (const doc of parsedDocs) {
    const slug = (doc.frontmatter && doc.frontmatter.topicSlug) || '';
    const qsRaw = (doc.byRole && doc.byRole.get('question')) || [];
    const qs = applyTermFilter(qsRaw, filterOptions || {});
    for (const q of qs) {
      if (qType(q) === 'fib') continue;          // defensive
      if (!isExamEligible(q)) continue;
      // Spec-level tag exclusion (e.g. excludeTags: ['adversarial'] strips
      // anything tagged #adversarial). Match against bare tag names without #.
      let excluded = false;
      for (const t of q.tags) {
        if (excludeTags.has(t)) { excluded = true; break; }
      }
      if (excluded) continue;
      // Augment with topicSlug + sourceMain so mark-used can edit-back later.
      const sourceMain = (doc.frontmatter && doc.frontmatter.raw && doc.frontmatter.raw.__path) || null;
      pool.push(Object.assign({}, q, {
        topicSlug: slug,
        sourceMain,
        // preserve tags + children + fields + sourceLine via spread
      }));
    }
  }
  return pool;
}

// Mark-used: append `#used/<term>` to each picked item's source line in its
// origin main.md. Idempotent — items already carrying the tag are skipped.
//
// Strategy: read the source file as a line array, locate the bullet at
// `item.sourceLine` (1-indexed), append ` #used/<term>` to the END of that
// line if it's not already present anywhere on the line. We only modify the
// FIRST line of a multi-line item — children on subsequent lines are not
// touched. Idempotency is checked via a regex against the current line text.
export function markUsedTag(parsedDocs, picked, term, options = {}) {
  if (!term) return { modified: 0, alreadyTagged: 0, files: [] };
  // Match each picked item to its source main path. Use parsedDocs slug for lookup.
  const slugToPath = new Map();
  for (const doc of parsedDocs) {
    const slug = (doc.frontmatter && doc.frontmatter.topicSlug) || '';
    const p = (doc.frontmatter && doc.frontmatter.raw && doc.frontmatter.raw.__path) || null;
    if (slug && p) slugToPath.set(slug, p);
  }
  // Group picks by source main path, then by sourceLine.
  const byPath = new Map();
  for (const q of picked || []) {
    const path = q.sourceMain || slugToPath.get(q.topicSlug) || options.fallbackPath;
    if (!path) continue;
    if (!byPath.has(path)) byPath.set(path, []);
    byPath.get(path).push(q);
  }

  const tagToken = `#used/${term}`;
  const tagRe = new RegExp(`(?:^|\\s)${tagToken.replace(/\//g, '\\/')}(?:\\s|$)`);

  let modified = 0;
  let alreadyTagged = 0;
  const files = [];
  for (const [filePath, items] of byPath) {
    if (!fs.existsSync(filePath)) continue;
    const orig = fs.readFileSync(filePath, 'utf8');
    const lines = orig.split('\n');
    let fileChanged = false;
    for (const it of items) {
      const lineIdx = (it.sourceLine || 0) - 1;
      if (lineIdx < 0 || lineIdx >= lines.length) continue;
      const line = lines[lineIdx];
      if (tagRe.test(line)) { alreadyTagged++; continue; }
      // Append at end of line, before any trailing whitespace.
      const trimmed = line.replace(/\s+$/, '');
      lines[lineIdx] = `${trimmed} ${tagToken}`;
      modified++;
      fileChanged = true;
    }
    if (fileChanged) {
      fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
      files.push(filePath);
    }
  }
  return { modified, alreadyTagged, files };
}

// --- selection ---

// Compute per-difficulty quotas given a count + difficulty mix.
// Floors with largest-remainder rounding to hit count exactly.
function difficultyQuotas(count, mix) {
  const tiers = Object.keys(mix).map(Number).sort((a, b) => a - b);
  const raw = tiers.map((t) => ({ tier: t, want: count * (mix[t] || 0) }));
  const floored = raw.map((r) => ({ tier: r.tier, want: Math.floor(r.want), frac: r.want - Math.floor(r.want) }));
  let assigned = floored.reduce((s, r) => s + r.want, 0);
  let remainder = count - assigned;
  // Distribute leftover slots to largest fractional parts
  const order = [...floored].sort((a, b) => b.frac - a.frac);
  for (let i = 0; i < order.length && remainder > 0; i++, remainder--) {
    order[i].want += 1;
  }
  const out = new Map();
  for (const r of floored) out.set(r.tier, r.want);
  return out;
}

// Pick `count` items for a section, respecting weighting + difficulty mix.
// Falls back to easier difficulty tiers when a target tier is under-supplied.
function pickSection(section, sourcePool, weighting, randomize, rng, warnings) {
  const accepts = acceptsForSection(section.type);
  let candidates = sourcePool.filter((q) => accepts.has(qType(q)));

  // Order: source-line by default, shuffled (with weighting bias) if random.
  candidates = [...candidates];
  if (randomize) {
    shuffleInPlace(candidates, rng);
  } else {
    candidates.sort((a, b) => (a.sourceLine || 0) - (b.sourceLine || 0));
  }

  // Apply weighting as soft preference: higher-weight topics drift earlier.
  // We sort stably by weight desc, breaking ties by current order.
  if (weighting && Object.keys(weighting).length > 0) {
    const wOf = (q) => (weighting[q.topicSlug] != null ? Number(weighting[q.topicSlug]) : 1);
    // Stable sort: higher weight first, preserving prior order.
    candidates = candidates
      .map((q, i) => ({ q, i, w: wOf(q) }))
      .sort((a, b) => (b.w - a.w) || (a.i - b.i))
      .map((x) => x.q);
  }

  const taken = new Set();
  const picks = [];

  if (section.difficultyMix) {
    const quotas = difficultyQuotas(section.count, section.difficultyMix);
    // Greedy fill in tier order (3 → 2 → 1) so easier tiers absorb fallback.
    const tiers = [...quotas.keys()].sort((a, b) => b - a);
    for (const tier of tiers) {
      let want = quotas.get(tier) || 0;
      // First pass: exact tier
      for (const q of candidates) {
        if (want === 0) break;
        if (taken.has(q)) continue;
        if (qDifficulty(q) === tier) { taken.add(q); picks.push(q); want--; }
      }
      // Fallback: easier tiers
      if (want > 0) {
        for (let lower = tier - 1; lower >= 1 && want > 0; lower--) {
          for (const q of candidates) {
            if (want === 0) break;
            if (taken.has(q)) continue;
            if (qDifficulty(q) === lower) {
              taken.add(q); picks.push(q); want--;
              warnings.push(`section ${section.type}: difficulty/${tier} under-supplied, filling from difficulty/${lower}`);
            }
          }
        }
      }
      // Final fallback: any remaining
      if (want > 0) {
        for (const q of candidates) {
          if (want === 0) break;
          if (taken.has(q)) continue;
          taken.add(q); picks.push(q); want--;
          warnings.push(`section ${section.type}: difficulty/${tier} under-supplied, filling from any difficulty`);
        }
      }
    }
  } else {
    for (const q of candidates) {
      if (picks.length >= section.count) break;
      if (taken.has(q)) continue;
      taken.add(q); picks.push(q);
    }
  }

  if (picks.length < section.count) {
    warnings.push(`section ${section.type}: requested ${section.count} but only ${picks.length} available`);
  }

  // Final order within section: source-line (clean for non-random); shuffled for random.
  if (randomize) {
    shuffleInPlace(picks, rng);
  } else {
    picks.sort((a, b) => (a.sourceLine || 0) - (b.sourceLine || 0));
  }
  return picks;
}

// --- LaTeX rendering ---
//
// Output shape mirrors Anthony's LyX exam template:
//   - one continuous numbered Enumerate across all questions (Q1 ... QN)
//   - each item prefixed with bold "N pts." showing the point value
//   - SA items get cascading \bigskip space for student answers (no \vspace block)
//   - bare header (Name + Student ID# rules + title), no per-page banner
//   - Directions in italicized paragraph, not a section heading
//   - no \section* dividers between MC / TF / SA — single list, points-per-item
//     carries the type difference where it matters

function renderQuestionItem(q, pointsEach) {
  const t = qType(q);
  const stem = qStem(q);
  // Editorial pattern: italic pts in parens, leading. e.g. "(2 pts)" reads
  // as a typographic aside rather than a heavy bold-sans label.
  const ptsPrefix = `\\textit{(${pointsEach} pts)}~`;
  const lines = [];
  if (t === 'mc') {
    lines.push(`\\item ${ptsPrefix}${texEscape(stem)}`);
    lines.push('  \\begin{enumerate}[label=(\\alph*)]');
    for (const c of (q.children || [])) {
      const text = String(c.text || '').replace(/^[A-Z][.)]\s*/, '');
      lines.push(`    \\item ${texEscape(text)}`);
    }
    lines.push('  \\end{enumerate}');
    const ans = qAnswer(q).toString().trim().toLowerCase().replace(/[().]/g, '');
    lines.push(`  \\ifanswers \\textbf{Answer:} ${texEscape(ans || '?')} \\fi`);
  } else if (t === 'tf') {
    lines.push(`\\item ${ptsPrefix}\\textsc{T~/~F.}~${texEscape(stem)}`);
    const a = qAnswer(q).toString().trim().toUpperCase();
    const expanded = a.startsWith('T') ? 'True' : a.startsWith('F') ? 'False' : a || '?';
    lines.push(`  \\ifanswers \\textbf{Answer:} ${texEscape(expanded)} \\fi`);
  } else if (t === 'code') {
    lines.push(`\\item ${ptsPrefix}\\textsc{T~/~F.}~${texEscape(stem)}`);
    const code = qCode(q);
    if (code) {
      lines.push('\\begin{lstlisting}');
      lines.push(code);
      lines.push('\\end{lstlisting}');
    }
    const a = qAnswer(q).toString().trim().toUpperCase();
    const expanded = a.startsWith('T') ? 'True' : a.startsWith('F') ? 'False' : a || '?';
    lines.push(`  \\ifanswers \\textbf{Answer:} ${texEscape(expanded)} \\fi`);
  } else if (t === 'sa') {
    const a = qAnswer(q).toString().trim();
    const code = qCode(q);
    lines.push(`\\item \\needspace{2.5in} ${ptsPrefix}${texEscape(stem)}`);
    if (code) {
      lines.push('\\begin{lstlisting}');
      lines.push(code);
      lines.push('\\end{lstlisting}');
    }
    // Ruled writing lines instead of blank vertical space — handwriting
    // tracks straighter on photocopies, and the line count communicates
    // expected response length. ~5-7 lines per handwritten paragraph;
    // scale to roughly two paragraphs for a typical SA.
    const writeRules = Math.max(7, Math.min(16, Math.ceil(pointsEach * 0.9) + 3));
    lines.push(`  \\ifanswers \\par\\smallskip \\textit{Key:} ${texEscape(a || '(model answer — graded by rubric)')} \\else \\writelines{${writeRules}} \\fi`);
  } else {
    // unknown type — fall back to plain stem
    lines.push(`\\item ${ptsPrefix}${texEscape(stem)}`);
  }
  return lines.join('\n');
}

// Exam preamble — refined editorial / drafting-hybrid aesthetic.
// Design vocabulary: small caps section headings, hairline + thick double
// rules (letterpress convention), drafting-style metadata strip in title,
// manicule on directions, italic pts in parens (editorial pattern), italic
// "p. N" in running foot. All print-safe and B&W-photocopy resilient.
function examPreamble(headerLeft, headerRight) {
  return `\\documentclass[11pt]{article}
\\usepackage[margin=0.9in,top=0.7in,bottom=0.85in,headheight=14pt,headsep=14pt]{geometry}
\\usepackage[T1]{fontenc}
\\usepackage[utf8]{inputenc}

% --- Print-optimized font stack ---
\\usepackage{charter}                          % Bitstream Charter body
\\usepackage[scaled=0.92]{helvet}              % Helvetica-clone sans (metadata)
\\usepackage[scaled=0.95,varl]{inconsolata}    % Inconsolata mono, varl alt
\\renewcommand{\\familydefault}{\\rmdefault}
\\linespread{1.06}
\\frenchspacing

\\usepackage{enumitem}
\\usepackage{needspace}
\\usepackage[hyphens]{url}
\\usepackage[hidelinks]{hyperref}
\\usepackage{listings}
\\usepackage{microtype}
\\usepackage{fancyhdr}
\\usepackage{pifont}                           % Zapf Dingbats — manicule (\\ding{43})

% --- Running header + italic foot ---
% Header: italic small caps charter — feels editorial, not corporate.
% Foot: italic "p. N" — old-school typographic pagination.
\\pagestyle{fancy}
\\fancyhf{}
\\fancyhead[L]{\\textit{\\small ${texEscape(headerLeft)}}}
\\fancyhead[R]{\\textit{\\small ${texEscape(headerRight)}}}
\\fancyfoot[C]{\\textit{\\small p.~\\thepage}}
\\renewcommand{\\headrulewidth}{0.4pt}
\\renewcommand{\\footrulewidth}{0pt}

% --- Letterpress double rule (thick + thin, 2pt apart) ---
% Used under the title block and on the answer-key banner. The double rule
% is a centuries-old letterpress convention that signals "title above".
\\newcommand{\\doublerule}{%
  \\noindent\\rule{\\linewidth}{1.0pt}\\par\\vspace{1.5pt}%
  \\noindent\\rule{\\linewidth}{0.3pt}\\par}

% --- Drafting-style metadata strip ---
% Two-column key/value table in small caps for labels, charter for values.
% Hairline rule above and below; mimics an engineer's drawing title block
% without the heavy chrome.
\\newcommand{\\metastrip}[4]{%
  \\par\\noindent\\rule{\\linewidth}{0.3pt}\\par\\vspace{2pt}%
  \\noindent\\begin{minipage}{\\linewidth}%
  \\begin{tabbing}%
  \\hspace{6em}\\=\\hspace{16em}\\=\\hspace{6em}\\=\\kill%
  \\textsc{course}~~\\>#1\\>\\textsc{term}~~\\>#2\\\\[1pt]%
  \\textsc{exam}~~\\>#3\\>\\textsc{points}~~\\>#4%
  \\end{tabbing}%
  \\end{minipage}\\par\\vspace{-4pt}%
  \\noindent\\rule{\\linewidth}{0.3pt}\\par}

% --- Section-heading command for question groups ---
% Small caps + letterspaced for editorial gravitas; thin rule above. No bold,
% no sans — fits the Charter body voice.
\\newcommand{\\examsection}[1]{%
  \\par\\vspace{1.4em}%
  \\noindent\\rule{\\linewidth}{0.3pt}\\par\\vspace{2pt}%
  \\noindent{\\textsc{\\large #1}}%
  \\par\\vspace{0.4em}}

% --- Ornamental section break (between MC and SA) ---
% Three centered asterisks — \\textsection\\textsection\\textsection style.
% Used optionally; the section heading carries most of the work.
\\newcommand{\\examornament}{%
  \\par\\vspace{0.6em}\\begin{center}\\large $*$\\quad$*$\\quad$*$\\end{center}\\par}

% --- List metrics: editorial proportions, tightened ---
\\setlist[enumerate,1]{leftmargin=2.4em, itemsep=0.45em, topsep=0.45em, parsep=0pt, label=\\textbf{\\arabic*.}}
\\setlist[enumerate,2]{leftmargin=1.8em, itemsep=0pt, topsep=0.1em, parsep=0pt, label=(\\alph*)}

% --- Code blocks: hairline-rule top + bottom, no fill, no line numbers ---
% Line numbers were colliding with the leftline frame rule. Top/bottom hair
% rules read as a typographic "code" treatment (letterpress quote-rule
% convention) without competing with the number column, and short exam
% snippets don't need line-number anchors.
\\lstset{
  basicstyle=\\ttfamily\\small,
  breaklines=true,
  breakatwhitespace=true,
  columns=fullflexible,
  showstringspaces=false,
  numbers=none,
  tabsize=3,
  aboveskip=4mm,
  belowskip=4mm,
  frame=tb,
  framerule=0.4pt,
  framesep=6pt,
  xleftmargin=12pt,
  xrightmargin=12pt,
}

% --- Ruled writing lines for SA responses ---
\\newcounter{wl}
\\newcommand{\\writelines}[1]{%
  \\par\\vspace{0.4em}%
  \\setcounter{wl}{0}%
  \\loop\\ifnum\\value{wl}<#1%
    \\noindent\\rule[0.45em]{\\linewidth}{0.3pt}\\par\\vspace{0.30in}%
    \\stepcounter{wl}%
  \\repeat}

% --- Even-page padding for duplex printing ---
% Two-sided printing reality: an odd-page exam means the back of the last
% leaf is the front of the NEXT student's exam — bad. Pad with a blank
% verso when total page count is odd, with a discreet "intentionally left
% blank" notice (printers/instructors recognize the convention).
\\AtEndDocument{%
  \\clearpage%
  \\ifodd\\value{page}\\else%
    \\thispagestyle{plain}%
    \\null\\vfill%
    \\begin{center}\\textit{\\small This page intentionally left blank.}\\end{center}%
    \\vfill\\null%
  \\fi%
}

\\setlength{\\emergencystretch}{2em}
\\sloppy
`;
}

// Per-section heading text — small caps editorial style. Section names are
// short; the per-point detail is communicated by each question's own (N pts)
// prefix, so the heading itself stays uncluttered.
function sectionHeading(section) {
  if (section.type === 'mc') return 'Multiple Choice';
  if (section.type === 'sa') return 'Short Essay & Code Interpretation';
  if (section.type === 'tf') return 'True / False';
  return `${section.type[0].toUpperCase()}${section.type.slice(1)}`;
}

// Expand a term code (e.g. "sp26") to its human-readable form ("Spring 2026").
// Falls back to the raw value if the code doesn't match the known shape.
function expandTerm(termRaw) {
  if (!termRaw) return '';
  const m = /^(sp|fa|su|wi)(\d{2})$/i.exec(String(termRaw).trim());
  if (!m) return String(termRaw);
  const seasons = { sp: 'Spring', fa: 'Fall', su: 'Summer', wi: 'Winter' };
  const season = seasons[m[1].toLowerCase()] || m[1];
  const year = parseInt(m[2], 10);
  // Two-digit years: 70-99 → 19xx, 00-69 → 20xx (window matches the working
  // span of teaching artifacts in this vault).
  const fullYear = year >= 70 ? 1900 + year : 2000 + year;
  return `${season} ${fullYear}`;
}

function renderTex(spec, sectionPicks, isKey) {
  const termPretty = expandTerm(spec.term);
  const courseTitle = [
    spec.course || '',
    termPretty ? ` — ${termPretty}` : '',
    spec.name ? `: ${spec.name}` : '',
    spec.totalPoints ? ` (${spec.totalPoints} pts)` : '',
  ].join('').replace(/\s+/g, ' ').trim();

  // Running header pieces for fancyhdr.
  const headerLeft = [spec.course, termPretty].filter(Boolean).join(' · ');
  const headerRight = [spec.name, isKey ? 'KEY' : null].filter(Boolean).join(' — ');

  const out = [];
  out.push(examPreamble(headerLeft, headerRight));
  out.push('\\newif\\ifanswers');
  out.push(isKey ? '\\answerstrue' : '\\answersfalse');
  out.push('\\begin{document}');

  // --- Title block ---
  // 1. Drafting-style metadata strip (course/term/exam/points)
  // 2. Italic charter display title
  // 3. Letterpress double-rule (thick + thin)
  // 4. PROMINENT student-info block (heavy double-rule wrap, manicule callout,
  //    sans-bold uppercase labels, 0.8pt rules) — students MUST fill this in.
  // 5. (key only) ornamental answer-key banner
  const examTitle = spec.name || 'Exam';
  out.push(`\\metastrip{${texEscape(spec.course || '')}}{${texEscape(termPretty)}}{${texEscape(examTitle)}}{${texEscape(String(spec.totalPoints || ''))}}`);
  out.push('\\par\\vspace{0.4em}');
  out.push(`\\begin{center}{\\Large\\itshape ${texEscape(examTitle)}}\\end{center}`);
  out.push('\\par\\vspace{-0.2em}');
  out.push('\\doublerule');
  out.push('\\par\\vspace{0.9em}');

  // Student-info block — visually heaviest element on page 1 so the form
  // gets filled in. Heavy top + bottom rules bracket the area; manicule
  // attention header + sans-bold uppercase labels + 0.8pt rules make the
  // blanks unmissable.
  out.push('\\noindent\\rule{\\linewidth}{1.2pt}');
  out.push('\\par\\vspace{2pt}\\noindent\\rule{\\linewidth}{0.4pt}');
  out.push('\\par\\vspace{8pt}');
  out.push('\\noindent{\\sffamily\\bfseries\\small\\ding{43}~~PRINT CLEARLY. UNNAMED EXAMS CANNOT BE RETURNED OR GRADED.}');
  out.push('\\par\\vspace{14pt}');
  out.push('\\noindent{\\sffamily\\bfseries\\large NAME:}~\\rule[-3pt]{13.5cm}{0.8pt}');
  out.push('\\par\\vspace{16pt}');
  out.push('\\noindent{\\sffamily\\bfseries\\large STUDENT ID\\#:}~\\rule[-3pt]{5.5cm}{0.8pt}\\hfill{\\sffamily\\bfseries\\large DATE:}~\\rule[-3pt]{4cm}{0.8pt}');
  out.push('\\par\\vspace{10pt}');
  out.push('\\noindent\\rule{\\linewidth}{0.4pt}');
  out.push('\\par\\vspace{2pt}\\noindent\\rule{\\linewidth}{1.2pt}');
  out.push('\\par\\vspace{0.6em}');

  out.push('\\ifanswers\\par\\vspace{0.4em}\\begin{center}\\textsc{\\large $\\star$~~Answer Key~--~Not for Distribution~~$\\star$}\\end{center}\\fi');

  // --- Directions block (manicule + bold lead + italic body) ---
  out.push('\\par\\vspace{0.6em}');
  out.push('\\noindent\\ding{43}~\\textbf{Directions.}~\\textit{Write on the exam paper. No electronic devices allowed. Answer completely but as briefly as possible. All answers must be in your own words.}');
  out.push('\\par\\vspace{0.4em}');

  // Section groups: \examsection{} heading + numbered list with continuous
  // numbering across groups via enumitem's [resume] option.
  let resumed = false;
  for (const { section, picks } of sectionPicks) {
    if (!picks.length) continue;
    const heading = sectionHeading(section);
    out.push('');
    out.push(`\\examsection{${texEscape(heading)}}`);
    out.push(`\\begin{enumerate}${resumed ? '[resume]' : ''}`);
    for (const q of picks) {
      out.push(renderQuestionItem(q, section.pointsEach));
    }
    out.push('\\end{enumerate}');
    resumed = true;
  }

  out.push('\\par\\vfill');
  out.push('\\begin{center}\\small\\textit{End of exam.}\\end{center}');
  out.push('\\end{document}');
  return out.join('\n');
}

// --- public entry ---

export function generateExam(parsedDocs, spec, options = {}) {
  const warnings = [];
  // Term filter — accept on either spec or options. Spec takes precedence.
  const filterOptions = {
    semester: spec.semester ?? options.semester,
    strictSemester: spec.strictSemester ?? options.strictSemester,
    excludeTags: spec.excludeTags ?? options.excludeTags,
  };
  const pool = buildPool(parsedDocs, filterOptions);

  const randomize = !!spec.randomize;
  const rng = randomize ? mulberry32(Number(spec.randomSeed) >>> 0 || 1) : null;

  // Pick per-section, draining the pool so sections don't collide.
  const used = new Set();
  const sectionPicks = [];
  for (const section of (spec.sections || [])) {
    const remaining = pool.filter((q) => !used.has(q));
    const picks = pickSection(section, remaining, spec.weighting || {}, randomize, rng, warnings);
    for (const p of picks) used.add(p);
    sectionPicks.push({ section, picks });
  }

  const allPicks = sectionPicks.flatMap((sp) => sp.picks);

  // Total-points sanity
  const sectionSum = (spec.sections || []).reduce((s, sec) => s + sec.count * sec.pointsEach, 0);
  if (spec.totalPoints != null && sectionSum !== spec.totalPoints) {
    warnings.push(`total points mismatch: spec.totalPoints=${spec.totalPoints} but sections sum to ${sectionSum}`);
  }

  if (warnings.length > 0 && !options.silent) {
    for (const w of warnings) console.warn(`exam: ${w}`);
  }

  const examTex = renderTex(spec, sectionPicks, false);
  const keyTex = renderTex(spec, sectionPicks, true);

  // Mark-used pass — runs AFTER successful assembly. Idempotent.
  let markUsed = null;
  const markTerm = spec.markUsed || options.markUsed;
  if (markTerm) {
    markUsed = markUsedTag(parsedDocs, allPicks, markTerm, options);
  }

  return { examTex, keyTex, picked: allPicks, warnings, markUsed };
}

export default generateExam;
