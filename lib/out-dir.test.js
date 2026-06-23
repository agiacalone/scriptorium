import { describe, test, expect } from 'vitest';
import path from 'node:path';
import { resolveOutDir } from './out-dir.js';

describe('resolveOutDir', () => {
  test('defaults to a products/ subdir beside the main file', () => {
    const got = resolveOutDir(undefined, '/vault/classes/326/intro_to_os_lecture_main.md');
    expect(got).toBe('/vault/classes/326/products');
  });

  test('resolves a relative main path before appending products/', () => {
    const got = resolveOutDir(undefined, 'examples/file_systems_abstraction_lecture_main.md');
    expect(got).toBe(path.join(process.cwd(), 'examples', 'products'));
  });

  test('honors an explicit --out, leaving it untouched', () => {
    expect(resolveOutDir('./out', '/vault/classes/326/x_lecture_main.md')).toBe('./out');
    expect(resolveOutDir('/abs/out', '/vault/classes/326/x_lecture_main.md')).toBe('/abs/out');
  });

  test('treats an empty --out as unset (falls back to products/)', () => {
    expect(resolveOutDir('', '/v/a/x_lecture_main.md')).toBe('/v/a/products');
  });
});
