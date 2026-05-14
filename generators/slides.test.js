import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parse } from '../parser/index.js';
import { generateSlides } from './slides.js';

const FIXTURE = 'examples/file_systems_abstraction_lecture_main.md';
const OUT = '/tmp/lma-slides-test';

describe('slides generator (Beamer)', () => {
  it('writes a non-empty .tex + .pdf and reports slide count', async () => {
    fs.mkdirSync(OUT, { recursive: true });
    const r = parse({ path: FIXTURE });
    const result = await generateSlides(r, { outputDir: OUT });
    expect(result.filename).toBe('file_systems_abstraction_slides.tex');
    expect(fs.existsSync(result.path)).toBe(true);
    const tex = fs.readFileSync(result.path, 'utf8');
    expect(tex).toContain('\\documentclass[aspectratio=169,11pt]{beamer}');
    expect(tex).toContain('\\begin{document}');
    expect(tex).toContain('File Systems');
    // .tex should contain one \begin{frame} per rendered slide
    const frameCount = (tex.match(/\\begin\{frame\}/g) || []).length;
    expect(frameCount).toBe(result.slideCount);
    expect(result.slideCount).toBe(16);

    // PDF compiled alongside the .tex
    const pdfPath = path.join(OUT, 'file_systems_abstraction_slides.pdf');
    expect(fs.existsSync(pdfPath)).toBe(true);
    expect(fs.statSync(pdfPath).size).toBeGreaterThan(50000);
  });

  it('emits warnings array (may be empty)', async () => {
    const r = parse({ path: FIXTURE });
    const result = await generateSlides(r, { outputDir: OUT, noPdf: true });
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it('warns on ≥4 consecutive same-layout slides', async () => {
    const src = `---\ntitle: t\ntopic-slug: t\nadversarial-thinking: false\n---\n## I. S\n### Slide deck source\n- #slide [slide:: 1] [layout:: title] **t**\n- #slide [slide:: 2] [layout:: concept] **a**\n  - one\n- #slide [slide:: 3] [layout:: concept] **b**\n  - one\n- #slide [slide:: 4] [layout:: concept] **c**\n  - one\n- #slide [slide:: 5] [layout:: concept] **d**\n  - one\n- #slide [slide:: 6] [layout:: summary] **end**\n  - bye\n`;
    const r = parse({ source: src });
    const result = await generateSlides(r, { outputDir: OUT, noPdf: true });
    expect(result.warnings.some(w => /consecutive|same-layout/i.test(w.message))).toBe(true);
  });

  it('warns when deck lacks a [layout:: summary] closing slide', async () => {
    const src = `---\ntitle: t\ntopic-slug: t\nadversarial-thinking: false\n---\n## I. S\n### Slide deck source\n- #slide [slide:: 1] [layout:: title] **t**\n- #slide [slide:: 2] [layout:: concept] **a**\n  - one\n`;
    const r = parse({ source: src });
    const result = await generateSlides(r, { outputDir: OUT, noPdf: true });
    expect(result.warnings.some(w => /summary/i.test(w.message))).toBe(true);
  });

  it('warns when deck lacks a [layout:: key] pacing pause', async () => {
    const src = `---\ntitle: t\ntopic-slug: t\nadversarial-thinking: false\n---\n## I. S\n### Slide deck source\n- #slide [slide:: 1] [layout:: title] **t**\n- #slide [slide:: 2] [layout:: concept] **a**\n  - one\n- #slide [slide:: 3] [layout:: summary] **end**\n  - bye\n`;
    const r = parse({ source: src });
    const result = await generateSlides(r, { outputDir: OUT, noPdf: true });
    expect(result.warnings.some(w => /key|pacing/i.test(w.message))).toBe(true);
  });

  it('canonical fixture passes humanize warnings (has key + summary, no 4 consecutive same-layout)', async () => {
    const r = parse({ path: FIXTURE });
    const result = await generateSlides(r, { outputDir: OUT, noPdf: true });
    const humanize = result.warnings.filter(w => /consecutive|key|summary|pacing/i.test(w.message));
    expect(humanize).toEqual([]);
  });

  describe('semester filter', () => {
    const SRC = `---
title: t
course: CECS 326
term: sp26
topic-slug: t
---
## I. S
- Evergreen slide #slide #section/I [layout:: title-only] [slide:: 1] Title: Evergreen-slide-title
- Sp26 slide #slide #section/I #used/sp26 [layout:: title-only] [slide:: 2] Title: Sp26-slide-title
- Sp24 slide #slide #section/I #used/sp24 [layout:: title-only] [slide:: 3] Title: Sp24-slide-title
`;
    it('no filter — all 3 slides in deck', async () => {
      const r = parse({ source: SRC });
      const result = await generateSlides(r, { outputDir: OUT, noPdf: true });
      expect(result.slideCount).toBe(3);
    });
    it('loose semester=sp26 keeps tagged + untagged', async () => {
      const r = parse({ source: SRC });
      const result = await generateSlides(r, { outputDir: OUT, noPdf: true, semester: 'sp26' });
      expect(result.slideCount).toBe(2);
    });
    it('strict semester=sp26 keeps tagged only', async () => {
      const r = parse({ source: SRC });
      const result = await generateSlides(r, { outputDir: OUT, noPdf: true, strictSemester: 'sp26' });
      expect(result.slideCount).toBe(1);
    });
  });
});
