"use strict";

const { texEscape, toRoman } = require("./tex-helpers");

// Student handout palette — harmonized with instructor palette but distinct.
// Track colors anchor section identity; functional colors carry stable meaning
// across sections (yellow = fill-in, green = objectives, lavender = vocab,
// blue = summary). Hex values selected for WCAG AA contrast on white at body
// size and on tinted backgrounds at heading size.
const COLORS = {
  // Section track colors — used for banner fill, cue tint, and KEY accents.
  studNavy:    "1F3864",
  studTeal:    "0F766E",
  studAmber:   "B45309",
  studIndigo:  "4338CA",
  studGreen:   "15803D",
  studPurple:  "6D28D9",
  studRose:    "BE185D",

  // Stable functional colors — same meaning every section.
  studYellow:    "FEF9C3",
  studYellowDk:  "EAB308",
  studObjBg:     "F0FDF4",
  studObjAccent: "16A34A",
  studVocabBg:   "F5F3FF",
  studVocabAcc:  "7C3AED",
  studSummaryBg: "DBEAFE",
  studSummaryAcc:"2563EB",

  // Neutrals.
  studText:    "111827",
  studMuted:   "6B7280",
  studHair:    "E5E7EB",
};

// Section "kinds" map a semantic role to a track color and a matching cue-tint.
// Cue tints are very light variants of the track color so the cue column visually
// belongs to the section without overwhelming the notes column.
const SECTION_KINDS = {
  concept:      { color: "studNavy",   cueTint: "EFF6FF" },
  motivation:   { color: "studTeal",   cueTint: "F0FDFA" },
  synthesis:    { color: "studAmber",  cueTint: "FEF3C7" },
  strategy:     { color: "studIndigo", cueTint: "EEF2FF" },
  application:  { color: "studGreen",  cueTint: "F0FDF4" },
  "case-study": { color: "studPurple", cueTint: "F5F3FF" },
  pitfall:      { color: "studRose",   cueTint: "FFF1F2" },
};

const DEFAULT_KIND = "concept";

// Resolve a section's kind. Explicit `section.kind` wins; otherwise fall back to
// positional defaults — first section is "motivation" (set the stage), last is
// "synthesis" (wrap up), everything between is "concept". This keeps existing
// specs (no kind field) immediately meaningful while leaving room for explicit
// per-section overrides on new specs.
function resolveSectionKind(section, index, total) {
  if (section && section.kind && SECTION_KINDS[section.kind]) {
    return section.kind;
  }
  if (total >= 3) {
    if (index === 0) return "motivation";
    if (index === total - 1) return "synthesis";
  }
  if (total === 2) {
    if (index === 0) return "motivation";
    return "synthesis";
  }
  return DEFAULT_KIND;
}

function kindStyle(kind) {
  return SECTION_KINDS[kind] || SECTION_KINDS[DEFAULT_KIND];
}

// --- Preamble ---------------------------------------------------------------

