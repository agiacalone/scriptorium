// Reading-list companion generator — hybrid scaffold for `<topic>_reading_list.md`.
//
// Hybrid contract: the generator owns the cue-tables block fenced by
//   <!-- generator: cue-tables --> ... <!-- /generator -->
// Everything outside the fence is the author's prose (How-to-use callout,
// primary-source callout, "cues newer than the textbook" callout, supplementary
// readings list). On regen, the author's edits OUTSIDE the fence survive verbatim;
// the cue tables INSIDE the fence are replaced.
//
// First-run behavior (no `options.existing`): emit a full scaffold with frontmatter
// + TODO-marked callouts for the author to fill in, then the fenced cue-tables.

const FENCE_OPEN = '<!-- generator: cue-tables -->';
const FENCE_CLOSE = '<!-- /generator -->';

import { applyTermFilter } from './_filter.js';

const ROMAN_VAL = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
function romanToArabic(s) {
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const cur = ROMAN_VAL[s[i]] || 0;
    const next = ROMAN_VAL[s[i + 1]] || 0;
    total += cur < next ? -cur : cur;
  }
  return total;
}

function isRomanSection(key) {
  return /^[IVXLCDM]+$/.test(key);
}

// Map roman → section title from `## I. Title (n min)` body lines.
function extractSectionMeta(body) {
  const meta = new Map();
  const lines = (body || '').split('\n');
  const re = /^##\s+([IVXLCDM]+)\.\s+(.+?)(?:\s+\((\d+)\s*min\))?\s*$/;
  for (const line of lines) {
    const m = re.exec(line);
    if (m) meta.set(m[1], { title: m[2].trim() });
  }
  return meta;
}

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^\w\s-]+/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function buildTags(fm, topicSlug) {
  const out = new Set();
  const rawTags = fm.raw && Array.isArray(fm.raw.tags) ? fm.raw.tags : [];
  for (const t of rawTags) {
    if (t === 'lecture-main' || t === 'reading-list') continue;
    out.add(t);
  }
  if (fm.course) out.add(fm.course.toLowerCase().replace(/\s+/g, ''));
  out.add('reading-list');
  if (topicSlug) out.add(topicSlug);
  return [...out];
}

function frontmatterBlock(fm, topicSlug) {
  const now = new Date().toISOString();
  const title = fm.title || 'Lecture';
  const course = fm.course || '';
  const tags = buildTags(fm, topicSlug);
  const lines = ['---'];
  lines.push(`title: ${title} — Reading List`);
  if (course) lines.push(`course: ${course}`);
  lines.push('type: reading-list-companion');
  lines.push(`created: ${now}`);
  lines.push(`updated: ${now}`);
  lines.push('visibility: private');
  lines.push(`tags: [${tags.join(', ')}]`);
  lines.push('icon: LiBookOpen');
  lines.push('iconColor: var(--text-normal)');
  lines.push('---');
  return lines.join('\n');
}

// Cue derivation: prefer `[cue:: …]`, else first ~40 chars of item.text on a word boundary.
function deriveCue(item) {
  const fields = item.fields;
  if (fields && typeof fields.get === 'function') {
    const c = fields.get('cue');
    if (c) return String(c).trim();
  }
  const text = String(item.text || '').replace(/\s+/g, ' ').trim();
  if (text.length <= 40) return text;
  const slice = text.slice(0, 40);
  const lastSpace = slice.lastIndexOf(' ');
  const cut = lastSpace > 20 ? slice.slice(0, lastSpace) : slice;
  return cut + '…';
}

function getCitation(item) {
  const fields = item.fields;
  if (fields && typeof fields.get === 'function') {
    const c = fields.get('citation');
    if (c) return String(c).trim();
  }
  return '';
}

// Escape pipe chars so they don't break markdown table cells.
function cell(s) {
  return String(s || '').replace(/\|/g, '\\|');
}

function buildCueTables(parsed, options = {}) {
  const meta = extractSectionMeta(parsed.body);
  const sectionKeys = [...parsed.bySection.keys()]
    .filter(isRomanSection)
    .sort((a, b) => romanToArabic(a) - romanToArabic(b));

  const blocks = [];
  for (const key of sectionKeys) {
    const raw = parsed.bySection.get(key) || [];
    const filtered = applyTermFilter(raw, options);
    const items = filtered.filter((i) => getCitation(i));
    if (items.length === 0) continue;
    const title = (meta.get(key) && meta.get(key).title) || '';
    const heading = title ? `### §${key} — ${title}` : `### §${key}`;
    const lines = [heading, '', '| Cue | Source |', '|---|---|'];
    for (const item of items) {
      lines.push(`| ${cell(deriveCue(item))} | ${cell(getCitation(item))} |`);
    }
    blocks.push(lines.join('\n'));
  }
  return blocks.join('\n\n');
}

function freshScaffold(parsed, options = {}) {
  const fm = parsed.frontmatter || {};
  const title = fm.title || 'Lecture';
  const topicSlug = (fm.raw && fm.raw['topic-slug']) || slugify(title);
  const cueTables = buildCueTables(parsed, options);

  const out = [];
  out.push(frontmatterBlock(fm, topicSlug));
  out.push('');
  out.push(`# ${title} — Reading List`);
  out.push('');
  out.push('> [!info] How to use this document');
  out.push('> <!-- TODO author: 1-2 sentences telling students how to consume this list -->');
  out.push('');
  out.push('> [!note] Primary source');
  out.push('> <!-- TODO author: textbook chapter/sections; e.g., "Tanenbaum & Bos, *Modern Operating Systems*, 4th ed. — Ch 4 §4.1–§4.2" -->');
  out.push('');
  out.push('> [!warning] Cues newer than the textbook');
  out.push('> <!-- TODO author: list any cues that fall outside the assigned edition; cite primary sources directly -->');
  out.push('');
  out.push(FENCE_OPEN);
  out.push('');
  out.push(cueTables);
  out.push('');
  out.push(FENCE_CLOSE);
  out.push('');
  out.push('## Supplementary readings');
  out.push('');
  out.push('<!-- TODO author: rows beyond textbook. Each as `- [Title](url) — one-line description #tag` -->');
  out.push('');
  return out.join('\n');
}

export function generateReadingList(parsed, options = {}) {
  const existing = options && options.existing;

  if (!existing) {
    return freshScaffold(parsed, options);
  }

  const openIdx = existing.indexOf(FENCE_OPEN);
  const closeIdx = existing.indexOf(FENCE_CLOSE);
  if (openIdx === -1 || closeIdx === -1 || closeIdx < openIdx) {
    throw new Error(
      'Refusing to regenerate: <!-- generator: cue-tables --> fence missing. ' +
        'Manual content would be clobbered. Restore the fence or delete the file ' +
        'to regenerate from scratch.'
    );
  }

  const before = existing.slice(0, openIdx + FENCE_OPEN.length);
  const after = existing.slice(closeIdx);
  const cueTables = buildCueTables(parsed, options);
  return `${before}\n\n${cueTables}\n\n${after}`;
}

export default generateReadingList;
