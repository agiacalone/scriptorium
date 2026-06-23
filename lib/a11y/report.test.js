import { describe, test, expect } from 'vitest';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { stageFromPalette, aggregate, writeReport } from './report.js';
import { auditColorPairs } from './palette-audit.js';

describe('stageFromPalette', () => {
  const audit = auditColorPairs([
    { name: 'good', fg: '000000', bg: 'FFFFFF' },
    { name: 'bad', fg: 'DDDDDD', bg: 'FFFFFF' },
  ]);

  test('maps a palette audit into a named stage with per-pair rows', () => {
    const stage = stageFromPalette('palette-contrast', audit);
    expect(stage.stage).toBe('palette-contrast');
    expect(stage.ok).toBe(false);
    expect(stage.rows).toHaveLength(2);
  });

  test('a failing pair row carries pass:false and the contrast ratio in its detail', () => {
    const stage = stageFromPalette('palette-contrast', audit);
    const bad = stage.rows.find((r) => r.name === 'bad');
    expect(bad.pass).toBe(false);
    expect(bad.detail).toMatch(/:1/);
  });
});

describe('aggregate', () => {
  test('ok is true only when every stage is ok', () => {
    expect(aggregate([{ stage: 'a', ok: true, rows: [] }]).ok).toBe(true);
    expect(
      aggregate([
        { stage: 'a', ok: true, rows: [] },
        { stage: 'b', ok: false, rows: [] },
      ]).ok
    ).toBe(false);
  });

  test('preserves the stage list under .stages', () => {
    const r = aggregate([{ stage: 'a', ok: true, rows: [] }]);
    expect(r.stages).toHaveLength(1);
    expect(r.stages[0].stage).toBe('a');
  });
});

describe('writeReport', () => {
  test('writes parseable JSON carrying ok and the stages', () => {
    const out = join(tmpdir(), `a11y-report-test-${process.pid}.json`);
    const report = aggregate([{ stage: 'palette-contrast', ok: true, rows: [] }]);
    writeReport(report, out);
    const parsed = JSON.parse(readFileSync(out, 'utf8'));
    expect(parsed.ok).toBe(true);
    expect(parsed.stages[0].stage).toBe('palette-contrast');
    rmSync(out, { force: true });
  });
});
