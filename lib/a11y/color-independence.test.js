import { describe, test, expect } from 'vitest';
import { auditColorIndependence, projectColorIndependence } from './color-independence.js';

const cfg = {
  callouts: { KEY: {}, ASK: {} },
  sections: { concept: {}, pitfall: {} },
};

describe('auditColorIndependence', () => {
  test('passes when callouts emit their [KIND] badge and sections emit the title text', () => {
    const r = auditColorIndependence({
      ...cfg,
      renderCallout: (k) => `\\color{x}[${k}] body`,
      renderSection: (k, title) => `\\color{x}{${title}}`,
    });
    expect(r.stage).toBe('color-independence');
    expect(r.ok).toBe(true);
    expect(r.rows.length).toBe(4);
  });

  test('flags a callout that renders color with no textual badge', () => {
    const r = auditColorIndependence({
      ...cfg,
      renderCallout: (k) => (k === 'ASK' ? `\\color{x} body` : `[${k}] body`),
      renderSection: (k, title) => title,
    });
    expect(r.ok).toBe(false);
    expect(r.rows.find((row) => row.name === 'callout/ASK').pass).toBe(false);
    expect(r.rows.find((row) => row.name === 'callout/KEY').pass).toBe(true);
  });

  test('flags a section banner that drops the textual title (color-only)', () => {
    const r = auditColorIndependence({
      ...cfg,
      renderCallout: (k) => `[${k}]`,
      renderSection: (k, title) => (k === 'pitfall' ? `\\color{red} block` : title),
    });
    expect(r.ok).toBe(false);
    expect(r.rows.find((row) => row.name === 'section/pitfall').pass).toBe(false);
  });
});

describe('projectColorIndependence (real generators)', () => {
  test('the live callout + section emitters are color-independent', () => {
    const r = projectColorIndependence();
    expect(r.ok).toBe(true);
    expect(r.rows.length).toBeGreaterThan(0);
  });
});
