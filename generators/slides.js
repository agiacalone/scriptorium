// Slides generator — Beamer LaTeX deck.
// Walks parsed.byRole.get('slide') in source order, dispatching each item
// to a per-layout renderer. Writes a Beamer .tex file and runs pdflatex
// twice to produce the .pdf (clean projection — no notes by default; the
// .tex source contains \note{} blocks so a future --with-notes flag can
// re-render the deck for instructor reference).
//
// Layout dispatch (11 layouts): title, agenda, concept, split, code, diagram,
// vocab, case-study, key, summary, section-divider.
//
// Palette (matches references/style-guide.md):
//   slatebg    #0F172A  background
//   slatefg    #F1F5F9  primary text
//   indigo     #6366F1  frametitles, dividers, accent stripe
//   amber      #F59E0B  key callouts, highlights
//   slatemuted #94A3B8  secondary text / footers
//
// Humanize warnings (returned in result):
//   - ≥4 consecutive same-layout slides
//   - deck lacks a [layout:: key] pacing pause
//   - deck lacks a [layout:: summary] closing slide
//   - any single slide stays denser than 6 bullets after auto-split
//   - title slide missing [tagline::] (soft note, not warning category)
//
// concept-layout density: >6 children → split into continuation slides
// titled "<title> (cont.)" with the remaining children, in groups of 6.

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { applyTermFilter } from './_filter.js';

const require = createRequire(import.meta.url);
const { compileLatex } = require('../lib/tex-helpers.js');

const KNOWN_LAYOUTS = new Set([
  'title', 'agenda', 'concept', 'split', 'code', 'diagram',
  'vocab', 'case-study', 'key', 'summary', 'section-divider',
]);

// ─── tex escaping ──────────────────────────────────────────────────────────

function texEscape(str) {
  return String(str || '').replace(/[\\&%$#_{}~^]/g, (ch) => {
    switch (ch) {
      case '\\': return '\\textbackslash{}';
      case '&':  return '\\&';
      case '%':  return '\\%';
      case '$':  return '\\$';
      case '#':  return '\\#';
      case '_':  return '\\_';
      case '{':  return '\\{';
      case '}':  return '\\}';
      case '~':  return '\\textasciitilde{}';
      case '^':  return '\\textasciicircum{}';
    }
  });
}

// Strip leading **bold** marker from item.text, returning { title, rest }.
function splitBoldTitle(text) {
  const m = /^\*\*(.+?)\*\*\s*(.*)$/s.exec(text || '');
  if (m) return { title: m[1].trim(), rest: m[2].trim() };
  return { title: (text || '').trim(), rest: '' };
}

function childTexts(item) {
  return (item.children || []).map((c) => c.text);
}

// ─── preamble ──────────────────────────────────────────────────────────────

