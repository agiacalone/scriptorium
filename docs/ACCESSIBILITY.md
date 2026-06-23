# Accessibility & ADA Title II Compliance — Scriptorium

**Audience:** auditors, reviewers, and maintainers verifying that the lecture materials
Scriptorium generates meet digital-accessibility obligations.
**Status date:** 2026-06-23. **Tracking issue:** #7. **Roadmap:** `docs/plans/2026-06-23-a11y-roadmap.md`.

This document is the authoritative, version-controlled record of *how* Scriptorium produces
accessible documents and *how that is verified*. It is intentionally honest about what is and is
not yet compliant, and why — claims here are backed by a machine validator, not aspiration.

---

## 1. Regulatory scope

| Obligation | What it means here |
|---|---|
| **ADA Title II** (42 U.S.C. §12131 et seq.) | Public entities — including CSULB, a California State University campus — must make their programs accessible. Course materials are part of the program. |
| **DOJ 2024 Title II web/mobile rule** (28 CFR Part 35) | Sets **WCAG 2.1 Level AA** as the technical standard for web content and **electronic documents**. Large public entities' compliance deadline is **2026-04-24**; smaller entities **2027-04-26**. Scriptorium targets the standard ahead of the operative deadline. |
| **WCAG 2.1 AA** | The content standard. For PDFs, the corresponding machine-checkable conformance target is **PDF/UA-1 (ISO 14289-1)** — tagged structure, reading order, alt text, document title, etc. |
| **PDF/UA-1** | The PDF accessibility ISO standard. Scriptorium's compiled PDFs are validated against it with **veraPDF**. |

**Why PDF/UA-1 as the proxy:** WCAG 2.1 AA is written for web content; for the PDF artifacts (lecture
notes, Cornell handouts, quizzes) the industry-standard machine-verifiable expression of the same
requirements is PDF/UA-1. Passing PDF/UA-1 satisfies the structural WCAG criteria that apply to documents
(1.3.1 Info & Relationships, 1.3.2 Meaningful Sequence, 1.1.1 Non-text Content, 2.4.2 Page Titled, etc.).

---

## 2. Compliance architecture — the audit chain

Every generation run passes through a two-tier audit chain enforced by `generate.js`. The principle:
**accessibility is gated, not optional, and the gate is backed by evidence.**

```
 SOURCE  ──►  pre-generation gate  ──►  GENERATE  ──►  post-generation gate  ──►  artifacts + a11y-report.json
 (_lecture_main.md)   (lib/a11y/*)                       (lib/a11y/pdfua.js)
```

### Tier 1 — source-level lints (pre-generation, blocking)
Run on the parsed source before any artifact is written (`runA11yGate` in `generate.js`). Any failure
**aborts generation** with an actionable message.

| Stage | Module | Checks | Maps to |
|---|---|---|---|
| Palette contrast | `lib/a11y/palette-audit.js`, `project-palette.js`, `contrast.js` | Every student/instructor color pair meets the WCAG contrast ratio for its text size | WCAG 1.4.3 Contrast (Minimum) |
| Color-independence | `lib/a11y/color-independence.js` | Every callout/section emitter pairs color with a textual/glyph cue (never color alone) | WCAG 1.4.1 Use of Color |
| Alt-text | `lib/a11y/alt-text.js` | Every visual (`#diagram`, `[layout:: diagram]`) carries `[alt:: …]`; collects *all* misses | WCAG 1.1.1 Non-text Content |

Results are aggregated into a machine-readable `a11y-report.json` (`lib/a11y/report.js`).

### Tier 2 — compiled-PDF validation (post-generation)
The source lints can't see the *compiled* output. `runPdfUaGate` (`generate.js` → `lib/a11y/pdfua.js`)
checks every produced PDF:

- **veraPDF** PDF/UA-1 profile when the `verapdf` binary is on `PATH` (the authoritative deep check —
  tags, reading order, heading hierarchy, table semantics, metadata).
- **`pdfinfo` `Tagged:` smoke-check** as a graceful fallback when veraPDF is absent. A tagged PDF passes
  the smoke-check, but its report row says *"smoke-check only — install veraPDF"* — **a fallback pass is
  never reported as a full PDF/UA pass (no silent pass).**

#### Blocking model (important for auditors)
| Condition | Default build | Under `--strict-a11y` (CI) |
|---|---|---|
| PDF **untagged** (no StructTreeRoot) | **FAIL (exit 1)** | FAIL |
| PDF tagged but **not** fully PDF/UA-1 | advisory (logged, recorded, build proceeds) | **FAIL (exit 1)** |
| PDF fully PDF/UA-1 compliant | pass | pass |

Rationale: the *tagged-presence* invariant is a hard regression guard (an untagged document has no
accessibility tree at all). Full PDF/UA-1 compliance is held to an **advisory** by default so that a single
known toolchain-limited rule (see §5) doesn't block routine lecture generation — but `--strict-a11y` makes
it blocking for CI and release gates. The decision logic is the pure, unit-tested
`evaluatePdfUaGate(stage, {strict})`.

---

## 3. How the documents are made accessible (generation)

