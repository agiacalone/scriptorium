import { describe, it, expect } from 'vitest';
import { parse } from './main-parser.js';
import { validate } from './validators.js';

function v(src) { return validate(parse({ source: src })); }

describe('validators: hard errors', () => {
  it('flags #blank without [slide:: N]', () => {
    const r = v(`---\ntitle: t\n---\n## I. S\n- a _____ blank #blank #section/I [answer:: x]\n`);
    expect(r.ok).toBe(false);
    expect(r.errors.some(e => /blank.*slide/i.test(e.message))).toBe(true);
  });

  it('flags #question #type/mc without [answer::]', () => {
    const r = v(`---\ntitle: t\n---\n## I. S\n- #question #type/mc #section/I [options:: A; B]\n`);
    expect(r.errors.some(e => /mc.*answer|answer/i.test(e.message))).toBe(true);
  });

  it('flags #question #type/mc without [options::] and no child bullets', () => {
    const r = v(`---\ntitle: t\n---\n## I. S\n- #question #type/mc #section/I [answer:: A]\n  Stem: q?\n`);
    expect(r.errors.some(e => /options/i.test(e.message))).toBe(true);
  });

  it('accepts #question #type/mc with child-bullet options', () => {
    const r = v(`---\ntitle: t\n---\n## I. S\n- #question #type/mc #section/I [answer:: B]\n  Stem: q?\n  - A. wrong\n  - B. right\n  - C. wrong\n  - D. wrong\n`);
    expect(r.errors).toEqual([]);
  });

  it('flags #question without exactly one #type/*', () => {
    const r = v(`---\ntitle: t\n---\n## I. S\n- #question #section/I [answer:: x]\n`);
    expect(r.errors.some(e => /type/i.test(e.message))).toBe(true);
  });

  it('flags #question with multiple #section/* tags', () => {
    const r = v(`---\ntitle: t\n---\n## I. S\n- #question #type/sa #section/I #section/II [answer:: x]\n  prompt\n`);
    expect(r.errors.some(e => /section/i.test(e.message))).toBe(true);
  });

  it('flags unknown #type/X', () => {
    const r = v(`---\ntitle: t\n---\n## I. S\n- #question #type/bogus #section/I [answer:: x]\n  prompt\n`);
    expect(r.errors.some(e => /type/i.test(e.message))).toBe(true);
  });

  it('flags missing or invalid layout on #slide', () => {
    const r1 = v(`---\ntitle: t\n---\n## I. S\n### Slide deck source\n- #slide [slide:: 1] **t**\n`);
    expect(r1.errors.some(e => /layout/i.test(e.message))).toBe(true);
    const r2 = v(`---\ntitle: t\n---\n## I. S\n### Slide deck source\n- #slide [slide:: 1] [layout:: bogus] **t**\n`);
    expect(r2.errors.some(e => /layout/i.test(e.message))).toBe(true);
  });

  it('flags #diagram without [alt::]', () => {
    const r = v(`---\ntitle: t\n---\n## I. S\n- the diagram #diagram #section/I\n`);
    expect(r.errors.some(e => /alt/i.test(e.message))).toBe(true);
  });

  it('flags #slide [layout:: diagram] without [alt::]', () => {
    const r = v(`---\ntitle: t\n---\n## I. S\n### Slide deck source\n- #slide [slide:: 1] [layout:: diagram] **t**\n`);
    expect(r.errors.some(e => /alt/i.test(e.message))).toBe(true);
  });

  it('flags #blank citing missing #slide [slide:: N]', () => {
    const r = v(`---\ntitle: t\n---\n## I. S\n### Cornell blanks\n- a _____ blank #blank #section/I [slide:: 99] [answer:: x]\n### Slide deck source\n- #slide [slide:: 1] [layout:: title] **t**\n`);
    expect(r.errors.some(e => /99/.test(e.message))).toBe(true);
  });

  it('passes a minimal valid main', () => {
    const r = v(`---\ntitle: t\nadversarial-thinking: false\n---\n## I. S\n### Cornell blanks\n- a _____ blank #blank #section/I [slide:: 1] [answer:: x]\n### Slide deck source\n- #slide [slide:: 1] [layout:: title] **t**\n`);
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });
});

describe('validators: soft warnings', () => {
  it('strips #exam-eligible from #type/fib and warns', () => {
    const r = v(`---\ntitle: t\n---\n## I. S\n- #question #type/fib #section/I #exam-eligible [answer:: x]\n  prompt _____\n### Slide deck source\n- #slide [slide:: 1] [layout:: title] **t**\n`);
    expect(r.warnings.some(w => /fib.*exam-eligible/i.test(w.message))).toBe(true);
  });

  it('warns on #question without #difficulty/*', () => {
    const r = v(`---\ntitle: t\n---\n## I. S\n- #question #type/sa #section/I [answer:: x]\n  prompt\n### Slide deck source\n- #slide [slide:: 1] [layout:: title] **t**\n`);
    expect(r.warnings.some(w => /difficulty/i.test(w.message))).toBe(true);
  });

  it('warns when adversarial-thinking: true but no #adversarial item exists', () => {
    const r = v(`---\ntitle: t\nadversarial-thinking: true\n---\n## I. S\n### Slide deck source\n- #slide [slide:: 1] [layout:: title] **t**\n`);
    expect(r.warnings.some(w => /adversarial/i.test(w.message))).toBe(true);
  });
});
