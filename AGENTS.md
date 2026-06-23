# AGENTS.md — Scriptorium AI Operation Guide

Scriptorium is operable two ways: driven by an AI agent (Claude Code skill) **or**
run directly by a human via its CLI. This file documents the AI-operation path.

## Entry Points

| Path | Purpose |
|---|---|
| `SKILL.md` | Skill entry point — Claude reads this first when invoked as `/scriptorium` |
| `node generate.js --main <path> [--artifact <name>] [--out <dir>]` | Generate all artifacts (or a named artifact) from a `_lecture_main.md` source |
| `node exam-reading-list-cli.js --exam-name <name> --slug <slug> --course <course> --term <term> --mains <paths>` | Build a multi-topic per-exam reading-list study guide |
| `npm run check` | Syntax-validate all generator source files |
| `npm test` | Run the full vitest suite (parser, validators, all generators) |
| `npm run verify:a11y` | Standalone WCAG palette-contrast audit (one stage of the full a11y chain — see "Accessibility gate" below) |

## Dual-Operability Contract

Every action the skill performs maps to a CLI command:

| Skill action | CLI equivalent |
|---|---|
| Generate all artifacts | `node generate.js --main <path>` |
| Generate a single artifact | `node generate.js --main <path> --artifact <name>` |
| Override output dir | `node generate.js --main <path> --out ./out` |
| Skip pdflatex | `node generate.js --main <path> --no-pdf` |
| Strict accessibility (CI) | `node generate.js --main <path> --strict-a11y` |
| Build exam reading-list | `node exam-reading-list-cli.js ...` |
| Staleness audit | `node generate.js audit --main <path> --current-term <term>` |

A human can replicate any skill-driven workflow by running these CLI commands directly.
No skill invocation is required for any operation.

**Output layout:** without `--out`, artifacts land in a **`products/` subdirectory beside the source**
(not the topic root); pdflatex intermediates are swept after each successful compile, leaving only `.tex`
+ `.pdf`. `products/` is gitignored.

## Accessibility gate (ADA Title II / WCAG → PDF/UA-1)

Every `generate.js` run enforces a two-tier accessibility gate. An agent must understand it because it can
**abort generation**:

- **Tier 1 — source lints (blocking, pre-generation):** palette contrast (WCAG 1.4.3), color-independence
  (1.4.1), and alt-text-present (1.1.1) run on the parsed source. Any failure aborts before any artifact is
  written. Fix the source — never reach for `--skip-a11y` on materials you intend to distribute.
- **Tier 2 — compiled-PDF validation (post-generation):** every PDF is tagged via
  `\DocumentMetadata{...pdfstandard=ua-1,...}`; a **veraPDF PDF/UA-1** deep check runs when `verapdf` is on
  `PATH` (else a `pdfinfo` smoke-check — never a silent pass). **Untagged PDFs fail the build**; PDF/UA-1
  non-compliance is **advisory** by default and **blocking** under `--strict-a11y`.
- A machine-readable `a11y-report.json` is written to the output dir each run.

The authoritative record — architecture, the compiler/type-checker framing, blocking model, honest status,
and the one toolchain-limited residual rule — is **`docs/ACCESSIBILITY.md`**. Read it before touching
anything under `lib/a11y/`, the preambles, or the table/section emitters.

## Kept vs. Disposable Artifacts

**Kept** (author once, persist across semesters — do not overwrite blindly):
- `<topic>_lecture_main.md` — the source of truth; every artifact is a projection of this file
- `<topic>_question_bank.md` — append-only bank; read before adding to avoid duplicates
- `<topic>_reading_list.md` — hybrid: generator updates the cue-table fence; manual content outside the fence survives regeneration

**Disposable** (regenerated fresh each run from `_lecture_main.md`):
- `<topic>_lecture_notes.pdf` / `.tex`
- `<topic>_cornell_handout.pdf` / `.tex`
- `<topic>_study_questions.md`
- `<topic>_quiz.pdf` / `_quiz_key.pdf` / `.tex`
- `<topic>_slides.md` (Slidev)
- `README.md` (GitHub Classroom)

## Skill-to-CLI Principle

The skill is the interface; the checked-in JavaScript toolchain is the stable engine.
When invoked as a Claude Code skill, Claude writes or edits `_lecture_main.md` to
match the style guide, then runs `node generate.js` — it does **not** rewrite the
generator code. The generator JS files are not skill output.

## Part of the Lectern · Scriptorium · Oracle LMS Suite

Scriptorium handles **content** (this repo). Administration is Lectern (`reg-*` CLI);
grading is Oracle (verify-by-proof service + gradebox). See `README.md` for the
full suite overview.

## Changelog philosophy

Every change lands its `CHANGELOG.md` entry **in the same commit/PR** — git tells you the diff, the changelog tells you the story. Format: [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/), newest-first under `## [Unreleased]`; groups `Added` / `Changed` / `Deprecated` / `Removed` / `Fixed` / `Security` (only those with entries). Entries say **what changed and why**, for humans.

**Regression-citation rule (load-bearing):** when a `Fixed` entry documents a regression, cite the chain — the commit that *introduced* the feature, the one that *broke* it, the *mechanism* of the break, and the *restore* — so the next person diagnoses it from the changelog, not a cold `git log`.
