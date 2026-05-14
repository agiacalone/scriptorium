import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parse } from '../parser/index.js';
import { generateExam } from './exam.js';

const FIXTURE = 'examples/file_systems_abstraction_lecture_main.md';

const SPEC = {
  course: 'CECS 326',
  name: 'Sample Exam',
  term: 'sp26',
  totalPoints: 30,
  fileBase: '326-sample-sp26',
  randomize: false,
  weighting: { file_systems_abstraction: 1 },
  sections: [
    { type: 'mc', pointsEach: 2, count: 5 },
    { type: 'sa', pointsEach: 5, count: 2 },
  ],
};

describe('exam generator', () => {
  it('returns examTex + keyTex strings + picked + warnings', () => {
    const docs = [parse({ path: FIXTURE })];
    const result = generateExam(docs, SPEC);
    expect(typeof result.examTex).toBe('string');
    expect(typeof result.keyTex).toBe('string');
    expect(Array.isArray(result.picked)).toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);
    expect(result.examTex).toContain('\\documentclass');
    expect(result.keyTex).toContain('\\documentclass');
  });

  it('picks the requested counts per section type', () => {
    const docs = [parse({ path: FIXTURE })];
    const result = generateExam(docs, SPEC);
    expect(result.picked.length).toBe(7);
  });

  it('exam version has \\answersfalse, key has \\answerstrue', () => {
    const docs = [parse({ path: FIXTURE })];
    const result = generateExam(docs, SPEC);
    expect(result.examTex).toMatch(/\\answersfalse/);
    expect(result.keyTex).toMatch(/\\answerstrue/);
  });

  it('strips #type/fib from pool — fib never on exams', () => {
    const docs = [parse({ path: FIXTURE })];
    const result = generateExam(docs, SPEC);
    for (const q of result.picked) {
      expect([...q.tags].some(t => t === 'type/fib')).toBe(false);
    }
  });

  it('warns when totalPoints mismatch the section sum', () => {
    const docs = [parse({ path: FIXTURE })];
    const result = generateExam(docs, { ...SPEC, totalPoints: 999 });
    expect(result.warnings.some(w => /total/i.test(w.message ?? w))).toBe(true);
  });

  it('produces deterministic picks when randomize=false', () => {
    const docs = [parse({ path: FIXTURE })];
    const a = generateExam(docs, SPEC);
    const b = generateExam(docs, SPEC);
    expect(a.picked.map(p => p.text)).toEqual(b.picked.map(p => p.text));
  });

  it('produces stable randomized picks given a fixed seed', () => {
    const docs = [parse({ path: FIXTURE })];
    const a = generateExam(docs, { ...SPEC, randomize: true, randomSeed: 42 });
    const b = generateExam(docs, { ...SPEC, randomize: true, randomSeed: 42 });
    expect(a.picked.map(p => p.text)).toEqual(b.picked.map(p => p.text));
  });

  it('renders MC options as nested enumerate', () => {
    const docs = [parse({ path: FIXTURE })];
    const result = generateExam(docs, SPEC);
    expect(result.examTex).toMatch(/\\begin\{enumerate\}\[label=\(\\alph\*\)\]/);
  });

  it('key version contains answer-key labels', () => {
    const docs = [parse({ path: FIXTURE })];
    const result = generateExam(docs, SPEC);
    expect(result.keyTex).toMatch(/Answer:|Key:/);
  });

  describe('semester filter', () => {
    const FILTER_FIXTURE = `---
title: filter test
course: CECS 326
term: sp26
topic-slug: filter_test
type: lecture-main
---
## I. S
- #question #type/mc #difficulty/1 #section/I #exam-eligible [answer:: A]
  Stem: evergreen-eq?
  - A. ok
  - B. no
- #question #type/mc #difficulty/1 #section/I #exam-eligible #used/sp26 [answer:: A]
  Stem: sp26-eq?
  - A. ok
  - B. no
- #question #type/mc #difficulty/1 #section/I #exam-eligible #used/sp24 [answer:: A]
  Stem: sp24-eq?
  - A. ok
  - B. no
`;
    const SPEC2 = {
      course: 'CECS 326', name: 'filter', term: 'sp26',
      totalPoints: 6, fileBase: 'filter',
      sections: [{ type: 'mc', pointsEach: 2, count: 3 }],
    };
    it('no filter — pool has all 3 questions', () => {
      const docs = [parse({ source: FILTER_FIXTURE })];
      const r = generateExam(docs, SPEC2);
      expect(r.picked.length).toBe(3);
    });
    it('loose semester=sp26 keeps tagged + untagged (2)', () => {
      const docs = [parse({ source: FILTER_FIXTURE })];
      const r = generateExam(docs, { ...SPEC2, semester: 'sp26' });
      expect(r.picked.length).toBe(2);
      expect(r.examTex).not.toContain('sp24-eq');
    });
    it('strict semester=sp26 keeps tagged only (1)', () => {
      const docs = [parse({ source: FILTER_FIXTURE })];
      const r = generateExam(docs, { ...SPEC2, strictSemester: 'sp26' });
      expect(r.picked.length).toBe(1);
      expect(r.examTex).toContain('sp26-eq');
      expect(r.examTex).not.toContain('evergreen-eq');
    });
  });

  describe('mark-used', () => {
    const FIXTURE_MD = `---
title: mark-used test
course: CECS 326
term: sp26
topic-slug: mu_test
type: lecture-main
---
## I. S
- #question #type/mc #difficulty/1 #section/I #exam-eligible [answer:: A]
  Stem: q-one?
  - A. ok
  - B. no
- #question #type/mc #difficulty/1 #section/I #exam-eligible #used/sp24 [answer:: A]
  Stem: q-two?
  - A. ok
  - B. no
`;
    function mkTmp() {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lma-mu-'));
      const p = path.join(dir, 'mu_test_lecture_main.md');
      fs.writeFileSync(p, FIXTURE_MD, 'utf8');
      return p;
    }
    const SPEC3 = {
      course: 'CECS 326', name: 'mu', term: 'sp26',
      totalPoints: 4, fileBase: 'mu',
      sections: [{ type: 'mc', pointsEach: 2, count: 2 }],
    };
    it('writes #used/<term> back to source main for picked items', () => {
      const tmpPath = mkTmp();
      const docs = [parse({ path: tmpPath })];
      const r = generateExam(docs, { ...SPEC3, markUsed: 'sp27' });
      expect(r.markUsed).toBeDefined();
      expect(r.markUsed.modified).toBe(2);
      const after = fs.readFileSync(tmpPath, 'utf8');
      // Both picked lines now carry #used/sp27
      expect((after.match(/#used\/sp27/g) || []).length).toBe(2);
      // Existing #used/sp24 was preserved on q-two line
      expect(after).toContain('#used/sp24');
    });
    it('is idempotent — second run does not double-tag', () => {
      const tmpPath = mkTmp();
      const docs1 = [parse({ path: tmpPath })];
      generateExam(docs1, { ...SPEC3, markUsed: 'sp27' });
      const docs2 = [parse({ path: tmpPath })];
      const r2 = generateExam(docs2, { ...SPEC3, markUsed: 'sp27' });
      expect(r2.markUsed.modified).toBe(0);
      expect(r2.markUsed.alreadyTagged).toBe(2);
      const after = fs.readFileSync(tmpPath, 'utf8');
      expect((after.match(/#used\/sp27/g) || []).length).toBe(2);
    });
    it('does not mangle nested children of an item', () => {
      const tmpPath = mkTmp();
      const before = fs.readFileSync(tmpPath, 'utf8');
      const docs = [parse({ path: tmpPath })];
      generateExam(docs, { ...SPEC3, markUsed: 'sp27' });
      const after = fs.readFileSync(tmpPath, 'utf8');
      // Children lines (option bullets) untouched
      for (const childLine of before.split('\n').filter(l => /^\s+-\s+[A-Z]\./.test(l))) {
        expect(after).toContain(childLine);
      }
    });
  });
});
