// mark-used.js — write `#used/<term>` tags back into a lecture's source main.
//
// Generalized from the retired exam generator's `markUsedTag()` (lost when the
// exam path moved to lectern in c087cab; the `--mark-used` flag was left parsed
// but unwired). Instead of marking only the questions an exam picked, this marks
// every *deck item the build used* — each tagged content bullet that survives
// the active semester filter — so `--mark-used <term>` records "this deck was
// used in <term>" for future `--semester <term>` builds. The `#used/*` tag set
// is multi-valued and accumulates over a lecture's life, per the reproducibility
// doctrine in SKILL.md.
//
// Mechanism (unchanged from the original): read the source main as a line array,
// locate each item by its 1-indexed `sourceLine`, and append ` #used/<term>` to
// the END of that line unless the tag is already present anywhere on it. Only the
// item's first line is touched; idempotent; never reorders or rewrites other
// content. The tag's position on the line is irrelevant — the parser extracts
// `#tags` independent of `[field:: …]` order.

import fs from 'node:fs';
import { applyTermFilter } from './_filter.js';

const USED_PREFIX = 'used/';

// A deck item worth term-tracking carries at least one real content tag
// (anything other than a `#used/*` term tag) and is not a `#draft` (drafts are
// excluded from every artifact, so they were never "used"). Untagged prose
// bullets, references, etc. are skipped.
function isMarkable(item) {
  if (!item || !item.tags || item.tags.size === 0) return false;
  if (item.tags.has('draft')) return false;
  for (const t of item.tags) {
    if (typeof t === 'string' && !t.startsWith(USED_PREFIX)) return true;
  }
  return false;
}

// Mark every deck item the build used with `#used/<term>` in the source main.
// `options.semester` / `options.strictSemester` scope which items count as used
// (same filter the generators apply); with neither set, the whole deck is marked.
// Returns { term, modified, alreadyTagged, files } for reporting.
export function markUsedTags(parsed, term, options = {}) {
  const empty = { term, modified: 0, alreadyTagged: 0, files: [] };
  if (!term) return empty;
  const filePath = parsed && parsed.frontmatter && parsed.frontmatter.sourcePath;
  if (!filePath || !fs.existsSync(filePath)) return empty;

  const markable = (parsed.items || []).filter(isMarkable);
  const kept = applyTermFilter(markable, options);

  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const tagRe = new RegExp(`(?:^|\\s)#${USED_PREFIX}${escaped}(?:\\s|$)`);
  const tagToken = `#${USED_PREFIX}${term}`;

  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  let modified = 0;
  let alreadyTagged = 0;
  let changed = false;
  for (const it of kept) {
    const idx = (it.sourceLine || 0) - 1;
    if (idx < 0 || idx >= lines.length) continue;
    const line = lines[idx];
    if (tagRe.test(line)) { alreadyTagged++; continue; }
    lines[idx] = `${line.replace(/\s+$/, '')} ${tagToken}`;
    modified++;
    changed = true;
  }
  if (changed) fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
  return { term, modified, alreadyTagged, files: changed ? [filePath] : [] };
}

export default markUsedTags;
