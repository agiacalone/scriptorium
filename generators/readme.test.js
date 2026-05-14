import { describe, it, expect } from 'vitest';
import { parse } from '../parser/index.js';
import { generateReadme } from './readme.js';

const FIXTURE = 'examples/file_systems_abstraction_lecture_main.md';

describe('readme generator (reading variant)', () => {
  it('emits a README with title, learning goals, reading questions, deliverables', () => {
    const r = parse({ path: FIXTURE });
    const md = generateReadme(r);
    expect(md).toMatch(/^# File Systems/m);
    expect(md).toContain('## Learning Goals');
    expect(md).toContain('## Reading Questions');
    expect(md).toContain('## Deliverables');
    expect(md).toContain('## Please note');
  });

  it('renders all 5 #objective items as Learning Goals bullets', () => {
    const r = parse({ path: FIXTURE });
    const md = generateReadme(r);
    const goalsArea = md.slice(md.indexOf('## Learning Goals'), md.indexOf('##', md.indexOf('## Learning Goals') + 1));
    expect((goalsArea.match(/^-\s/gm) || []).length).toBe(5);
  });

  it('renders self-quiz items as Reading Questions (10 in fixture)', () => {
    const r = parse({ path: FIXTURE });
    const md = generateReadme(r);
    const start = md.indexOf('## Reading Questions');
    const end = md.indexOf('## Deliverables');
    const area = md.slice(start, end);
    expect((area.match(/^-\s/gm) || []).length).toBeGreaterThanOrEqual(10);
    // No backtick `Q1.` artifact
    expect(area).not.toMatch(/`Q\d+\.`/);
  });

  it('extracts summary paragraph from body', () => {
    const r = parse({ path: FIXTURE });
    const md = generateReadme(r);
    expect(md).toContain('A file system is an abstract data structure');
  });
});

describe('readme generator (lab variant)', () => {
  it('emits Requirements section instead of Reading Questions', () => {
    const r = parse({ path: FIXTURE });
    const md = generateReadme(r, { variant: 'lab' });
    expect(md).toContain('## Requirements');
    expect(md).not.toContain('## Reading Questions');
  });

  it('uses section titles as Requirements bullets', () => {
    const r = parse({ path: FIXTURE });
    const md = generateReadme(r, { variant: 'lab' });
    const start = md.indexOf('## Requirements');
    const end = md.indexOf('## Deliverables');
    const area = md.slice(start, end);
    // 4 sections in fixture
    expect((area.match(/^-\s/gm) || []).length).toBe(4);
  });

  describe('semester filter', () => {
    const SRC = `---
title: t
course: CECS 326
term: sp26
topic-slug: t
assessment-format: reading
---
## I. S
- Evergreen learning goal #objective
- Sp26 learning goal #objective #used/sp26
- Sp24 learning goal #objective #used/sp24
- Evergreen prompt #self-quiz #section/I
- Sp26 prompt #self-quiz #section/I #used/sp26
- Sp24 prompt #self-quiz #section/I #used/sp24
`;
    it('no filter — all goals + prompts present', () => {
      const r = parse({ source: SRC });
      const md = generateReadme(r);
      expect(md).toContain('Evergreen learning goal');
      expect(md).toContain('Sp24 learning goal');
    });
    it('loose semester=sp26 keeps tagged + untagged', () => {
      const r = parse({ source: SRC });
      const md = generateReadme(r, { semester: 'sp26' });
      expect(md).toContain('Evergreen learning goal');
      expect(md).toContain('Sp26 learning goal');
      expect(md).not.toContain('Sp24 learning goal');
    });
    it('strict semester=sp26 keeps tagged only', () => {
      const r = parse({ source: SRC });
      const md = generateReadme(r, { strictSemester: 'sp26' });
      expect(md).not.toContain('Evergreen learning goal');
      expect(md).toContain('Sp26 learning goal');
      expect(md).not.toContain('Sp24 learning goal');
    });
  });
});
