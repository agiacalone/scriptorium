import { describe, it, expect } from 'vitest';
import { blankOut, renderCitation, generateExamReferenceSheet } from './exam-reference-sheet.js';

describe('blankOut', () => {
  it('empties every blank and never prints an answer', () => {
    expect(blankOut('A _______ and a _______.')).toBe('A \\_\\_\\_\\_\\_\\_ and a \\_\\_\\_\\_\\_\\_.');
  });
  it('collapses a run of adjacent blanks into one', () => {
    expect(blankOut('a _______ _______ sign it')).toBe('a \\_\\_\\_\\_\\_\\_ sign it');
  });
});

describe('renderCitation', () => {
  it('links OSTEP chapters to their PDF', () => {
    expect(renderCitation('OSTEP 26').md).toBe('[OSTEP 26](https://pages.cs.wisc.edu/~remzi/OSTEP/threads-intro.pdf)');
  });
  it('maps a retired textbook to lecture notes', () => {
    expect(renderCitation('Stallings & Brown 21.3', { retiredCitation: 'Stallings' }).md).toBe('Lecture notes');
  });
  it('links RFCs and current NIST SP revisions', () => {
    expect(renderCitation('RFC 2104').md).toBe('[RFC 2104](https://www.rfc-editor.org/rfc/rfc2104)');
    expect(renderCitation('NIST SP 800-67').md).toContain('NIST.SP.800-67r2');
  });
  it('leaves unknown sources as plain text', () => {
    expect(renderCitation('Shannon 1949').md).toBe('Shannon 1949');
  });
});

describe('generateExamReferenceSheet', () => {
  it('prints the exam date and when/where line', () => {
    const parsed = { frontmatter: { title: 'T' }, byRole: new Map(), bySection: new Map(), body: '' };
    const md = generateExamReferenceSheet([{ parsed }], { examDate: '2026-09-29', examWhen: 'Tue Sep 29, in class' });
    expect(md).toContain('exam-date: 2026-09-29');
    expect(md).toContain('**Exam:** Tue Sep 29, in class');
  });
});

describe('what to bring', () => {
  const parsed = { frontmatter: { title: 'T' }, byRole: new Map(), bySection: new Map(), body: '' };
  it('prints the list as a callout under the Exam line', () => {
    const md = generateExamReferenceSheet([{ parsed }], { examWhen: 'Tue', bring: ['Student ID', 'Pencil'] });
    expect(md).toMatch(/\*\*Exam:\*\* Tue\n\n> \[!important\] What to bring to the exam\n>\n> - Student ID\n> - Pencil/);
  });
  it('omits the callout when the list is empty', () => {
    expect(generateExamReferenceSheet([{ parsed }], {})).not.toContain('What to bring');
  });
});

describe('citation-urls', () => {
  const item = (citation) => ({ text: 'A _______ fact.', tags: new Set(['blank']), fields: new Map([['citation', citation]]) });
  const urls = new Map([['stevens et al., "shattered," 2017', 'https://shattered.io']]);

  it('links a citation the frontmatter maps to a URL', () => {
    expect(renderCitation('Stevens et al., "SHAttered," 2017', { citationUrls: urls }).md)
      .toBe('[Stevens et al., "SHAttered," 2017](https://shattered.io)');
  });
  it('leaves an unmapped citation as plain text', () => {
    expect(renderCitation('Schneier 1999', { citationUrls: urls }).md).toBe('Schneier 1999');
  });
  it('reads the map from the lecture frontmatter and lists the source once', () => {
    const parsed = {
      frontmatter: {
        title: 'Encryption',
        raw: { 'citation-urls': [{ citation: 'Stevens et al., "SHAttered," 2017', url: 'https://shattered.io' }] },
      },
      byRole: new Map(),
      bySection: new Map([['V', [item('Stevens et al., "SHAttered," 2017'), item('Stevens et al., "SHAttered," 2017; FIPS 180-4')]]]),
      body: '## V. Cryptographic Hash Functions\n',
    };
    const md = generateExamReferenceSheet([{ parsed }], {});
    const read = md.split('\n').find((l) => l.startsWith('*Read:*'));
    expect(read).toBe('*Read:* [Stevens et al., "SHAttered," 2017](https://shattered.io) · [FIPS 180-4](https://doi.org/10.6028/NIST.FIPS.180-4)');
  });
});
