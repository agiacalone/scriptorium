// Exam reference sheet: the dense, two-column successor to the exam reading
// list. It tells students where to read, never what the answer is: each
// Cornell statement is printed with its blank left empty, grouped by lecture
// section under one "Read" line of linked sources, and key terms are listed
// under the source that defines them, without definitions. The [answer::]
// fields are never read, so the handout key cannot leak through this sheet. Built for a two-column, narrow-margin PDF (see the wrapper's
// reference render), so it favours bullets over tables.
//
// Options beyond the reading list's:
//   readings        [{title, url, note?}] — the term's assigned readings for
//                   this exam's units, rendered as a callout under the header.
//   retiredCitation regex source; citations matching it name a textbook the
//                   course no longer uses and are replaced by "Lecture notes".

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

// OSTEP chapter → PDF basename, verified 2026-09-15 (notes/ostep-course-mapping-326.md).
const OSTEP_BASE = 'https://pages.cs.wisc.edu/~remzi/OSTEP/';
const OSTEP_FILES = {
  2: 'intro', 4: 'cpu-intro', 5: 'cpu-api', 6: 'cpu-mechanisms', 7: 'cpu-sched',
  8: 'cpu-sched-mlfq', 9: 'cpu-sched-lottery', 13: 'vm-intro', 14: 'vm-api',
  15: 'vm-mechanism', 16: 'vm-segmentation', 17: 'vm-freespace', 18: 'vm-paging',
  19: 'vm-tlbs', 20: 'vm-smalltables', 21: 'vm-beyondphys', 22: 'vm-beyondphys-policy',
  26: 'threads-intro', 27: 'threads-api', 28: 'threads-locks', 29: 'threads-locks-usage',
  30: 'threads-cv', 31: 'threads-sema', 32: 'threads-bugs', 36: 'file-devices',
  37: 'file-disks', 38: 'file-raid', 39: 'file-intro', 40: 'file-implementation',
  41: 'file-ffs', 42: 'file-journaling', 44: 'file-ssd',
};

// SPs whose unrevised DOI does not resolve; point at the current revision.
const SP_CURRENT_REV = { '800-57': '800-57pt1r5', '800-67': '800-67r2', '800-63': '800-63-4', '800-53': '800-53r5' };

function field(item, k) {
  return (item.fields && item.fields.get && item.fields.get(k)) || '';
}

// Normalise one citation string into {key, md}. `key` dedupes within a section.
export function renderCitation(raw, opts = {}) {
  const c = String(raw || '').trim();
  if (!c) return null;
  if (opts.retiredCitation && new RegExp(opts.retiredCitation, 'i').test(c)) {
    return { key: 'lecture', md: 'Lecture notes' };
  }
  if (/^lecture notes/i.test(c)) return { key: 'lecture', md: 'Lecture notes' };
  let m = /^OSTEP\s+(?:ch\.?\s*)?(\d+)/i.exec(c);
  if (m) {
    const n = Number(m[1]);
    const f = OSTEP_FILES[n];
    return { key: `ostep-${n}`, md: f ? `[OSTEP ${n}](${OSTEP_BASE}${f}.pdf)` : `OSTEP ${n}` };
  }
  if (/^OSTEP\s+App/i.test(c)) return { key: 'ostep-b', md: `[OSTEP App. B](${OSTEP_BASE}vmm-intro.pdf)` };
  m = /^RFC\s*(\d+)/i.exec(c);
  if (m) return { key: `rfc-${m[1]}`, md: `[RFC ${m[1]}](https://www.rfc-editor.org/rfc/rfc${m[1]})` };
  m = /^NIST\s+SP\s+(800-\d+[A-Z]?)/i.exec(c);
  if (m) {
    const id = m[1].toUpperCase();
    const doi = SP_CURRENT_REV[id] || id;
    return { key: `sp-${id}`, md: `[NIST SP ${id}](https://doi.org/10.6028/NIST.SP.${doi})` };
  }
  m = /^(?:NIST\s+)?FIPS\s+(?:Publication\s+|PUB\s+)?(199|186-5|180-4|202)\b/i.exec(c);
  if (m) return { key: `fips-${m[1]}`, md: `[FIPS ${m[1]}](https://doi.org/10.6028/NIST.FIPS.${m[1]})` };
  // Strip a trailing section number so "Saltzer & Schroeder 1975 §3" and
  // "Saltzer & Schroeder 1975" collapse into one source.
  const base = c.replace(/\s*[,;]?\s*(§|p\.|pp\.)\s*[\d.–-]+$/, '').trim();
  return { key: base.toLowerCase(), md: base };
}

// Fill each _______ with the next answer, in bold.
// Collapse each run of blanks ("a _______ _______ sign it") into one empty blank.
export function blankOut(text) {
  return String(text || '').replace(/_{3,}(\s+_{3,})*/g, '\\_\\_\\_\\_\\_\\_');
}

function vocabTerm(item) {
  const t = clean(item.text);
  const m = /^\*\*([^*]+)\*\*/.exec(t) || /^([^—–]+?)\s+[—–]/.exec(t);
  return m ? m[1].trim() : t.split(/\s+/).slice(0, 3).join(' ');
}

