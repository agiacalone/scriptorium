import { describe, it, expect } from 'vitest';
import { parse, validate } from '../parser/index.js';
import { generateStudyQuestions } from './study-questions.js';

const FIXTURE = 'examples/file_systems_abstraction_lecture_main.md';

describe('study-questions generator', () => {
  it('emits a markdown doc with frontmatter and 10 numbered questions', () => {
    const r = parse({ path: FIXTURE });
    expect(validate(r).ok).toBe(true);
    const md = generateStudyQuestions(r);
    expect(md).toMatch(/^---\n/);
    expect(md).toContain('type: study-questions');
    expect(md).toContain('# File Systems');
    // 10 numbered items
    const numberedLines = (md.match(/^\d+\.\s/gm) || []).length;
    expect(numberedLines).toBeGreaterThanOrEqual(10);
  });

  it('strips `Qn.` backtick prefix from self-quiz prompts', () => {
    const r = parse({ path: FIXTURE });
    const md = generateStudyQuestions(r);
    // No raw `Q1.` etc. should appear
    expect(md).not.toMatch(/`Q\d+\.`/);
    // The first question content (without prefix) should appear:
    expect(md).toContain('block device');
  });

  it('includes Reading Assignment and Deliverables sections', () => {
    const r = parse({ path: FIXTURE });
    const md = generateStudyQuestions(r);
    expect(md).toContain('## Reading Assignment');
    expect(md).toContain('## Deliverables');
  });

  it('omits Adversarial section when frontmatter is non-adversarial', () => {
    const r = parse({ path: FIXTURE });
    const md = generateStudyQuestions(r);
    expect(md).not.toMatch(/^## Adversarial/m);
  });

  it('emits Adversarial section when frontmatter is adversarial AND #self-quiz #adversarial items exist', () => {
    const src = `---\ntitle: t\ntopic-slug: t\nadversarial-thinking: true\n---\n## I. S\n- regular #self-quiz #section/I Q1.\n- attacker #self-quiz #adversarial #section/I Q2.\n### Slide deck source\n- #slide [slide:: 1] [layout:: title] **t**\n`;
    const r = parse({ source: src });
    const md = generateStudyQuestions(r);
    expect(md).toMatch(/## Adversarial/);
    expect(md).toMatch(/attacker/);
  });

  describe('semester filter', () => {
    const SRC = `---
title: t
course: CECS 326
term: sp26
---
## I. S
- Evergreen prompt #self-quiz #section/I
- Sp26 prompt #self-quiz #section/I #used/sp26
- Sp24 prompt #self-quiz #section/I #used/sp24
`;
    it('no filter — all 3 prompts present', () => {
      const r = parse({ source: SRC });
      const md = generateStudyQuestions(r);
      expect(md).toContain('Evergreen prompt');
      expect(md).toContain('Sp26 prompt');
      expect(md).toContain('Sp24 prompt');
    });
    it('loose semester=sp26 keeps tagged + untagged', () => {
      const r = parse({ source: SRC });
      const md = generateStudyQuestions(r, { semester: 'sp26' });
      expect(md).toContain('Evergreen prompt');
      expect(md).toContain('Sp26 prompt');
      expect(md).not.toContain('Sp24 prompt');
    });
    it('strict semester=sp26 keeps tagged only', () => {
      const r = parse({ source: SRC });
      const md = generateStudyQuestions(r, { strictSemester: 'sp26' });
      expect(md).not.toContain('Evergreen prompt');
      expect(md).toContain('Sp26 prompt');
      expect(md).not.toContain('Sp24 prompt');
    });
  });
});
