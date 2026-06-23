// Accessibility audit-chain stage: alt-text lint (issue #7).
//
// Promotes the parser's first-error alt-text check (parser/validators.js hard-errors
// on the first #diagram / #slide[layout::diagram] missing [alt::]) into a first-class
// audit stage that collects EVERY missing-alt visual with its source line, surfaced in
// the machine-readable a11y report. The parser keeps its hard-error as the build block;
// this stage is the reporting/standalone surface over the same rule.
//
// Operates on the parsed model (no LaTeX), so it runs pre-compile with good messages.
// CommonJS to match the lib/ directory convention.

function flatten(item, out) {
  out.push(item);
  for (const c of item.children || []) flatten(c, out);
}

// A visual that ADA Title II requires alt text on:
//   - a #diagram that is not also a #slide, or
//   - a #slide whose [layout::] is `diagram`.
// Missing alt = no [alt::] field.
function isMissingAltVisual(it) {
  if (it.tags.has("diagram") && !it.tags.has("slide") && !it.fields.has("alt")) {
    return true;
  }
  if (it.tags.has("slide")) {
    const layout = it.fields.has("layout") ? String(it.fields.get("layout")).trim() : null;
    if (layout === "diagram" && !it.fields.has("alt")) return true;
  }
  return false;
}

function auditAltText(parsed) {
  const all = [];
  for (const it of (parsed && parsed.items) || []) flatten(it, all);

  const rows = [];
  for (const it of all) {
    if (isMissingAltVisual(it)) {
      const snippet = String(it.text || "").slice(0, 60);
      rows.push({
        name: `line ${it.sourceLine}`,
        pass: false,
        detail: `visual missing [alt::] at line ${it.sourceLine}${snippet ? `: ${snippet}` : ""} — ADA Title II requires alt text on every visual`,
      });
    }
  }
  return { stage: "alt-text", ok: rows.length === 0, rows };
}

module.exports = { auditAltText, isMissingAltVisual };
