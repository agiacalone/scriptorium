import { describe, it, expect } from 'vitest';
import { parse } from '../parser/index.js';
import { generateQuiz } from './quiz.js';

const FIXTURE = 'examples/file_systems_abstraction_lecture_main.md';

describe('quiz generator', () => {
  it('returns quizTex and keyTex strings', () => {
    const r = parse({ path: FIXTURE });
    const result = generateQuiz(r);
    expect(typeof result.quizTex).toBe('string');
    expect(typeof result.keyTex).toBe('string');
    expect(result.quizTex).toContain('\\documentclass');
    expect(result.keyTex).toContain('\\documentclass');
  });

  it('quiz has \\keyfalse and key has \\keytrue', () => {
    const r = parse({ path: FIXTURE });
    const result = generateQuiz(r);
    expect(result.quizTex).toMatch(/\\keyfalse/);
    expect(result.keyTex).toMatch(/\\keytrue/);
  });

  it('picks 5 questions deterministically (same fixture → same picks)', () => {
    const r = parse({ path: FIXTURE });
    const a = generateQuiz(r);
    const b = generateQuiz(r);
    expect(a.picked.length).toBe(5);
    expect(b.picked.length).toBe(5);
    expect(a.picked.map(p => p.text)).toEqual(b.picked.map(p => p.text));
  });

  it('includes Multiple Choice and Short Answer sections', () => {
    const r = parse({ path: FIXTURE });
    const result = generateQuiz(r);
    expect(result.quizTex).toMatch(/Multiple Choice/);
    expect(result.quizTex).toMatch(/Short Answer/);
  });

  it('renders mc options as nested enumerate', () => {
    const r = parse({ path: FIXTURE });
    const result = generateQuiz(r);
    expect(result.quizTex).toMatch(/\\begin\{enumerate\}\[label=\(\\alph\*\)\]/);
  });

  it('key version contains answer letters or expected-key text', () => {
    const r = parse({ path: FIXTURE });
    const result = generateQuiz(r);
    expect(result.keyTex).toMatch(/Answer:|Key:/);
  });

  describe('semester filter', () => {
    const SRC = `---
title: t
course: CECS 326
term: sp26
---
## I. S
- #question #type/mc #difficulty/1 #section/I [slide:: 1] [answer:: A]
  Stem: evergreen-quizq?
  - A. ok
  - B. no
- #question #type/mc #difficulty/1 #section/I #used/sp26 [slide:: 2] [answer:: A]
  Stem: sp26-quizq?
  - A. ok
  - B. no
- #question #type/mc #difficulty/1 #section/I #used/sp24 [slide:: 3] [answer:: A]
  Stem: sp24-quizq?
  - A. ok
  - B. no
`;
    it('no filter — all 3 questions in pool (picked count limited)', () => {
      const r = parse({ source: SRC });
      const result = generateQuiz(r);
      expect(result.picked.length).toBeGreaterThanOrEqual(1);
    });
    it('loose semester=sp26 — pool excludes sp24 question', () => {
      const r = parse({ source: SRC });
      const result = generateQuiz(r, { semester: 'sp26' });
      expect(result.quizTex).not.toContain('sp24-quizq');
    });
    it('strict semester=sp26 — only sp26-tagged in pool', () => {
      const r = parse({ source: SRC });
      const result = generateQuiz(r, { strictSemester: 'sp26' });
      expect(result.quizTex).not.toContain('evergreen-quizq');
      expect(result.quizTex).not.toContain('sp24-quizq');
    });
  });
});
