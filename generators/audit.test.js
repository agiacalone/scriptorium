import { describe, it, expect } from 'vitest';
import { parse } from '../parser/main-parser.js';
import { generateAudit, termOrder, termDistance } from './audit.js';

describe('termOrder', () => {
  it('orders sp24 < su24 < fa24 < sp25', () => {
    expect(termOrder('sp24')).toBeLessThan(termOrder('su24'));
    expect(termOrder('su24')).toBeLessThan(termOrder('fa24'));
    expect(termOrder('fa24')).toBeLessThan(termOrder('sp25'));
  });
  it('returns -1 for malformed input', () => {
    expect(termOrder('garbage')).toBe(-1);
    expect(termOrder('')).toBe(-1);
    expect(termOrder(null)).toBe(-1);
  });
});

describe('termDistance', () => {
  it('counts semesters between terms', () => {
    expect(termDistance('sp26', 'sp24')).toBe(6);  // sp24→su24→fa24→sp25→su25→fa25→sp26
    expect(termDistance('sp26', 'fa25')).toBe(1);
    expect(termDistance('sp26', 'sp26')).toBe(0);
  });
});

describe('generateAudit', () => {
  const SRC = `---
title: Test Topic
course: CECS 326
term: sp27
topic-slug: test
type: lecture-main
---
## I. First
- Old item #concept #section/I #used/sp24 [slide:: 1]
- Recent item #concept #section/I #used/sp26 [slide:: 2]
- Current item #concept #section/I #used/sp27 [slide:: 3]
- Untagged item #concept #section/I [slide:: 4]

## II. Second
- Ancient item #concept #section/II #used/sp23 [slide:: 5]
`;

  it('flags items whose newest #used/* is older than current term', () => {
    const r = parse({ source: SRC });
    const md = generateAudit(r, { currentTerm: 'sp27' });
    expect(md).toContain('# Staleness audit');
    expect(md).toContain('Current term: sp27');
    expect(md).toContain('Old item');
    expect(md).toContain('Recent item');
    expect(md).toContain('Ancient item');
    expect(md).toContain('last used: sp24');
    expect(md).toContain('last used: sp26');
    // current-term item is not stale
    expect(md).not.toMatch(/Current item.*last used:/);
  });

  it('lists items with no #used/* tag in "Never marked used"', () => {
    const r = parse({ source: SRC });
    const md = generateAudit(r, { currentTerm: 'sp27' });
    expect(md).toContain('## Never marked used');
    expect(md).toContain('Untagged item');
  });

  it('falls back to frontmatter term when --current-term omitted', () => {
    const r = parse({ source: SRC });
    const md = generateAudit(r, {});
    expect(md).toContain('Current term: sp27');
  });

  it('reports clean state when nothing is stale and nothing untagged', () => {
    const allCurrent = `---
title: All Current
course: CECS 326
term: sp27
topic-slug: ac
type: lecture-main
---
## I. First
- All-tagged item #concept #section/I #used/sp27 [slide:: 1]
`;
    const r = parse({ source: allCurrent });
    const md = generateAudit(r, { currentTerm: 'sp27' });
    expect(md).toContain('Stale items');
    expect(md).toMatch(/None — every tagged item is current/);
  });

  it('handles a main with zero #used/* tags — everything goes to "Never"', () => {
    const noTags = `---
title: No Tags
course: CECS 326
term: sp26
topic-slug: nt
type: lecture-main
---
## I. First
- Item one #concept #section/I [slide:: 1]
- Item two #concept #section/I [slide:: 2]
`;
    const r = parse({ source: noTags });
    const md = generateAudit(r, { currentTerm: 'sp26' });
    expect(md).toMatch(/None — every tagged item is current/);
    expect(md).toContain('Item one');
    expect(md).toContain('Item two');
  });
});
