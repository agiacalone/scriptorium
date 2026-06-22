# Examples

A self-contained sample you can compile without any course data of your own.

## `file_systems_abstraction_lecture_main.md`

The **source of truth** for one lecture (CECS 326, "File Systems — Abstraction and
Naming"). Everything else — student handout, slide deck, study questions, quiz,
instructor notes, question bank, GitHub Classroom README — is a *projection* of
this single tagged-Markdown file. Edit the `_lecture_main.md`; recompile; every
artifact updates.

This file is fully self-contained (no vault wikilinks/embeds), so it compiles
straight out of a fresh clone.

### Run it

```bash
npm install                 # one-time: pulls markdown-it, gray-matter, slidev, …

# One artifact, Markdown-only (no LaTeX required):
node generate.js --main examples/file_systems_abstraction_lecture_main.md \
  --artifact study-questions --out ./out

# Slide deck (Slidev Markdown):
node generate.js --main examples/file_systems_abstraction_lecture_main.md \
  --artifact slides --out ./out

# The full set, skipping PDF compilation (no pdflatex needed):
node generate.js --main examples/file_systems_abstraction_lecture_main.md \
  --no-pdf --out ./out
```

Drop `--no-pdf` (and have a LaTeX toolchain with `pdflatex` on `PATH`) to render
the printable PDFs — instructor lecture notes, the Cornell student handout, and
the pop quiz + key.

### What you get

| `--artifact` | Output | Needs LaTeX? |
|---|---|---|
| `study-questions` | `*_study_questions.md` | no |
| `slides` | `*_slides.md` (Slidev) | no |
| `bank` (alias `question-bank`) | `*_question_bank.md` | no |
| `reading-list` | `*_reading_list.md` | no |
| `readme` | `README.md` (GitHub Classroom) | no |
| `lecture-notes` | `*_lecture_notes.pdf` (+`.tex`) | yes |
| `cornell-handout` | `*_cornell_handout.pdf` (+`.tex`) | yes |
| `quiz` | `*_quiz.pdf` + `*_quiz_key.pdf` (+`.tex`) | yes |
| `all` (default) | every artifact above | yes (use `--no-pdf` to skip) |

---

## Beyond the single lecture

Two more sample sources demonstrate capabilities that one lecture can't show:

- `processes_and_threads_lecture_main.md` — a second CECS 326 topic (carries
  `#used/sp26` tags so the staleness audit has something to surface).
- `secure_protocols_478_lecture_main.md` — a **CECS 478** topic (course code drives
  automatic theme selection).

### Multi-topic exam reading list (`exam-reading-list-cli.js`)

Consolidate the topics one exam covers into a single cue→source study guide:

```bash
node exam-reading-list-cli.js --exam-name "Midterm 1" --slug midterm_1 \
  --course "CECS 326" --term su26 --out examples/midterm_1 \
  --mains examples/file_systems_abstraction_lecture_main.md,examples/processes_and_threads_lecture_main.md
# → examples/midterm_1/midterm_1_reading_list.md  (both topics, one guide)
```

This is the sub-tool lectern's `reg-exam-readinglist` drives.

### Course-driven theme (blueprint vs terminal)

The slide theme is auto-selected by course code: **blueprint** (navy/cyan) for
CECS 326/378, **terminal** (phosphor-green) for CECS 478.

```bash
node generate.js --main examples/secure_protocols_478_lecture_main.md \
  --artifact slides --no-pdf
# → secure_protocols_478_slides.md   [theme: terminal]
```

### Staleness audit

List items whose newest `#used/<term>` tag predates the current term (plus items
never marked used) — a reuse check before the next offering:

```bash
node generate.js audit --main examples/processes_and_threads_lecture_main.md \
  --current-term su26
# → processes_and_threads_staleness_audit.md  (stale + never-used items)
```

`--semester <term>` / `--strict-semester <term>` reproduce a past offering by
filtering role-based item lookups during generation.

### Lab vs reading README variant

The GitHub Classroom README has two variants — `reading` (default) and `lab`:

```bash
node generate.js --main examples/file_systems_abstraction_lecture_main.md \
  --artifact readme --readme-variant lab --no-pdf --out examples/lab-readme-variant
# → examples/lab-readme-variant/README.md  ("… — Lab Assignment")
```

---

**100% open formats** — tagged Markdown in, Markdown / Beamer-LaTeX / Slidev out.
No proprietary or binary "kept" formats anywhere in the pipeline. Pairs with the
course-operations toolchain at **github.com/agiacalone/lectern** (exam assembly,
gradebook, term lifecycle, GitHub-Actions autograding).