function cornellPreamble(headerLeft, headerRight) {
  // PDF/UA-1 needs a document title in XMP (dc:title); derive from the header title.
  const pdfTitle = String(headerLeft || "Untitled").replace(/[\\{}]/g, "").trim() || "Untitled";
  const colorDefs = Object.entries(COLORS)
    .map(([name, hex]) => `\\definecolor{${name}}{HTML}{${hex}}`)
    .join("\n");

  // Cue-tint colors are referenced directly by the per-section table so we
  // declare each one as a named color too — keeps the call sites clean.
  const cueTintDefs = Object.entries(SECTION_KINDS)
    .map(([k, v]) => `\\definecolor{cueTint_${k.replace("-", "_")}}{HTML}{${v.cueTint}}`)
    .join("\n");

  // \DocumentMetadata enables LaTeX's PDF tagging (ADA Title II / WCAG 2.1 AA, issue #7).
  // MUST precede \documentclass; needs a tagging-capable TeX Live (≥2024; verified on TL2026).
  // The `table` module enables \tagpdfsetup{table/header-rows=…} → /TH header cells.
  // `pdfstandard=ua-1` + `pdfversion=1.7` declare PDF/UA-1 conformance and force the
  // PDF-1.7 header it requires (verified veraPDF-clean on TL2026).
  return `\\DocumentMetadata{lang=en-US,pdfstandard=ua-1,pdfversion=1.7,testphase={phase-III,table}}
\\documentclass[11pt]{article}
\\usepackage[margin=0.75in]{geometry}
\\usepackage[T1]{fontenc}
\\usepackage{lmodern}
\\usepackage[utf8]{inputenc}
\\usepackage{xcolor}
\\usepackage{colortbl}
\\usepackage{mdframed}
\\usepackage{tabularx}
\\usepackage{array}
\\usepackage{enumitem}
\\usepackage{fancyhdr}
\\usepackage{needspace}
\\usepackage[hidelinks]{hyperref}
\\hypersetup{pdftitle={${pdfTitle}},pdfdisplaydoctitle=true}
\\setlength{\\parskip}{2pt}
\\setlength{\\parindent}{0pt}

% Answer-key toggle. The same .tex compiles to two PDFs: the default below is
% the student handout (blank cells); the in-class answer key sets the flag true
% so every answers-branch reveals in red. generate.js writes the student file
% as-is and a second _key.tex with the directive on the next line flipped on.
% Keep this the sole occurrence of the false directive — the key build flips it
% with a global replace.
\\newif\\ifanswers
\\answersfalse

${colorDefs}
${cueTintDefs}

% --- Reusable boxed environments --------------------------------------------

% Learning Objectives — green left bar, light green fill.
\\newmdenv[
  topline=false,
  bottomline=false,
  rightline=false,
  linewidth=3pt,
  linecolor=studObjAccent,
  backgroundcolor=studObjBg,
  innerleftmargin=10pt,
  innerrightmargin=8pt,
  innertopmargin=6pt,
  innerbottommargin=6pt,
  skipabove=4pt,
  skipbelow=8pt,
  nobreak=true
]{cornellobjenv}

% Vocabulary frame — purple left bar, light lavender fill.
\\newmdenv[
  topline=false,
  bottomline=false,
  rightline=false,
  linewidth=3pt,
  linecolor=studVocabAcc,
  backgroundcolor=studVocabBg,
  innerleftmargin=10pt,
  innerrightmargin=8pt,
  innertopmargin=6pt,
  innerbottommargin=6pt,
  skipabove=4pt,
  skipbelow=8pt
]{cornellvocabenv}

% KEY callout — colored left bar (per-section), tinted body.
% The actual color is overridden per call via the [linecolor=...] option.
\\newmdenv[
  topline=false,
  bottomline=false,
  rightline=false,
  linewidth=3pt,
  linecolor=studNavy,
  backgroundcolor=studSummaryBg,
  innerleftmargin=10pt,
  innerrightmargin=8pt,
  innertopmargin=5pt,
  innerbottommargin=5pt,
  skipabove=6pt,
  skipbelow=4pt,
  nobreak=true
]{cornellkeyenv}

% Summary strip — blue top bar, light blue fill, generous interior space.
\\newmdenv[
  rightline=false,
  leftline=false,
  bottomline=false,
  topline=true,
  linewidth=3pt,
  linecolor=studSummaryAcc,
  backgroundcolor=studSummaryBg,
  innerleftmargin=12pt,
  innerrightmargin=12pt,
  innertopmargin=8pt,
  innerbottommargin=8pt,
  skipabove=10pt,
  skipbelow=6pt
]{cornellsummaryenv}

% --- Header / footer chrome -------------------------------------------------

\\pagestyle{fancy}
\\fancyhf{}
\\fancyhead[L]{\\small\\color{studNavy}\\textbf{${texEscape(headerLeft)}}}
\\fancyhead[R]{\\small\\color{studMuted}${texEscape(headerRight)}}
\\fancyfoot[L]{\\footnotesize\\color{studMuted}\\itshape Fill in during lecture}
\\fancyfoot[R]{\\footnotesize\\color{studMuted}Page \\thepage}
\\renewcommand{\\headrulewidth}{0.4pt}
\\renewcommand{\\footrulewidth}{0pt}

\\setlist[itemize]{noitemsep, topsep=2pt, leftmargin=1.4em, parsep=0pt}
\\setlist[enumerate]{noitemsep, topsep=2pt, leftmargin=1.4em, parsep=0pt}

\\setlength{\\emergencystretch}{2em}
\\setlength{\\arrayrulewidth}{0.4pt}
\\arrayrulecolor{studHair}
`;
}

