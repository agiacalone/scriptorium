#!/usr/bin/env node
// generate.js — markdown-monolith orchestrator CLI.
//
// Parses a <topic>_lecture_main.md, dispatches to one or more generators,
// writes outputs into the main file's directory (or --out <dir>), and
// auto-compiles LaTeX outputs to PDF unless --no-pdf is passed.
//
// Usage:
//   node generate.js --main <path> [--artifact <name>] [--out <dir>]
//   node generate.js exam --spec <exam-spec.json> [--out <dir>]

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

import { parse, validate } from './parser/index.js';
import { generateLectureNotes } from './generators/lecture-notes.js';
import { generateCornellHandout } from './generators/cornell-handout.js';
import { generateQuestionBank } from './generators/question-bank.js';
import { generateSlides } from './generators/slides.js';
import { generateStudyQuestions } from './generators/study-questions.js';
import { generateQuiz } from './generators/quiz.js';
import { generateReadingList } from './generators/reading-list.js';
import { generateExam } from './generators/exam.js';
import { generateReadme } from './generators/readme.js';
import { generateAudit } from './generators/audit.js';

const require = createRequire(import.meta.url);
const { compileLatex } = require('./lib/tex-helpers.js');

const ARTIFACTS = new Set([
  'all',
  'lecture-notes',
  'cornell',
  'bank', 'question-bank',
  'slides',
  'study', 'study-questions',
  'quiz',
  'reading-list',
  'readme',
]);

const ARTIFACT_ALIASES = {
  'question-bank': 'bank',
  'study-questions': 'study',
};

function usage() {
  return `Usage:
  node generate.js --main <path> [--artifact <name>] [--out <dir>]
  node generate.js exam --spec <exam-spec.json> [--out <dir>]

Artifacts (--artifact):
  all           default. runs every generator
  lecture-notes
  cornell
  bank          alias: question-bank
  slides
  study         alias: study-questions
  quiz
  reading-list
  readme

Flags:
  --main <path>             path to <topic>_lecture_main.md
  --artifact <name>         which generator to run; default \`all\`
  --out <dir>               output directory; default = dirname(main)
  --readme-variant <r|l>    \`reading\` (default) or \`lab\`
  --no-pdf                  skip pdflatex compilation
  --silent                  suppress info-level logs

Semester filtering (applied to all role-based item lookups):
  --semester <term>         loose: keep #used/<term> + items with NO #used/* tag
  --strict-semester <term>  strict: keep ONLY items tagged #used/<term>

Sub-commands:
  exam --spec <path>        run the exam assembler against an exam-spec.json
                            optional: --mark-used <term> writes #used/<term>
                            back to each picked item's source main.md
  audit --main <path>       staleness audit; lists items whose newest #used/*
                            is older than --current-term (default = main's
                            frontmatter \`term:\`)

Exit codes:
  0  success
  1  validation hard-error or generator threw
  2  CLI usage error
`;
}

function parseArgs(argv) {
  const args = { positional: [], flags: {} };
  let i = 0;
  while (i < argv.length) {
    const a = argv[i];
    if (a === '--main' || a === '--artifact' || a === '--out' ||
        a === '--readme-variant' || a === '--spec' ||
        a === '--semester' || a === '--strict-semester' ||
        a === '--mark-used' || a === '--current-term') {
      args.flags[a.slice(2)] = argv[++i];
    } else if (a === '--no-pdf') {
      args.flags.noPdf = true;
    } else if (a === '--silent') {
      args.flags.silent = true;
    } else if (a === '-h' || a === '--help') {
      args.flags.help = true;
    } else if (a.startsWith('--')) {
      throw new Error(`Unknown flag: ${a}`);
    } else {
      args.positional.push(a);
    }
    i++;
  }
  return args;
}

function makeLogger(silent) {
  return {
    info: (...a) => { if (!silent) console.error(...a); },
    warn: (...a) => console.error(...a),
    error: (...a) => console.error(...a),
  };
}

