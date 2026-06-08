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

**100% open formats** — tagged Markdown in, Markdown / Beamer-LaTeX / Slidev out.
No proprietary or binary "kept" formats anywhere in the pipeline. Pairs with the
course-operations toolchain at **github.com/agiacalone/lectern** (exam assembly,
gradebook, term lifecycle, GitHub-Actions autograding).
