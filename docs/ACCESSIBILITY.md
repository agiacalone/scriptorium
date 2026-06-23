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

### 2.1 The pipeline is a compiler — and the validator is its type-checker

The most accurate mental model: Scriptorium is a **compiler** and the accessibility chain is its
**type system**. This isn't a loose metaphor — the structure maps one-to-one, and it's the right frame
for reasoning about where compliance succeeds, where it fails, and *whose problem* a failure is.

| Compiler concept | Scriptorium |
|---|---|
| Source | `_lecture_main.md` (tagged Markdown) |
| Front-end / AST | `parser/` → items, sections, tables, fields |
| Codegen → IR | `generators/` → LaTeX |
| Backend / assembler | `pdflatex` → the PDF (the "binary") |
| Type annotations / debug symbols | the **structure tree** — `StructTreeRoot`, `/H1…/H6`, `/TH`, `/Artifact`. *Tagging is type-annotating content.* |
| Static analyzer / type-checker | **veraPDF** parses the PDF and runs the PDF/UA-1 clause-set against it |
| Type errors with source locations | "failed checks" — the `mcid`/content-path is a stack-trace-style locator |
| `-Werror` | `--strict-a11y` |
| Warnings vs errors | advisory vs blocking |
| Diagnostics output | `a11y-report.json` |
| Semantic analysis pass | **Tier 1** source lints (before codegen) |
| Post-link verification | **Tier 2** PDF/UA check (after codegen) |

**Where the analogy is exact:** accessibility tagging *is* a type system for documents. A screen reader
is a consumer that relies on those types (`/TH` ⇒ "announce as a column header") exactly as a runtime
relies on a memory layout. veraPDF is the checker that proves the annotations are present and
well-formed before the artifact ships.

**Where it frays (three ways, increasingly important):**

1. **The spec is prose, not a formal type system.** PDF/UA-1 is natural-language ISO 14289-1 clauses
   interpreted by the validator — so veraPDF, PAC, and Acrobat Preflight disagree on edge cases, the way
   two compilers implement an under-specified language differently. We standardize on **veraPDF** as our
   reference checker so "compliant" has one unambiguous meaning in this project.
2. **It checks preconditions, not adequacy.** veraPDF verifies that alt text *exists* and a reading order
   *is defined* — it cannot verify the alt text is *meaningful* or the order is *correct*. It catches
   "missing annotation," never "wrong annotation" (no Rice's-theorem escape). Semantic correctness still
   requires human review; the source lints (alt-text required, color never alone) push as much of that
   upstream as a machine can.
3. **It's a post-hoc verifier on the artifact, decoupled from the producing backend — and this is the
   crux of our one residual failure.** The producer (`pdflatex`'s tagging) and the checker (veraPDF) are
   separate tools, so errors surface at the "linked binary" stage, not inline at the source. Our residual
   clause-7.1-t3 failure (§5) is **missing annotations the codegen backend did not emit** — the analog of
   a compiler backend that drops debug symbols for certain constructs. The verifier correctly flags the
   missing symbols, but the fix lives in the backend (LaTeX's tagging engine), which we do not control and
   cannot patch from the source. That is why editing the materials cannot resolve it — see §5.

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
real content").** In compiler terms (§2.1): the codegen backend (`pdflatex`'s tagging) does **not emit
complete type annotations** for these documents — some content reaches the PDF neither tagged as real
content nor marked `/Artifact`. The verifier correctly flags the missing annotations; the gap is in the
backend, not the source.

**This was experimentally confirmed to be a backend gap, not a styling choice (2026-06-23).** The
intuitive hypothesis was that decorative fills/rules were the culprit — colored table borders (`\hline`,
`|`, even booktabs rules) and `mdframed` background fills do each emit untagged content in isolation. But
a full de-styling experiment **disproved that as the whole story**: a variant with *every* fill and rule
removed (the generated `.tex` contained zero `\cellcolor`/`\rowcolor`/`\hline`/`\vrule`) **still failed the
same rule on the same ~100 content items.** So:

- Editing the **source** (the lecture materials) does not fix it — we removed the decorations and the
  failure count did not move. This is the decisive evidence that it is a codegen-gap, not an authoring
  defect.
- The de-styling would also have been a genuine pedagogical regression (it removes the Cornell handout's
  yellow fill-in cells — the "write here" affordance — its cue-column tint, and the at-a-glance section
  banners) **while buying zero compliance.** It was therefore abandoned; the rich, navigable design is
  retained.

**Status: toolchain-limited, watched.** Root cause is the maturity of LaTeX's automatic tagging
(`testphase=phase-III` on TeX Live 2026) — rule/frame artifacting and complete content tagging for
box-and-table-heavy layouts are expected in a later tagging phase. The **advisory gate surfaces the gap on
every build** (never a silent pass), the simpler artifacts (quiz, quiz key) are already fully compliant,
and we **re-run veraPDF on each TeX Live upgrade**, flipping CI to strict-blocking once the backend closes
the gap. See the roadmap (P2). A future *source-side* mitigation that would also help: emitting fill-in
fields as accessible AcroForm `\TextField`s rather than colored cells.

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