function sectionTitle(parsed, key) {
  const re = new RegExp(`^##\\s+${key}\\.\\s+(.+?)(?:\\s+\\(\\d+\\s*min\\))?\\s*$`, 'm');
  const m = re.exec(parsed.body || '');
  return m ? m[1].trim() : key;
}

function romanKeys(parsed) {
  return [...parsed.bySection.keys()]
    .filter((k) => /^[IVXLCDM]+$/.test(k))
    .sort((a, b) => ROMAN.indexOf(a) - ROMAN.indexOf(b));
}

function clean(s) {
  return String(s || '')
    .replace(/(^|\s)#(adversarial|blank|vocab|self-quiz|section\/\w+)\b/g, '$1')
    .replace(/^`?Q\d+\.`?\s*/, '')
    .trim();
}

function sourcesLine(items, opts) {
  const seen = new Map();
  for (const it of items) {
    for (const part of String(field(it, 'citation')).split(/\s*;\s*/)) {
      const r = renderCitation(part, opts);
      if (r && !seen.has(r.key)) seen.set(r.key, r.md);
    }
  }
  // Lecture notes last: a real reading is the better pointer when one exists.
  const lec = seen.get('lecture');
  seen.delete('lecture');
  const list = [...seen.values()];
  if (lec) list.push(lec);
  return list.length ? list.join(' · ') : 'Lecture notes';
}

function topicBlock(parsed, opts) {
  const title = (parsed.frontmatter || {}).title || 'Topic';
  const out = [`# ${title}`, ''];

  const vocab = parsed.byRole.get('vocab') || [];
  if (vocab.length) {
    out.push('## Key terms, by where they are defined', '');
    const bySource = new Map();
    for (const v of vocab) {
      const r = renderCitation(field(v, 'citation'), opts) || { key: 'lecture', md: 'Lecture notes' };
      if (!bySource.has(r.key)) bySource.set(r.key, { md: r.md, terms: [] });
      bySource.get(r.key).terms.push(vocabTerm(v));
    }
    for (const { md, terms } of bySource.values()) out.push(`- ${md}: ${terms.join(', ')}`);
    out.push('');
  }

  for (const key of romanKeys(parsed)) {
    const items = parsed.bySection.get(key) || [];
    const blanks = items.filter((it) => it.tags.has('blank'));
    if (!blanks.length) continue;
    out.push(`## ${key}. ${sectionTitle(parsed, key)}`, '');
    out.push(`*Read:* ${sourcesLine(items, opts)}`, '');
    for (const b of blanks) out.push(`- ${blankOut(clean(b.text))}`);
    out.push('');
  }

  const sq = parsed.byRole.get('self-quiz') || [];
  if (sq.length) {
    out.push('## Check yourself', '');
    sq.forEach((q, i) => out.push(`${i + 1}. ${clean(q.text)}`));
    out.push('');
  }
  return out.join('\n');
}

export function generateExamReferenceSheet(topics, opts = {}) {
  const examName = opts.examName || 'Exam';
  const course = opts.course || '';
  const term = opts.term || '';
  const titles = topics.map((t) => (t.parsed.frontmatter || {}).title).filter(Boolean);
  const readings = opts.readings || [];

  const out = [];
  out.push('---');
  out.push(`title: "${course ? course + ' — ' : ''}${examName} Reference Sheet"`);
  if (course) out.push(`course: ${course}`);
  if (term) out.push(`term: ${term}`);
  if (opts.examDate) out.push(`exam-date: ${opts.examDate}`);
  out.push('type: reading-list');
  out.push('tags:');
  out.push('  - reading-list');
  out.push('  - study-guide');
  out.push('  - exam-study-guide');
  out.push('icon: LiGraduationCap');
  out.push('iconColor: var(--text-normal)');
  out.push('generated-by: reg-exam-readinglist');
  out.push('---');
  out.push('');
  out.push(`# ${course ? course + ' · ' : ''}${examName} Reference Sheet`);
  out.push('');
  if (opts.examWhen) out.push(`**Exam:** ${opts.examWhen}`, '');
  out.push(`**Covers:** ${titles.join(' · ')}${opts.coverageNote ? ` — ${opts.coverageNote}` : ''}`);
  out.push('');
  out.push('> [!info] How to use this sheet');
  out.push('> Every fill-in statement from your lecture handouts is below, with its blank left empty. The *Read* line under each heading links to where that section\'s material is covered: find each answer there and write it in. Key terms are grouped by the source that defines them. The *Check yourself* questions at the end of each unit are the kind of reasoning the exam asks for.');
  out.push('');
  if (readings.length) {
    out.push('> [!source] Readings for this exam');
    out.push(`> ${opts.textbook ? opts.textbook : 'There is no textbook this term; these readings are all free.'}`);
    out.push('>');
    for (const r of readings) {
      const t = r.url ? `[${r.title}](${r.url})` : r.title;
      out.push(`> - ${t}${r.note ? ` — ${r.note}` : ''}`);
    }
    out.push('');
  }
  if (opts.note) {
    out.push(`> [!warning] ${opts.noteTitle || 'Note'}`);
    for (const line of String(opts.note).split('\n')) out.push(`> ${line}`);
    out.push('');
  }
  out.push('<!-- body -->');
  out.push('');
  topics.forEach((t) => out.push(topicBlock(t.parsed, opts)));
  return out.join('\n');
}

export default generateExamReferenceSheet;
