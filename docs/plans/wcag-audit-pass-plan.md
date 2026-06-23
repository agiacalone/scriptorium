---
created: 2026-06-22T12:25:00-07:00
updated: 2026-06-23T10:50:00-07:00
tags: [scriptorium, accessibility, teaching, tooling, plan]
type: plan
status: draft
icon: LiListChecks
iconColor: var(--text-normal)
---
# Scriptorium — WCAG 2.1 AA Audit Pass — Implementation Plan

Implements GitHub issue **#7** (ADA audit chain, stages 2+). Companion scope:
`plans/scriptorium/wcag-audit-pass-scope.md` (vault) / this repo's tracking issue. Stage 1
(palette contrast) already shipped in #5/#6 — this plan covers the remaining stages.

**Architecture invariant (do not break):** every stage is a module under `lib/a11y/` exporting a
pure-ish `run()` that returns a structured result, registered in `lib/a11y/verify.js`, and gated in
`generate.js`. Stage 1 set this pattern; every phase below extends it, never forks it.

**Standing rule (per [[changelog-doctrine]]):** every phase's PR adds a `CHANGELOG.md` `## [Unreleased]`
entry in the same commit — WCAG stages under `Added`; any regression uncovered gets the full
introduce→break→mechanism→restore citation chain.

---

## Phase 0 — De-risk spike + tooling prereqs `[S]`  — BLOCKS Phase 2

**Goal:** answer the one question that sizes everything — *can `pdflatex` (TL2023) emit a valid
`StructTreeRoot`, or must `compileLatex` migrate to lualatex?*

1. Install `tagpdf`: `sudo dnf install texlive-tagpdf` (fallback `tlmgr install tagpdf`). Confirm
   `kpsewhich tagpdf.sty` resolves.
2. Install veraPDF CLI (Java app, verapdf.org installer or container). Confirm `verapdf --version`.
3. Spike branch: prepend `\DocumentMetadata{lang=en-US,testphase={phase-III}}` to the preamble of
   **one** Cornell handout and **one** lecture-notes `.tex` (hand-edit a generated `.tex`, do not
   touch generators yet). Compile under `pdflatex`.
4. Probe the output: `pdfinfo <pdf> | grep Tagged` (expect `Tagged: yes`) and
   `verapdf -f ua1 <pdf>` (read the failure list).

**Verify / decision gate:** write a one-paragraph decision into the scope's "crux decision" section —
**pdflatex-tagging viable** (proceed in-engine) **or lualatex-migration required** (Phase 2 grows a
fontspec sub-task). Do not start Phase 2 until this is recorded.

> **RESULT (2026-06-22):** TeX Live 2023 emits **zero tags** under both pdflatex and lualatex —
> `tagpdf-base v0.98e` on this box is the *"no-op version"*; real auto-tagging needs LaTeX 2024-06+.
> The blocker is the **TeX Live version, not the engine**. New hard prerequisite → **Phase 1.5** below.
> Full decision recorded in the scope's crux-decision callout. veraPDF (step 2) deferred — nothing
> to validate yet; Java 21 confirmed present for when it's needed.

---

## Phase 1.5 — Prerequisite: TeX Live upgrade `[?]`  — BLOCKS Phase 2

Surfaced by the Phase 0 spike. Tagged-PDF emission is impossible on TeX Live 2023.

> [!success] Vehicle resolved 2026-06-22 — Fedora 43 → 44 upgrade
> **Verified:** this box's `texlive-base-20230311` is TL2023, and `dnf check-update` shows nothing
> newer in F43's repos — F43 tops out at 2023. Per the Fedora package DB, **Fedora 44 ships
> `texlive 2025-1.fc44`** (Rawhide/F45 likewise 2025). TeX Live 2025 has the matured LaTeX auto-tagging.
> So the **Fedora 43 → 44 OS upgrade brings a tagging-capable TeX Live system-wide** — Anthony wants
> that upgrade anyway, so it's the chosen vehicle. The earlier fallbacks (upstream `install-tl` into a
> PATH-scoped prefix; a TL2025 compile container) are retained only if the OS upgrade slips.

**Post-upgrade checklist (the blast radius to manage):**
1. **Re-smoke-test exams** — the upgrade moves the *system* TeX (TL2023 → TL2025) that lectern's
   `reg-exam-build` compiles against. Compile a known exam; confirm output + per-student serials render.
   This is the controlled-document pipeline — do not skip.
2. **Re-run the Phase 0 spike** on TL2025 → expect `pdfinfo … Tagged: yes` + a `StructTreeRoot`, which
   also finally answers the deferred pdflatex-vs-lualatex question for real.

**Independent of vehicle — build regardless:** a **capability-probe preflight** (`lib/a11y/` stage) that
compiles a 3-line `\DocumentMetadata` doc and checks for a `StructTreeRoot`, failing tagged-PDF builds
with an actionable message if the toolchain can't tag. This is the "require the dependency" enforcement +
CI guard; it fails cleanly pre-upgrade and passes post-upgrade. TDD-able with a fake compiler.

