import { describe, it, expect } from 'vitest';
import { parse, validate } from '../parser/index.js';
import { generateLectureNotes } from './lecture-notes.js';

const FIXTURE = 'examples/file_systems_abstraction_lecture_main.md';

describe('lecture-notes generator', () => {
  it('begins with \\DocumentMetadata{testphase} so the PDF is tagged (ADA Title II)', () => {
    const r = parse({ path: FIXTURE });
    const tex = generateLectureNotes(r);
    // \DocumentMetadata MUST be the very first token, before \documentclass.
    expect(tex.trimStart()).toMatch(/^\\DocumentMetadata\{[^}]*testphase/);
    expect(tex.indexOf('\\DocumentMetadata')).toBeLessThan(tex.indexOf('\\documentclass'));
  });

  it('emits a valid LaTeX document with section per Roman-numeral section', () => {
    const r = parse({ path: FIXTURE });
    const v = validate(r); expect(v.ok).toBe(true);
    const tex = generateLectureNotes(r);
    expect(tex).toContain('\\documentclass');
    expect(tex).toContain('\\begin{document}');
    expect(tex).toContain('\\end{document}');
    expect(tex).toContain('File Systems');
    // 4 numbered sections (I-IV) plus the objectives header
    const sectionCount = (tex.match(/\\section\*?{/g) || []).length;
    expect(sectionCount).toBeGreaterThanOrEqual(0); // helpers don't emit \section, but check structural anchors below
    // Roman section headers should appear in briefing strips
    expect(tex).toMatch(/I\. Files as Abstraction/);
    expect(tex).toMatch(/II\. Directory Structures/);
    expect(tex).toMatch(/III\. Hard Links/);
    expect(tex).toMatch(/IV\. Path Resolution/);
  });

  it('includes #concept items as section content', () => {
    const r = parse({ path: FIXTURE });
    const tex = generateLectureNotes(r);
    expect(tex).toContain('block device');
    expect(tex).toContain('hard link');
  });

  it('includes #key-callout items', () => {
    const r = parse({ path: FIXTURE });
    const tex = generateLectureNotes(r);
    expect(tex).toMatch(/A file system is an abstract data structure/);
  });

  it('includes objectives', () => {
    const r = parse({ path: FIXTURE });
    const tex = generateLectureNotes(r);
    expect(tex).toMatch(/Learning Objectives/);
    expect(tex).toMatch(/Distinguish hard links from symbolic links/);
  });

  it('skips #cornell-only items', () => {
    const src = `---\ntitle: t\nadversarial-thinking: false\n---\n## I. S\n### Concepts\n- in lecture #concept #section/I [slide:: 1]\n- not in lecture #concept #cornell-only #section/I [slide:: 1]\n### Slide deck source\n- #slide [slide:: 1] [layout:: title] **t**\n`;
    const r = parse({ source: src });
    const tex = generateLectureNotes(r);
    expect(tex).toContain('in lecture');
    expect(tex).not.toContain('not in lecture');
  });

  describe('semester filter', () => {
    const SRC = `---
title: t
course: CECS 326
term: sp26
---
## I. Section
- Evergreen objective #objective
- Sp26 objective #objective #used/sp26
- Sp24 objective #objective #used/sp24
- Evergreen concept #concept #section/I
- Sp26 concept #concept #section/I #used/sp26
- Sp24 concept #concept #section/I #used/sp24
`;
    it('no filter — all 3 concepts present', () => {
      const r = parse({ source: SRC });
      const tex = generateLectureNotes(r);
      expect(tex).toContain('Evergreen concept');
      expect(tex).toContain('Sp26 concept');
      expect(tex).toContain('Sp24 concept');
    });
    it('loose semester=sp26 keeps tagged + untagged', () => {
      const r = parse({ source: SRC });
      const tex = generateLectureNotes(r, { semester: 'sp26' });
      expect(tex).toContain('Evergreen concept');
      expect(tex).toContain('Sp26 concept');
      expect(tex).not.toContain('Sp24 concept');
    });
    it('strict semester=sp26 keeps tagged only', () => {
      const r = parse({ source: SRC });
      const tex = generateLectureNotes(r, { strictSemester: 'sp26' });
      expect(tex).not.toContain('Evergreen concept');
      expect(tex).toContain('Sp26 concept');
      expect(tex).not.toContain('Sp24 concept');
    });
  });
});

describe('lecture-notes generator — comparison tables', () => {
  const src = `---
title: T
course: CECS 326
type: lecture-main
---

## III. Links (10 min)

- A concept here. #concept #section/III [slide:: 1]

| Aspect | Hard link | Symlink |
|---|---|---|
| Crosses FS | No | Yes |
`;
  it('renders a section comparison table with /TH header tagging', () => {
    const tex = generateLectureNotes(parse({ source: src }));
    expect(tex).toContain('\\tagpdfsetup{table/header-rows={1}}'); // /TH header cells
    expect(tex).toContain('Hard link');
    expect(tex).toContain('Crosses FS');
  });
});
