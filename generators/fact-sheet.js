// Fact sheet: a one-page, student-facing reference card for each named case
// study in a lecture (a botnet, a breach, an outage). Unlike the Cornell
// handout it withholds nothing: it is the "what happened, when, how big, what
// to do about it" summary a student keeps after the case has been taught.
//
// Source schema (see references/style-guide.md § Fact Sheet):
//   #fact [case:: Mirai] [label:: Discovered] August 2016
//       → a row in that case's facts table (label | text)
//   #fact [case:: Mirai] [group:: Preventing infection] Change every default password.
//       → a bullet under that group's heading; add #steps to any item in the
//         group to number the whole group
//   #case-study [case:: Mirai] …   → the case's opening paragraph (first one wins)
//   [citation:: …] on any of them  → the case's Sources line, linked the same way
//                                    the exam reference sheet links them
//
// One case per page, in the order each case first appears in the source.
// #draft items are skipped, and the --semester / --strict-semester filters apply.

import { createRequire } from 'node:module';
import { applyTermFilter } from './_filter.js';
import { renderCitation, citationUrlMap } from './exam-reference-sheet.js';
const require = createRequire(import.meta.url);
const { texPreamble, texEscape, texDocHeader } = require('../lib/tex-helpers.js');

const DEFAULT_GROUP = 'Key points';

function field(item, k) {
  return (item.fields && item.fields.get && item.fields.get(k)) || '';
}

function live(items, opts) {
  return applyTermFilter(items || [], opts).filter((it) => !it.tags.has('draft'));
}

// Group the #fact items by [case::], keeping source order for cases, rows and
// groups alike. Items without a case are left to the validator, which rejects them.
export function collectCases(parsed, opts = {}) {
  const facts = live(parsed.byRole.get('fact'), opts)
    .slice().sort((a, b) => (a.sourceLine || 0) - (b.sourceLine || 0));
  const cases = new Map();
  for (const f of facts) {
    const name = field(f, 'case').trim();
    if (!name) continue;
    if (!cases.has(name)) cases.set(name, { name, intro: null, rows: [], groups: new Map(), cites: [] });
    const c = cases.get(name);
    const label = field(f, 'label').trim();
    if (label) {
      c.rows.push({ label, text: f.text });
    } else {
      const g = field(f, 'group').trim() || DEFAULT_GROUP;
      if (!c.groups.has(g)) c.groups.set(g, { items: [], numbered: false });
      const grp = c.groups.get(g);
      grp.items.push(f.text);
      if (f.tags.has('steps')) grp.numbered = true;
    }
    if (field(f, 'citation')) c.cites.push(field(f, 'citation'));
  }
  for (const cs of live(parsed.byRole.get('case-study'), opts)) {
    const c = cases.get(field(cs, 'case').trim());
    if (c && !c.intro) {
      c.intro = cs.text;
      if (field(cs, 'citation')) c.cites.unshift(field(cs, 'citation'));
    }
  }
  return [...cases.values()];
}

function sourcesLine(cites, citeOpts) {
  const seen = new Map();
  for (const raw of cites) {
    for (const part of String(raw).split(/\s*;\s*/)) {
      const r = renderCitation(part, citeOpts);
      if (r && !seen.has(r.key)) seen.set(r.key, r.md);
    }
  }
  return [...seen.values()].join(' · ');
}

function factsTable(rows) {
  if (!rows.length) return '';
  // \textcolor, not {\color …}: a \color switch at the start of a p{} cell
  // opens an empty line and drops the label below its detail.
  const body = rows
    .map((r) => `\\textcolor{instrNavy}{\\textbf{${texEscape(r.label)}}} & ${texEscape(r.text)} \\\\\\hline`)
    .join('\n');
  // Header row tagged /TH for PDF/UA (same group-scoped directive as texComparisonTable).
  return `
{\\tagpdfsetup{table/header-rows={1}}\\renewcommand{\\arraystretch}{1.3}%
\\noindent\\begin{tabularx}{\\linewidth}{|p{0.24\\linewidth}|X|}
\\hline
\\rowcolor{instrNavy}
\\textcolor{white}{\\textbf{Fact}} & \\textcolor{white}{\\textbf{Detail}} \\\\\\hline
${body}
\\end{tabularx}}
\\vspace{6pt}
`;
}

function groupBlock(name, grp) {
  const env = grp.numbered ? 'enumerate' : 'itemize';
  const items = grp.items.map((t) => `  \\item ${texEscape(t)}`).join('\n');
  return `
\\needspace{4\\baselineskip}
{\\color{instrNavy}\\textbf{${texEscape(name)}}}
\\begin{${env}}
${items}
\\end{${env}}
\\vspace{4pt}
`;
}

function caseBlock(c, course, citeOpts) {
  const out = [texDocHeader(c.name, 'Fact sheet', course)];
  if (c.intro) out.push(`${texEscape(c.intro)}\n\n\\vspace{6pt}`);
  out.push(factsTable(c.rows));
  for (const [name, grp] of c.groups) out.push(groupBlock(name, grp));
  const src = sourcesLine(c.cites, citeOpts);
  if (src) out.push(`\n\\vspace{2pt}\n{\\small\\textbf{Sources:} ${texEscape(src)}}\n`);
  return out.join('\n');
}

// Returns { tex, cases } — tex is null when the lecture has no #fact items, so
// the orchestrator can skip the artifact instead of writing an empty sheet.
export function generateFactSheet(parsed, opts = {}) {
  const cases = collectCases(parsed, opts);
  if (!cases.length) return { tex: null, cases: [] };
  const fm = parsed.frontmatter || {};
  const course = fm.course || '';
  const topic = fm.title || 'Case studies';
  const citeOpts = { citationUrls: citationUrlMap(fm) };
  const out = [
    texPreamble(`Fact sheet: ${topic}`, course, { fontSize: '11pt', margin: '0.75in' }),
    '\\begin{document}',
    cases.map((c) => caseBlock(c, course, citeOpts)).join('\n\\newpage\n'),
    '\\end{document}',
  ];
  return { tex: out.join('\n'), cases: cases.map((c) => c.name) };
}
