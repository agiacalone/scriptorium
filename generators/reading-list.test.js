import { describe, it, expect } from 'vitest';
import { parse } from '../parser/index.js';
import { generateReadingList } from './reading-list.js';

const FIXTURE = 'examples/file_systems_abstraction_lecture_main.md';

describe('reading-list generator', () => {
  it('emits a full scaffold with frontmatter and TODO callouts when no existing content', () => {
    const r = parse({ path: FIXTURE });
    const md = generateReadingList(r);
    expect(md).toMatch(/^---\n/);
    expect(md).toContain('type: reading-list-companion');
    expect(md).toContain('How to use this document');
    expect(md).toContain('Primary source');
    expect(md).toContain('Cues newer than the textbook');
    expect(md).toContain('<!-- generator: cue-tables -->');
    expect(md).toContain('<!-- /generator -->');
  });

  it('emits a section subhead + cue table for each Roman-numeral section that has citations', () => {
    const r = parse({ path: FIXTURE });
    const md = generateReadingList(r);
    expect(md).toMatch(/§I\s*—\s*Files as Abstraction/);
    expect(md).toMatch(/§II\s*—\s*Directory Structures/);
    expect(md).toMatch(/§III\s*—\s*Hard Links vs Symbolic Links/);
    expect(md).toMatch(/§IV\s*—\s*Path Resolution and Live Demo/);
    expect(md).toMatch(/\| Cue \| Source \|/);
  });

  it('renders citations from [citation::] field as the Source column', () => {
    const r = parse({ path: FIXTURE });
    const md = generateReadingList(r);
    expect(md).toMatch(/Tanenbaum 4\.1/);
    expect(md).toMatch(/Tanenbaum 4\.2/);
  });

  it('preserves manual content outside the fence on regen', () => {
    const r = parse({ path: FIXTURE });
    const fresh = generateReadingList(r);
    const manual = fresh
      .replace('<!-- TODO author: 1-2 sentences telling students how to consume this list -->', 'Read the cues in order; cite the textbook section beside each.')
      .replace('## Supplementary readings\n\n<!-- TODO author: rows beyond textbook. Each as `- [Title](url) — one-line description #tag` -->', '## Supplementary readings\n\n- [Aleph One — Smashing the Stack](https://example.com) — primary source #primary');
    const regen = generateReadingList(r, { existing: manual });
    expect(regen).toContain('Read the cues in order; cite the textbook section beside each.');
    expect(regen).toContain('Aleph One — Smashing the Stack');
    expect(regen).toContain('<!-- generator: cue-tables -->');
    expect(regen).toMatch(/§I\s*—/);
  });

  it('throws a clear error if existing file has no fence markers', () => {
    const r = parse({ path: FIXTURE });
    expect(() => generateReadingList(r, { existing: '# manually rolled\nno fence here\n' }))
      .toThrow(/fence missing|generator: cue-tables/i);
  });

  describe('semester filter', () => {
    const SRC = `---
title: t
course: CECS 326
term: sp26
topic-slug: t
---
## I. First
- Evergreen item #concept #section/I [citation:: Tanenbaum 1.1]
- Sp26 item #concept #section/I #used/sp26 [citation:: Tanenbaum 1.2]
- Sp24 item #concept #section/I #used/sp24 [citation:: Tanenbaum 1.3]
`;
    it('no filter — all 3 citations present', () => {
      const r = parse({ source: SRC });
      const md = generateReadingList(r);
      expect(md).toContain('Tanenbaum 1.1');
      expect(md).toContain('Tanenbaum 1.2');
      expect(md).toContain('Tanenbaum 1.3');
    });
    it('loose semester=sp26 keeps tagged + untagged', () => {
      const r = parse({ source: SRC });
      const md = generateReadingList(r, { semester: 'sp26' });
      expect(md).toContain('Tanenbaum 1.1');
      expect(md).toContain('Tanenbaum 1.2');
      expect(md).not.toContain('Tanenbaum 1.3');
    });
    it('strict semester=sp26 keeps tagged only', () => {
      const r = parse({ source: SRC });
      const md = generateReadingList(r, { strictSemester: 'sp26' });
      expect(md).not.toContain('Tanenbaum 1.1');
      expect(md).toContain('Tanenbaum 1.2');
      expect(md).not.toContain('Tanenbaum 1.3');
    });
  });
});
