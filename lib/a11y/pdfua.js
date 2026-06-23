// pdfua.js — PDF/UA-1 validation stage (issue #7, Phase 3).
//
// Closes the audit chain on the *compiled* artifacts: the pre-generation stages
// (palette, color-independence, alt-text) check the source, but only a real PDF
// validator can confirm the tagged structure (StructTreeRoot, reading order,
// heading hierarchy, table semantics) actually landed in the output.
//
// Two tiers, in preference order:
//   - veraPDF CLI (PDF/UA-1 profile) — the authoritative deep check. Mechanically
//     covers tags, reading order, heading nesting, and table headers in one shot.
//   - pdfinfo `Tagged:` smoke-check — graceful fallback when veraPDF is absent.
//     A tagged PDF *passes the smoke-check* but the row says so explicitly, so a
//     fallback pass is never mistaken for a full PDF/UA pass (no silent pass).
//
// CommonJS to match the lib/ directory convention.

const path = require("node:path");
const { spawnSync } = require("node:child_process");

// --- pure interpreters (unit-tested) -------------------------------------

// pdfinfo emits a "Tagged: yes|no" line. Tagged ⇒ smoke-pass (annotated);
// untagged ⇒ hard fail (no StructTreeRoot means no accessibility tree at all).
function interpretPdfinfo(stdout, artifact) {
  const tagged = /^Tagged:\s*yes\b/im.test(String(stdout || ""));
  if (tagged) {
    return {
      name: artifact,
      pass: true,
      detail: "tagged (pdfinfo smoke-check only — install veraPDF for the full PDF/UA-1 check)",
    };
  }
  return { name: artifact, pass: false, detail: "not tagged — no StructTreeRoot (run on a tagging-capable TeX Live)" };
}

// veraPDF --format json: report.jobs[].validationResult[] carries `compliant`
// plus a failed-rule count. Pick the PDF/UA-1 result (or the first result).
function interpretVeraJson(obj, artifact) {
  const results = obj?.report?.jobs?.[0]?.validationResult || [];
  const r = results.find((v) => /UA-1/.test(v.profileName || "")) || results[0] || {};
  const compliant = r.compliant === true;
  const failed = r.details?.failedRules ?? 0;
  return {
    name: artifact,
    pass: compliant,
    detail: compliant
      ? "PDF/UA-1 compliant (veraPDF)"
      : `PDF/UA-1 non-compliant (veraPDF) — ${failed} failed rule(s)`,
  };
}

// --- orchestration (pure given injected runners) -------------------------

// The BLOCKING invariant is tagged-presence (pdfinfo `Tagged:`): an untagged PDF
// has no accessibility tree at all and fails the gate. veraPDF's PDF/UA-1 verdict
// rides along as an ADVISORY (`row.ua1`) — it's reported and written to the report,
// but it never flips `row.pass`/`stage.ok`. Rationale: full PDF/UA-1 compliance is
// real remediation work (XMP identifier, dc:title, artifacting, …) and shouldn't
// break every lecture build the moment veraPDF is installed. A future --strict-a11y
// flag (or CI) can opt into treating the advisory as blocking.
function auditPdfUA(pdfPaths, { haveVera, runVera, runPdfinfo }) {
  const rows = (pdfPaths || []).map((pdf) => {
    const artifact = path.basename(pdf);
    const tagged = interpretPdfinfo(runPdfinfo(pdf), artifact); // { name, pass, detail }
    if (!haveVera) return tagged;
    const vera = interpretVeraJson(runVera(pdf), artifact); // { name, pass, detail }
    return {
      name: artifact,
      pass: tagged.pass, // gate on tagging only
      detail: tagged.pass ? `tagged; ${vera.detail}` : tagged.detail,
      ua1: { compliant: vera.pass, detail: vera.detail }, // advisory
    };
  });
  return { stage: "pdf-ua", ok: rows.every((r) => r.pass), rows };
}

// --- real-runner wrapper (thin wiring; the testable logic is above) ------

function veraPdfAvailable() {
  const r = spawnSync("verapdf", ["--version"], { stdio: "ignore" });
  return r.status === 0;
}

// Run the PDF/UA stage over real files, auto-selecting veraPDF or the pdfinfo
// fallback. Returns the uniform { stage, ok, rows } shape.
function runPdfUaStage(pdfPaths) {
  const haveVera = veraPdfAvailable();
  return auditPdfUA(pdfPaths, {
    haveVera,
    runVera: (pdf) => {
      const r = spawnSync("verapdf", ["--format", "json", "-f", "ua1", pdf], { encoding: "utf8" });
      try {
        return JSON.parse(r.stdout || "{}");
      } catch {
        return {};
      }
    },
    runPdfinfo: (pdf) => {
      const r = spawnSync("pdfinfo", [pdf], { encoding: "utf8" });
      return r.stdout || "";
    },
  });
}

module.exports = { interpretPdfinfo, interpretVeraJson, auditPdfUA, veraPdfAvailable, runPdfUaStage };
