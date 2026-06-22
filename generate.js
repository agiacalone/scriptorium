#!/usr/bin/env node
// generate.js — markdown-monolith orchestrator CLI.
//
// Parses a <topic>_lecture_main.md, dispatches to one or more generators,
// writes outputs into the main file's directory (or --out <dir>), and
// auto-compiles LaTeX outputs to PDF unless --no-pdf is passed.
//
// Usage:
//   node generate.js --main <path> [--artifact <name>] [--out <dir>]

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
import { generateReadme } from './generators/readme.js';
import { generateAudit } from './generators/audit.js';

const require = createRequire(import.meta.url);
const { compileLatex } = require('./lib/tex-helpers.js');
const { projectColorPairs } = require('./lib/a11y/project-palette.js');
const { auditColorPairs } = require('./lib/a11y/palette-audit.js');
const { formatReport } = require('./lib/a11y/verify.js');

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
  --a11y-level <AA|AAA>     WCAG contrast target for the gate; default AA
  --skip-a11y               bypass the ADA/WCAG contrast gate (not recommended)

Semester filtering (applied to all role-based item lookups):
  --semester <term>         loose: keep #used/<term> + items with NO #used/* tag
  --strict-semester <term>  strict: keep ONLY items tagged #used/<term>

Sub-commands:
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
        a === '--mark-used' || a === '--current-term' ||
        a === '--a11y-level') {
      args.flags[a.slice(2)] = argv[++i];
    } else if (a === '--no-pdf') {
      args.flags.noPdf = true;
    } else if (a === '--skip-a11y') {
      args.flags.skipA11y = true;
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

// ADA Title II / WCAG contrast gate (audit chain, issue #5). Runs once per
// invocation as a project-level invariant: the student/instructor palette must
// meet the target before any artifact is generated. Returns true if it passes.
function runA11yGate(log, { level }) {
  const report = auditColorPairs(projectColorPairs(), { level });
  if (report.ok) {
    log.info(`✓ a11y: palette meets WCAG ${level} (${report.passed} pairs)`);
    return true;
  }
  process.stderr.write(`error: ADA/WCAG ${level} contrast gate failed:\n`);
  process.stderr.write(formatReport(report, { level }) + '\n');
  return false;
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
      const { handoutTex, keyTex } = generateCornellHandout(parsed, { ...filterOpts });
      const out = path.join(outDir, `${slug}_cornell_handout.tex`);
      const keyOut = path.join(outDir, `${slug}_cornell_handout_key.tex`);
      writeText(out, handoutTex);
      writeText(keyOut, keyTex);
      log.info(`✓ cornell → ${path.basename(out)} + ${path.basename(keyOut)}`);
      maybeCompile(out, outDir, log, opts.noPdf);
      maybeCompile(keyOut, outDir, log, opts.noPdf);
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
      const result = await generateSlides(parsed, { outputDir: outDir, ...filterOpts });
      const themeLabel = result.theme ? ` [theme: ${result.theme}]` : '';
      log.info(`✓ slides → ${result.filename} (${result.slideCount} slides)${themeLabel}`);
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
    process.stderr.write('error: exam generation has moved to lectern — build with `reg-exam-build`. See notes/exam-tex-doctrine.\n');
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

  // ADA/WCAG contrast gate — palette is a project-level invariant; fail fast
  // before generating any student-facing artifact (override with --skip-a11y).
  if (!args.flags.skipA11y) {
    const level = (args.flags['a11y-level'] || 'AA').toUpperCase();
    if (level !== 'AA' && level !== 'AAA') {
      process.stderr.write(`error: --a11y-level must be AA or AAA, got ${args.flags['a11y-level']}\n`);
      process.exit(2);
    }
    if (!runA11yGate(log, { level })) process.exit(1);
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

  // Sub-command: exam — retired; exams are controlled documents owned by lectern.
  if (args.positional[0] === 'exam') {
    process.stderr.write(
      'error: exam generation has moved to lectern. Assemble a .tex by hand from the ' +
      'question bank, then build per-student copies with `reg-exam-build --roster` ' +
      '(serials) and check with `reg-exam-verify`. See notes/exam-tex-doctrine.\n');
    process.exit(2);
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