// --- Title block ------------------------------------------------------------

function cornellTitleBlock(topic, courseLabel) {
  return `
{\\color{studNavy}\\LARGE\\textbf{${texEscape(topic)}}}\\hfill{\\normalsize\\color{studMuted}${texEscape(courseLabel)}}\\\\[0.2em]
{\\color{studNavy}\\rule{\\linewidth}{1.5pt}}
\\vspace{0.3em}
`;
}

function cornellInstructionLine(text) {
  return `
{\\small\\itshape\\color{studMuted}${texEscape(text)}}\\par\\vspace{0.6em}
`;
}

// Answer-key banner — only rendered in the \answerstrue (key) build so the
// instructor copy is unmistakable. Invisible in the student handout.
function cornellKeyBanner() {
  return `
\\ifanswers
\\begin{center}
{\\color{studRose}\\large\\textbf{*** ANSWER KEY --- INSTRUCTOR USE ONLY ***}}
\\end{center}
\\vspace{2pt}
\\fi
`;
}

// --- Learning Objectives box ------------------------------------------------

function cornellObjectivesBox(objectives) {
  if (!objectives || objectives.length === 0) return "";
  const items = objectives.map((o) => `  \\item ${texEscape(o)}`).join("\n");
  return `
\\begin{cornellobjenv}
{\\textbf{\\color{studObjAccent}Learning Objectives}}
\\begin{itemize}
${items}
\\end{itemize}
\\end{cornellobjenv}
`;
}

// --- Vocabulary grid: 2 columns of (term | blank) -------------------------

function cornellVocabGrid(terms) {
  if (!terms || terms.length === 0) return "";

  // Accept either the legacy string[] form (term only — the yellow cell stays
  // blank in the key too) or the {term, definition}[] form (definition revealed
  // in the yellow cell when compiled with \answerstrue).
  const normalized = terms.map((t) =>
    typeof t === "string"
      ? { term: t, definition: null }
      : { term: t.term, definition: t.definition || null }
  );

  // Two-column layout: split into halves, render each row as
  // (term1 | fill1 | term2 | fill2). If odd count, last row's right side empty.
  const half = Math.ceil(normalized.length / 2);
  const col1 = normalized.slice(0, half);
  const col2 = normalized.slice(half);
  while (col2.length < col1.length) col2.push(null);

  // Yellow fill cell. Term-only entries keep the exact bare-cell shape the
  // post-processor annotates with the literal _______ token; entries carrying a
  // definition use the \ifanswers toggle to reveal it in the key and embed the
  // token directly in the student (\else) branch so the audit invariant holds.
  function fillCell(entry) {
    if (!entry) return "";
    const space = "\\rule{0pt}{1.4em}";
    if (entry.definition) {
      const def = `\\textcolor{studRose}{\\textbf{${texEscape(entry.definition)}}}`;
      return `\\cellcolor{studYellow}{\\small \\ifanswers ${def}\\else ${space}\\iffalse _______ \\fi\\fi}`;
    }
    return `\\cellcolor{studYellow}${space}`;
  }

  const rows = col1
    .map((entryA, i) => {
      const entryB = col2[i];
      const cellA = `\\textbf{${texEscape(entryA.term)}}`;
      const cellAfill = fillCell(entryA);
      const cellB = entryB ? `\\textbf{${texEscape(entryB.term)}}` : "";
      const cellBfill = fillCell(entryB);
      return `${cellA} & ${cellAfill} & ${cellB} & ${cellBfill} \\\\`;
    })
    .join("\n");

  return `
\\begin{cornellvocabenv}
{\\textbf{\\color{studVocabAcc}Vocabulary} \\hfill {\\small\\color{studMuted}\\itshape fill in during lecture}}\\par\\vspace{4pt}
\\noindent\\renewcommand{\\arraystretch}{1.25}\\begin{tabularx}{\\linewidth}{@{}p{0.18\\linewidth}X@{\\hspace{8pt}}p{0.18\\linewidth}X@{}}
${rows}
\\end{tabularx}
\\end{cornellvocabenv}
`;
}

