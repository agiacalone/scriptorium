import { describe, it, expect } from 'vitest';
import { parse, validate } from '../parser/index.js';
import { generateCornellHandout } from './cornell-handout.js';

const FIXTURE = 'examples/file_systems_abstraction_lecture_main.md';

describe('cornell-handout generator', () => {
  it('emits a valid LaTeX document', () => {
    const r = parse({ path: FIXTURE });
    expect(validate(r).ok).toBe(true);
    const tex = generateCornellHandout(r);
    expect(tex).toContain('\\documentclass');
    expect(tex).toContain('\\begin{document}');
    expect(tex).toContain('\\end{document}');
  });

  it('includes the Vocabulary fill-in block before section I', () => {
    const r = parse({ path: FIXTURE });
    const tex = generateCornellHandout(r);
    const vocabIdx = tex.indexOf('Vocabulary');
    const sectionI = tex.indexOf('Files as Abstraction');
    expect(vocabIdx).toBeGreaterThan(0);
    expect(vocabIdx).toBeLessThan(sectionI);
  });

  it('renders each #blank as a row with _______ marker', () => {
    const r = parse({ path: FIXTURE });
    const tex = generateCornellHandout(r);
    const blankRows = (tex.match(/_______/g) || []).length;
    expect(blankRows).toBeGreaterThanOrEqual(40);
  });

  it('skips #notes-only items', () => {
    const src = `---\ntitle: t\n---\n## I. S\n### Cornell blanks\n- in handout #blank #section/I [slide:: 1] [answer:: x]\n- not in handout #blank #notes-only #section/I [slide:: 1] [answer:: y]\n### Slide deck source\n- #slide [slide:: 1] [layout:: title] **t**\n`;
    const r = parse({ source: src });
    const tex = generateCornellHandout(r);
    expect(tex).toContain('in handout');
    expect(tex).not.toContain('not in handout');
  });

  it('includes Self-Quiz section', () => {
    const r = parse({ path: FIXTURE });
    const tex = generateCornellHandout(r);
    expect(tex).toMatch(/Self-Quiz/);
  });

  it('includes Summary fill-in (3 numbered blanks)', () => {
    const r = parse({ path: FIXTURE });
    const tex = generateCornellHandout(r);
    expect(tex).toMatch(/Summary/);
    const summaryArea = tex.slice(tex.indexOf('Summary'));
    expect((summaryArea.match(/_______/g) || []).length).toBeGreaterThanOrEqual(3);
  });

  it('includes References pulled from main.md body', () => {
    const r = parse({ path: FIXTURE });
    const tex = generateCornellHandout(r);
    expect(tex).toMatch(/Tanenbaum/);
  });

  describe('semester filter', () => {
    const SRC = `---
title: t
course: CECS 326
term: sp26
---
## I. First
### Cornell blanks
- Evergreen blank #blank #section/I [slide:: 1]
- Sp26 blank #blank #section/I #used/sp26 [slide:: 2]
- Sp24 blank #blank #section/I #used/sp24 [slide:: 3]
`;
    it('no filter — all 3 blanks render in cue rows', () => {
      const r = parse({ source: SRC });
      const tex = generateCornellHandout(r);
      expect(tex).toContain('Evergreen blank');
      expect(tex).toContain('Sp26 blank');
      expect(tex).toContain('Sp24 blank');
    });
    it('loose semester=sp26 keeps tagged + untagged', () => {
      const r = parse({ source: SRC });
      const tex = generateCornellHandout(r, { semester: 'sp26' });
      expect(tex).toContain('Evergreen blank');
      expect(tex).toContain('Sp26 blank');
      expect(tex).not.toContain('Sp24 blank');
    });
    it('strict semester=sp26 keeps tagged only', () => {
      const r = parse({ source: SRC });
      const tex = generateCornellHandout(r, { strictSemester: 'sp26' });
      expect(tex).not.toContain('Evergreen blank');
      expect(tex).toContain('Sp26 blank');
      expect(tex).not.toContain('Sp24 blank');
    });
  });
});
