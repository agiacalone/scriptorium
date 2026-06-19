# Scriptorium

> In a medieval **scriptorium** — Latin, "a place for writing" — scribes copied and illuminated manuscripts by candlelight, one careful page at a time. We borrowed the name, and a little of the reverence: this is where a course's materials are made, every artifact projected from one plain-Markdown source you own outright. The candles are gone; the craft, and the open formats, stayed.

A [Claude Code](https://claude.ai/code) skill **and** a standalone Node.js generator
toolchain that turns **one tagged-Markdown lecture source** into a full set of
production-ready course materials for university CS courses — lecture notes, a
student Cornell handout, study questions, a pop quiz, a question bank, a slide deck,
a GitHub Classroom assignment README, and reading-list study guides.

Everything is **100% open formats, end to end**: Markdown in; Markdown, LaTeX→PDF,
and [Slidev](https://sli.dev) decks out. No proprietary or binary "source" formats
anywhere in the pipeline.

## Part of a self-hosted LMS — Lectern · Scriptorium · Oracle

**Lectern · Scriptorium · Oracle** together form a **self-hosted, open-format learning-management
system (LMS)** for university CS courses — faculty-owned, no vendor lock-in, spanning the full course
lifecycle: **administration** (Lectern) · **content** (Scriptorium) · **grading** (Oracle). It covers
what a commercial LMS does, but in plain version-controllable formats you own end to end.

**Modular by design:** adopt one tool or all three. Each stands alone, owns one stage of the course
lifecycle, and interoperates through open plain-text formats (Markdown · CSV · YAML · LaTeX) and
stable CLI contracts — no shared database, no monolith, no lock-in. Each tool is also operable two
ways: driven by an AI agent (Claude Code skill) *or* run directly by a human via its CLI.

| Tool | Role | Repo |
|---|---|---|
| **[Lectern](https://github.com/agiacalone/lectern)** — the Registrar | Course **administration** — terms, sections, gradebook, exam build/verify, Classroom binding, archival. | `agiacalone/lectern` |
| **[Scriptorium](https://github.com/agiacalone/scriptorium)** — the workshop | Course **content** — lecture notes, Cornell handouts, quizzes, slides, question banks. | `agiacalone/scriptorium` |
| **[Oracle](https://github.com/agiacalone/oracle)** — the secret box | **Grading** — a verify-by-proof oracle service + a sandboxed code-runner (gradebox). | `agiacalone/oracle` |

*You are here: **Scriptorium**.*

> **Suite licensing.** Lectern and Scriptorium are open source ([MIT](LICENSE)). **Oracle** — the grading engine — is **licensed, not open**: a **source-available license** (PolyForm Strict 1.0.0), private repo, source provided on licensing. Accredited **educational institutions can license it for free**; commercial and other use is by arrangement. Either way, **contact the author for a license** — [@agiacalone](https://github.com/agiacalone).

---

## The idea in one minute

You maintain a single source of truth per lecture — `<topic>_lecture_main.md` — a
plain Markdown file with YAML frontmatter and lightweight inline tags. **Every other
artifact is a projection of that file.** Change the source, re-run the generator, and
the whole set regenerates consistently.

Two design principles drive the output:

- **Living notes — kept vs. disposable.** The `_lecture_main.md` and the append-only
  `_question_bank.md` are *kept* (you edit them, they persist across semesters).
  Everything else — handouts, slides, quizzes, study guides — is *disposable* and
  regenerated fresh from the source each term. You never hand-edit a PDF.
- **Student materials are intentionally partial.** Handouts carry roughly **40% of
  the slide content** and leave key elements blank, so the handout complements
  attending lecture instead of replacing it. Printed materials use **color as a
  functional navigation cue** (each section kind gets its own banner/cue tint), so a
  page is easy to scan at a glance during a live lecture.

---

## What it generates

Run against the bundled sample (`examples/file_systems_abstraction_lecture_main.md`):

| Artifact | `--artifact` | Output | Needs LaTeX? |
|---|---|---|---|
| Instructor lecture notes | `lecture-notes` | `.tex` → `.pdf` | yes |
| Cornell student handout | `cornell` | `.tex` → `.pdf` | yes |
| Pop quiz + answer key | `quiz` | `.tex` → `.pdf` (×2) | yes |
| Study questions | `study-questions` | `.md` | no |
| Question bank (append-only) | `bank` | `.md` | no |
| Slide deck | `slides` | `.md` (Slidev) | no |
| GitHub Classroom README | `readme` | `.md` | no |
| Reading-list companion | `reading-list` | `.md` | no |
| Consistency audit | `audit` | console report | no |

Printed artifacts (`lecture-notes`, `cornell`, `quiz`) compile to PDF with
`pdflatex`. Pass `--no-pdf` to emit the `.tex` and skip compilation if you don't have
a LaTeX toolchain installed. The slide deck is Slidev Markdown — preview it live with
`npm run slides:dev` or export with `npm run slides:build`.

> **Exams are not generated here.** Exams are controlled documents built by lectern's
> `reg-exam-build` (per-student serials, register, verify). This toolchain produces
> the *question bank* that exam assembly draws from. See the
> [Exam reading-list](#exam-reading-list-multi-topic-study-guide) section for the
> per-exam *study guide*, which this repo does produce.

---

## Quick start

```bash
git clone https://github.com/agiacalone/scriptorium.git
cd scriptorium
npm install

# Compile the full set from the bundled sample, skipping PDF compilation:
node generate.js --main examples/file_systems_abstraction_lecture_main.md --no-pdf --out ./out

# Or one artifact at a time:
node generate.js --main examples/file_systems_abstraction_lecture_main.md --artifact slides --out ./out
node generate.js --main examples/file_systems_abstraction_lecture_main.md --artifact cornell --out ./out
```

See [`examples/README.md`](examples/README.md) for the per-artifact walkthrough.

---

## The source file: `<topic>_lecture_main.md`

This is the only file you author. It's ordinary Markdown with three layers of
structure that the parser reads:

**1. YAML frontmatter** — course context the generators need:

```yaml
---
title: File Systems — Abstraction and Naming
course: CECS 326
topic-slug: file_systems_abstraction
term: sp26
adversarial-thinking: false   # set true for Security courses → adds attacker-mindset questions
---
```

**2. Obsidian-style tags** on list items and headings — these mark *what each piece
is*, so the right generator can pick it up:

| Tag | Meaning |
|---|---|
| `#objective` | a learning objective |
| `#vocab` | a vocabulary term (term + definition) |
| `#concept` | a core idea |
| `#blank` | a fill-in target on the student handout — **must** carry `[slide:: N]` |
| `#slide` | a slide in the deck — carries a `[layout:: …]` from the layout enum |
| `#question` | a bank/quiz question — typed `#type/mc`, `#type/sa`, etc. and `#difficulty/1..3` |
| `#self-quiz` | a self-check question for the reading-list/study guide |

**3. Dataview-style inline fields** — `[key:: value]` pairs that attach data to a
tagged item, e.g. `[slide:: 6]` (which slide a blank is answered on),
`[citation:: Tanenbaum 4.2]` (textbook source for a reading list), `[answer:: B]`
(the key for a multiple-choice question), `[layout:: two-cols]` (slide layout).

The parser validates the source before generating: a `#blank` without `[slide::]`, a
multiple-choice `#question` without `[answer::]`, an unknown slide layout, or a
diagram block missing `[alt::]` (ADA) all abort with a clear message *before* any
file is written. The full tag taxonomy and validation rules live in
[`references/style-guide.md`](references/style-guide.md).

---

## Two ways to use it

### As a Claude Code skill (recommended)

Installed as a skill, Claude does the authoring for you: you describe a lecture in
plain English, Claude writes or edits the `_lecture_main.md` to match the style
guide, then runs the generator. It does **not** rewrite the generator code — the
checked-in JavaScript is the stable engine; the skill is the interface.

```bash
mkdir -p ~/.claude/skills
git clone https://github.com/agiacalone/scriptorium.git \
  ~/.claude/skills/scriptorium
```

In your course repo, copy the context template and reference the skill:

```bash
cp ~/.claude/skills/scriptorium/CLAUDE.md.example ./CLAUDE.md
```

```markdown
## Skills
- Use the Scriptorium skill at
  ~/.claude/skills/scriptorium/SKILL.md for all lecture content.
```

Then just ask:

> Generate lecture materials for **virtual memory and paging** in CECS 326. Cover the
> virtual address space, page-table translation, the TLB, and thrashing. ~75 minutes.

### As a plain CLI

You can author the `_lecture_main.md` by hand and drive the generator directly — no
Claude required. Every artifact is a `node generate.js --main <file> --artifact <name>`
call (see the table above). This is what the [Quick start](#quick-start) shows.

---

## Generating a question bank

Question banks are topic-wide and **append-only** — the persistent pool that exam
assembly (in lectern) later draws from. The generator reads the existing bank, avoids
duplicates, and assigns the next sequence number per question type (`m01`, `m02`, …
for multiple choice; `t01…` true/false; `s01…` short answer; etc.).

```bash
node generate.js --main examples/file_systems_abstraction_lecture_main.md --artifact bank --out ./out
```

## Exam reading-list (multi-topic study guide)

A consolidated, per-exam study guide that maps each covered handout's cues to where
the answer lives in the assigned reading — the multi-topic companion to the
single-topic reading list. Driven by lectern's `reg-exam-readinglist`, but runnable
directly: point it at the `_lecture_main.md` for every topic the exam covers.

```bash
node exam-reading-list-cli.js \
  --exam-name "Midterm 1" --slug midterm_1 \
  --course "CECS 326" --term sp26 \
  --mains examples/file_systems_abstraction_lecture_main.md \
  --out ./out
# → ./out/midterm_1_reading_list.md
```

Pass several comma-separated `--mains` to fold multiple topics into one guide
(rendered as Part A, Part B, …). Optional `--textbook`, `--citation-key`, `--note`,
and `--note-title` override the source-block defaults (Tanenbaum & Bos for OS courses).

---

## Installing prerequisites

You need **Node.js** (for all artifacts) and, for the printable PDFs, a **LaTeX**
toolchain with `pdflatex` on your `PATH`. The Markdown and Slidev artifacts need
neither beyond Node.

| Platform | Base tools | LaTeX (for PDFs) |
|---|---|---|
| macOS | `brew install git node` | `brew install --cask mactex-no-gui` *(or `basictex` + `sudo tlmgr install enumitem listings geometry`)* |
| Fedora | `sudo dnf install -y git nodejs npm` | `sudo dnf install -y texlive-scheme-basic texlive-enumitem texlive-listings texlive-geometry` |
| Ubuntu / Debian | `sudo apt install -y git nodejs npm` | `sudo apt install -y texlive-latex-base texlive-latex-recommended texlive-latex-extra` |

On Fedora Atomic (Kinoite/Silverblue), install inside a `distrobox` container rather
than layering onto the immutable host.

Then, once per clone:

```bash
npm install
```

---

## Repository layout

```
generate.js                 # CLI orchestrator: parse → validate → dispatch → (compile)
exam-reading-list-cli.js    # sub-tool CLI: multi-topic per-exam study guide
parser/
  index.js                  # parse() + validate() entry points
  main-parser.js            # Markdown + tag + inline-field walker
  validators.js             # invariant checks; hard errors block generation
generators/                 # one file per artifact (lecture-notes, cornell-handout,
                            #   study-questions, quiz, question-bank, slides, readme,
                            #   reading-list, exam-reading-list, audit)
lib/                        # shared LaTeX preamble + Cornell palette helpers
themes/                     # Slidev themes (blueprint, terminal)
examples/                   # self-contained sample source + walkthrough
references/
  style-guide.md            # complete style + tag + validation specs — read this
SKILL.md                    # skill metadata + workflow (entry point when used as a skill)
CLAUDE.md.example           # template you copy into your course repo
```

---

## Tests

```bash
npm test           # vitest — parser, validators, and every generator
npm run check      # node --check syntax-validation across the live sources
npm run verify:a11y  # ADA Title II / WCAG contrast audit of the palettes (--level AA|AAA)
```

## Accessibility (ADA Title II / WCAG)

Student-facing materials are built toward WCAG 2.1 AA per the
[md-monolith design spec](docs/specs/2026-05-07-md-monolith-revamp-design.md#accessibility--ada-title-ii-compliance-non-functional-requirement).
The first stage of the compliance [audit chain](https://github.com/agiacalone/scriptorium/issues/5)
is live: a **palette contrast verifier** (`lib/a11y/`) checks every student/instructor
color pair against the WCAG target. `generate.js` **gates** on it before emitting any
artifact — run `npm run verify:a11y` standalone, or pass `--skip-a11y` / `--a11y-level AAA`
to `generate.js`. The student palette currently passes AA.

---

## License & ownership

[MIT](LICENSE).

Materials you generate with this toolchain are yours — they are not required to carry
this repository's license unless they copy substantial portions of the repository
itself.
