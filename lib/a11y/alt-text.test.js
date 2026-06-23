import { describe, test, expect } from 'vitest';
import { auditAltText } from './alt-text.js';

// Minimal stand-in for a parsed item (mirrors the parser's shape:
// tags=Set, fields=Map, children=[], sourceLine, text).
function item({ tags = [], fields = {}, line = 0, text = '' }) {
  return {
    tags: new Set(tags),
    fields: new Map(Object.entries(fields)),
    children: [],
    sourceLine: line,
    text,
  };
}

describe('auditAltText', () => {
  test('returns an alt-text stage shape', () => {
    const stage = auditAltText({ items: [] });
    expect(stage.stage).toBe('alt-text');
    expect(stage.ok).toBe(true);
    expect(stage.rows).toEqual([]);
  });

  test('flags a #diagram with no [alt::], citing its line', () => {
    const parsed = { items: [item({ tags: ['diagram'], line: 12, text: 'state machine' })] };
    const stage = auditAltText(parsed);
    expect(stage.ok).toBe(false);
    expect(stage.rows).toHaveLength(1);
    expect(stage.rows[0].pass).toBe(false);
    expect(stage.rows[0].detail).toMatch(/12/);
  });

  test('passes a #diagram that carries [alt::]', () => {
    const parsed = { items: [item({ tags: ['diagram'], fields: { alt: 'a state machine' } })] };
    expect(auditAltText(parsed).ok).toBe(true);
  });

  test('flags a #slide [layout:: diagram] missing alt but ignores non-diagram slides', () => {
    const parsed = {
      items: [
        item({ tags: ['slide'], fields: { layout: 'diagram' }, line: 5 }),
        item({ tags: ['slide'], fields: { layout: 'concept' }, line: 7 }),
      ],
    };
    const stage = auditAltText(parsed);
    expect(stage.ok).toBe(false);
    expect(stage.rows).toHaveLength(1);
    expect(stage.rows[0].detail).toMatch(/5/);
  });

  test('collects ALL missing-alt visuals, not just the first', () => {
    const parsed = {
      items: [item({ tags: ['diagram'], line: 1 }), item({ tags: ['diagram'], line: 2 })],
    };
    expect(auditAltText(parsed).rows).toHaveLength(2);
  });

  test('recurses into child items', () => {
    const parent = item({ tags: [], line: 1 });
    parent.children = [item({ tags: ['diagram'], line: 3 })];
    expect(auditAltText({ items: [parent] }).ok).toBe(false);
  });
});