function buildPreamble(parsed) {
  const fm = parsed.frontmatter || {};
  const docTitle = texEscape(fm.title || 'Lecture');
  const meta = [fm.course, fm.term].filter(Boolean).map(texEscape).join(' \\textperiodcentered\\ ');
  const subtitle = meta ? `\\subtitle{${meta}}` : '';

  return `\\documentclass[aspectratio=169,11pt]{beamer}
\\usepackage[T1]{fontenc}
\\usepackage[utf8]{inputenc}
\\usepackage{xcolor}
\\usepackage{listings}

% Palette — slate / indigo / amber from references/style-guide.md
\\definecolor{slatebg}{HTML}{0F172A}
\\definecolor{slatefg}{HTML}{F1F5F9}
\\definecolor{slatemuted}{HTML}{94A3B8}
\\definecolor{slatepanel}{HTML}{1E293B}
\\definecolor{indigo}{HTML}{6366F1}
\\definecolor{amber}{HTML}{F59E0B}

% Theme — hand-rolled, no Beamer outer-theme chrome
\\usefonttheme{professionalfonts}
\\useinnertheme{rectangles}
\\setbeamertemplate{navigation symbols}{}
\\setbeamertemplate{footline}{%
  \\hbox{%
    \\hspace*{0.6em}{\\color{slatemuted}\\tiny\\insertshorttitle}\\hfill%
    {\\color{slatemuted}\\tiny\\insertframenumber\\,/\\,\\inserttotalframenumber}\\hspace*{0.6em}%
  }%
  \\vspace*{0.3em}%
}

\\setbeamercolor{normal text}{fg=slatefg, bg=slatebg}
\\setbeamercolor{background canvas}{bg=slatebg}
\\setbeamercolor{frametitle}{fg=indigo, bg=slatebg}
\\setbeamercolor{title}{fg=indigo, bg=slatebg}
\\setbeamercolor{subtitle}{fg=slatemuted, bg=slatebg}
\\setbeamercolor{author}{fg=slatemuted, bg=slatebg}
\\setbeamercolor{itemize item}{fg=indigo}
\\setbeamercolor{itemize subitem}{fg=indigo}
\\setbeamercolor{itemize subsubitem}{fg=indigo}
\\setbeamercolor{enumerate item}{fg=indigo}
\\setbeamercolor{section in head/navigation}{fg=slatemuted}
\\setbeamercolor{block title}{fg=slatefg, bg=indigo}
\\setbeamercolor{block body}{fg=slatefg, bg=slatepanel}
\\setbeamercolor{caption name}{fg=indigo}

\\setbeamerfont{frametitle}{series=\\bfseries, size=\\large}
\\setbeamerfont{title}{series=\\bfseries, size=\\Large}

% Indigo accent stripe under each frametitle
\\setbeamertemplate{frametitle}{%
  \\nointerlineskip%
  \\vspace*{0.5em}%
  \\hspace*{0.6em}{\\usebeamercolor[fg]{frametitle}\\usebeamerfont{frametitle}\\insertframetitle}\\par%
  \\vspace*{0.15em}%
  \\hspace*{0.6em}{\\color{indigo}\\rule{0.92\\paperwidth}{1.2pt}}%
  \\vspace*{0.3em}%
}

% Listings — dark panel, indigo-bordered code blocks
\\lstset{
  basicstyle=\\ttfamily\\footnotesize\\color{slatefg},
  backgroundcolor=\\color{slatepanel},
  frame=single,
  rulecolor=\\color{indigo},
  framesep=4pt,
  breaklines=true,
  columns=flexible,
  xleftmargin=0pt,
  xrightmargin=0pt,
  showstringspaces=false,
}

\\title{${docTitle}}
${subtitle}
`;
}

// ─── per-layout renderers (return string) ──────────────────────────────────

function bulletList(items) {
  if (!items || items.length === 0) return '';
  const lines = items.map((b) => `  \\item ${texEscape(b)}`).join('\n');
  return `\\begin{itemize}\n${lines}\n\\end{itemize}\n`;
}

function maybeNote(item) {
  const notes = item && item.fields && typeof item.fields.get === 'function'
    ? item.fields.get('notes')
    : null;
  if (!notes) return '';
  return `\\note{${texEscape(notes)}}\n`;
}

function renderTitle(item, parsed) {
  const fm = parsed.frontmatter || {};
  const tagline = item.fields.get('tagline');
  const mainTitle = texEscape(fm.title || splitBoldTitle(item.text).title);
  const meta = [fm.course, fm.term].filter(Boolean).map(texEscape).join(' \\textperiodcentered\\ ');
  const taglineBlock = tagline
    ? `\\vspace{0.6em}\n{\\color{indigo}\\itshape\\large ${texEscape(tagline)}}\\par\n`
    : '';
  const metaBlock = meta
    ? `\\vfill\n{\\color{slatemuted}\\small ${meta}}\\par\n`
    : '';
  return `\\begin{frame}[plain]
\\centering
\\vspace*{0.8em}
{\\color{indigo}\\bfseries\\Huge ${mainTitle}}\\par
\\vspace{0.4em}
{\\color{indigo}\\rule{0.7\\paperwidth}{1.5pt}}\\par
${taglineBlock}${metaBlock}\\end{frame}
${maybeNote(item)}`;
}

function frameWithBullets(title, item, opts = {}) {
  const titleEsc = texEscape(opts.titleOverride || title || '');
  const bullets = childTexts(item);
  const breaks = opts.allowBreaks ? '[allowframebreaks]' : '';
  return `\\begin{frame}${breaks}{${titleEsc}}
${bulletList(bullets)}\\end{frame}
${maybeNote(item)}`;
}

function renderAgenda(item) {
  const { title } = splitBoldTitle(item.text);
  return frameWithBullets(title || 'Today', item);
}

function renderConcept(item, titleOverride) {
  const { title } = splitBoldTitle(item.text);
  return frameWithBullets(title, item, { titleOverride });
}

function renderSplit(item) {
  const { title } = splitBoldTitle(item.text);
  const bullets = childTexts(item);
  const half = Math.ceil(bullets.length / 2);
  const left = bullets.slice(0, half);
  const right = bullets.slice(half);
  return `\\begin{frame}{${texEscape(title)}}
\\begin{columns}[T,onlytextwidth]
\\begin{column}{0.48\\textwidth}
${bulletList(left)}\\end{column}
\\begin{column}{0.48\\textwidth}
${bulletList(right)}\\end{column}
\\end{columns}
\\end{frame}
${maybeNote(item)}`;
}

