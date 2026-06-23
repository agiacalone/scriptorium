import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cleanupLatexAux } from './latex-clean.js';

let dir;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'latex-clean-'));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

function touch(name) {
  fs.writeFileSync(path.join(dir, name), 'x');
}

describe('cleanupLatexAux', () => {
  test('removes the pdflatex intermediates for the given .tex basename', () => {
    for (const ext of ['aux', 'log', 'out', 'nav', 'snm', 'toc']) touch(`deck.${ext}`);
    touch('deck.tex');
    touch('deck.pdf');

    const removed = cleanupLatexAux(path.join(dir, 'deck.tex'), dir);

    for (const ext of ['aux', 'log', 'out', 'nav', 'snm', 'toc']) {
      expect(fs.existsSync(path.join(dir, `deck.${ext}`))).toBe(false);
    }
    expect(removed.sort()).toEqual(['aux', 'log', 'nav', 'out', 'snm', 'toc'].map((e) => `deck.${e}`).sort());
  });

  test('never deletes the .tex source or the .pdf output', () => {
    touch('deck.tex');
    touch('deck.pdf');
    touch('deck.aux');

    cleanupLatexAux(path.join(dir, 'deck.tex'), dir);

    expect(fs.existsSync(path.join(dir, 'deck.tex'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'deck.pdf'))).toBe(true);
  });

  test('leaves intermediates belonging to OTHER decks untouched', () => {
    touch('deck.tex');
    touch('deck.aux');
    touch('other.aux');
    touch('other.log');

    cleanupLatexAux(path.join(dir, 'deck.tex'), dir);

    expect(fs.existsSync(path.join(dir, 'other.aux'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'other.log'))).toBe(true);
  });

  test('is silent when an intermediate is already absent', () => {
    touch('deck.tex');
    expect(() => cleanupLatexAux(path.join(dir, 'deck.tex'), dir)).not.toThrow();
    expect(cleanupLatexAux(path.join(dir, 'deck.tex'), dir)).toEqual([]);
  });
});
