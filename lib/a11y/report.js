// Accessibility audit-chain reporting backbone (issue #7).
//
// Each audit stage produces a uniform shape: { stage, ok, rows }, where each row
// is { name, pass, detail }. This module adapts the palette-contrast audit (which
// predates the uniform shape) into a stage, aggregates stages into one report, and
// serializes the report to JSON so CI and tooling can gate on a machine-readable
// per-stage status — not just the human-readable console output.
//
// CommonJS to match the lib/ directory convention.

const { writeFileSync } = require("node:fs");

// Adapt a palette `auditColorPairs` report into the uniform stage shape.
function stageFromPalette(name, audit) {
  const rows = (audit.results || []).map((r) => ({
    name: r.name,
    pass: r.pass,
    detail: `${r.ratio.toFixed(2)}:1 (needs ${r.required}:1, ${r.size}) — ${r.fg} on ${r.bg}`,
  }));
  return { stage: name, ok: audit.ok, rows };
}

// Combine stages into one report; ok only when every stage is ok.
function aggregate(stages) {
  const list = stages || [];
  return { ok: list.every((s) => s.ok), stages: list };
}

// Serialize a report to a JSON file (trailing newline, POSIX-friendly).
function writeReport(report, outPath) {
  writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n");
}

module.exports = { stageFromPalette, aggregate, writeReport };