// --- Section banner ---------------------------------------------------------

function cornellSectionBanner(title, index, minutes, kind) {
  const style = kindStyle(kind);
  const roman = toRoman(index);
  const minuteStr = minutes ? ` \\textnormal{\\itshape (${minutes} min)}` : "";
  return `\\needspace{14\\baselineskip}
\\vspace{6pt}
\\begin{mdframed}[
  backgroundcolor=${style.color},
  linewidth=0pt,
  innertopmargin=5pt,
  innerbottommargin=5pt,
  innerleftmargin=10pt,
  innerrightmargin=10pt,
  skipabove=4pt,
  skipbelow=4pt,
  nobreak=true
]
{\\color{white}\\large\\textbf{${roman}. ${texEscape(title)}}${minuteStr ? `{\\color{white!85}${minuteStr.replace("\\textnormal{\\itshape", "\\textnormal{\\itshape ")}}` : ""}}
\\end{mdframed}
\\nopagebreak[4]
`;
}

// --- Cornell two-column table ----------------------------------------------

// rows: [{cue, notes, fillIn}]. fillIn=true → yellow notes cell with writing
// space; fillIn=false → scaffold (gray italic prompt).
//
// `kind` controls the cue column's tint and the cue text color so each section
// reads as visually contiguous.
function cornellTable(rows, kind, opts = {}) {
  if (!rows || rows.length === 0) return "";
  const style = kindStyle(kind);
  const cueTintName = `cueTint_${kind.replace("-", "_")}`;
  const cueTextColor = style.color;

  const body = rows
    .map(({ cue, notes, fillIn, answers }) => {
      const cueCell = `\\textbf{\\color{${cueTextColor}}${texEscape(cue)}}`;
      const notesCell = fillIn
        ? cornellFillCell(notes, { ...opts, answers })
        : `{\\color{studText}\\small ${texEscape(notes)}}`;
      return `${cueCell} & ${notesCell} \\\\\\hline`;
    })
    .join("\n");

  return `
\\noindent\\renewcommand{\\arraystretch}{1.35}\\arrayrulecolor{studHair}\\begin{tabularx}{\\linewidth}{@{}>{\\columncolor{${cueTintName}}}p{0.26\\linewidth}!{\\color{${style.color}}\\vrule width 2pt}X@{}}
\\hline
${body}
\\end{tabularx}
\\vspace{4pt}
`;
}

// Substitute red-bold answers into a (texEscape'd) template wherever runs of
// `\_` appear. Each `\_{2,}` run consumes one entry from the answers array, in
// order. Missing answers render as `?` so the gap is visually obvious in the
// key. Used only by the \answerstrue (key) branch of cornellFillCell.
function substituteAnswers(escapedTemplate, answers) {
  const list = Array.isArray(answers) ? answers : [answers];
  let i = 0;
  return escapedTemplate.replace(/(?:\\_){2,}/g, () => {
    const ans = list[i++];
    const display = ans === undefined ? "?" : texEscape(String(ans));
    return `\\textcolor{studRose}{\\textbf{${display}}}`;
  });
}

// Fill-in cell: yellow background. The same cell serves both PDFs via the
// \ifanswers toggle:
//   \answersfalse → student version: prompt + writing space (\else branch)
//   \answerstrue  → answer key:      prompt with answers substituted in red
// When opts.answers is absent, both branches fall back to writing space so an
// un-annotated blank still produces a usable (if unfilled) key.
//
// `opts.fillable` is reserved for a future feature that swaps the static
// writing space for an AcroForm \TextField (via hyperref). For now the option
// is accepted and ignored — keeps the call sites stable when we wire that up.
function cornellFillCell(text, opts = {}) {
  // Vertical writing space: ~2.6em so a student can comfortably handwrite or
  // type a 1–2 line answer. Tunable per call later if needed.
  const space = "\\par\\rule{0pt}{2.6em}";
  const escaped = texEscape(text);
  const keyBranch =
    opts.answers !== undefined && opts.answers !== null
      ? substituteAnswers(escaped, opts.answers)
      : `${escaped}${space}`;
  return `\\cellcolor{studYellow}{\\small \\ifanswers ${keyBranch}\\else ${escaped}${space}\\fi}`;
}