**Verify:** the Phase 0 spike `.tex` compiles to a PDF with `pdfinfo … Tagged: yes` + a `StructTreeRoot`.

---

## Phase 1 — Source-level lints `[M]`  — ✅ DONE 2026-06-22

No engine risk; ships value regardless of Phase 0. Built and verified: 15 new tests, full suite
166 green, standalone + end-to-end + negative (blocked-build) paths confirmed; CHANGELOG updated.
All three sub-tasks (1a JSON report, 1b alt-text lint, 1c color-independence sweep) landed behind the
existing `verify.js` runner / `generate.js` gate; `a11y-report.json` is now emitted per run.

### 1a. Per-artifact JSON report backbone
- Extend the report shape (currently human-readable, generation-level in `palette-audit.js`/`verify.js`)
  to a machine-readable array: `{ artifact, stage, pass, detail }[]`, written to `<out>/a11y-report.json`.
- Keep the human-readable console formatter; it now renders *from* the structured array.
- **Verify:** `npm run verify:a11y` emits both console output and `a11y-report.json`; a deliberately
  failing palette pair shows up as a `{pass:false}` row in the JSON. Test in `verify.test.js`.

### 1b. Alt-text lint stage → `lib/a11y/alt-text.js`
- Promote the parser's existing hard-error (`#diagram`/`[layout:: diagram]` missing `[alt::]`) to a
  first-class stage that scans `_lecture_main.md` for *every* visual and reports each missing `[alt::]`
  with file + line, instead of throwing on the first.
- Register in `verify.js`; gate in `generate.js`.
- **Verify:** new `lib/a11y/alt-text.test.js` — fixture with two visuals, one missing alt → one failure
  row, actionable message naming the line.

### 1c. Color-independence sweep → `lib/a11y/color-independence.js`
- Generators already enforce glyph+label pairing; add a *verifying* sweep over generated `.tex` that
  flags any callout/section emission producing color without a paired glyph/label.
- Register + gate as above.
- **Verify:** `lib/a11y/color-independence.test.js` — a synthetic color-only callout trips one failure;
  a properly paired one passes.

---

## Phase 2 — Tagged-PDF emission (remediation) `[L]`  — ✅ CORE DONE 2026-06-22

**Outcome better than planned:** the post-upgrade spike showed **pdflatex tagging works on TL2026**, so the
feared lualatex/fontspec migration was *avoided* — engine stays pdflatex. `\DocumentMetadata{...testphase=
{phase-III}}` added to both shared preambles (`texPreamble`, `cornellPreamble`). Verified: lecture-notes,
Cornell handout + key, quiz + key all `Tagged: yes` with a real `StructTreeRoot` (Document → lists, tables
→ TR/TD). 168 tests green; full build clean. **Remaining Phase 2 polish** (incremental): ~~table header cells
(`\thead{}` → `/TH`)~~ ✅ **mechanism done 2026-06-23** (see below); heading-hierarchy outline, figure alt actualtext.

> **Table header `/TH` — verified recipe (2026-06-23).** `\thead{}` was a red herring; the working mechanism on
> TL2026 is: (1) add the `table` module to the metadata — `\DocumentMetadata{…testphase={phase-III,table}}`; (2)
> wrap the table in a group with `\tagpdfsetup{table/header-rows={1}}`. Empirically confirmed via a pikepdf
> StructTreeRoot walk: header row → `/TH`, data rows → `/TD`, and the group scope keeps non-header *layout*
> tables (e.g. the Cornell cue/notes table) at `/TD` with no leak to later tables. Applied to `texComparisonTable`
> + `cornellComparisonTable` and unit-tested. **Caveat:** those comparison-table emitters are not yet called by the
> live markdown-monolith generators, so the recipe is correct + ready but no shipping artifact emits `/TH` yet —
> wiring them in is the remaining step. The two auto-mechanisms that *don't* work (so we don't retry them):
> plain `phase-III` and `phase-III,table` + `\midrule`/booktabs both yield `/TD` only.

1. Add `\DocumentMetadata{...testphase={phase-III}}` + `tagpdf` setup to the **shared** preamble:
   `lib/tex-helpers.js` (instructor) and `lib/cornell-tex.js` (student). One preamble change
   propagates to all artifacts — the md-monolith forcing function.
2. Heading hierarchy: ensure sectioning emits a gap-free tagged outline (no skipped levels).
3. Table semantics: emit `\thead{}` on header cells; assert no headerless data tables in the generators.
4. Figure/diagram alt: route the `[alt::]` field into tagpdf actualtext/alt on each visual.
5. **If lualatex migration (Phase 0 said so):** swap `compileLatex` engine (`lib/tex-helpers.js:537`);
   add a `fontspec` preamble replacing the pdflatex Charter/CM setup; visually re-baseline **every**
   artifact (the fonts will shift). This is the expensive branch — budget accordingly.

**Verify:** regenerate the `examples/` lectures; `pdfinfo … | grep Tagged` → `yes` on every
student-facing PDF; visual diff against pre-change baselines (catch layout regressions, esp. on the
lualatex branch). Existing generator tests stay green.

---

