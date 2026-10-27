import { describe, it, expect } from 'vitest';
import { parse, validate } from '../parser/index.js';
import { generateFactSheet, collectCases } from './fact-sheet.js';
import { generateLectureNotes } from './lecture-notes.js';

const SOURCE = `---
title: Denial of Service Attacks
course: CECS 378
topic-slug: denial_of_service
term: fa26
citation-urls:
  - citation: 'CISA TA16-288A'
    url: https://www.cisa.gov/news-events/alerts/2016/10/14/heightened-ddos-threat-posed-mirai-and-other-botnets
---

# Denial of Service Attacks

## I. Opener (10 min)

- Mirai turned cameras and DVRs into a botnet. #concept #section/I [slide:: 1]
- Mirai (2016) took down Dyn. #case-study #section/I [case:: Mirai] [citation:: Krebs 2016]

## Fact sheet: Mirai

- IoT botnet malware for DDoS attacks #fact [case:: Mirai] [label:: What]
- August 2016 #fact [case:: Mirai] [label:: Discovered] [citation:: CISA TA16-288A]
- Telnet on ports 23 and 2323, with 62 default passwords #fact [case:: Mirai] [label:: Infection]
- Disconnect the device. #fact #steps [case:: Mirai] [group:: Removing an infection]
- Reboot it while offline. #fact [case:: Mirai] [group:: Removing an infection]
- Change every default password. #fact [case:: Mirai] [group:: Preventing infection]
- Old rumour, cut. #fact #draft [case:: Mirai] [label:: Rumour]

## Fact sheet: Smurf

- 1997 #fact [case:: Smurf] [label:: First seen]
`;

const parsed = () => parse({ source: SOURCE });

describe('fact-sheet generator', () => {
  it('validates the fact schema cleanly', () => {
    const v = validate(parsed());
    expect(v.ok).toBe(true);
    expect(v.warnings.filter((w) => /#fact/.test(w.message))).toEqual([]);
  });

  it('groups facts by case in source order, rows before groups, drafts dropped', () => {
    const cases = collectCases(parsed());
    expect(cases.map((c) => c.name)).toEqual(['Mirai', 'Smurf']);
    const m = cases[0];
    expect(m.rows.map((r) => r.label)).toEqual(['What', 'Discovered', 'Infection']);
    expect([...m.groups.keys()]).toEqual(['Removing an infection', 'Preventing infection']);
    expect(m.groups.get('Removing an infection').numbered).toBe(true);
    expect(m.groups.get('Preventing infection').numbered).toBe(false);
    expect(m.intro).toBe('Mirai (2016) took down Dyn.');
  });

  it('renders one page per case with a tagged header row, steps numbered, sources linked', () => {
    const { tex, cases } = generateFactSheet(parsed());
    expect(cases).toEqual(['Mirai', 'Smurf']);
    expect(tex).toMatch(/^\\DocumentMetadata/);
    expect((tex.match(/\\newpage/g) || []).length).toBe(1);
    expect(tex).toContain('table/header-rows={1}');
    expect(tex).toContain('\\begin{enumerate}');
    expect(tex).toContain('\\begin{itemize}');
    expect(tex).toContain('cisa.gov');
    expect(tex).toContain('Krebs 2016');
    expect(tex).not.toContain('Rumour');
    expect(tex).not.toMatch(/#fact|\[case::/);
  });

  it('returns null tex when a lecture has no facts', () => {
    const r = parse({ source: '---\ntitle: T\n---\n\n## I. A\n\n- x #concept\n' });
    expect(generateFactSheet(r)).toEqual({ tex: null, cases: [] });
  });

  it('keeps facts out of section-walking artifacts', () => {
    const notes = generateLectureNotes(parsed());
    expect(notes).not.toContain('62 default passwords');
  });
});

describe('fact validators', () => {
  it('rejects a #fact without [case::]', () => {
    const r = parse({ source: '---\ntitle: T\n---\n\n## Facts\n\n- 1997 #fact [label:: Year]\n' });
    const v = validate(r);
    expect(v.ok).toBe(false);
    expect(v.errors[0].message).toMatch(/\[case::/);
  });

  it('warns on a fact placed inside a numbered lecture section', () => {
    const r = parse({ source: '---\ntitle: T\n---\n\n## I. A\n\n- 1997 #fact [case:: X] [label:: Year]\n' });
    const v = validate(r);
    expect(v.ok).toBe(true);
    expect(v.warnings.some((w) => /unnumbered heading/.test(w.message))).toBe(true);
  });
});
