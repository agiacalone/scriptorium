// Tests for the shared term-filter helper. Each generator gets its own
// 3-case filter test in its own file; this covers the helper itself.

import { describe, it, expect } from 'vitest';
import { applyTermFilter, hasUsedTag, hasAnyUsedTag, filteredByRole } from './_filter.js';
import { parse } from '../parser/main-parser.js';

const ITEMS = [
  { tags: new Set(['concept', 'used/sp26']) },
  { tags: new Set(['concept', 'used/sp24', 'used/sp26']) },
  { tags: new Set(['concept', 'used/sp24']) },
  { tags: new Set(['concept']) },                       // untagged (evergreen)
];

describe('applyTermFilter', () => {
  it('returns all items when no filter set', () => {
    expect(applyTermFilter(ITEMS, {}).length).toBe(4);
  });

  it('loose semester keeps tagged-current + untagged', () => {
    const out = applyTermFilter(ITEMS, { semester: 'sp26' });
    expect(out.length).toBe(3); // two with sp26 + one untagged
    expect(out).toContain(ITEMS[3]);
    expect(out).not.toContain(ITEMS[2]); // sp24-only — excluded
  });

  it('strict semester keeps ONLY tagged-current', () => {
    const out = applyTermFilter(ITEMS, { strictSemester: 'sp26' });
    expect(out.length).toBe(2);
    expect(out).not.toContain(ITEMS[3]); // untagged excluded
  });

  it('strict takes precedence when both passed', () => {
    const out = applyTermFilter(ITEMS, { semester: 'sp26', strictSemester: 'fa99' });
    expect(out.length).toBe(0);
  });
});

describe('hasUsedTag / hasAnyUsedTag', () => {
  it('detects exact and any used tags', () => {
    expect(hasUsedTag(ITEMS[0], 'sp26')).toBe(true);
    expect(hasUsedTag(ITEMS[0], 'sp24')).toBe(false);
    expect(hasAnyUsedTag(ITEMS[0])).toBe(true);
    expect(hasAnyUsedTag(ITEMS[3])).toBe(false);
  });
});

describe('filteredByRole integration with parser', () => {
  const src = `---
title: t
---
## I. S
### Concepts
- Evergreen concept #concept #section/I [slide:: 1]
- Spring 2026 concept #concept #section/I #used/sp26 [slide:: 2]
- Spring 2024 concept #concept #section/I #used/sp24 [slide:: 3]
`;
  const parsed = parse({ source: src });

  it('no filter — all three concepts', () => {
    expect(filteredByRole(parsed, 'concept', {}).length).toBe(3);
  });
  it('loose filter — sp26 keeps tagged + untagged (2)', () => {
    expect(filteredByRole(parsed, 'concept', { semester: 'sp26' }).length).toBe(2);
  });
  it('strict filter — sp26 keeps tagged only (1)', () => {
    expect(filteredByRole(parsed, 'concept', { strictSemester: 'sp26' }).length).toBe(1);
  });
});
