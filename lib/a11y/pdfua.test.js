import { describe, test, expect } from 'vitest';
import { interpretPdfinfo, interpretVeraJson, auditPdfUA } from './pdfua.js';

describe('interpretPdfinfo (fallback smoke-check)', () => {
  test('passes a tagged PDF but marks it as a smoke-check, not a full PDF/UA pass', () => {
    const row = interpretPdfinfo('Pages: 4\nTagged:          yes\n', 'lecture_notes.pdf');
    expect(row.name).toBe('lecture_notes.pdf');
    expect(row.pass).toBe(true);
    expect(row.detail).toMatch(/smoke/i);
    expect(row.detail).toMatch(/veraPDF/i); // names the deep check that was skipped
  });

  test('fails an untagged PDF outright', () => {
    const row = interpretPdfinfo('Pages: 4\nTagged:          no\n', 'quiz.pdf');
    expect(row.pass).toBe(false);
    expect(row.detail).toMatch(/not tagged/i);
  });
});

describe('interpretVeraJson (deep PDF/UA-1 check)', () => {
  const veraFor = (compliant, failedRules = 0) => ({
    report: {
      jobs: [
        {
          validationResult: [
            { profileName: 'PDF/UA-1', compliant, details: { failedRules } },
          ],
        },
      ],
    },
  });

  test('passes a compliant PDF/UA-1 result', () => {
    const row = interpretVeraJson(veraFor(true), 'handout.pdf');
    expect(row.pass).toBe(true);
    expect(row.detail).toMatch(/PDF\/UA-1/);
  });

  test('fails and reports the failed-rule count', () => {
    const row = interpretVeraJson(veraFor(false, 3), 'handout.pdf');
    expect(row.pass).toBe(false);
    expect(row.detail).toMatch(/3/);
  });
});

describe('auditPdfUA orchestration', () => {
  const deps = (over = {}) => ({
    haveVera: false,
    runPdfinfo: () => 'Tagged: yes\n',
    runVera: () => ({ report: { jobs: [{ validationResult: [{ compliant: true, details: { failedRules: 0 } }] }] } }),
    ...over,
  });

  test('returns the uniform stage shape', () => {
    const stage = auditPdfUA([], deps());
    expect(stage.stage).toBe('pdf-ua');
    expect(stage.ok).toBe(true);
    expect(stage.rows).toEqual([]);
  });

  test('uses pdfinfo when veraPDF is absent; one row per PDF', () => {
    const stage = auditPdfUA(['a.pdf', 'b.pdf'], deps({ haveVera: false }));
    expect(stage.rows).toHaveLength(2);
    expect(stage.rows.every((r) => /smoke/i.test(r.detail))).toBe(true);
    expect(stage.ok).toBe(true);
  });

  test('uses veraPDF when present', () => {
    const stage = auditPdfUA(['a.pdf'], deps({ haveVera: true }));
    expect(stage.rows[0].detail).toMatch(/PDF\/UA-1/);
  });

  test('a single untagged PDF fails the whole stage', () => {
    const stage = auditPdfUA(['ok.pdf', 'bad.pdf'], deps({
      haveVera: false,
      runPdfinfo: (pdf) => (pdf === 'bad.pdf' ? 'Tagged: no\n' : 'Tagged: yes\n'),
    }));
    expect(stage.ok).toBe(false);
    expect(stage.rows.find((r) => r.name === 'bad.pdf').pass).toBe(false);
  });
});
