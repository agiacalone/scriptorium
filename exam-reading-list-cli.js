#!/usr/bin/env node
// CLI for the exam reading-list generator. Invoked by lectern's
// `reg-exam-readinglist`. Parses several topic _lecture_main.md files and emits
// one consolidated per-exam study guide (cue→source map).
//
// Usage:
//   node exam-reading-list-cli.js \
//     --exam-name "Midterm 1" --slug midterm_1 \
//     --course "CECS 326" --term sp26 \
//     --out <dir> \
//     --mains <main1.md>,<main2.md>[,...]
//
//   --format reference     two-column reference sheet (generators/exam-reference-sheet.js)
//   --readings-json '[{"title":…,"url":…,"note":…}]'   assigned readings callout
//   --retired-citation <regex>   citations naming a dropped textbook become "Lecture notes"
//
// Writes <out>/<slug>_reading_list.md and prints the path.

import fs from 'node:fs';
import path from 'node:path';
import { parse } from './parser/index.js';
import { generateExamReadingList } from './generators/exam-reading-list.js';
import { generateExamReferenceSheet } from './generators/exam-reference-sheet.js';

function parseArgs(argv) {
  const f = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) f[a.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  }
  return f;
}

function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function main() {
  const f = parseArgs(process.argv.slice(2));
  const examName = f['exam-name'] || 'Exam';
  const slug = f.slug || slugify(examName);
  const course = f.course || '';
  const term = f.term || '';
  const textbook = f.textbook && f.textbook !== true ? f.textbook : '';
  const citationKey = f['citation-key'] && f['citation-key'] !== true ? f['citation-key'] : '';
  const note = f.note && f.note !== true ? f.note : '';
  const noteTitle = f['note-title'] && f['note-title'] !== true ? f['note-title'] : '';
  const out = f.out || process.cwd();
  const mainsArg = f.mains || '';
  const mainPaths = String(mainsArg).split(',').map((s) => s.trim()).filter(Boolean);

  if (mainPaths.length === 0) {
    process.stderr.write('error: --mains <main1.md>[,<main2.md>...] is required\n');
    process.exit(2);
  }

  const topics = [];
  for (const p of mainPaths) {
    if (!fs.existsSync(p)) {
      process.stderr.write(`error: lecture main not found: ${p}\n`);
      process.exit(2);
    }
    topics.push({ parsed: parse({ path: p }) });
  }

  const format = f.format && f.format !== true ? f.format : 'reading-list';
  const readings = f['readings-json'] && f['readings-json'] !== true ? JSON.parse(f['readings-json']) : [];
  const retiredCitation = f['retired-citation'] && f['retired-citation'] !== true ? f['retired-citation'] : '';
  const coverageNote = f['coverage-note'] && f['coverage-note'] !== true ? f['coverage-note'] : '';
  const md = format === 'reference'
    ? generateExamReferenceSheet(topics, { examName, course, term, textbook, note, noteTitle, readings, retiredCitation, coverageNote })
    : generateExamReadingList(topics, { examName, course, term, slug, textbook, citationKey, note, noteTitle });
  fs.mkdirSync(out, { recursive: true });
  const outPath = path.join(out, `${slug}_reading_list.md`);
  fs.writeFileSync(outPath, md, 'utf8');
  process.stdout.write(outPath + '\n');
}

main();
