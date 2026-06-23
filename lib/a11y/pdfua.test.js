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
  // The blocking invariant is tagged-presence (pdfinfo). veraPDF PDF/UA-1 is
  // advisory: reported per row, never flips the gate — full PDF/UA-1 compliance
  // is remediation work that shouldn't break lecture builds.
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

  test('gates on tagged-presence via pdfinfo; one row per PDF', () => {
    const stage = auditPdfUA(['a.pdf', 'b.pdf'], deps({ haveVera: false }));
    expect(stage.rows).toHaveLength(2);
    expect(stage.rows.every((r) => r.pass)).toBe(true);
    expect(stage.ok).toBe(true);
    expect(stage.rows[0].ua1).toBeUndefined(); // no veraPDF → no advisory
  });

  test('an untagged PDF fails the stage (blocking regression guard)', () => {
    const stage = auditPdfUA(['ok.pdf', 'bad.pdf'], deps({
      haveVera: false,
      runPdfinfo: (pdf) => (pdf === 'bad.pdf' ? 'Tagged: no\n' : 'Tagged: yes\n'),
    }));
    expect(stage.ok).toBe(false);
    expect(stage.rows.find((r) => r.name === 'bad.pdf').pass).toBe(false);
  });

  test('veraPDF result rides along as ADVISORY — non-compliance does NOT fail the gate', () => {
    const stage = auditPdfUA(['a.pdf'], deps({
      haveVera: true,
      runPdfinfo: () => 'Tagged: yes\n', // tagged → gate passes
      runVera: () => ({ report: { jobs: [{ validationResult: [{ profileName: 'PDF/UA-1', compliant: false, details: { failedRules: 5 } }] }] } }),
    }));
    expect(stage.ok).toBe(true); // build NOT blocked by PDF/UA-1 non-compliance
    expect(stage.rows[0].pass).toBe(true); // row passes (it's tagged)
    expect(stage.rows[0].ua1.compliant).toBe(false); // advisory records the truth
    expect(stage.rows[0].ua1.detail).toMatch(/5/);
  });

  test('an untagged PDF still fails even when veraPDF is present', () => {
    const stage = auditPdfUA(['bad.pdf'], deps({
      haveVera: true,
      runPdfinfo: () => 'Tagged: no\n',
    }));
    expect(stage.ok).toBe(false);
    expect(stage.rows[0].pass).toBe(false);
  });

  test('a compliant veraPDF result is recorded as a passing advisory', () => {
    const stage = auditPdfUA(['a.pdf'], deps({ haveVera: true }));
    expect(stage.rows[0].ua1.compliant).toBe(true);
  });
});
