# Changelog

All notable changes to Scriptorium are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### Fixed
- **Restored the Cornell handout in-class answer key.** The `[topic]_cornell_handout_key.pdf`
  output — added in `7cd5307` ("feat: in-class answer key for the Cornell handout") — was
  silently dropped by `f085e277` ("chore: catch up installed-skill drift"), the 2026-05-14
  amnesty commit that overwrote the canonical generator with a drifted installed-skill copy
  predating the feature. From then on, every regenerated lecture produced only the student
  handout; the key was gone. Re-implemented against the current markdown-monolith generator:
  `generateCornellHandout` now returns `{ handoutTex, keyTex }` (mirroring the quiz generator),
  `lib/cornell-tex.js` regains the `\ifanswers` toggle, the `*** ANSWER KEY — INSTRUCTOR USE
  ONLY ***` banner, and `substituteAnswers` (rose-bold reveal, one answer per `_______` run from
  the `#blank` `[answer:: …]` field; `#vocab` definitions revealed in the key). `generate.js`
  writes and compiles both PDFs. Regression coverage added in `generators/cornell-handout.test.js`.
- **Restored and generalized `--mark-used <term>`.** The flag was parsed by `generate.js` but did
  nothing — its implementation lived in the exam generator's `markUsedTag()` and was removed with the
  exam path in `c087cab` ("retire exam generator"), leaving the flag wired to nothing. Reimplemented as
  `generators/mark-used.js` (`markUsedTags`), generalized from "mark the questions an exam picked" to
  "mark every deck item this build used": after a clean build, every tagged content bullet that survives
  the active semester filter gets `#used/<term>` appended in the source `_lecture_main.md` (idempotent;
  drafts and untagged prose skipped; respects `--semester`/`--strict-semester`). `generate.js` reports
  `tagged N item(s) … M already tagged`. Makes the documented `#used/<term>` reproducibility workflow
  actually executable. Covered by `generators/mark-used.test.js`.

