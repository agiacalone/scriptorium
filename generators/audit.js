// Staleness audit generator — emits a markdown report listing items whose
// newest `#used/<term>` tag is older than the current term, plus a separate
// "Never marked used" section for items with no `#used/*` tag at all.
//
// Term ordering: parse a term code like `sp26` into a sortable integer:
//   year (2000+yy) * 10 + season-rank (sp=1, su=2, fa=3)
//
// API:
//   generateAudit(parsed, { currentTerm }) → markdown string

const SEASON_RANK = { sp: 1, su: 2, fa: 3 };

export function termOrder(term) {
  if (typeof term !== 'string') return -1;
  const m = term.match(/^(sp|su|fa)(\d{2})$/);
  if (!m) return -1;
  const seasonRank = SEASON_RANK[m[1]];
  const year = 2000 + parseInt(m[2], 10);
  return year * 10 + seasonRank;
}

// Distance in semesters between two term codes (a − b). Both must be valid.
export function termDistance(a, b) {
  const oa = termOrder(a);
  const ob = termOrder(b);
  if (oa < 0 || ob < 0) return null;
  // each year contributes 3 seasons
  const ay = Math.floor(oa / 10), as = oa % 10;
  const by = Math.floor(ob / 10), bs = ob % 10;
  return (ay - by) * 3 + (as - bs);
}

const USED_PREFIX = 'used/';

function usedTerms(item) {
  const out = [];
  if (!item || !item.tags) return out;
  for (const t of item.tags) {
    if (typeof t === 'string' && t.startsWith(USED_PREFIX)) {
      out.push(t.slice(USED_PREFIX.length));
    }
  }
  return out;
}

function newestUsed(item) {
  const terms = usedTerms(item);
  if (terms.length === 0) return null;
  let best = null;
  let bestOrder = -1;
  for (const t of terms) {
    const o = termOrder(t);
    if (o > bestOrder) { bestOrder = o; best = t; }
  }
  return best;
}

function shortText(item, max = 80) {
  const t = (item.text || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + '…';
}

function sectionKey(item) {
  return item.section || 'unsectioned';
}

function sectionTitleMap(body) {
  const meta = new Map();
  const re = /^##\s+([IVXLCDM]+)\.\s+(.+?)(?:\s+\((\d+)\s*min\))?\s*$/;
  for (const line of (body || '').split('\n')) {
    const m = re.exec(line);
    if (m) meta.set(m[1], m[2].trim());
  }
  return meta;
}

// Walk parsed AST flatly (top-level + children).
function walkAll(items, out = []) {
  for (const it of items) {
    out.push(it);
    if (it.children && it.children.length) walkAll(it.children, out);
  }
  return out;
}

export function generateAudit(parsed, options = {}) {
  const fm = parsed.frontmatter || {};
  const title = fm.title || 'Lecture';
  const fallbackTerm = fm.term || null;
  const currentTerm = options.currentTerm || fallbackTerm;
  const currentOrder = termOrder(currentTerm);

  const all = walkAll(parsed.items || []);
  const sectionTitles = sectionTitleMap(parsed.body || '');

  // Bucket
  const stale = [];        // has used/* tags, newest < currentOrder
  const current = [];      // has used/<currentTerm>
  const future = [];       // has used/* tag newer than currentTerm (rare)
  const never = [];        // no used/* tags at all
  for (const it of all) {
    const terms = usedTerms(it);
    if (terms.length === 0) {
      // only count things that look like meaningful content items —
      // i.e. have a role tag or a section. Headings + naked bullets pass through.
      if (!it.text) continue;
      never.push(it);
      continue;
    }
    const newest = newestUsed(it);
    const o = termOrder(newest);
    if (currentOrder > 0 && o < currentOrder) stale.push({ it, newest });
    else if (currentOrder > 0 && o === currentOrder) current.push({ it, newest });
    else future.push({ it, newest });
  }

  // Sort stale: oldest first (largest gap first)
  stale.sort((a, b) => termOrder(a.newest) - termOrder(b.newest));

  const out = [];
  out.push(`# Staleness audit — ${title}`);
  out.push('');
  out.push(`Current term: ${currentTerm || '(none — set frontmatter \`term:\` or pass --current-term)'}`);
  out.push(`Generated: ${new Date().toISOString()}`);
  out.push('');

  // Stale items, grouped by section
  out.push('## Stale items (last used in a previous semester)');
  out.push('');
  if (stale.length === 0) {
    out.push('_None — every tagged item is current._');
    out.push('');
  } else {
    const bySection = new Map();
    for (const entry of stale) {
      const k = sectionKey(entry.it);
      if (!bySection.has(k)) bySection.set(k, []);
      bySection.get(k).push(entry);
    }
    const orderedKeys = [...bySection.keys()].sort();
    for (const k of orderedKeys) {
      const sectTitle = sectionTitles.get(k);
      const head = sectTitle ? `### §${k} — ${sectTitle}` : `### §${k}`;
      out.push(head);
      for (const { it, newest } of bySection.get(k)) {
        const dist = currentTerm ? termDistance(currentTerm, newest) : null;
        const distLabel = dist != null
          ? ` (${dist} semester${dist === 1 ? '' : 's'} ago)`
          : '';
        const warn = dist != null && dist >= 4 ? ' ⚠' : '';
        out.push(`- Line ${it.sourceLine}: \`${shortText(it)}\` — last used: ${newest}${distLabel}${warn}`);
      }
      out.push('');
    }
  }

  // Never marked used
  out.push('## Never marked used');
  out.push('');
  if (never.length === 0) {
    out.push('_None — every item carries a `#used/*` tag._');
    out.push('');
  } else {
    const bySection = new Map();
    for (const it of never) {
      const k = sectionKey(it);
      if (!bySection.has(k)) bySection.set(k, []);
      bySection.get(k).push(it);
    }
    const orderedKeys = [...bySection.keys()].sort();
    for (const k of orderedKeys) {
      const sectTitle = sectionTitles.get(k);
      const head = sectTitle ? `### §${k} — ${sectTitle}` : `### §${k}`;
      out.push(head);
      for (const it of bySection.get(k)) {
        out.push(`- Line ${it.sourceLine}: \`${shortText(it)}\``);
      }
      out.push('');
    }
  }

  return out.join('\n');
}

export default generateAudit;
