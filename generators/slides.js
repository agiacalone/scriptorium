// Slides generator — Slidev markdown deck.
// Walks parsed.byRole.get('slide') in source order, dispatching each item
// to a per-layout renderer. Writes a Slidev .md file for live HTML rendering
// — no LaTeX or PDF involved.
//
// Layout dispatch (11 layouts): title, agenda, concept, split, code, diagram,
// vocab, case-study, key, summary, section-divider (+ blank fallback).
//
// Theme selection by course number:
//   326 → blueprint   (OS / systems courses)
//   378 → blueprint   (intro security)
//   478 → terminal    (advanced security)
//   (default) → blueprint
//
// Pacing lint warnings (log.warn, not errors):
//   - ≥4 consecutive same-layout slides
//   - deck lacks a [layout:: key] pacing pause
//   - deck lacks a [layout:: summary] closing slide
//
// concept-layout density: >6 children → split into continuation slides
// titled "<title> (cont.)" with the remaining children, in groups of 6.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyTermFilter } from './_filter.js';

// ESM-safe __dirname
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const KNOWN_LAYOUTS = new Set([
  'title', 'agenda', 'concept', 'split', 'code', 'diagram',
  'vocab', 'case-study', 'key', 'summary', 'section-divider', 'blank',
]);

// Course number → Slidev theme name
const COURSE_THEME = { '326': 'blueprint', '378': 'blueprint', '478': 'terminal' };

// ─── helpers ───────────────────────────────────────────────────────────────

// Strip leading **bold** marker from item.text, returning { title, rest }.
function splitBoldTitle(text) {
  const m = /^\*\*(.+?)\*\*\s*(.*)$/s.exec(text || '');
  if (m) return { title: m[1].trim(), rest: m[2].trim() };
  return { title: (text || '').trim(), rest: '' };
}

function childTexts(item) {
  return (item.children || []).map((c) => c.text);
}

function getField(item, name) {
  return item && item.fields && typeof item.fields.get === 'function'
    ? item.fields.get(name)
    : null;
}

// Build a Slidev presenter-note block if notes are present.
function maybeNotes(item) {
  const notes = getField(item, 'notes');
  if (!notes) return '';
  return `\n<!--\n${notes}\n-->\n`;
}

// Bullet list from string array → markdown unordered list.
function bulletList(items) {
  if (!items || items.length === 0) return '';
  return items.map((b) => `- ${b}`).join('\n') + '\n';
}

// Numbered list from string array.
function numberedList(items) {
  if (!items || items.length === 0) return '';
  return items.map((b, i) => `${i + 1}. ${b}`).join('\n') + '\n';
}

// Extract language hint from a fenced code field value.
// Field stores e.g. "```python\n...\n```" or "```\n...\n```"
function parseCodeField(codeField) {
  if (!codeField) return { lang: '', body: '' };
  const m = /^```([^\n]*)\n([\s\S]*?)```\s*$/.exec(codeField.trim());
  if (m) return { lang: m[1].trim(), body: m[2] };
  // bare body without fences
  return { lang: '', body: codeField };
}

// ─── per-layout renderers (return slide body string, NO leading ---) ───────
// Each returns the content between two --- separators. The separator itself
// is added by the main loop.

function renderTitle(item, parsed) {
  const fm = parsed.frontmatter || {};
  const { title: itemTitle } = splitBoldTitle(item.text);
  const title = fm.title || itemTitle;
  const tagline = getField(item, 'tagline');
  const lines = [`# ${title}`];
  if (tagline) lines.push('', tagline);
  lines.push('');
  return lines.join('\n') + maybeNotes(item);
}

function renderAgenda(item) {
  const { title } = splitBoldTitle(item.text);
  const bullets = childTexts(item);
  const lines = [`## ${title || 'Today'}`, ''];
  if (bullets.length > 0) lines.push(numberedList(bullets));
  return lines.join('\n') + maybeNotes(item);
}

function renderConcept(item, titleOverride) {
  const { title: rawTitle } = splitBoldTitle(item.text);
  const title = titleOverride || rawTitle;
  const bullets = childTexts(item);
  const lines = [`## ${title}`, ''];
  if (bullets.length > 0) lines.push(bulletList(bullets));
  return lines.join('\n') + maybeNotes(item);
}

function renderSplit(item) {
  const { title } = splitBoldTitle(item.text);
  const bullets = childTexts(item);
  const half = Math.ceil(bullets.length / 2);
  const left = bullets.slice(0, half);
  const right = bullets.slice(half);
  const lines = [`## ${title}`, ''];
  if (left.length > 0) lines.push(bulletList(left));
  lines.push('::right::', '');
  if (right.length > 0) lines.push(bulletList(right));
  return lines.join('\n') + maybeNotes(item);
}

function renderCode(item) {
  const { title } = splitBoldTitle(item.text);
  const codeField = getField(item, 'code');
  const { lang, body } = parseCodeField(codeField);
  const fence = '```' + (lang || '');
  const lines = [`## ${title}`, '', fence, body.trimEnd(), '```', ''];
  return lines.join('\n') + maybeNotes(item);
}