### Added
- **Tagged-PDF emission — every artifact is now a tagged PDF (ADA Title II, issue #7 Phase 2).** The shared
  preambles (`lib/tex-helpers.js` `texPreamble`, `lib/cornell-tex.js` `cornellPreamble`) now emit
  `\DocumentMetadata{lang=en-US,testphase={phase-III}}` ahead of `\documentclass`, enabling LaTeX's
  automatic PDF tagging. Verified on **TeX Live 2026**: lecture-notes, Cornell handout + key, and quiz + key
  all compile to `pdfinfo → Tagged: yes` with a real `StructTreeRoot` (Document → lists with `LI`/`Lbl`/`LBody`,
  tables with `TR`/`TD`). pdflatex tagging works on TL2026, so **no lualatex/fontspec migration was needed** —
  the engine stays pdflatex. Requires a tagging-capable TeX Live (≥2024); on the no-op `tagpdf` stub in
  TL2023 the directive is silently inert (output simply untagged, no error). Covered by new assertions in
  `generators/lecture-notes.test.js` + `generators/cornell-handout.test.js`. Remaining Phase 2 polish:
  table header cells (`\thead{}` → `/TH`), heading-hierarchy outline, figure alt actualtext; then Phase 3
  wires veraPDF PDF/UA-1 validation.
- **ADA audit chain — stages 2+ (source-level lints + machine-readable report).** Extends the Stage 1
  palette-contrast gate (#5/#6) toward issue #7. Three new `lib/a11y/` stages hang off the existing
  `verify.js` runner / `generate.js` gate: `alt-text.js` promotes the parser's first-error `[alt::]`
  check into a stage that collects *every* missing-alt visual with its source line; `color-independence.js`
  is a render-based WCAG 1.4.1 sweep asserting every instructor callout emits its textual `[KIND]` badge
  and every student section banner emits its title (color is never the sole cue); `report.js` is a uniform
  `{stage, ok, rows}` model serialized to `a11y-report.json` so CI can gate on a per-stage status, not just
  console output. `npm run verify:a11y` gains `--out <dir>`; `generate.js` writes the per-run report and now
  gates on all three stages. Covered by `report.test.js`, `alt-text.test.js`, `color-independence.test.js`
  (15 new tests). Tagged-PDF emission (the remaining #7 stages) is blocked on a TeX Live upgrade — the
  on-box TeX Live 2023 ships a no-op `tagpdf` stub; see `docs/plans/wcag-audit-pass-plan.md`.
- **Extended the `examples/` demo beyond the single lecture.** Two more self-contained sample sources — `processes_and_threads_lecture_main.md` (a second CECS 326 topic, tagged `#used/sp26`) and `secure_protocols_478_lecture_main.md` (a CECS 478 topic) — plus `examples/README.md` sections demonstrating four previously-undemonstrated capabilities: the multi-topic `exam-reading-list-cli.js`, course-driven theme selection (blueprint for 326/378 vs **terminal** for 478), the staleness `audit` sub-command, and the `--readme-variant lab` GitHub Classroom variant.

---

## [0.1.0] — 2026-06-19

Rename release: `lecture-materials-assistant` becomes **Scriptorium**, taking its place as the
second tier of the Lectern · Scriptorium · Oracle LMS suite. The skill alias
`lecture-materials-assistant` is preserved so existing installations keep working.

### Added
- Suite framing in README and AGENTS.md: Lectern (registry/gradebook), **Scriptorium**
  (materials generation), Oracle (autograder); Oracle attribution notes its source-available
  license and private repo.
- Operator runbook (`docs/rename.md`) covering the `lecture-materials-assistant` → `scriptorium`
  migration path for installed skills.

### Changed
- Package name and skill entry point renamed `lecture-materials-assistant` → `scriptorium`;
  skill keeps the `lecture-materials-assistant` alias.
- README retitled and rewritten around the Scriptorium suite identity.

---

## [0.0.5] — 2026-06-08

WCAG accessibility gate, the `exam-reading-list` tool, Slidev dependency bump, and a
README refresh that documents the full nine-generator surface.

### Added
- **`exam-reading-list` generator** (`exam-reading-list-cli.js`) — multi-topic per-exam
  study guide that assembles a structured reading list scoped to exactly the topics an
  upcoming exam will cover.
- **WCAG contrast audit chain** (`audit.js`) — runs a contrast check over theme color pairs
  before generation proceeds; blocks output on failures so inaccessible materials can never
  be emitted silently.
- Self-contained runnable lecture sample under `examples/` so new users can verify the full
  pipeline without authoring a real source file.

### Changed
- `@slidev/cli` bumped `^0.49.0` → `^52.16.0` (upstream breaking rename; themes and
  components updated to match).
- Dead `init-spec` npm script dropped from `package.json`.
- README rewritten to document the markdown-monolith workflow and all nine current
  generators; stale `docx` references removed.

### Removed
- **Exam generator retired** — exam builds are now owned by lectern's `reg-exam-build`
  command, which carries per-student serialization, multi-form support, and Gradescope
  integration that belongs at the registry layer, not here.

---

## [0.0.4] — 2026-05-26

Slides pipeline rewritten from scratch with two course-branded Slidev themes.

### Added
- **Blueprint theme** (navy/cyan schematic aesthetic, CECS 378) with `Schematic` and
  `EventChain` custom components.
- **Terminal theme** (phosphor-green monospace/scanline aesthetic, CECS 478).
- `slides.js` rewritten as a Slidev markdown emitter; course field drives
  automatic theme selection (378 → Blueprint, 478 → Terminal).
- `@slidev/cli` scaffolded and both themes registered as local packages.
- Slidev slide-system documentation added; Beamer/LaTeX slide docs removed.

### Fixed
- Cover slide full-height layout and phantom-slide bug (first-slide headmatter fold).
- Stuck Goto autocomplete hidden in generated decks.

---

## [0.0.3] — 2026-05-13 — 2026-04-25

Cornell handout, answer key, bank-csv, and exam-macro work ahead of the exam generator
retirement.

### Added
- **Cornell handout PDF generator** with section-kind color coding (concept /
  definition / example / exercise).
- **In-class answer key** variant of the Cornell handout (separate artifact, same source).
- **`bank-csv` generator** — exports the question bank as a spreadsheet-friendly CSV for
  mail-merge grading workflows.
- Markdown copies of Cornell handout and quiz; documents the living-notes model.
- Markdown lecture-notes generator (`notes-md` artifact).
- LaTeX macros for per-student exam builds: `\studentname`, `\studentserial`, `\issuedto`,
  plus `\@ifundefined`-guarded `answersmode` bridge for `reg-exam-build` keying.

---

## [0.0.2] — 2026-04-12

LaTeX/PDF pipeline replacing the original HTML generators.

### Added
- `lib/tex-helpers.js` — shared LaTeX string-escape helpers and `compileLatex` (spawnSync
  wrapper).
- **`lecture-notes` generator** rewritten to LaTeX/PDF.
- **`study-questions` generator** rewritten to LaTeX/PDF with Bloom taxonomy grouping.
- **`quiz` generator** rewritten to LaTeX/PDF with answer key on a separate page.
- Cornell handout restructured to section-mirroring layout with an accessible color palette.
- Generator overhaul design spec and implementation plan committed to `docs/`.
- Installer script (`install.sh`).

### Fixed
- `texEscape` single-pass regex (was double-escaping backslashes).
- Array-access guards in `deriveQuestions` and section table/callout guards in
  `lecture-notes`.
- `defaultSection()` template placeholders replaced with explicit TODO markers.

---

## [0.0.1] — 2026-04-12

Initial scaffold: `lecture-materials-assistant` Claude Code skill.

### Added
- Initial skill with question bank, pop quiz, Cornell handout, and slide artifacts.
- MIT license (replaces initial GPL-3.0).
- CLAUDE.md with architecture tree and generation flow.
- Reference exam template (plain LaTeX, migrated from LyX).
- Question bank scoped to full topics (~50 questions across four Bloom levels).
- Adversarial-thinking toggle, lab README variant, and generic template.

[Unreleased]: https://github.com/agiacalone/scriptorium/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/agiacalone/scriptorium/compare/v0.0.5...v0.1.0
[0.0.5]: https://github.com/agiacalone/scriptorium/compare/v0.0.4...v0.0.5
[0.0.4]: https://github.com/agiacalone/scriptorium/compare/v0.0.3...v0.0.4
[0.0.3]: https://github.com/agiacalone/scriptorium/compare/v0.0.2...v0.0.3
[0.0.2]: https://github.com/agiacalone/scriptorium/compare/v0.0.1...v0.0.2
[0.0.1]: https://github.com/agiacalone/scriptorium/releases/tag/v0.0.1
