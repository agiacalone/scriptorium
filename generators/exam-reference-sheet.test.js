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