function topicSlugFromMain(mainPath) {
  // Resolve symlinks, then strip _lecture_main.md from basename.
  let real = mainPath;
  try { real = fs.realpathSync(mainPath); } catch { /* keep mainPath */ }
  const base = path.basename(real);
  return base.replace(/_lecture_main\.md$/, '').replace(/\.md$/, '');
}

function writeText(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function maybeCompile(texPath, outDir, log, noPdf) {
  if (noPdf) return null;
  try {
    const pdf = compileLatex(texPath, outDir);
    log.info(`  → compiled ${path.basename(pdf)}`);
    return pdf;
  } catch (err) {
    log.warn(`  ! pdflatex failed for ${path.basename(texPath)}: ${err.message}`);
    return null;
  }
}

function reportWarnings(label, warnings, log) {
  if (!warnings || warnings.length === 0) return;
  for (const w of warnings) {
    const msg = typeof w === 'string' ? w : (w.message || JSON.stringify(w));
    log.warn(`  ! ${label}: ${msg}`);
  }
}

async function runArtifact({ artifact, parsed, slug, outDir, log, opts }) {
  const filterOpts = { semester: opts.semester, strictSemester: opts.strictSemester };
  switch (artifact) {
    case 'lecture-notes': {
      const tex = generateLectureNotes(parsed, { ...filterOpts });
      const out = path.join(outDir, `${slug}_lecture_notes.tex`);
      writeText(out, tex);
      log.info(`✓ lecture-notes → ${path.basename(out)}`);
      maybeCompile(out, outDir, log, opts.noPdf);
      return;
    }
    case 'cornell': {
      const tex = generateCornellHandout(parsed, { ...filterOpts });
      const out = path.join(outDir, `${slug}_cornell_handout.tex`);
      writeText(out, tex);
      log.info(`✓ cornell → ${path.basename(out)}`);
      maybeCompile(out, outDir, log, opts.noPdf);
      return;
    }
    case 'bank': {
      const md = generateQuestionBank(parsed, { ...filterOpts });
      const out = path.join(outDir, `${slug}_question_bank.md`);
      writeText(out, md);
      log.info(`✓ question-bank → ${path.basename(out)}`);
      return;
    }
    case 'slides': {
      const result = await generateSlides(parsed, { outputDir: outDir, noPdf: opts.noPdf, ...filterOpts });
      const pdfName = result.filename.replace(/\.tex$/, '.pdf');
      const suffix = opts.noPdf ? '' : ` + ${pdfName}`;
      log.info(`✓ slides → ${result.filename}${suffix} (${result.slideCount} slides)`);
      reportWarnings('slides', result.warnings, log);
      return;
    }
    case 'study': {
      const md = generateStudyQuestions(parsed, { ...filterOpts });
      const out = path.join(outDir, `${slug}_study_questions.md`);
      writeText(out, md);
      log.info(`✓ study-questions → ${path.basename(out)}`);
      return;
    }
    case 'quiz': {
      const { quizTex, keyTex, picked } = generateQuiz(parsed, { ...filterOpts });
      const quizOut = path.join(outDir, `${slug}_quiz.tex`);
      const keyOut = path.join(outDir, `${slug}_quiz_key.tex`);
      writeText(quizOut, quizTex);
      writeText(keyOut, keyTex);
      log.info(`✓ quiz → ${path.basename(quizOut)} + ${path.basename(keyOut)} (${picked ? picked.length : 0} questions)`);
      maybeCompile(quizOut, outDir, log, opts.noPdf);
      maybeCompile(keyOut, outDir, log, opts.noPdf);
      return;
    }
    case 'reading-list': {
      const out = path.join(outDir, `${slug}_reading_list.md`);
      const existing = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : undefined;
      const md = generateReadingList(parsed, { ...(existing ? { existing } : {}), ...filterOpts });
      writeText(out, md);
      log.info(`✓ reading-list → ${path.basename(out)}`);
      return;
    }
    case 'readme': {
      const variantArg = (opts.readmeVariant || '').toLowerCase();
      const variant = variantArg.startsWith('l') ? 'lab' : 'reading';
      const md = generateReadme(parsed, { variant, ...filterOpts });
      const out = path.join(outDir, 'README.md');
      writeText(out, md);
      log.info(`✓ readme (${variant}) → ${path.basename(out)}`);
      return;
    }
    default:
      throw new Error(`unhandled artifact: ${artifact}`);
  }
}

const ALL_ARTIFACTS = [
  'lecture-notes',
  'cornell',
  'bank',
  'slides',
  'study',
  'quiz',
  'reading-list',
  'readme',
];

async function runMain(args) {
  const log = makeLogger(args.flags.silent);
  const mainPath = args.flags.main || args.positional[0];
  if (!mainPath) {
    process.stderr.write('error: --main <path> is required\n\n' + usage());
    process.exit(2);
  }
  if (!fs.existsSync(mainPath)) {
    process.stderr.write(`error: main file not found: ${mainPath}\n`);
    process.exit(2);
  }

  let artifactInput = (args.flags.artifact || 'all').toLowerCase();
  artifactInput = ARTIFACT_ALIASES[artifactInput] || artifactInput;
  if (artifactInput === 'exam') {
    process.stderr.write('error: use the `exam` sub-command instead — `node generate.js exam --spec <path>`\n');
    process.exit(2);
  }
  if (!ARTIFACTS.has(artifactInput)) {
    process.stderr.write(`error: unknown artifact: ${args.flags.artifact}\n\n` + usage());
    process.exit(2);
  }

  const outDir = args.flags.out || path.dirname(path.resolve(mainPath));
  fs.mkdirSync(outDir, { recursive: true });

  log.info(`Parsing ${mainPath}…`);
  let parsed;
  try {
    parsed = parse({ path: mainPath });
  } catch (err) {
    process.stderr.write(`error: parse failed: ${err.message}\n`);
    process.exit(1);
  }

  const validation = validate(parsed);
  if (validation && validation.errors && validation.errors.length > 0) {
    process.stderr.write(`error: validation failed (${validation.errors.length} error(s)):\n`);
    for (const e of validation.errors) {
      const msg = typeof e === 'string' ? e : (e.message || JSON.stringify(e));
      process.stderr.write(`  ✗ ${msg}\n`);
    }
    process.exit(1);
  }
  if (validation && validation.warnings && validation.warnings.length > 0) {
    reportWarnings('validate', validation.warnings, log);
  }

  const slug = topicSlugFromMain(mainPath);
  const targets = artifactInput === 'all' ? ALL_ARTIFACTS : [artifactInput];

  log.info(`Generating ${targets.length} artifact(s) into ${outDir}`);
  const opts = {
    noPdf: !!args.flags.noPdf,
    readmeVariant: args.flags['readme-variant'],
    semester: args.flags.semester,
    strictSemester: args.flags['strict-semester'],
  };

  let failures = 0;
  for (const artifact of targets) {
    try {
      await runArtifact({ artifact, parsed, slug, outDir, log, opts });
    } catch (err) {
      failures++;
      log.error(`✗ ${artifact} failed: ${err.message}`);
      if (process.env.DEBUG) log.error(err.stack);
    }
  }

  if (failures > 0) {
    process.stderr.write(`\n${failures} generator(s) failed.\n`);
    process.exit(1);
  }
  log.info('Done.');
}

async function runExam(args) {
  const log = makeLogger(args.flags.silent);
  const specPath = args.flags.spec;
  if (!specPath) {
    process.stderr.write('error: exam requires --spec <exam-spec.json>\n\n' + usage());
    process.exit(2);
  }
  if (!fs.existsSync(specPath)) {
    process.stderr.write(`error: exam spec not found: ${specPath}\n`);
    process.exit(2);
  }

  let spec;
  try {
    spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  } catch (err) {
    process.stderr.write(`error: failed to parse exam spec JSON: ${err.message}\n`);
    process.exit(2);
  }

  const mains = Array.isArray(spec.mains) ? spec.mains : [];
  if (mains.length === 0) {
    process.stderr.write('error: exam spec must include `mains: [...]` (at least one path)\n');
    process.exit(2);
  }

  const outDir = args.flags.out || path.dirname(path.resolve(specPath));
  fs.mkdirSync(outDir, { recursive: true });

  log.info(`Parsing ${mains.length} main file(s) for exam…`);
  const parsedDocs = [];
  for (const m of mains) {
    if (!fs.existsSync(m)) {
      process.stderr.write(`error: main file not found: ${m}\n`);
      process.exit(1);
    }
    let p;
    try {
      p = parse({ path: m });
    } catch (err) {
      process.stderr.write(`error: parse failed for ${m}: ${err.message}\n`);
      process.exit(1);
    }
    const v = validate(p);
    if (v && v.errors && v.errors.length > 0) {
      process.stderr.write(`error: validation failed for ${m}:\n`);
      for (const e of v.errors) {
        const msg = typeof e === 'string' ? e : (e.message || JSON.stringify(e));
        process.stderr.write(`  ✗ ${msg}\n`);
      }
      process.exit(1);
    }
    parsedDocs.push(p);
  }

  let result;
  try {
    result = generateExam(parsedDocs, spec, {
      semester: args.flags.semester,
      strictSemester: args.flags['strict-semester'],
      markUsed: args.flags['mark-used'],
    });
  } catch (err) {
    process.stderr.write(`error: exam assembly failed: ${err.message}\n`);
    if (process.env.DEBUG) process.stderr.write(err.stack + '\n');
    process.exit(1);
  }

  const fileBase = spec.fileBase || 'exam';
  const examOut = path.join(outDir, `${fileBase}.tex`);
  const keyOut = path.join(outDir, `${fileBase}_key.tex`);
  writeText(examOut, result.examTex);
  writeText(keyOut, result.keyTex);
  log.info(`✓ exam → ${path.basename(examOut)} + ${path.basename(keyOut)} (${result.picked ? result.picked.length : 0} questions)`);
  reportWarnings('exam', result.warnings, log);

  const noPdf = !!args.flags.noPdf;
  maybeCompile(examOut, outDir, log, noPdf);
  maybeCompile(keyOut, outDir, log, noPdf);

  if (result.markUsed) {
    const markTerm = spec.markUsed || args.flags['mark-used'];
    log.info(`✓ mark-used: tagged ${result.markUsed.modified} item(s) with #used/${markTerm} across ${result.markUsed.files.length} file(s); ${result.markUsed.alreadyTagged} already tagged.`);
  }

  log.info('Done.');
}

async function runAudit(args) {
  const log = makeLogger(args.flags.silent);
  const mainPath = args.flags.main || args.positional[1];
  if (!mainPath) {
    process.stderr.write('error: audit requires --main <path>\n\n' + usage());
    process.exit(2);
  }
  if (!fs.existsSync(mainPath)) {
    process.stderr.write(`error: main file not found: ${mainPath}\n`);
    process.exit(2);
  }

  let parsed;
  try {
    parsed = parse({ path: mainPath });
  } catch (err) {
    process.stderr.write(`error: parse failed: ${err.message}\n`);
    process.exit(1);
  }

  const md = generateAudit(parsed, {
    currentTerm: args.flags['current-term'],
  });

  const outDir = args.flags.out || path.dirname(path.resolve(mainPath));
  const slug = topicSlugFromMain(mainPath);
  const outPath = path.join(outDir, `${slug}_staleness_audit.md`);
  writeText(outPath, md);
  log.info(`✓ audit → ${path.basename(outPath)}`);
}

async function main() {
  const argv = process.argv.slice(2);
  let args;
  try {
    args = parseArgs(argv);
  } catch (err) {
    process.stderr.write(`error: ${err.message}\n\n` + usage());
    process.exit(2);
  }

  if (args.flags.help || argv.length === 0) {
    process.stdout.write(usage());
    process.exit(args.flags.help ? 0 : 2);
  }

  // Sub-command: exam
  if (args.positional[0] === 'exam') {
    await runExam(args);
    return;
  }
  // Sub-command: audit
  if (args.positional[0] === 'audit') {
    await runAudit(args);
    return;
  }

  await runMain(args);
}

main().catch((err) => {
  process.stderr.write(`fatal: ${err.message}\n`);
  if (process.env.DEBUG) process.stderr.write(err.stack + '\n');
  process.exit(1);
});
