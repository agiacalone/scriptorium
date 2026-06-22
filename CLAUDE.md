# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

**Scriptorium** is a document-generation system for production-ready
CS lecture materials. The checked-in Node.js code is the stable generator. The skill
is the interface layer that turns a user request into a structured `_lecture_main.md`
markdown source and then runs that generator. It should not regenerate JavaScript
files on each run. Student-facing lecture materials are intentionally partial
replacements for distributing slides: target roughly 40% of slide content and omit
key explanatory elements so students must attend lecture. Printed student handouts
and instructor lecture notes should use color intentionally so the materials are
easy to navigate at a glance during lecture.

## Living Notes — What is Kept vs What is Disposable

This skill builds a **living-notes** system around the generated materials. Every
artifact is produced fresh each semester from `_lecture_main.md` + the latest
priors, but the formats split into two tiers:

- **Kept (canonical, lives in the vault):**
  - `<topic>_lecture_main.md` — the source of truth. Tagged markdown with YAML
    frontmatter and Dataview-style inline fields. Anthony edits this; every other
    artifact is a projection of it.
  - `<topic>_question_bank.md` — append-only Markdown bank, persistent across
    semesters; the source for exam assembly.
  - `<topic>_reading_list.md` — hybrid scaffold. The cue→source tables inside
    the `<!-- generator: cue-tables -->` … `<!-- /generator -->` fence are
    regenerated from `_lecture_main.md`; everything outside the fence (curated
    primary sources, References discipline, instructor notes) is hand-authored
    and survives regeneration.
