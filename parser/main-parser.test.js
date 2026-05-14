import { describe, it, expect } from 'vitest';
import { parse } from './main-parser.js';

describe('parse: frontmatter', () => {
  it('extracts title, course, topic-slug, term, adversarial-thinking', () => {
    const src = `---
title: File Systems
course: CECS 326
topic-slug: file_systems_abstraction
term: sp26
adversarial-thinking: false
type: lecture-main
---
# File Systems
`;
    const r = parse({ source: src });
    expect(r.frontmatter.title).toBe('File Systems');
    expect(r.frontmatter.course).toBe('CECS 326');
    expect(r.frontmatter.topicSlug).toBe('file_systems_abstraction');
    expect(r.frontmatter.term).toBe('sp26');
    expect(r.frontmatter.adversarialThinking).toBe(false);
  });
});

describe('parse: items', () => {
  it('extracts tags and inline fields from a list bullet', () => {
    const src = `---
title: t
---
## I. Section
### Concepts
- Layered abstraction principle #concept #section/I [slide:: 6] [citation:: Tanenbaum 4.1]
`;
    const r = parse({ source: src });
    expect(r.items.length).toBe(1);
    const it0 = r.items[0];
    expect(it0.tags.has('concept')).toBe(true);
    expect(it0.tags.has('section/I')).toBe(true);
    expect(it0.fields.get('slide')).toBe('6');
    expect(it0.fields.get('citation')).toBe('Tanenbaum 4.1');
    expect(it0.text).toContain('Layered abstraction principle');
  });

  it('indexes items by tag and role', () => {
    const src = `---
title: t
---
## I. S
### Cornell blanks
- The _____ layer #blank #section/I [slide:: 4] [answer:: file]
- A second blank #blank #section/I [slide:: 5] [answer:: directory]
`;
    const r = parse({ source: src });
    expect(r.byRole.get('blank')?.length).toBe(2);
    expect(r.bySection.get('I')?.length).toBe(2);
    expect(r.byTag.get('blank')?.length).toBe(2);
  });
});

describe('parse: #used/<term> indexing', () => {
  it('indexes #used/<term> tags and exposes byTerm() helper', () => {
    const src = `---
title: t
---
## I. S
### Question Bank
- #question #type/mc #section/I #exam-eligible #used/sp24 #used/sp26 [answer:: B]
  Stem: q?
  - A. wrong
  - B. right
- #question #type/mc #section/I #exam-eligible #used/fa25 [answer:: A]
  Stem: q2?
  - A. right
  - B. wrong
- #question #type/mc #section/I #exam-eligible [answer:: A]
  Stem: q3 untagged
  - A. right
  - B. wrong
`;
    const r = parse({ source: src });
    expect(r.byTag.get('used/sp26')?.length).toBe(1);
    expect(r.byTag.get('used/sp24')?.length).toBe(1);
    expect(r.byTag.get('used/fa25')?.length).toBe(1);
    expect(typeof r.byTerm).toBe('function');
    expect(r.byTerm('sp26').length).toBe(1);
    expect(r.byTerm('fa25').length).toBe(1);
    expect(r.byTerm('su99')).toEqual([]);
  });
});

describe('parse: nested children', () => {
  it('captures mc option children under a #question item', () => {
    const src = `---
title: t
---
## III. S
### Question Bank
- #question #type/mc #section/III #exam-eligible [answer:: B]
  Stem: which is correct?
  - A. wrong
  - B. right
  - C. wrong
  - D. wrong
`;
    const r = parse({ source: src });
    const q = r.byRole.get('question')?.[0];
    expect(q).toBeDefined();
    expect(q.children.length).toBe(4);
    expect(q.children[1].text).toMatch(/right/);
  });
});