function renderCode(item) {
  const { title } = splitBoldTitle(item.text);
  const code = childTexts(item).join('\n');
  // listings consumes raw code — no tex-escape inside lstlisting
  return `\\begin{frame}[fragile]{${texEscape(title)}}
\\begin{lstlisting}
${code}
\\end{lstlisting}
\\end{frame}
${maybeNote(item)}`;
}

function renderDiagram(item) {
  const { title, rest } = splitBoldTitle(item.text);
  const alt = item.fields.get('alt') || rest || '';
  return `\\begin{frame}{${texEscape(title)}}
\\centering
\\vspace{0.6em}
\\fbox{\\begin{minipage}[c][3.6cm][c]{0.82\\textwidth}\\centering{\\color{slatemuted}\\itshape\\large Diagram: ${texEscape(alt)}}\\end{minipage}}
\\end{frame}
${maybeNote(item)}`;
}

function renderVocab(item) {
  const { title } = splitBoldTitle(item.text);
  const pairs = childTexts(item);
  const half = Math.ceil(pairs.length / 2);
  const left = pairs.slice(0, half);
  const right = pairs.slice(half);
  // Render each pair as "term — definition" — children are typically
  // "**term** — def" already; let texEscape handle markdown bold by stripping
  // the surrounding stars to \textbf.
  const fmt = (line) => {
    const m = /^\*\*(.+?)\*\*\s*(.*)$/s.exec(line || '');
    if (m) return `\\textbf{${texEscape(m[1])}} ${texEscape(m[2])}`;
    return texEscape(line);
  };
  const fmtList = (arr) => {
    if (arr.length === 0) return '';
    return `\\begin{itemize}\n${arr.map((l) => `  \\item ${fmt(l)}`).join('\n')}\n\\end{itemize}\n`;
  };
  return `\\begin{frame}{${texEscape(title)}}
\\begin{columns}[T,onlytextwidth]
\\begin{column}{0.48\\textwidth}
${fmtList(left)}\\end{column}
\\begin{column}{0.48\\textwidth}
${fmtList(right)}\\end{column}
\\end{columns}
\\end{frame}
${maybeNote(item)}`;
}

function renderCaseStudy(item) {
  const { title, rest } = splitBoldTitle(item.text);
  const bullets = childTexts(item);
  const cite = item.fields.get('citation');
  const body = bullets.length > 0
    ? bulletList(bullets)
    : (rest ? `${texEscape(rest)}\\par\n` : '');
  const footer = cite
    ? `\\vfill\n{\\color{slatemuted}\\itshape\\small\\hfill Source: ${texEscape(cite)}}\\par\n`
    : '';
  return `\\begin{frame}{${texEscape(title)}}
${body}${footer}\\end{frame}
${maybeNote(item)}`;
}

function renderKey(item) {
  const { title } = splitBoldTitle(item.text);
  return `\\begin{frame}[plain]
\\centering
\\vspace*{0.4em}
{\\color{amber}\\bfseries\\large KEY}\\par
\\vspace{0.2em}
{\\color{amber}\\rule{0.5\\paperwidth}{1.2pt}}\\par
\\vspace{1.2em}
\\begin{minipage}{0.86\\textwidth}\\centering
{\\color{slatefg}\\bfseries\\LARGE ${texEscape(title)}}
\\end{minipage}
\\vfill
\\end{frame}
${maybeNote(item)}`;
}

function renderSummary(item) {
  const { title, rest } = splitBoldTitle(item.text);
  const bullets = childTexts(item);
  if (bullets.length > 0) {
    return `\\begin{frame}{Summary}
${bulletList(bullets)}\\end{frame}
${maybeNote(item)}`;
  }
  const sentence = rest || title || '';
  return `\\begin{frame}{Summary}
\\vspace{0.4em}
\\begin{minipage}{0.92\\textwidth}
{\\color{slatefg}\\large ${texEscape(sentence)}}
\\end{minipage}
\\end{frame}
${maybeNote(item)}`;
}

