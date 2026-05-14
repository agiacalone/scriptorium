// Lecture notes generator — instructor copy.
// Walks parsed AST from parser/, emits a LaTeX document.
//
// Tag query (per design doc):
//   byRole.get('objective')      → Learning Objectives bullet list
//   byRole.get('concept')        → bullet body of each section
//   byRole.get('key-callout')    → KEY callouts inside sections
//   byRole.get('case-study')     → CASE callouts inside sections (KEY style fallback)
//   byRole.get('discussion')     → numbered "Discussion prompts" per section
//   byRole.get('activity')       → numbered "Activities" per section
//
// Routing:
//   #cornell-only  → skip in lecture-notes
//   #notes-only    → include in lecture-notes
//   #draft         → silently excluded (TODO: surface as warnings on a returned object)
//
// Section ordering: Roman-numeral (I, II, III, …) via a roman→arabic comparator.

import { createRequire } from 'node:module';
import { filteredByRole, filteredBySection } from './_filter.js';
const require = createRequire(import.meta.url);
const tex = require('../lib/tex-helpers.js');

const {
  texPreamble,
  texDocHeader,
  texHook,
  texPlainSection,
  texBriefingSection,
  texBulletList,
  texCallout,
  texEscape,
} = tex;

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

// Section headings appear in the body as `## I. Title (15 min)`.
// Build a map roman → { title, minutes }.
function extractSectionMeta(body) {
  const meta = new Map();
  const lines = body.split('\n');
  const re = /^##\s+([IVXLCDM]+)\.\s+(.+?)(?:\s+\((\d+)\s*min\))?\s*$/;
  for (const line of lines) {
    const m = re.exec(line);
    if (m) {
      meta.set(m[1], { title: m[2].trim(), minutes: m[3] ? m[3] : '' });
    }
  }
  return meta;
}

function shouldInclude(item) {
  if (!item || !item.tags) return true;
  if (item.tags.has('cornell-only')) return false;
  if (item.tags.has('draft')) return false;
  return true;
}

function itemsForRole(parsed, role, options) {
  const list = filteredByRole(parsed, role, options);
  return list.filter(shouldInclude);
}

function itemsForSection(parsed, sectionKey, role, options) {
  const items = filteredBySection(parsed, sectionKey, options);
  return items.filter((it) => it.tags.has(role) && shouldInclude(it));
}

function texNumberedList(items) {
  if (!items || items.length === 0) return '';
  const lines = items.map((t) => `  \\item ${texEscape(t)}`).join('\n');
  return `\\begin{enumerate}\n${lines}\n\\end{enumerate}\n`;
}

export function generateLectureNotes(parsed, options = {}) {
  const fm = parsed.frontmatter || {};
  const title = fm.title || 'Lecture Notes';
  const courseLabel = [fm.course, fm.term].filter(Boolean).join(' — ') || (fm.course || '');

  const out = [];
  out.push(texPreamble(title, courseLabel, { fontSize: '11pt', margin: '0.9in' }));
  out.push('\\begin{document}');
  out.push('\\thispagestyle{fancy}');
  out.push(texDocHeader(title, 'Lecture Notes — with Talking Points', courseLabel));

  // Hook: try description from frontmatter, else synthesis line.
  const hookText =
    (fm.raw && (fm.raw.description || fm.raw.summary)) ||
    `Instructor copy for ${title}. Section-by-section talking points, key callouts, and prompts.`;
  out.push(texHook(hookText));

  // Learning Objectives
  const objectives = itemsForRole(parsed, 'objective', options).map((it) => it.text);
  if (objectives.length > 0) {
    out.push(texPlainSection('Learning Objectives'));
    out.push(texBulletList(objectives));
  }

  // Roman-ordered sections
  const sectionMeta = extractSectionMeta(parsed.body || '');
  const romanKeys = [...parsed.bySection.keys()]
    .filter(isRomanSection)
    .sort((a, b) => romanToArabic(a) - romanToArabic(b));

  romanKeys.forEach((key, idx) => {
    const meta = sectionMeta.get(key) || { title: key, minutes: '' };
    const concepts = itemsForSection(parsed, key, 'concept', options);
    const notesOnly = concepts.filter((c) => c.tags.has('notes-only')).map((c) => c.text);
    const mainConcepts = concepts.filter((c) => !c.tags.has('notes-only')).map((c) => c.text);

    out.push(
      texBriefingSection(meta.title, idx, meta.minutes, '', mainConcepts, notesOnly)
    );

    // KEY callouts
    for (const it of itemsForSection(parsed, key, 'key-callout', options)) {
      out.push(texCallout('KEY', it.text));
    }
    // Case studies — render as KEY-style callout with "CASE" label (fallback to KEY).
    for (const it of itemsForSection(parsed, key, 'case-study', options)) {
      out.push(texCallout('KEY', `Case study: ${it.text}`));
    }

    // Discussion prompts
    const discussions = itemsForSection(parsed, key, 'discussion', options).map((it) => it.text);
    if (discussions.length > 0) {
      out.push(`\\par\\smallskip\\noindent\\textbf{Discussion prompts}\\par`);
      out.push(texNumberedList(discussions));
    }

    // Activities
    const activities = itemsForSection(parsed, key, 'activity', options).map((it) => it.text);
    if (activities.length > 0) {
      out.push(`\\par\\smallskip\\noindent\\textbf{Activities}\\par`);
      out.push(texNumberedList(activities));
    }
  });

  out.push('\\end{document}');
  return out.join('\n');
}

export default generateLectureNotes;
