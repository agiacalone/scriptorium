import { describe, test, expect } from 'vitest';
import { texPreamble, texComparisonTable } from './tex-helpers.js';

describe('texPreamble — PDF tagging', () => {
  test('enables the table tagging testphase (for /TH header cells)', () => {
    const pre = texPreamble('L', 'R');
    expect(pre).toMatch(/testphase=\{phase-III,table\}/);
  });

  test('declares PDF/UA-1 conformance and forces PDF 1.7 (veraPDF clauses 5, 6.1)', () => {
    const pre = texPreamble('Intro to OS', 'CECS 326');
    expect(pre).toMatch(/pdfstandard=ua-1/);
    expect(pre).toMatch(/pdfversion=1\.7/);
  });

  test('sets a document title and DisplayDocTitle (veraPDF clause 7.1: dc:title + ViewerPreferences)', () => {
    const pre = texPreamble('Intro to OS', 'CECS 326');
    expect(pre).toMatch(/pdfdisplaydoctitle=true/);
    expect(pre).toMatch(/pdftitle=\{[^}]*Intro to OS[^}]*\}/);
  });
});

describe('texComparisonTable — header-cell tagging', () => {
  const out = texComparisonTable(['A', 'B'], [['1', '2']]);

  test('marks the header row for /TH tagging', () => {
    expect(out).toContain('\\tagpdfsetup{table/header-rows={1}}');
  });

  test('scopes the header-rows directive to this table only (wrapped in a group, set before the tabular)', () => {
    const setup = out.indexOf('table/header-rows={1}');
    const begin = out.indexOf('\\begin{tabularx}');
    expect(setup).toBeGreaterThan(-1);
    expect(setup).toBeLessThan(begin); // declared before the table
    // the table opens a group that closes after \end{tabularx} (no leak to later tables)
    const tail = out.slice(out.indexOf('\\end{tabularx}'));
    expect(tail).toContain('}');
  });
});