function renderDiagram(item) {
  const { title } = splitBoldTitle(item.text);
  const alt = getField(item, 'alt') || '';
  const bullets = childTexts(item);
  // Emit the Schematic component tag for future theme support.
  // Escape any double-quotes in alt text for the attribute.
  const escapedAlt = alt.replace(/"/g, '&quot;');
  const lines = [`## ${title}`, '', `<Schematic alt="${escapedAlt}" />`, ''];
  if (bullets.length > 0) {
    lines.push('');
    lines.push(bulletList(bullets));
  }
  return lines.join('\n') + maybeNotes(item);
}

function renderVocab(item) {
  // vocab is not in the new layout map spec but keep it working — render
  // as a split with definition pairs.
  const { title } = splitBoldTitle(item.text);
  const pairs = childTexts(item);
  const half = Math.ceil(pairs.length / 2);
  const left = pairs.slice(0, half);
  const right = pairs.slice(half);
  const lines = [`## ${title}`, ''];
  if (left.length > 0) lines.push(bulletList(left));
  lines.push('::right::', '');
  if (right.length > 0) lines.push(bulletList(right));
  return lines.join('\n') + maybeNotes(item);
}

function renderCaseStudy(item) {
  const { title } = splitBoldTitle(item.text);
  const bullets = childTexts(item);
  const citation = getField(item, 'citation');
  // Build EventChain steps from children. Each step is a JSON string.
  const stepsJson = JSON.stringify(bullets);
  const lines = [`## ${title}`, ''];
  lines.push(`<EventChain :steps='${stepsJson}' />`);
  lines.push('');
  if (citation) {
    lines.push(`*Source: ${citation}*`, '');
  }
  return lines.join('\n') + maybeNotes(item);
}

function renderKey(item) {
  const { title } = splitBoldTitle(item.text);
  const lines = [`# ${title}`, ''];
  return lines.join('\n') + maybeNotes(item);
}

function renderSummary(item) {
  const { title, rest } = splitBoldTitle(item.text);
  const bullets = childTexts(item);
  const lines = [`## ${title || 'Summary'}`, ''];
  if (bullets.length > 0) {
    lines.push(bulletList(bullets));
  } else if (rest) {
    lines.push(rest, '');
  }
  return lines.join('\n') + maybeNotes(item);
}

function renderSectionDivider(item) {
  const { title } = splitBoldTitle(item.text);
  const lines = [`# ${title}`, ''];
  return lines.join('\n') + maybeNotes(item);
}

function renderBlank(item) {
  const { title } = splitBoldTitle(item.text);
  const lines = [`# ${title}`, ''];
  return lines.join('\n') + maybeNotes(item);
}

// ─── per-layout headmatter (returns object of extra front-matter keys) ─────
// Returns null if no extra headmatter needed (use default layout).

function slidevLayout(layout) {
  switch (layout) {
    case 'title': return 'cover';
    case 'split': return 'two-cols';
    case 'vocab': return 'two-cols';
    case 'key': return 'center';
    case 'section-divider': return 'center';
    case 'blank': return 'center';
    default: return null; // default Slidev layout
  }
}

// ─── main content renderer ─────────────────────────────────────────────────

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
    case 'blank': return renderBlank(item);
    case 'concept':
    default:
      return renderConcept(item, titleOverride);
  }
}

// ─── export ────────────────────────────────────────────────────────────────

export async function generateSlides(parsed, options = {}) {
  const slides = applyTermFilter(parsed.byRole.get('slide') || [], options);
  const outputDir = options.outputDir || process.cwd();
  const slug = parsed.frontmatter.topicSlug || 'deck';
  const filename = `${slug}_slides.md`;
  const filePath = path.join(outputDir, filename);

  // Theme selection
  const courseNum = String(parsed.frontmatter.course || '').split(/\s+/).pop();
  const themeName = COURSE_THEME[courseNum] || 'blueprint';
  // Resolve absolute path from this generator's location so the deck can
  // be built from any cwd — Slidev resolves local themes by path, not name.
  const themePath = path.resolve(__dirname, '..', 'themes', themeName);

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

  // Pacing lint warnings.
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
  // Soft note: title slide missing tagline.
  const titleSlide = slides.find((s) => s.fields.get('layout') === 'title');
  if (titleSlide && !titleSlide.fields.get('tagline')) {
    warnings.push({
      message: 'Title slide missing [tagline::] (encouraged)',
      slideNumber: 1,
    });
  }

  // Build Slidev deck markdown.
  const fm = parsed.frontmatter || {};
  const deckTitle = fm.title || slug;
  const infoLine = `CECS ${courseNum} — generated by Scriptorium`;

  // Global headmatter (the deck-level frontmatter).
  // The deck frontmatter IS slide 1 in Slidev — so the first slide's layout
  // folds INTO the headmatter and its body follows directly. Emitting a
  // separate `---layout---` block here would create a phantom empty leading
  // slide and offset the whole deck (the title would land on slide 2).
  const firstLayout = expanded.length ? slidevLayout(expanded[0].layout) : null;
  const headmatterLines = [
    '---',
    `theme: ${themePath}`,
    `title: ${deckTitle}`,
    `info: ${infoLine}`,
    'class: text-left',
  ];
  if (firstLayout) headmatterLines.push(`layout: ${firstLayout}`);
  headmatterLines.push('drawings:', '  persist: false', '---');
  const headmatter = headmatterLines.join('\n');

  // Build slide sections. The first slide's body follows the headmatter
  // directly (no separator); every later slide starts with its own `---`.
  const slideParts = [];
  expanded.forEach((entry, idx) => {
    const slidevLyt = slidevLayout(entry.layout);
    const body = renderEntry(entry, parsed);
    if (idx === 0) {
      slideParts.push(body);
    } else if (slidevLyt) {
      slideParts.push(`---\nlayout: ${slidevLyt}\n---\n\n${body}`);
    } else {
      slideParts.push(`---\n\n${body}`);
    }
  });

  const deck = headmatter + '\n\n' + slideParts.join('\n\n') + '\n';

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(filePath, deck, 'utf8');

  return {
    filename,
    path: filePath,
    warnings,
    slideCount: expanded.length,
    theme: themeName,
  };
}

export default generateSlides;
