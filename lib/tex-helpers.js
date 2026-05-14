"use strict";

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Instructor palette — fast-glance optimized, saturated for print
const COLORS = {
  instrNavy:      "1F3864",
  instrTeal:      "0D9488",
  instrAmber:     "D97706",
  instrIndigo:    "4F46E5",
  instrGreen:     "15803D",
  instrOrange:    "C2410C",
  instrKeyBody:   "DBEAFE",
  instrAskBody:   "EEF2FF",
  instrDemoBody:  "DCFCE7",
  instrThesisBody:"FFEDD5",
};

const CALLOUT_CONFIG = {
  KEY:   { badge: "instrNavy",   body: "instrKeyBody",    bodyText: "instrNavy" },
  ASK:   { badge: "instrIndigo", body: "instrAskBody",    bodyText: "instrIndigo" },
  DEMO:  { badge: "instrGreen",  body: "instrDemoBody",   bodyText: "instrGreen" },
  THESIS:{ badge: "instrOrange", body: "instrThesisBody", bodyText: "instrOrange" },
};

const ROMAN = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII","XIII","XIV","XV"];

// Common Unicode chars that source markdown carries but default pdflatex
// inputenc cannot render. Mapped to plain-text or LaTeX-math equivalents.
// Run AFTER texEscape so emitted backslashes/braces/dollars don't get
// double-escaped.
function postEscapeUnicode(str) {
  // Coalesce superscript runs (e.g. "10⁻¹⁴" → "$10^{-14}$") so the exponent
  // typesets as a single math group.
  const SUP_DIGIT = { "⁰":"0","¹":"1","²":"2","³":"3","⁴":"4","⁵":"5","⁶":"6","⁷":"7","⁸":"8","⁹":"9" };
  const SUB_DIGIT = { "₀":"0","₁":"1","₂":"2","₃":"3","₄":"4","₅":"5","₆":"6","₇":"7","₈":"8","₉":"9" };
  const SCALARS = {
    "±": "$\\pm$",
    "≠": "$\\neq$",
    "≤": "$\\leq$",
    "≥": "$\\geq$",
    "≈": "$\\approx$",
    "≡": "$\\equiv$",
    "×": "$\\times$",
    "÷": "$\\div$",
    "·": "$\\cdot$",
    "∞": "$\\infty$",
    "→": "$\\rightarrow$",
    "←": "$\\leftarrow$",
    "↔": "$\\leftrightarrow$",
    "⇒": "$\\Rightarrow$",
    "⇐": "$\\Leftarrow$",
    "⇔": "$\\Leftrightarrow$",
    "…": "\\ldots{}",
    "−": "$-$",
    "°": "$^{\\circ}$",
    "√": "$\\surd$",
    "∂": "$\\partial$",
    "∇": "$\\nabla$",
    "∫": "$\\int$",
    "∑": "$\\sum$",
    "∏": "$\\prod$",
    "∈": "$\\in$",
    "∉": "$\\notin$",
    "⊂": "$\\subset$",
    "⊆": "$\\subseteq$",
    "⊕": "$\\oplus$",
    "⊗": "$\\otimes$",
    "∧": "$\\wedge$",
    "∨": "$\\vee$",
    "¬": "$\\neg$",
    "∀": "$\\forall$",
    "∃": "$\\exists$",
    // Lowercase Greek
    "α": "$\\alpha$",
    "β": "$\\beta$",
    "γ": "$\\gamma$",
    "δ": "$\\delta$",
    "ε": "$\\varepsilon$",
    "ζ": "$\\zeta$",
    "η": "$\\eta$",
    "θ": "$\\theta$",
    "ι": "$\\iota$",
    "κ": "$\\kappa$",
    "λ": "$\\lambda$",
    "μ": "$\\mu$",
    "ν": "$\\nu$",
    "ξ": "$\\xi$",
    "π": "$\\pi$",
    "ρ": "$\\rho$",
    "σ": "$\\sigma$",
    "τ": "$\\tau$",
    "υ": "$\\upsilon$",
    "φ": "$\\varphi$",
    "χ": "$\\chi$",
    "ψ": "$\\psi$",
    "ω": "$\\omega$",
    // Uppercase Greek (LaTeX only defines the ones distinct from Latin)
    "Γ": "$\\Gamma$",
    "Δ": "$\\Delta$",
    "Θ": "$\\Theta$",
    "Λ": "$\\Lambda$",
    "Ξ": "$\\Xi$",
    "Π": "$\\Pi$",
    "Σ": "$\\Sigma$",
    "Υ": "$\\Upsilon$",
    "Φ": "$\\Phi$",
    "Ψ": "$\\Psi$",
    "Ω": "$\\Omega$",
  };
  let out = "";
  let i = 0;
  while (i < str.length) {
    const ch = str[i];
    if (SUP_DIGIT[ch] || ch === "⁻" || ch === "⁺") {
      let group = "";
      if (ch === "⁻") { group += "-"; i++; }
      else if (ch === "⁺") { group += "+"; i++; }
      while (i < str.length && SUP_DIGIT[str[i]]) {
        group += SUP_DIGIT[str[i]];
        i++;
      }
      out += `$^{${group}}$`;
      continue;
    }
    if (SUB_DIGIT[ch]) {
      let group = "";
      while (i < str.length && SUB_DIGIT[str[i]]) {
        group += SUB_DIGIT[str[i]];
        i++;
      }
      out += `$_{${group}}$`;
      continue;
    }
    if (SCALARS[ch]) {
      out += SCALARS[ch];
      i++;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

// Escape a single char for LaTeX text mode.
function escapeChar(ch) {
  switch (ch) {
    case "\\": return "\\textbackslash{}";
    case "&":  return "\\&";
    case "%":  return "\\%";
    case "$":  return "\\$";
    case "#":  return "\\#";
    case "_":  return "\\_";
    case "{":  return "\\{";
    case "}":  return "\\}";
    case "~":  return "\\textasciitilde{}";
    case "^":  return "\\textasciicircum{}";
    default:   return ch;
  }
}

function escapeForText(s) {
  return String(s).replace(/[\\&%$#_{}~^]/g, escapeChar);
}

// Inside \texttt{} (inline code) we want code to look like code, not have
// escape sequences that read awkwardly. Strategy: still escape LaTeX-active
// chars (\, $, &, %, #, _, {, }, ^), but leave them readable. A backslash
// followed by a printable char (e.g. "\n") in a code context is almost
// always a C-style escape, not a LaTeX backslash; we render it as a
// literal \n inside \texttt by using \char92 for the visual backslash.
function escapeForCode(s) {
  return String(s)
    // Render literal backslash as a visible "\" inside ttfamily without
    // pulling in \textbackslash{} (which renders as a tilde-shaped glyph
    // in some fonts and reads worse than the simple ASCII backslash).
    .replace(/\\/g, "\\char`\\\\{}")
    .replace(/[&%$#_{}~^]/g, escapeChar);
}

// Render a plain-text run (no code/bold/italic markup): apply LaTeX text-mode
// escaping THEN convert markdown emphasis. Bold (**...**) → \textbf{...},
// italic (*...* and _..._) → \textit{...}. We process bold first so the
// stricter pattern wins; then italic on whatever remains. Underscore italic
// runs after underscores have been escaped to "\_", so the regex looks for
// "\_..._\" — but that's brittle, so we process underscore italics BEFORE
// escaping. Practical sequence:
//   1. Convert **bold** → BOLD_OPEN…BOLD_CLOSE sentinels
//   2. Convert *italic* → ITAL_OPEN…ITAL_CLOSE sentinels
//   3. Convert _italic_ → ITAL_OPEN…ITAL_CLOSE sentinels
//   4. LaTeX-escape the result (sentinels survive because they are ASCII)
//   5. Replace sentinels with \textbf{ / \textit{ / }
const BOLD_OPEN = "";
const BOLD_CLOSE = "";
const ITAL_OPEN = "";
const ITAL_CLOSE = "";

function applyMarkdownEmphasis(s) {
  // **bold** — non-greedy; do not match across newlines
  let out = s.replace(/\*\*([^*\n][^*\n]*?)\*\*/g, (_, inner) => `${BOLD_OPEN}${inner}${BOLD_CLOSE}`);
  // *italic* — single asterisks, not at edges of bold (already consumed),
  // not adjacent whitespace constraint to avoid eating math/printf-style "* "
  out = out.replace(/(^|[^*\w])\*([^*\n][^*\n]*?)\*(?=[^*\w]|$)/g, (_, lead, inner) => `${lead}${ITAL_OPEN}${inner}${ITAL_CLOSE}`);
  // _italic_ — same boundary discipline; underscores in identifiers like
  // "foo_bar" do not get matched because the inner cannot contain another _.
  out = out.replace(/(^|[^_\w])_([^_\n][^_\n]*?)_(?=[^_\w]|$)/g, (_, lead, inner) => `${lead}${ITAL_OPEN}${inner}${ITAL_CLOSE}`);
  return out;
}

function renderPlainText(s) {
  const marked = applyMarkdownEmphasis(s);
  const escaped = escapeForText(marked);
  return escaped
    .replace(new RegExp(BOLD_OPEN, "g"), "\\textbf{")
    .replace(new RegExp(BOLD_CLOSE, "g"), "}")
    .replace(new RegExp(ITAL_OPEN, "g"), "\\textit{")
    .replace(new RegExp(ITAL_CLOSE, "g"), "}");
}

// Convert a markdown body to LaTeX text. Inline code spans (`like this`)
// become \texttt{...} with code-mode escaping; bold (**…**) and italic
// (*…* / _…_) become \textbf{}/\textit{}; everything else is plain text.
// Triple-backtick fences are NOT handled here — the parser captures them
// as a separate `code` field; question stems should not carry fences.
function texEscape(str) {
  const src = String(str || "");
  let out = "";
  let i = 0;
  while (i < src.length) {
    if (src[i] === "`") {
      const close = src.indexOf("`", i + 1);
      if (close === -1) {
        out += renderPlainText(src.slice(i));
        i = src.length;
      } else {
        const code = src.slice(i + 1, close);
        out += `\\texttt{${escapeForCode(code)}}`;
        i = close + 1;
      }
      continue;
    }
    const next = src.indexOf("`", i);
    const end = next === -1 ? src.length : next;
    out += renderPlainText(src.slice(i, end));
    i = end;
  }
  return postEscapeUnicode(out);
}

function toRoman(index) {
  if (index >= ROMAN.length) {
    console.warn(`tex-helpers: section index ${index} exceeds Roman numeral table, using Arabic`);
    return String(index + 1);
  }
  return ROMAN[index];
}

function texPreamble(headerLeft, headerRight, opts = {}) {
  const fontSize = opts.fontSize || "12pt";
  const margin = opts.margin || "1in";
  // tightSpacing: suppress parskip's inter-paragraph stretch for dense layouts
  const spacingSetup = opts.tightSpacing
    ? `\\setlength{\\parskip}{1pt}\\setlength{\\parindent}{0pt}`
    : `\\usepackage{parskip}`;
  const colorDefs = Object.entries(COLORS)
    .map(([name, hex]) => `\\definecolor{${name}}{HTML}{${hex}}`)
    .join("\n");

  return `\\documentclass[${fontSize}]{article}
\\usepackage[margin=${margin}]{geometry}
\\usepackage[T1]{fontenc}
\\usepackage[utf8]{inputenc}
\\usepackage{xcolor}
\\usepackage{colortbl}
\\usepackage{mdframed}
\\usepackage{booktabs}
\\usepackage{tabularx}
\\usepackage{enumitem}
\\usepackage{fancyhdr}
\\usepackage[hyphens]{url}
\\usepackage[hidelinks]{hyperref}
\\usepackage{listings}
\\usepackage{array}
\\usepackage{needspace}
${spacingSetup}

${colorDefs}

% Talking points — full-width stacked box (used by non-briefing generators)
\\newmdenv[
  backgroundcolor=instrAmber!15,
  linecolor=instrAmber,
  linewidth=2pt,
  innerleftmargin=8pt,
  innerrightmargin=8pt,
  innertopmargin=6pt,
  innerbottommargin=6pt,
  skipabove=8pt,
  skipbelow=4pt
]{talkingpointsenv}

% Talking points — compact left-bar style for briefing/quick-ref layout
\\newmdenv[
  topline=false,
  bottomline=false,
  rightline=false,
  linewidth=3pt,
  linecolor=instrAmber,
  backgroundcolor=instrAmber!8,
  innerleftmargin=8pt,
  innerrightmargin=6pt,
  innertopmargin=4pt,
  innerbottommargin=4pt,
  skipabove=4pt,
  skipbelow=4pt
]{talkingbarenv}

% Hook block - teal, "start here"
\\newmdenv[
  backgroundcolor=instrTeal!15,
  linecolor=instrTeal,
  linewidth=2pt,
  innerleftmargin=8pt,
  innerrightmargin=8pt,
  innertopmargin=6pt,
  innerbottommargin=6pt,
  skipabove=8pt,
  skipbelow=4pt,
  nobreak=true
]{hookenv}

\\pagestyle{fancy}
\\fancyhf{}
\\fancyhead[L]{\\small\\textbf{${texEscape(headerLeft)}}}
\\fancyhead[R]{\\small\\textbf{${texEscape(headerRight)}}}
\\fancyfoot[C]{\\small Page \\thepage}
\\renewcommand{\\headrulewidth}{0.4pt}

\\setlist[itemize]{noitemsep, topsep=3pt, leftmargin=1.4em, parsep=0pt}
\\setlist[enumerate]{noitemsep, topsep=3pt, leftmargin=1.4em, parsep=0pt}

\\lstset{
  basicstyle=\\ttfamily\\small,
  backgroundcolor=\\color{black!5},
  frame=single,
  framesep=4pt,
  breaklines=true,
  columns=flexible,
}

% Allow extra inter-word stretch to prevent overfull hboxes for long URLs/words
\\setlength{\\emergencystretch}{2em}
`;
}

function texDocHeader(title, subtitle, course) {
  return `
{\\color{instrNavy}\\LARGE\\textbf{${texEscape(title)}}}\\\\[0.3em]
{\\large\\textit{${texEscape(subtitle)}}}\\\\[0.1em]
{\\normalsize ${texEscape(course)}}\\\\[0.5em]
{\\color{instrNavy}\\rule{\\linewidth}{1.5pt}}
\\vspace{0.5em}
`;
}

function texSectionRule(title, index) {
  const roman = toRoman(index);
  return `
\\needspace{5\\baselineskip}
\\vspace{0.8em}
\\noindent{\\color{instrNavy}\\rule{\\linewidth}{1.5pt}}\\par\\nopagebreak[4]%
{\\color{instrNavy}\\large\\textbf{${roman}. ${texEscape(title)}}}\\par\\nopagebreak[4]%
\\noindent{\\color{instrNavy}\\rule{\\linewidth}{0.4pt}}
\\vspace{0.3em}
`;
}

function texPlainSection(title) {
  return `
\\needspace{4\\baselineskip}
\\vspace{0.8em}
\\noindent{\\color{instrNavy}\\rule{\\linewidth}{1.5pt}}\\par\\nopagebreak[4]%
{\\color{instrNavy}\\large\\textbf{${texEscape(title)}}}\\par\\nopagebreak[4]%
\\noindent{\\color{instrNavy}\\rule{\\linewidth}{0.4pt}}
\\vspace{0.3em}
`;
}

function texHook(text) {
  return `
\\begin{hookenv}
{\\textbf{\\color{instrTeal}[ HOOK --- open with this story ]}}\\\\[4pt]
${texEscape(text)}
\\end{hookenv}
`;
}

function texTalkingPoints(items) {
  if (!items || items.length === 0) return "";
  const itemLines = items.map((item) => `  \\item ${texEscape(item)}`).join("\n");
  return `
\\begin{talkingpointsenv}
{\\textbf{\\color{instrAmber}[ TALKING POINTS ]}}
\\begin{itemize}
${itemLines}
\\end{itemize}
\\end{talkingpointsenv}
`;
}

function texCallout(label, text) {
  if (!CALLOUT_CONFIG[label]) {
    console.warn(`tex-helpers: unknown callout label "${label}", falling back to KEY`);
  }
  const style = CALLOUT_CONFIG[label] || CALLOUT_CONFIG.KEY;
  return `
\\begin{mdframed}[
  backgroundcolor=${style.body}!60,
  linecolor=${style.badge},
  linewidth=2pt,
  innerleftmargin=8pt,
  innertopmargin=6pt,
  innerbottommargin=6pt,
  skipabove=6pt,
  skipbelow=4pt,
  nobreak=true
]
{\\textbf{\\color{${style.badge}}[${texEscape(label)}]}}\\enspace ${texEscape(text)}
\\end{mdframed}
`;
}

function texComparisonTable(headers, rows) {
  const n = headers.length;
  const colSpec = "|" + Array(n).fill("X").join("|") + "|";
  const headerRow = headers
    .map((h) => `\\textcolor{white}{\\textbf{${texEscape(h)}}}`)
    .join(" & ");
  const dataRows = rows
    .map((row) => {
      const cells = row.slice(0, n);
      while (cells.length < n) cells.push("");
      return cells.map((cell) => texEscape(cell)).join(" & ") + " \\\\\\hline";
    })
    .join("\n");
  return `
\\vspace{4pt}
\\noindent\\begin{tabularx}{\\linewidth}{${colSpec}}
\\hline
\\rowcolor{instrNavy}
${headerRow} \\\\\\hline
${dataRows}
\\end{tabularx}
\\vspace{4pt}
`;
}

// Escape str for LaTeX, but detect bare URLs and wrap them in \url{} so the
// url package can break them at safe characters (hyphens, slashes, etc.).
function texEscapeWithUrls(str) {
  const parts = String(str || "").split(/(https?:\/\/[^\s]+)/);
  return parts.map((part, i) => (i % 2 === 1 ? `\\url{${part}}` : texEscape(part))).join("");
}

function texBulletList(items) {
  if (!items || items.length === 0) return "";
  return `\\begin{itemize}\n${items.map((item) => `  \\item ${texEscapeWithUrls(item)}`).join("\n")}\n\\end{itemize}\n`;
}

function texCodeBlock(lines, lang) {
  const langOpt = lang ? `language=${lang},` : "";
  return `\\begin{lstlisting}[${langOpt}frame=single]\n${lines.join("\n")}\n\\end{lstlisting}\n`;
}

// Dense quick-ref briefing layout for a single lecture section.
// Navy filled header strip for instant visual anchoring.
// Bullet points followed by a compact left-bar amber talking-points block.
// Single column — no minipages, no overflow.
function texBriefingSection(title, index, minutes, overview, points, talkingPoints) {
  const roman = toRoman(index);
  const minuteStr = minutes ? ` (${minutes} min)` : "";
  const hasTP = talkingPoints && talkingPoints.length > 0;
  const hasPoints = points && points.length > 0;

  const parts = [];

  // Navy filled header strip — snaps to section on fast glance
  parts.push(`\\needspace{5\\baselineskip}
\\vspace{5pt}
\\begin{mdframed}[
  backgroundcolor=instrNavy,
  linewidth=0pt,
  innertopmargin=4pt,
  innerbottommargin=4pt,
  innerleftmargin=7pt,
  innerrightmargin=7pt,
  skipabove=4pt,
  skipbelow=0pt,
  nobreak=true
]
{\\color{white}\\textbf{\\normalsize ${roman}. ${texEscape(title)}${texEscape(minuteStr)}}}
\\end{mdframed}
\\nopagebreak[4]`);

  // Overview — navy italic, visually quieter than body points
  if (overview) {
    parts.push(`\\noindent{\\small\\color{instrNavy}\\itshape ${texEscape(overview)}}\\par\\nopagebreak[4]`);
  }

  // Content bullet points
  if (hasPoints) {
    const ptItems = points.map((pt) => `  \\item ${texEscape(pt)}`).join("\n");
    parts.push(`\\begin{itemize}[noitemsep,topsep=2pt,leftmargin=1.4em,parsep=0pt]\n${ptItems}\n\\end{itemize}`);
  }

  // Talking points — amber left-bar, compact and tight
  if (hasTP) {
    const tpItems = talkingPoints.map((tp) => `  \\item ${texEscape(tp)}`).join("\n");
    parts.push(`\\begin{talkingbarenv}
{\\small\\textbf{\\color{instrAmber}TALKING POINTS}}
{\\small
\\begin{itemize}[noitemsep,topsep=2pt,leftmargin=1.2em,parsep=0pt]
${tpItems}
\\end{itemize}
}
\\end{talkingbarenv}`);
  }

  return parts.join("\n");
}

function compileLatex(texPath, outputDir) {
  const args = ["-interaction=nonstopmode", "-output-directory", outputDir, texPath];
  spawnSync("pdflatex", args, { stdio: "ignore" });
  spawnSync("pdflatex", args, { stdio: "ignore" }); // second pass for refs
  const pdfPath = path.join(outputDir, path.basename(texPath).replace(/\.tex$/, ".pdf"));
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`pdflatex did not produce a PDF: ${pdfPath}. Check the .tex file for errors.`);
  }
  return pdfPath;
}

module.exports = {
  compileLatex,
  texBriefingSection,
  texBulletList,
  texCallout,
  texCodeBlock,
  texComparisonTable,
  texDocHeader,
  texEscape,
  texHook,
  texPlainSection,
  texPreamble,
  texSectionRule,
  texTalkingPoints,
  toRoman,
};
