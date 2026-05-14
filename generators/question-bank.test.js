import { describe, it, expect } from 'vitest';
import { parse, validate } from '../parser/index.js';
import { generateQuestionBank } from './question-bank.js';

const FIXTURE = 'examples/file_systems_abstraction_lecture_main.md';

describe('question-bank generator', () => {
  it('emits a markdown bank with one block per question', () => {
    const r = parse({ path: FIXTURE });
    expect(validate(r).ok).toBe(true);
    const md = generateQuestionBank(r);
    expect(md).toContain('# File Systems');
    expect(md).toContain('Question Bank');
    // 18 questions in fixture → 18 ## headers under the title
    const blocks = (md.match(/^## [mtcfs]\d{2}/gm) || []).length;
    expect(blocks).toBe(18);
  });

  it('numbers ids as <typeletter><nn>, padded, sequential within type', () => {
    const r = parse({ path: FIXTURE });
    const md = generateQuestionBank(r);
    expect(md).toMatch(/## m01/);
    expect(md).toMatch(/## m07/); // 7 mc questions
    expect(md).toMatch(/## t01/);
    expect(md).toMatch(/## t03/); // 3 tf questions
    expect(md).toMatch(/## c01/); // 1 code question
    expect(md).toMatch(/## f01/);
    expect(md).toMatch(/## f03/); // 3 fib questions
    expect(md).toMatch(/## s01/);
    expect(md).toMatch(/## s04/); // 4 sa questions
  });

  it('emits options block for mc questions from child bullets', () => {
    const r = parse({ path: FIXTURE });
    const md = generateQuestionBank(r);
    // First mc question: about block device
    expect(md).toMatch(/options:/);
    expect(md).toMatch(/A\.\s+A tree of named files/);
    expect(md).toMatch(/B\.\s+A flat array/);
  });

  it('emits answer line for every question', () => {
    const r = parse({ path: FIXTURE });
    const md = generateQuestionBank(r);
    const answerCount = (md.match(/^- answer:/gm) || []).length;
    expect(answerCount).toBe(18);
  });

  it('marks #type/fib questions as exam-eligible: false (validator already stripped)', () => {
    const r = parse({ path: FIXTURE });
    const md = generateQuestionBank(r);
    // The 3 fib questions in fixture had no #exam-eligible to begin with — confirm explicit false
    const fibBlocks = md.split(/^## /m).filter(b => b.match(/^f\d/m));
    for (const block of fibBlocks) {
      expect(block).toMatch(/exam-eligible:\s*false/);
    }
  });

  it('preserves source order across types (questions interleaved by section)', () => {
    const r = parse({ path: FIXTURE });
    const md = generateQuestionBank(r);
    // Source order: 7 mc, then 3 tf, then 1 code, then 4 sa, then 3 fib
    // First id should be m01, last should be f03
    const ids = (md.match(/^## ([mtcfs]\d{2})/gm) || []).map(s => s.replace('## ', ''));
    expect(ids[0]).toBe('m01');
    expect(ids[ids.length - 1]).toBe('f03');
  });

  it('includes section, difficulty, points fields per question', () => {
    const r = parse({ path: FIXTURE });
    const md = generateQuestionBank(r);
    expect(md).toMatch(/section:\s*I\b/);
    expect(md).toMatch(/difficulty:\s*1\b/);
    expect(md).toMatch(/points:\s*2\b/);
  });

  describe('semester filter', () => {
    const SRC = `---
title: t
course: CECS 326
term: sp26
---
## I. S
### Bank
- #question #type/mc #difficulty/1 #section/I #exam-eligible [answer:: A]
  Stem: evergreen-q?
  - A. ok
  - B. no
- #question #type/mc #difficulty/1 #section/I #exam-eligible #used/sp26 [answer:: A]
  Stem: sp26q?
  - A. ok
  - B. no
- #question #type/mc #difficulty/1 #section/I #exam-eligible #used/sp24 [answer:: A]
  Stem: sp24q?
  - A. ok
  - B. no
`;
    it('no filter — all 3 questions in bank', () => {
      const r = parse({ source: SRC });
      const md = generateQuestionBank(r);
      expect(md).toContain('evergreen-q');
      expect(md).toContain('sp26q');
      expect(md).toContain('sp24q');
    });
    it('loose semester=sp26 keeps tagged + untagged', () => {
      const r = parse({ source: SRC });
      const md = generateQuestionBank(r, { semester: 'sp26' });
      expect(md).toContain('evergreen-q');
      expect(md).toContain('sp26q');
      expect(md).not.toContain('sp24q');
    });
    it('strict semester=sp26 keeps tagged only', () => {
      const r = parse({ source: SRC });
      const md = generateQuestionBank(r, { strictSemester: 'sp26' });
      expect(md).not.toContain('evergreen-q');
      expect(md).toContain('sp26q');
      expect(md).not.toContain('sp24q');
    });
  });
});