function renderSectionDivider(item) {
  const { title } = splitBoldTitle(item.text);
  // Drive Beamer's \section so the navigation tree stays sensible.
  return `\\section{${texEscape(title)}}
\\begin{frame}[plain]
\\hspace*{0.04\\paperwidth}{\\color{indigo}\\rule{0.4em}{0.7\\paperheight}}\\hfill%
\\begin{minipage}[c][0.7\\paperheight][c]{0.82\\paperwidth}
\\centering
{\\color{slatefg}\\bfseries\\Huge ${texEscape(title)}}
\\end{minipage}%
\\end{frame}
${maybeNote(item)}`;
}

// ─── main ──────────────────────────────────────────────────────────────────

function renderEntry(entry, parsed) {
  const { item, layout, titleOverride } = entry;
  switch (layout) {
    case 'title': return renderTitle(item, parsed);
    case 'agenda': return renderAgenda(item);
    case 'split': return renderSplit(item);
    case 'code': return renderCode(item);
    case 'diagram': return renderDiagram(item);
    case 'vocab': return renderVocab(item);
    case 'case-study': return renderCaseStudy(item);
    case 'key': return renderKey(item);
    case 'summary': return renderSummary(item);
    case 'section-divider': return renderSectionDivider(item);
    case 'concept':
    default:
      return renderConcept(item, titleOverride);
  }
}

export async function generateSlides(parsed, options = {}) {
  const slides = applyTermFilter(parsed.byRole.get('slide') || [], options);
  const outputDir = options.outputDir || process.cwd();
  const slug = parsed.frontmatter.topicSlug || 'deck';
  const filename = `${slug}_slides.tex`;
  const filePath = path.join(outputDir, filename);

  const warnings = [];

  // Expand for concept-layout density splits.
  const expanded = []; // { item, layout, titleOverride }
  for (const item of slides) {
    const layout = item.fields.get('layout') || 'concept';
    if (!KNOWN_LAYOUTS.has(layout)) {
      warnings.push({
        message: `Unknown layout '${layout}' — falling back to concept`,
        slideNumber: expanded.length + 1,
      });
    }
    if (layout === 'concept' && (item.children || []).length > 6) {
      const { title } = splitBoldTitle(item.text);
      const all = item.children;
      let chunkIdx = 0;
      for (let i = 0; i < all.length; i += 6) {
        const chunk = all.slice(i, i + 6);
        const proxy = { ...item, children: chunk };
        expanded.push({
          item: proxy,
          layout,
          titleOverride: chunkIdx === 0 ? title : `${title} (cont.)`,
        });
        chunkIdx++;
      }
    } else {
      expanded.push({ item, layout });
    }
  }

  // Density warnings (post-split).
  let slideNum = 0;
  for (const entry of expanded) {
    slideNum++;
    if ((entry.item.children || []).length > 6) {
      warnings.push({
        message: 'Slide stays dense (>6 bullets) after auto-split',
        slideNumber: slideNum,
      });
    }
  }

  // Humanize warnings.
  let run = 1;
  for (let i = 1; i < expanded.length; i++) {
    if (expanded[i].layout === expanded[i - 1].layout) {
      run++;
      if (run === 4) {
        warnings.push({
          message: `≥4 consecutive same-layout slides ('${expanded[i].layout}')`,
          slideNumber: i + 1,
        });
      }
    } else {
      run = 1;
    }
  }
  const layoutsPresent = new Set(expanded.map((e) => e.layout));
  if (!layoutsPresent.has('key')) {
    warnings.push({
      message: 'Deck lacks a [layout:: key] pacing pause',
      slideNumber: null,
    });
  }
  if (!layoutsPresent.has('summary')) {
    warnings.push({
      message: 'Deck lacks a [layout:: summary] closing slide',
      slideNumber: null,
    });
  }
  // Soft note (not a humanize warning per acceptance criteria).
  const titleSlide = slides.find((s) => s.fields.get('layout') === 'title');
  if (titleSlide && !titleSlide.fields.get('tagline')) {
    warnings.push({
      message: 'Title slide missing [tagline::] (encouraged)',
      slideNumber: 1,
    });
  }

  // Build .tex
  const preamble = buildPreamble(parsed);
  const frames = expanded.map((entry) => renderEntry(entry, parsed)).join('\n');
  const tex = `${preamble}
\\begin{document}

${frames}

\\end{document}
`;

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(filePath, tex, 'utf8');

  // Compile to PDF (twice — TOC/refs) unless caller opts out.
  if (!options.noPdf) {
    try {
      compileLatex(filePath, outputDir);
    } catch (err) {
      warnings.push({
        message: `pdflatex failed: ${err.message}`,
        slideNumber: null,
      });
    }
  }

  return {
    filename,
    path: filePath,
    warnings,
    slideCount: expanded.length,
  };
}

export default generateSlides;