## Phase 3 — veraPDF validation stage `[M]`  — ✅ CORE DONE 2026-06-23

1. ✅ `lib/a11y/pdfua.js` — wraps the veraPDF CLI (PDF/UA-1 profile) per artifact; parses its
   machine-readable report into the Phase 1a JSON shape. Pure interpreters (`interpretPdfinfo`,
   `interpretVeraJson`) + `auditPdfUA` orchestration unit-tested in `lib/a11y/pdfua.test.js` (8 tests).
2. ✅ No-Java fallback: when `verapdf` is absent, falls back to a `pdfinfo` `Tagged:` smoke-check —
   a tagged PDF passes but its report row says "smoke-check only — install veraPDF", so a fallback pass
   is **never** mistaken for a full PDF/UA pass (no silent pass). veraPDF auto-detected on `PATH`.
3. ✅ Gated in `generate.js` as a **post-generation** step (`runPdfUaGate`) — the pre-generation gate
   checks the source, this checks the compiled PDFs. Appends a `pdf-ua` stage to `a11y-report.json` and
   exits 1 on any untagged artifact. (Runs after generation, not in `verify.js`'s pre-gen runner, because
   it needs the compiled output.)

4. ✅ **Blocking model corrected (2026-06-23):** the gate blocks on *tagged-presence* only (untagged →
   exit 1); veraPDF's PDF/UA-1 verdict is **advisory** (`row.ua1`, logged + in `a11y-report.json`), never
   blocking — so installing veraPDF doesn't break every lecture build. A `--strict-a11y` flag can opt in.

> **veraPDF installed 2026-06-23 — veraPDF 1.30.2** (userspace, `~/verapdf/`, symlinked `~/bin/verapdf`;
> headless IzPack console install, CLI pack). The deep check now runs. **Reality check:** all 5 example
> artifacts are *tagged* but **fail PDF/UA-1** (4–6 rules each). The failing rules, in priority order, are
> the real Phase 2/remediation backlog:
> 1. **PDF/UA identifier missing** (clause 5) — XMP lacks the PDF/UA-1 conformance entry. Likely
>    `\DocumentMetadata{pdfstandard=ua-1,…}` (or the `pdfua` package) rather than bare `testphase`.
> 2. **`dc:title` missing** + **ViewerPreferences `DisplayDocTitle` not true** (clause 7.1) — set a real
>    document title in XMP and `\hypersetup{pdftitle=…,pdfdisplaydoctitle=true}`.
> 3. **PDF header EOL** (clause 6.1) — `%PDF-1.n` + single EOL; pdflatex output nit.
> 4. **Untagged real content** (clause 7.1 t9) — the `fancyhdr` header/footer rules and page furniture
>    need `/Artifact` marking (or tagging).

**Verified:** full suite 193 green; `node generate.js` exits 0 with the advisory surfaced.
**Remaining for full Phase 3 / PDF/UA-1 compliance:** remediate the four rule classes above, re-run
veraPDF to green, then (optionally) add `--strict-a11y` + wire it into Phase 4 CI.

---

## Phase 4 — CI enforcement `[S]`

1. `.github/workflows/` job: install TeX Live + `tagpdf` + veraPDF, run `npm run verify:a11y` over the
   `examples/` artifacts on every push.
2. Job fails the build on any `{pass:false}` row; uploads `a11y-report.json` as an artifact.

**Verify:** open a PR with a deliberately inaccessible fixture → CI red with an actionable message;
revert → CI green.

---

## Phase 5 — Doctrine + changelog housekeeping `[S]`  — anytime

1. **Propagate the changelog philosophy across the LMS suite** (Anthony's 2026-06-22 ask). Add a short,
   public-safe "Changelog philosophy" section to `AGENTS.md` in **lectern, scriptorium, oracle** —
   Keep a Changelog 1.1.0 link + the regression-citation rule + "entry lands in the same PR as the
   change." (The full doctrine lives in the private vault note; repos get the inline summary.)
2. Confirm all three repos' `CHANGELOG.md` carry a current `## [Unreleased]` section.

**Verify:** `grep -il changelog AGENTS.md` returns a hit in each of the three repos.

---

## Sequencing

```
Phase 0 (spike) ─► Phase 1.5 (TeX Live upgrade — needs sign-off) ─► Phase 2 (tagging) ─► Phase 3 (veraPDF) ─► Phase 4 (CI)
Phase 1 (lints) ─────────── parallel, no toolchain dependency ───────────────────────────────► Phase 5 (docs) — anytime
```

Phase 0 is **done** and reshaped the graph: Phase 2 now blocks on **Phase 1.5 (TeX Live upgrade)**, which
needs Anthony's sign-off. **Phase 1 (lints) and Phase 5 (docs) have no toolchain dependency** — they're
the productive path while the upgrade decision is pending.

## Acceptance (issue #7)

- Chain runs end-to-end over student-facing PDFs, emits a per-artifact status report.
- A failing artifact blocks generation **and** CI with an actionable message.
- All stages green ⇒ "fully ADA Title II compliant" is backed by an artifact-level audit trail,
  ahead of the **2027-04-26** DOJ deadline.