- **Disposable (regenerated fresh from `_lecture_main.md`):**
  - `<topic>_lecture_notes.pdf` (instructor)
  - `<topic>_cornell_handout.pdf` (student) + `<topic>_cornell_handout_key.pdf` (instructor answer key — never distribute)
  - `<topic>_study_questions.md` (student review)
  - `<topic>_quiz.pdf` + `<topic>_quiz_key.pdf`
  - `<topic>_slides.md` (Slidev) — render/export with the `slides:dev` / `slides:build` scripts
  - `README.md` (GitHub Classroom)
  - (exams are no longer produced here — built by lectern's `reg-exam-build` from the
    question bank; this repo's kept form is the `_question_bank.md`)
- **Archived (do not author new):**
  - `lecture-spec.json` and `init-spec.js` — the spec-driven path was archived
    on 2026-05-07 to `archive/spec-driven-2025/`. New work goes through the
    `_lecture_main.md` markdown-monolith path.

**Practical cycle:**
1. Open last semester's `_lecture_main.md` (vault) to see what changed and what to update.
2. Edit `_lecture_main.md` — adjust tagged blocks, add/remove `#concept` /
   `#blank` / `#question` / `#slide`, refresh `[slide::]` cross-references.
3. Run `node generate.js --main <path>` — overwrites every disposable from the
   refreshed source; the reading-list scaffold updates inside its fence while
   curated content outside survives.
4. Diff regenerated outputs; print/distribute.

**Preferred formats by artifact type:**

| Data shape | Preferred kept format |
|---|---|
| Lecture source of truth (concepts, blanks, slides, questions) | tagged Markdown (`_lecture_main.md`) with YAML frontmatter + inline fields |
| Tabular data (question banks, grade rubrics) | Markdown table or CSV (CSV when sort/filter matters) |
| Reading-list companion | Markdown with a generator fence; manual content outside the fence |
| Assembled assessments | regenerated `.pdf` — the kept form is the bank + exam-spec.json |

Never add a "kept" format in a proprietary or tool-specific binary — the
principle is open, easy-to-track, tool-agnostic text. The disposables are
PDFs (handouts, slides, quiz, exam) for hand-out and projector.

## Skill Invocation

Users invoke the skill from a course project directory that has a `CLAUDE.md` referencing this skill:

```markdown
- Use the Scriptorium skill at ~/.claude/skills/scriptorium/SKILL.md
```

When deployed as a skill, the entry point is `SKILL.md`. When invoked, Claude must
read `references/style-guide.md`, translate the user's request into edits on the
`_lecture_main.md` source, and use the existing CLI in this repo to compile
outputs from that source.

## Architecture

```
scriptorium/
├── SKILL.md                       # Skill metadata, workflow, artifact specs, file naming
├── CLAUDE.md.example              # Template users copy to their course project directory
├── generate.js                    # Stable CLI orchestrator: parse → validate → dispatch → compile
├── parser/
│   ├── index.js                   # parse(mainPath) + validate(parsed) entry points
│   ├── main-parser.js             # markdown + tag + inline-field walker
│   └── validators.js              # invariant checks; hard errors block generation
├── examples/
│   ├── file_systems_abstraction_lecture_main.md  # canonical example (self-contained)
│   └── README.md                                 # how to compile the sample
├── exam-reading-list-cli.js       # sub-tool CLI: multi-topic per-exam reading list (driven by lectern reg-exam-readinglist)
├── generators/                    # one file per artifact family (lecture-notes, cornell-handout, slides, quiz, study-questions, question-bank, reading-list, exam-reading-list, readme, audit); plus non-artifact helpers _filter.js (semester filter) and mark-used.js (#used/<term> writeback)
├── lib/                           # shared LaTeX preamble + Cornell palette helpers
│   └── a11y/                       # ADA Title II / WCAG audit chain (issue #5): contrast verifier; `generate.js` gates on it
├── references/
│   └── style-guide.md             # Complete style specs — MUST read before generating
├── archive/
│   └── spec-driven-2025/          # historical: init-spec.js + lecture-spec.json (do not author new specs)
└── assets/                        # Placeholder for course-specific assets
```

**Generation flow:**
1. The user provides a lecture topic — or edits an existing `_lecture_main.md` in their vault.
2. Claude reads `SKILL.md` + `references/style-guide.md`.
3. Claude creates or updates the `_lecture_main.md` to reflect the request.
4. Claude runs `node generate.js --main <path>` to compile artifacts. The parser
   validates first; hard errors (missing `[slide::]` on a `#blank`, `mc` question
   without `[answer::]`, unknown layout, missing `[alt::]` on a diagram) abort
   generation with a clear message before any output is written.

**CLI entrypoints:**
- `node generate.js --main <path>/<topic>_lecture_main.md` — full set
- `node generate.js --main <path> --artifact slides` — single artifact
- `node generate.js --main <path> --artifact bank` (alias: `question-bank`)
- `node generate.js --main <path> --artifact reading-list`
- `node generate.js --main <path> --out ./out --no-pdf` — override output dir, skip pdflatex
- `node generate.js --main <path> --mark-used <term>` — after a clean build, stamp `#used/<term>` onto every deck item the build used, written back to the source main (idempotent; respects `--semester`/`--strict-semester`). Implemented in `generators/mark-used.js`; the documented `#used/<term>` reproducibility workflow depends on it.
- `node exam-reading-list-cli.js --exam-name "Midterm 1" --slug midterm_1 --course "CECS 326" --term sp26 --mains a.md,b.md --out ./out` — **exam reading-list** sub-tool: consolidates several topic `_lecture_main.md` files into one per-exam cue→source study guide (`<slug>_reading_list.md`). Driven by lectern's `reg-exam-readinglist`. Accepts `--textbook`, `--citation-key`, `--note`, `--note-title` overrides.

**Exam generation has moved out of this repo.** Exams are controlled documents owned
by lectern: assemble a `.tex` from the topic's `*_question_bank.md`, then build
per-student serialized copies with `reg-exam-build` and verify with `reg-exam-verify`.
The `exam` artifact and the old `generate.js exam` sub-command now emit an error
pointing at `reg-exam-build`. This repo still produces the *question bank* that exam
assembly draws from, and the per-exam *reading-list* study guide.

## Output Artifacts

| File | Format | Key constraints |
|------|--------|-----------------|
| `[topic]_lecture_main.md` | Source of truth | YAML frontmatter + Obsidian tags + Dataview-style inline fields. Lives at `<vault>/classes/<course>/`. Read by the parser; every artifact is a projection. |
| `[topic]_lecture_notes.pdf` | Lecture notes | LaTeX, Computer Modern, navy/teal/amber/indigo callouts; `.tex` source retained |
| `[topic]_cornell_handout.pdf` (+ `_key.pdf`) | Student handout + instructor key | 2-col Cornell layout, ~40% slide-content coverage, section-kind colors (motivation=teal / concept=navy / synthesis=amber / strategy=indigo / application=green / case-study=purple / pitfall=rose) anchor each section's banner, cue-tint, and KEY callout; `.tex` retained. A second `_cornell_handout_key.pdf` reveals every answer in rose bold under an INSTRUCTOR-ONLY banner (same `.tex`, `\ifanswers` toggle) — never distributed |
| `[topic]_study_questions.md` | Study questions | 10 questions: 2 Recall, 3 Apply, 5 Analyze; Markdown only — no print form generated |
| `[topic]_quiz.pdf` + `[topic]_quiz_key.pdf` | Pop quiz | 5 questions (~10 min), MC+short answer, separate key PDF; `.tex` retained |
| `[topic]_question_bank.md` | Question bank | ~50 tagged questions (mc/tf/code/fib/sa · ★/★★/★★★ · subtopic); source of truth for exam assembly (in lectern) |
| `[topic]_reading_list.md` *or* `[scope]_reading_list.md` | Reading-list companion | Hybrid scaffold paired 1:1 (or 1:N) with Cornell handout(s). Generator emits cue-table rows inside `<!-- generator: cue-tables -->` … `<!-- /generator -->`; manual content (curated primary sources, References, instructor notes) outside the fence is preserved on regen. |
| `README.md` | GitHub Classroom README | Rigid boilerplate — copy structure exactly |
| `[topic]_slides.md` | Slide deck (Slidev) | 14–18 slides; render live or export via the `slides:dev` / `slides:build` scripts. *(Slide styling is mid-migration — the Beamer-era palette notes below are being reworked.)* |

The `.docx` and `.pptx` formats are no longer emitted. Printed handouts (lecture
notes, Cornell handout, quiz) render to PDF via `pdflatex`; the slide deck is Slidev
Markdown. Exams are built by lectern, not here.

## Required npm/pip Dependencies (user installs once)

```bash
npm install
```

`pptxgenjs` and `docx` are no longer dependencies. The slides generator emits Slidev
Markdown; the LaTeX artifacts (lecture notes, Cornell handout, quiz) compile to PDF
via `pdflatex`.

## Preferred Skill Behavior

When the user gives a lecture request in natural language, Claude should:
1. Extract the topic, course context, key concepts, sections, case studies, and questions.
2. Create or update the `_lecture_main.md` in the user's working directory (or vault `classes/<course>/` folder) — add or refine tagged blocks until it reflects the request.
3. Refine the file to satisfy `references/style-guide.md` (tag taxonomy, blank rules, slide layout enum, ADA `[alt::]` requirements).
4. Run `node generate.js --main <path>` against the final source.

The intended mental model is:
- Input: a lecture request
- Source of truth: `<topic>_lecture_main.md` — tagged markdown
- Output: compiled lecture documents (PDFs and supporting `.md`)

The skill is not the generator itself. The checked-in `.js` toolchain is the
generator; the skill is how Claude maps requests into edits on the markdown
source consistently.

## Current Note

The end-to-end markdown-monolith workflow has been exercised against the canonical
example at `examples/file_systems_abstraction_lecture_main.md` (a self-contained
copy of a CECS 326 lecture source; see `examples/README.md` to compile it). 75
vitest tests pass against the parser, validators, and all generators.

The legacy spec-driven path (`init-spec.js` + `lecture-spec.json`) is archived at
`archive/spec-driven-2025/`. Do not author new specs against it; existing course
materials should be migrated to `_lecture_main.md` over time.

Scripts use `markdown-it` for parsing and Beamer (via `pdflatex`) for slide
compilation. Exams also require a LaTeX toolchain with `pdflatex` available on
`PATH`.

## QA for Slides

```bash
# Beamer compiles directly to PDF via pdflatex (no soffice / pptx step)
pdftoppm -jpeg -r 150 [topic]_slides.pdf slide
# inspect slide-*.jpg
```

## Code and Diagrams (all artifacts)

- **Inline code**: Menlo, gray background `F5F5F5`. **Code blocks**: dark panel `1E293B` with limited syntax highlighting in slides; fenced blocks in `.md`; `\begin{lstlisting}` in `.tex`.
- **Pseudocode**: use when language-independent; label as `pseudocode`; prefer over real code in handouts and study questions unless the course requires reading real source.
- **Code blanks in handout**: replace target token/line with `_______`, keep surrounding structure intact, one blank per logical unit.
- **Partial diagrams in handout**: full structure drawn, all labels blank — students fill in from projected slide. Every diagram block requires `[alt:: …]` (ADA Title II).
- **Diagrams in slides**: boxes as rounded rectangles (`334155` fill, indigo `6366F1` border), arrows in sky `38BDF8`. Beamer Tikz under the hood.

## Critical Style Rules (enforced by style-guide.md and parser/validators.js)

- **Cornell handout**: Pre-distributed via Canvas before class. Students fill blanks from projected slides during lecture — every `#blank` must carry `[slide:: N]` (parser hard-error if missing). Verbal explanation is never a blank source. Keep student-facing coverage to roughly 40% of the slide content. Key diagrams from slides must appear in the handout as partial structures, paired with `[alt::]`. The generator emits a paired **instructor answer key** (`_cornell_handout_key.pdf`) from the same `.tex` via the `\ifanswers` toggle — answers from each `#blank`'s `[answer:: …]` and `#vocab` definitions reveal in rose bold under an INSTRUCTOR-ONLY banner. Treat the key like the quiz key: never distribute to students.
- **Printed PDF materials**: Use color as a functional lecture cue. Handouts and instructor notes should preserve colored headers, cue regions, dividers, and callout fills so the printed pages are easy to scan during a live lecture. Color is paired with a glyph for ADA contrast independence.
- **Slides**: Beamer deck. Theme colors are slate `#0F172A`, indigo `#6366F1`, amber `#F59E0B`. Each frame uses a frametitle accent stripe (indigo) and section badge. Slide `[layout::]` must come from the 11-layout enum (validated).
- **Study questions**: Open-ended and case-study reference questions are always required. Attacker-mindset question required only when `adversarial-thinking: yes` (Security courses). Defaults to `no`.
- **Pop quiz**: All questions must come from slide/lecture content — no curveballs. MC distractors must be plausible. Answer key is a separate page with red header; include grading rubric notes per question. Do not reuse study question wording verbatim.
- **Question bank**: Persistent, append-only Markdown file — never overwrite, only add. Types: `mc` (4-option), `tf` (T/F), `code` (code-interpretation T/F), `fib` (quiz/handout only, never exams), `sa` (short answer). Type + difficulty (★/★★/★★★) are the two scoring dimensions used by exam assembly. Read the file before adding to avoid duplicates and assign the next sequence number per type. `mc` without `[answer::]` is a parser hard-error.
- **Exam**: Driven by an exam-spec.json (sub-command `node generate.js exam --spec …`). Generator emits `.tex` from bank `.md` files and runs `pdflatex` automatically. MC section mixes `mc`+`tf`+`code` — no separate T/F section. `fib` never in exams. Both student and key PDFs produced by toggling `\answerstrue` and recompiling. Parallel sections: `randomize: yes` + section suffix (e.g. `-A`, `-B`).
- **GitHub README**: Two variants — reading assignment (answer questions from a chapter) and lab/programming assignment (build something, verifiable requirements). Choose based on `assessment format` in course context. Deliverables and "Please note" boilerplate must be copied exactly in both variants.
