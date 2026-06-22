import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parse } from '../parser/index.js';
import { markUsedTags } from './mark-used.js';

const SRC = `---
title: Test
course: CECS 378
term: fa26
---
## I. First
### Cornell blanks
- already tagged #blank #section/I #used/fa26 [slide:: 1]
- needs tag #blank #section/I #used/sp26 [slide:: 2]
- evergreen blank #blank #section/I [slide:: 3]
- a draft #blank #draft #section/I [slide:: 4]
- plain prose bullet with no tags
### Slide deck source
- #slide #section/I [slide:: 1] [layout:: title] **t**
`;

describe('mark-used', () => {
  let file;
  beforeEach(() => {
    file = path.join(os.tmpdir(), `mark_used_${process.pid}_${Math.floor(performance.now())}.md`);
    fs.writeFileSync(file, SRC, 'utf8');
  });
  afterEach(() => { try { fs.unlinkSync(file); } catch { /* ignore */ } });

  const lineFor = (text) =>
    fs.readFileSync(file, 'utf8').split('\n').find((l) => l.includes(text)) || '';

  it('tags markable items the build used; skips drafts, prose, and already-tagged', () => {
    const parsed = parse({ path: file });
    const r = markUsedTags(parsed, 'fa26');
    // needs-tag + evergreen-blank + slide get tagged; already-tagged counted separately.
    expect(r.modified).toBe(3);
    expect(r.alreadyTagged).toBe(1);
    expect(r.files).toEqual([fs.realpathSync(file)]);

    expect(lineFor('needs tag')).toContain('#used/fa26');
    expect(lineFor('evergreen blank')).toContain('#used/fa26');
    expect(lineFor('layout:: title')).toContain('#used/fa26');
    // draft and untagged prose are never marked.
    expect(lineFor('a draft')).not.toContain('#used/fa26');
    expect(lineFor('plain prose bullet')).not.toContain('#used/fa26');
  });

  it('preserves existing tags and inline fields on a tagged line', () => {
    const parsed = parse({ path: file });
    markUsedTags(parsed, 'fa26');
    const line = lineFor('needs tag');
    expect(line).toContain('#blank');
    expect(line).toContain('#used/sp26'); // accumulates, does not replace
    expect(line).toContain('#used/fa26');
    expect(line).toContain('[slide:: 2]');
  });

  it('is idempotent — a second run modifies nothing', () => {
    markUsedTags(parse({ path: file }), 'fa26');
    const r2 = markUsedTags(parse({ path: file }), 'fa26');
    expect(r2.modified).toBe(0);
    expect(r2.alreadyTagged).toBe(4);
    expect(r2.files).toEqual([]);
  });

  it('respects the strict semester filter (only #used/sp26 items count as used)', () => {
    const parsed = parse({ path: file });
    const r = markUsedTags(parsed, 'fa26', { strictSemester: 'sp26' });
    expect(r.modified).toBe(1); // only "needs tag" carries #used/sp26
    expect(lineFor('needs tag')).toContain('#used/fa26');
    expect(lineFor('evergreen blank')).not.toContain('#used/fa26');
  });

  it('no term → no-op', () => {
    const r = markUsedTags(parse({ path: file }), '');
    expect(r.modified).toBe(0);
    expect(r.files).toEqual([]);
    expect(fs.readFileSync(file, 'utf8')).toBe(SRC);
  });

  it('parsed from source with no file path → no-op (nothing to write)', () => {
    const r = markUsedTags(parse({ source: SRC }), 'fa26');
    expect(r.modified).toBe(0);
    expect(r.files).toEqual([]);
  });
});