Tagged-PDF emission is driven by LaTeX's PDF management layer. Both shared preambles
(`lib/tex-helpers.js` `texPreamble`, `lib/cornell-tex.js` `cornellPreamble`) begin with:

```latex
\DocumentMetadata{lang=en-US,pdfstandard=ua-1,pdfversion=1.7,testphase={phase-III,table}}
```

- `testphase={phase-III,table}` activates LaTeX's automatic structure tagging (Document, headings, lists,
  tables → real `StructTreeRoot`) and the table-tagging module.
- `pdfstandard=ua-1` writes the **PDF/UA-1 identifier** into the XMP metadata.
- `pdfversion=1.7` forces the PDF-1.7 header PDF/UA-1 requires (LaTeX's default is PDF 2.0).

Plus, for the document-title requirements:
```latex
\hypersetup{pdftitle={<title>},pdfdisplaydoctitle=true}
```
satisfying `dc:title` (XMP) and the `DisplayDocTitle` ViewerPreference.

**Table headers** are tagged `/TH` (not `/TD`) via a group-scoped
`\tagpdfsetup{table/header-rows={1}}` around each comparison table — so screen readers announce header
cells correctly (WCAG 1.3.1). GFM pipe tables in the source flow through the parser
(`parsed.tables`/`tablesForSection`) into the `texComparisonTable`/`cornellComparisonTable` emitters.

**Requirement:** a tagging-capable TeX Live (**≥ 2024-06**; verified on **TeX Live 2026**). On older TeX
Live the `tagpdf` support is a no-op and PDFs will not be tagged — the Tier-2 gate catches this (untagged →
build fails).

---

## 4. Evidence & reproduction

- **`a11y-report.json`** (written into the output dir each run) — machine-readable per-stage, per-artifact
  status: `{ stage, ok, rows: [{ name, pass, detail, ua1? }] }`. This is the primary audit artifact.
- **Reproduce locally:**
  ```sh
  node generate.js --main examples/file_systems_abstraction_lecture_main.md
  cat examples/products/a11y-report.json
  verapdf -f ua1 --format text examples/products/<artifact>.pdf   # deep check, per file
  ```
- **CI:** `.github/workflows/a11y.yml` installs TeX Live + veraPDF, regenerates the example, runs the
  gate, and uploads `a11y-report.json` as a build artifact.
- **Tooling provenance:** TeX Live 2026 (tagging) · veraPDF 1.30.2 (PDF/UA-1 validator) · pikepdf
  (structure spot-checks) · pdfinfo (fallback smoke-check).

---

## 5. Current compliance status (honest)

Measured with veraPDF 1.30.2 on the canonical example (`file_systems_abstraction`):

| Artifact | Tagged | PDF/UA-1 | Notes |
|---|---|---|---|
| quiz | ✅ | ✅ **compliant** | 0 failed rules |
| quiz key | ✅ | ✅ **compliant** | 0 failed rules |
| lecture notes | ✅ | ⚠️ 1 rule | clause 7.1 t3 (below) |
| Cornell handout | ✅ | ⚠️ 1 rule | clause 7.1 t3 |
| Cornell handout key | ✅ | ⚠️ 1 rule | clause 7.1 t3 |

**The single residual rule — PDF/UA-1 clause 7.1 t3 ("content shall be marked as Artifact or tagged as
real content"):** isolated (via veraPDF spikes) to two sources of *untagged decorative content*:
1. **Table border rules** — `\hline`, `|` column separators, and even booktabs `\toprule/\midrule/\bottomrule`
   all emit content the current LaTeX tagging engine does not auto-artifact. Only a fully borderless table
   passes.
2. **`mdframed` background fills** — the navy section-header strips in lecture notes.

This is a **documented limitation of the LaTeX tagging toolchain** (TeX Live 2026, `testphase=phase-III`),
not a defect in Scriptorium's process. Manual `\tagmcbegin{artifact}` wrapping was tried and made it
*worse*. The two resolution paths are (a) a design regression (drop the borders/fills, sacrificing the
color-as-navigation-cue design) or (b) adopt the engine's rule/frame artifacting when it ships in a later
LaTeX tagging phase. The advisory gate surfaces the gap on every build; we **re-test on each TeX Live
upgrade** and flip CI to strict-blocking once it clears. See the roadmap (P2) for the watch.

**Audit posture:** the chain *measures* compliance on every build, blocks any regression to untagged,
records per-artifact status as evidence, and is explicit about the one known gap and its upstream cause.
No artifact is claimed compliant that veraPDF does not confirm compliant.

---

## 6. Maintenance & process

- **On every TeX Live upgrade:** re-run the example through the gate and `verapdf -f ua1`; if clause 7.1 t3
  clears, remove `continue-on-error` from the CI `--strict-a11y` step and update §5.
- **Adding a visual/diagram:** the parser hard-errors without `[alt:: …]`; the alt-text stage collects any
  misses — keep them at zero.
- **Adding/altering colors:** the palette-contrast + color-independence stages will block on a failing
  pair; fix the pair, don't bypass.
- **Never use `--skip-a11y` for distributed materials** — it bypasses the Tier-1 gate and exists only for
  local iteration.
- **Releases / CI** run with `--strict-a11y` so PDF/UA-1 status is enforced, not merely reported.
