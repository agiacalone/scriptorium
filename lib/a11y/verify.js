#!/usr/bin/env node
"use strict";

// Accessibility audit-chain runner (issues #5, #7).
//
// Static stages (no source document needed):
//   - palette contrast — every student/instructor color pair vs the WCAG target.
//   - color-independence — every callout/section emitter pairs color with a textual cue.
// The doc-level alt-text stage runs inside generate.js (it needs a parsed source).
// Exits non-zero on any failure so generation and CI can gate on it; with --out,
// writes a machine-readable a11y-report.json. Future stages (tagged-PDF / reading-order
// via veraPDF, table headers) hang off this same runner.
//
// Usage:
//   node lib/a11y/verify.js [--level AA|AAA] [--out <dir>]
//
// CommonJS to match the lib/ directory convention.

const path = require("node:path");
const { projectColorPairs } = require("./project-palette.js");
const { auditColorPairs } = require("./palette-audit.js");
const { projectColorIndependence } = require("./color-independence.js");
const { stageFromPalette, aggregate, writeReport } = require("./report.js");

function formatReport(report, { level }) {
  const lines = [];
  lines.push(`ADA Title II / WCAG ${level} — palette contrast audit`);
  lines.push("=".repeat(52));
  for (const r of report.results) {
    const mark = r.pass ? "PASS" : "FAIL";
    const ratio = `${r.ratio.toFixed(2)}:1`.padStart(7);
    const need = `(needs ${r.required}:1, ${r.size})`;
    lines.push(`  [${mark}] ${ratio}  ${r.name}  ${r.fg} on ${r.bg} ${r.pass ? "" : need}`.trimEnd());
  }
  lines.push("-".repeat(52));
  lines.push(`  ${report.passed} passed · ${report.failed} failed · ${report.results.length} total`);
  lines.push(report.ok ? "  RESULT: PASS — palette meets the target" : "  RESULT: FAIL — fix the pairs above");
  return lines.join("\n");
}

function parseLevel(argv) {
  const i = argv.indexOf("--level");
  if (i >= 0 && argv[i + 1]) {
    const lvl = argv[i + 1].toUpperCase();
    if (lvl === "AA" || lvl === "AAA") return lvl;
    throw new Error(`--level must be AA or AAA, got ${argv[i + 1]}`);
  }
  return "AA";
}

function parseOut(argv) {
  const i = argv.indexOf("--out");
  return i >= 0 && argv[i + 1] ? argv[i + 1] : null;
}

function main(argv) {
  const level = parseLevel(argv);
  const outDir = parseOut(argv);

  // Stage: palette contrast (keep the rich table output).
  const paletteAudit = auditColorPairs(projectColorPairs(), { level });
  process.stdout.write(formatReport(paletteAudit, { level }) + "\n");

  // Stage: color-independence.
  const colorIndep = projectColorIndependence();
  if (colorIndep.ok) {
    process.stdout.write(`\ncolor-independence: PASS (${colorIndep.rows.length} callout/section emitters)\n`);
  } else {
    process.stdout.write("\ncolor-independence: FAIL\n");
    for (const r of colorIndep.rows) if (!r.pass) process.stdout.write(`  ✗ ${r.name}: ${r.detail}\n`);
  }

  const report = aggregate([stageFromPalette("palette-contrast", paletteAudit), colorIndep]);

  if (outDir) {
    const outPath = path.join(outDir, "a11y-report.json");
    writeReport(report, outPath);
    process.stdout.write(`\nwrote ${outPath}\n`);
  }

  return report.ok ? 0 : 1;
}

if (require.main === module) {
  process.exit(main(process.argv.slice(2)));
}

module.exports = { formatReport, main };
