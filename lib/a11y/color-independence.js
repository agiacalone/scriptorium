// Accessibility audit-chain stage: color-independence verifying sweep (issue #7).
//
// WCAG 1.4.1 (Use of Color): color must never be the SOLE carrier of meaning. The
// generators already pair each color with a non-color cue — instructor callouts carry
// a textual `[KIND]` badge, student section banners carry the Roman numeral + title —
// so this stage *verifies* that invariant by rendering each kind and asserting the
// non-color textual cue survives. It catches a regression that drops the badge/title
// and leaves color as the only differentiator.
//
// Renderers are injected (dependency injection) so the check is unit-testable without
// the LaTeX generators; projectColorIndependence() wires the real emitters.
//
// CommonJS to match the lib/ directory convention.

// Letters-only so it survives texEscape unchanged (e.g. `_` would become `\_`).
const SECTION_TITLE_PROBE = "ZZCOLORINDEPTITLEPROBEZZ";

function auditColorIndependence({
  callouts = {},
  sections = {},
  renderCallout,
  renderSection,
} = {}) {
  const rows = [];

  for (const kind of Object.keys(callouts)) {
    const out = String(renderCallout(kind));
    const pass = out.includes(`[${kind}]`);
    rows.push({
      name: `callout/${kind}`,
      pass,
      detail: pass
        ? "textual [KIND] badge present alongside color"
        : `callout "${kind}" renders color with no textual [${kind}] badge — color-only distinction (WCAG 1.4.1)`,
    });
  }

  for (const kind of Object.keys(sections)) {
    const out = String(renderSection(kind, SECTION_TITLE_PROBE));
    const pass = out.includes(SECTION_TITLE_PROBE);
    rows.push({
      name: `section/${kind}`,
      pass,
      detail: pass
        ? "textual section title present alongside color"
        : `section "${kind}" banner renders color with no textual title cue — color-only distinction (WCAG 1.4.1)`,
    });
  }

  return { stage: "color-independence", ok: rows.every((r) => r.pass), rows };
}

// Wire the real project emitters (single source of truth) into the sweep.
function projectColorIndependence() {
  const tex = require("../tex-helpers.js");
  const cornell = require("../cornell-tex.js");
  return auditColorIndependence({
    callouts: tex.CALLOUT_CONFIG,
    sections: cornell.SECTION_KINDS,
    renderCallout: (kind) => tex.texCallout(kind, "sample body"),
    renderSection: (kind, title) => cornell.cornellSectionBanner(title, 1, null, kind),
  });
}

module.exports = { auditColorIndependence, projectColorIndependence };
