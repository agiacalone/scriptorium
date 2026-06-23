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
import { markUsedTags } from './generators/mark-used.js';

const require = createRequire(import.meta.url);
const { compileLatex } = require('./lib/tex-helpers.js');
const { resolveOutDir } = require('./lib/out-dir.js');
const { cleanupLatexAux } = require('./lib/latex-clean.js');
const { runPdfUaStage } = require('./lib/a11y/pdfua.js');
const { projectColorPairs } = require('./lib/a11y/project-palette.js');
const { auditColorPairs } = require('./lib/a11y/palette-audit.js');
const { formatReport } = require('./lib/a11y/verify.js');
const { projectColorIndependence } = require('./lib/a11y/color-independence.js');
const { auditAltText } = require('./lib/a11y/alt-text.js');
const { stageFromPalette, aggregate, writeReport } = require('./lib/a11y/report.js');

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

Reproducibility:
  --mark-used <term>        after a clean build, stamp every deck item the build
                            used with #used/<term> back into the source main
                            (idempotent; respects --semester/--strict-semester)

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
    cleanupLatexAux(texPath, outDir);
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

// ADA Title II / WCAG audit gate (audit chain, issues #5, #7). Runs once per
// invocation before any artifact is generated, and writes a machine-readable
// a11y-report.json into the output dir. Stages:
//   - palette-contrast — student/instructor palette meets the WCAG target.
//   - color-independence — every callout/section emitter pairs color with a textual cue.
//   - alt-text — every visual in the parsed source carries [alt::] (collects all misses).
// Returns true if every stage passes.
function runA11yGate(log, { level, parsed, outDir }) {
  const paletteAudit = auditColorPairs(projectColorPairs(), { level });
  const stages = [
    stageFromPalette('palette-contrast', paletteAudit),
    projectColorIndependence(),
  ];
  if (parsed) stages.push(auditAltText(parsed));
  const report = aggregate(stages);

  if (outDir) {
    try {
      writeReport(report, path.join(outDir, 'a11y-report.json'));
    } catch (err) {
      log.warn(`  ! a11y: could not write a11y-report.json: ${err.message}`);
    }
  }

  if (report.ok) {
    log.info(`✓ a11y: ${stages.length} stages pass (WCAG ${level}, ${paletteAudit.passed} palette pairs)`);
    return true;
  }

  process.stderr.write(`error: ADA/WCAG ${level} audit failed:\n`);
  for (const s of stages) {
    if (s.ok) continue;
    if (s.stage === 'palette-contrast') {
      process.stderr.write(formatReport(paletteAudit, { level }) + '\n');
    } else {
      process.stderr.write(`  stage ${s.stage}:\n`);
      for (const r of s.rows) if (!r.pass) process.stderr.write(`    ✗ ${r.name}: ${r.detail}\n`);
    }
  }
  return false;
}

// Post-generation PDF/UA verification (audit chain, issue #7, Phase 3). The
// pre-generation gate checks the source; this checks the *compiled* PDFs for a
// real tagged structure, via veraPDF (deep) or a pdfinfo Tagged smoke-check
// (fallback). Appends a `pdf-ua` stage to a11y-report.json and gates the build.
// Returns true when every produced PDF passes.
function runPdfUaGate(log, { outDir }) {
  const pdfPaths = fs.existsSync(outDir)
    ? fs.readdirSync(outDir).filter((f) => f.endsWith('.pdf')).map((f) => path.join(outDir, f))
    : [];
  if (pdfPaths.length === 0) return true; // --no-pdf, or nothing compiled

  const stage = runPdfUaStage(pdfPaths);

  // Merge into the report the pre-generation gate already wrote.
  const reportPath = path.join(outDir, 'a11y-report.json');
  let report = { ok: true, stages: [] };
  try {
    if (fs.existsSync(reportPath)) report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  } catch { /* fall back to a fresh report */ }
  report.stages = [...(report.stages || []).filter((s) => s.stage !== 'pdf-ua'), stage];
  report.ok = report.stages.every((s) => s.ok);
  try {
    writeReport(report, reportPath);
  } catch (err) {
    log.warn(`  ! pdf-ua: could not update a11y-report.json: ${err.message}`);
  }

  if (stage.ok) {
    const mode = /veraPDF\)/.test(stage.rows[0]?.detail || '') ? 'veraPDF PDF/UA-1' : 'pdfinfo smoke-check';
    log.info(`✓ pdf-ua: ${stage.rows.length} PDF(s) tagged (${mode})`);
    return true;
  }
  process.stderr.write('error: PDF/UA tag verification failed:\n');
  for (const r of stage.rows) if (!r.pass) process.stderr.write(`    ✗ ${r.name}: ${r.detail}\n`);
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

  const outDir = resolveOutDir(args.flags.out, mainPath);
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
    if (!runA11yGate(log, { level, parsed, outDir })) process.exit(1);
  }

  const slug = topicSlugFromMain(mainPath);
  const targets = artifactInput === 'all' ? ALL_ARTIFACTS : [artifactInput];

  log.info(`Generating ${targets.length} artifact(s) into ${outDir}`);
  const opts = {
    noPdf: !!args.flags.noPdf,
    readmeVariant: args.flags['readme-variant'],
    semester: args.flags.semester,
    strictSemester: args.flags['strict-semester'],
    markUsed: args.flags['mark-used'],
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

  // --mark-used <term>: stamp every deck item this build used with #used/<term>
  // back into the source main, so future --semester <term> builds keep them.
  // Runs only after a clean build, and respects the active semester filter.
  if (opts.markUsed) {
    const r = markUsedTags(parsed, opts.markUsed, {
      semester: opts.semester,
      strictSemester: opts.strictSemester,
    });
    if (r.files.length === 0 && r.modified === 0 && r.alreadyTagged === 0) {
      log.warn(`  ! mark-used: nothing to tag (no source file or no markable items)`);
    } else {
      log.info(
        `✓ mark-used: tagged ${r.modified} item(s) with #used/${r.term}` +
        ` across ${r.files.length} file(s); ${r.alreadyTagged} already tagged.`
      );
    }
  }

  if (!runPdfUaGate(log, { outDir })) process.exit(1);

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

  const outDir = resolveOutDir(args.flags.out, mainPath);
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
