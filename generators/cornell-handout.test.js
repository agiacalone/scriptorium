import { describe, it, expect } from 'vitest';
import { parse, validate } from '../parser/index.js';
import { generateCornellHandout } from './cornell-handout.js';

const FIXTURE = 'examples/file_systems_abstraction_lecture_main.md';

// generateCornellHandout now returns { handoutTex, keyTex } (mirrors the quiz
// generator's { quizTex, keyTex }). Most assertions target the student handout.
const handout = (r, o) => generateCornellHandout(r, o).handoutTex;

describe('cornell-handout generator', () => {
  it('handout and key both begin with \\DocumentMetadata{testphase} (tagged, ADA Title II)', () => {
    const r = parse({ path: FIXTURE });
    const { handoutTex, keyTex } = generateCornellHandout(r);
    for (const tex of [handoutTex, keyTex]) {
      expect(tex.trimStart()).toMatch(/^\\DocumentMetadata\{[^}]*testphase/);
      expect(tex.indexOf('\\DocumentMetadata')).toBeLessThan(tex.indexOf('\\documentclass'));
    }
  });

  it('emits a valid LaTeX document', () => {
    const r = parse({ path: FIXTURE });
    expect(validate(r).ok).toBe(true);
    const tex = handout(r);
    expect(tex).toContain('\\documentclass');
    expect(tex).toContain('\\begin{document}');
    expect(tex).toContain('\\end{document}');
  });

  it('includes the Vocabulary fill-in block before section I', () => {
    const r = parse({ path: FIXTURE });
    const tex = handout(r);
    const vocabIdx = tex.indexOf('Vocabulary');
    const sectionI = tex.indexOf('Files as Abstraction');
    expect(vocabIdx).toBeGreaterThan(0);
    expect(vocabIdx).toBeLessThan(sectionI);
  });

  it('renders each #blank as a row with _______ marker', () => {
    const r = parse({ path: FIXTURE });
    const tex = handout(r);
    const blankRows = (tex.match(/_______/g) || []).length;
    expect(blankRows).toBeGreaterThanOrEqual(40);
  });

  it('skips #notes-only items', () => {
    const src = `---\ntitle: t\n---\n## I. S\n### Cornell blanks\n- in handout #blank #section/I [slide:: 1] [answer:: x]\n- not in handout #blank #notes-only #section/I [slide:: 1] [answer:: y]\n### Slide deck source\n- #slide [slide:: 1] [layout:: title] **t**\n`;
    const r = parse({ source: src });
    const tex = handout(r);
    expect(tex).toContain('in handout');
    expect(tex).not.toContain('not in handout');
  });

  it('includes Self-Quiz section', () => {
    const r = parse({ path: FIXTURE });
    const tex = handout(r);
    expect(tex).toMatch(/Self-Quiz/);
  });

  it('includes Summary fill-in (3 numbered blanks)', () => {
    const r = parse({ path: FIXTURE });
    const tex = handout(r);
    expect(tex).toMatch(/Summary/);
    const summaryArea = tex.slice(tex.indexOf('Summary'));
    expect((summaryArea.match(/_______/g) || []).length).toBeGreaterThanOrEqual(3);
  });

  it('includes References pulled from main.md body', () => {
    const r = parse({ path: FIXTURE });
    const tex = handout(r);
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
      const tex = handout(r);
      expect(tex).toContain('Evergreen blank');
      expect(tex).toContain('Sp26 blank');
      expect(tex).toContain('Sp24 blank');
    });
    it('loose semester=sp26 keeps tagged + untagged', () => {
      const r = parse({ source: SRC });
      const tex = handout(r, { semester: 'sp26' });
      expect(tex).toContain('Evergreen blank');
      expect(tex).toContain('Sp26 blank');
      expect(tex).not.toContain('Sp24 blank');
    });
    it('strict semester=sp26 keeps tagged only', () => {
      const r = parse({ source: SRC });
      const tex = handout(r, { strictSemester: 'sp26' });
      expect(tex).not.toContain('Evergreen blank');
      expect(tex).toContain('Sp26 blank');
      expect(tex).not.toContain('Sp24 blank');
    });
  });

  // Regression coverage for the in-class answer key (lost in the May-14 amnesty
  // commit f085e277, restored on fix/restore-cornell-answer-key).
  describe('answer key', () => {
    const SRC = `---
title: Buffers
course: CECS 378
---
## I. Anatomy
### Cornell blanks
- A worm corrupts _______ and tricks the _______ into running bytes. #blank #section/I [slide:: 2] [answer:: memory; CPU]
### Vocabulary
- **canary** — a guard value placed before the saved return address #vocab #section/vocab [slide:: 3]
### Slide deck source
- #slide [slide:: 2] [layout:: title] **t**
`;

    it('returns both a handout and a key tex', () => {
      const r = parse({ source: SRC });
      const out = generateCornellHandout(r);
      expect(out).toHaveProperty('handoutTex');
      expect(out).toHaveProperty('keyTex');
      expect(typeof out.handoutTex).toBe('string');
      expect(typeof out.keyTex).toBe('string');
    });

    it('defines the \\ifanswers toggle; student is \\answersfalse, key is \\answerstrue', () => {
      const r = parse({ source: SRC });
      const { handoutTex, keyTex } = generateCornellHandout(r);
      expect(handoutTex).toContain('\\newif\\ifanswers');
      expect(handoutTex).toContain('\\answersfalse');
      expect(handoutTex).not.toContain('\\answerstrue');
      expect(keyTex).toContain('\\answerstrue');
      expect(keyTex).not.toContain('\\answersfalse');
    });

    it('carries the INSTRUCTOR-ONLY banner gated behind \\ifanswers', () => {
      const r = parse({ source: SRC });
      const { handoutTex } = generateCornellHandout(r);
      expect(handoutTex).toContain('ANSWER KEY');
      // Banner is inside an \ifanswers block so it only renders in the key PDF.
      const bannerIdx = handoutTex.indexOf('ANSWER KEY');
      const ifIdx = handoutTex.lastIndexOf('\\ifanswers', bannerIdx);
      expect(ifIdx).toBeGreaterThanOrEqual(0);
    });

    it('substitutes blank answers in red, one per _______ run, in order', () => {
      const r = parse({ source: SRC });
      const { keyTex } = generateCornellHandout(r);
      expect(keyTex).toContain('\\textcolor{studRose}{\\textbf{memory}}');
      expect(keyTex).toContain('\\textcolor{studRose}{\\textbf{CPU}}');
    });

    it('reveals vocab definitions in the key, gated behind \\ifanswers', () => {
      const r = parse({ source: SRC });
      const { handoutTex } = generateCornellHandout(r);
      expect(handoutTex).toContain('a guard value placed before the saved return address');
    });

    it('student handout hides answers behind the \\else branch (still blank space)', () => {
      const r = parse({ source: SRC });
      const { handoutTex } = generateCornellHandout(r);
      // The fill cell wraps the reveal in \ifanswers … \else <blank> \fi, so the
      // student build (\answersfalse) renders the \else branch — writing space.
      expect(handoutTex).toMatch(/\\ifanswers .*\\else .*\\fi/s);
    });
  });
});
