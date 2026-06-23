import { describe, test, expect } from 'vitest';
import { cornellPreamble, cornellComparisonTable } from './cornell-tex.js';

describe('cornellPreamble — PDF tagging', () => {
  test('enables the table tagging testphase (for /TH header cells)', () => {
    expect(cornellPreamble('L', 'R')).toMatch(/testphase=\{phase-III,table\}/);
  });

  test('declares PDF/UA-1 conformance, forces PDF 1.7, sets title + DisplayDocTitle', () => {
    const pre = cornellPreamble('File Systems', 'CECS 326');
    expect(pre).toMatch(/pdfstandard=ua-1/);
    expect(pre).toMatch(/pdfversion=1\.7/);
    expect(pre).toMatch(/pdfdisplaydoctitle=true/);
    expect(pre).toMatch(/pdftitle=\{[^}]*File Systems[^}]*\}/);
  });
});

describe('cornellComparisonTable — header-cell tagging', () => {
  const out = cornellComparisonTable(['A', 'B'], [['1', '2']], 'concept');

  test('marks the header row for /TH tagging', () => {
    expect(out).toContain('\\tagpdfsetup{table/header-rows={1}}');
  });

  test('declares header-rows before the tabular and closes its group after', () => {
    const setup = out.indexOf('table/header-rows={1}');
    const begin = out.indexOf('\\begin{tabularx}');
    expect(setup).toBeGreaterThan(-1);
    expect(setup).toBeLessThan(begin);
    expect(out.slice(out.indexOf('\\end{tabularx}'))).toContain('}');
  });

  test('returns empty for no headers (unchanged contract)', () => {
    expect(cornellComparisonTable([], [], 'concept')).toBe('');
  });
});