// --- KEY callout (per-section colored) -------------------------------------

function cornellKeyCallout(text, kind) {
  const style = kindStyle(kind);
  return `
\\begin{mdframed}[
  topline=false,
  bottomline=false,
  rightline=false,
  linewidth=3pt,
  linecolor=${style.color},
  backgroundcolor=${style.color}!8,
  innerleftmargin=10pt,
  innerrightmargin=8pt,
  innertopmargin=5pt,
  innerbottommargin=5pt,
  skipabove=6pt,
  skipbelow=4pt,
  nobreak=true
]
{\\textbf{\\color{${style.color}}KEY}}\\enspace ${texEscape(text)}
\\end{mdframed}
`;
}

// --- Comparison table (per-section header color) ---------------------------

function cornellComparisonTable(headers, rows, kind) {
  if (!headers || headers.length === 0) return "";
  const style = kindStyle(kind);
  const n = headers.length;
  const colSpec = "|" + Array(n).fill("X").join("|") + "|";

  const headerRow = headers
    .map((h) => `\\textcolor{white}{\\textbf{\\small ${texEscape(h)}}}`)
    .join(" & ");

  const dataRows = (rows || [])
    .map((row, idx) => {
      const cells = row.slice(0, n);
      while (cells.length < n) cells.push("");
      const tinted = idx % 2 === 1;
      const rowColor = tinted ? `\\rowcolor{studHair!40}` : "";
      const body = cells.map((c) => `\\small ${texEscape(c)}`).join(" & ");
      return `${rowColor}${body} \\\\\\hline`;
    })
    .join("\n");

  // Group-scoped header-rows tagging marks row 1 as /TH (ADA Title II, issue #7);
  // the {…} keeps it local so the Cornell two-column *layout* table — which has no
  // header row — keeps its cells as /TD (verified no-leak via pikepdf).
  return `
\\vspace{4pt}
{\\tagpdfsetup{table/header-rows={1}}%
\\noindent\\arrayrulecolor{studHair}\\begin{tabularx}{\\linewidth}{${colSpec}}
\\hline
\\rowcolor{${style.color}}
${headerRow} \\\\\\hline
${dataRows}
\\end{tabularx}}
\\vspace{4pt}
`;
}

// --- Summary strip ---------------------------------------------------------

function cornellSummaryStrip() {
  return `
\\vspace{8pt}
\\begin{cornellsummaryenv}
{\\textbf{\\color{studSummaryAcc}Summary} — write 3 key ideas in your own words after class.}
\\par\\vspace{4pt}
1.\\enspace\\rule[-2pt]{0.95\\linewidth}{0.4pt}\\par\\vspace{8pt}
2.\\enspace\\rule[-2pt]{0.95\\linewidth}{0.4pt}\\par\\vspace{8pt}
3.\\enspace\\rule[-2pt]{0.95\\linewidth}{0.4pt}\\par\\vspace{2pt}
\\end{cornellsummaryenv}
`;
}

// --- References ------------------------------------------------------------

function cornellReferences(refs) {
  if (!refs || refs.length === 0) return "";
  const items = refs
    .map((r) => `  \\item {\\footnotesize\\color{studMuted}${texEscape(r)}}`)
    .join("\n");
  return `
\\vspace{6pt}
{\\small\\textbf{\\color{studNavy}References}}
\\begin{itemize}
${items}
\\end{itemize}
`;
}

module.exports = {
  COLORS,
  SECTION_KINDS,
  resolveSectionKind,
  kindStyle,
  cornellPreamble,
  cornellTitleBlock,
  cornellInstructionLine,
  cornellKeyBanner,
  cornellObjectivesBox,
  cornellVocabGrid,
  cornellSectionBanner,
  cornellTable,
  cornellFillCell,
  substituteAnswers,
  cornellKeyCallout,
  cornellComparisonTable,
  cornellSummaryStrip,
  cornellReferences,
};
