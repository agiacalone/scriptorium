---
name: scriptorium
description: >
  Generates lecture material sets for CS professors: lecture notes (.pdf),
  Cornell note-taking handouts (.pdf), study questions (.md), pop quizzes (.pdf),
  GitHub Classroom README assignments (.md), topic-wide question banks (.md),
  reading-list companions (.md), and Slidev slide decks (.md). Use this
  skill whenever a user asks to generate, create, assemble, revise, or extend any
  lecture materials, course handouts, slides, quizzes, study questions, question
  banks, or GitHub Classroom assignments — even partial requests like "make me a
  Cornell handout for X", "add questions to the README", "write a pop quiz on Y",
  or "append to the question bank". Enforces strict style consistency, Cornell ↔
  slide alignment auditing, and tiered difficulty question design. Always use this
  skill for any CS lecture content generation task. Exams are built by lectern's
  reg-exam-build, not here.
---

# Scriptorium

Generates styled, production-ready lecture materials for CS courses. Student-facing
lecture materials are intentionally partial: they replace distributing slides, but
should expose only about 40% of slide content so attendance is still required. All
artifacts follow a strict style guide. See `references/style-guide.md` for complete specs.
Printed student handouts and instructor lecture notes should use color
intentionally as a live navigation aid that reads clearly at a glance during lecture.

**Read `references/style-guide.md` before generating any artifact.**

---

Output files are written to the directory containing the `_lecture_main.md`
source unless `--out <dir>` is passed.

---

## Capturing Course Context

Before generating, confirm these five fields when they matter for the requested
artifact. Once provided in a session, remember them — never re-ask unless the user
changes them.

| Field | Example |
|---|---|
| **Course code + name** | CECS 326 — Operating Systems |
| **Student level** | Upper-division CS majors; strong C/systems programming background |
| **Lecture length** | ~75 minutes |
| **Assessment format** | GitHub Classroom (Markdown), in-class activities |
| **Adversarial thinking** | yes (Security) / no (OS, Distributed Systems) |

If a required field is missing for the requested artifact, ask for it before
proceeding. `adversarial-thinking` defaults to **no** if not specified, so do not
block on that field alone.

These fields live in the YAML frontmatter and `#meta` section of the
`_lecture_main.md`; the parser surfaces them to every generator.

---

## What to Generate

| Artifact | File | When |
|---|---|---|
| Lecture notes | `[topic]_lecture_notes.pdf` (`.tex` retained) | Instructor copy with speaker notes, timing, and callouts; not student-facing |
| Cornell handout | `[topic]_cornell_handout.pdf` + `[topic]_cornell_handout_key.pdf` (`.tex` retained) | Student guided notes with roughly 40% slide coverage and strategic omissions; section colors keyed to section "kind". A second **instructor answer-key** PDF is emitted alongside — same layout, with every blank/vocab answer revealed in rose bold under a "*** ANSWER KEY — INSTRUCTOR USE ONLY ***" banner (toggled from the same `.tex` via `\ifanswers`, like the quiz key). Instructor-only — never distribute. |
| Study questions | `[topic]_study_questions.md` | 10 tiered review questions that reinforce the lecture without recreating it (kept-form Markdown; no print form yet) |
| Pop quiz | `[topic]_quiz.pdf` + `[topic]_quiz_key.pdf` (`.tex` retained) | 5-question in-class quiz with separate instructor answer-key PDF |
| Question bank | `[topic]_question_bank.md` | ~50 tagged questions (mc/tf/code/fib/sa), scoped to full topic (2–4 sessions) |
| Reading-list companion | `[topic]_reading_list.md` (single topic) or `[scope]_reading_list.md` (multi-topic, e.g. `final_third_reading_list.md`) | Hybrid scaffold paired 1:1 (or 1:N) with Cornell handout(s); the generator emits a `<!-- generator: cue-tables -->` … `<!-- /generator -->` fence with cue-to-source rows; manual content outside the fence is preserved on regen. Can also serve as a pre-exam review deliverable. |
| GitHub README | `README.md` | GitHub Classroom assignment (reading or lab/programming variant) |
| Slide deck | `[topic]_slides.md` (Slidev markdown) | 14–18 slides. Theme auto-selected from `course:` frontmatter: **blueprint** (CECS 326, 378) or **terminal** (CECS 478); default blueprint. Present live via `npx slidev [topic]_slides.md` — no PDF export (slides are a presentation artifact, not a distributed document). |

Printed-handout artifacts (lecture notes, Cornell handout, pop quiz) render to
PDF via `pdflatex`. Slides emit Slidev markdown (`.md`) — no PDF export. The
`.docx` and `.pptx` formats are no longer emitted by any generator.

> **Exams are controlled documents — built by lectern, not here.** Assemble an exam
> `.tex` by hand from the topic's `*_question_bank.md` using lectern's
> `references/reference_exam.tex` as the skeleton, then build per-student copies
> with `reg-exam-build --roster <roster.csv> <exam>.tex` (injects per-student
> serials, emits a register) and verify with `reg-exam-verify`. See
> [[notes/exam-tex-doctrine]]. This skill no longer generates exams.

**Default (generate everything — single session):**
> "Generate lecture materials for [TOPIC] in [COURSE]. Cover: [KEY CONCEPTS]. Case studies: [EXAMPLES]. ~[N] minutes."

**Subset:** "Generate lecture notes and slides only for [TOPIC]."

**Update existing:** "Reusing [TOPIC] lecture — add section on [NEW CONCEPT]. Add 2 README questions covering it."

**Question bank (topic-wide, multi-session):**
> "Generate a question bank for [TOPIC] in [COURSE]. Sessions covered: [SUBTOPIC 1], [SUBTOPIC 2], [SUBTOPIC 3]. Total material: ~[N] hours."

The question bank requires the full topic scope — all subtopics and sessions — before
generating. If subtopics are not provided, ask for them before proceeding.

**Reading-list companion (single topic):**
> "Build a reading-list companion for the [topic] Cornell handout. Map every cue to its source in [textbook ed.] and add supplementary primary sources where the textbook doesn't reach the cue."

**Reading-list companion (multi-topic, end-of-unit pre-exam review):**
> "Build a final-third reading-list for [course] covering both the [topic A] and [topic B] Cornell handouts — students will use it to fill in blanks they missed and prep for the final."

The reading-list generator scaffolds the cue→source tables inside a fence; the
surrounding prose, References list, and any hand-curated supplementary primary
sources live outside the fence and survive regeneration. See
`references/style-guide.md` § *Reading-List Companion* for the required structure.

---

## Generation Process

The skill consumes a single markdown source per topic — `<topic>_lecture_main.md`,
typically living at `<vault>/classes/<course>/`. That file is the source of truth:
it carries YAML frontmatter (course context, topic, length), Obsidian-tagged
content blocks (`#concept`, `#blank`, `#question`, `#slide`, …), and Dataview-style
inline fields (`[slide:: 5]`, `[layout:: diagram]`, `[answer:: B]`,
`[difficulty:: 2]`, `[alt:: …]`). Every generator walks the parsed AST + tag
indexes — no separate spec, no JSON intermediate.

Workflow:

1. Read `references/style-guide.md` (color, blank rules, tag taxonomy, slide layouts).
2. Create or update the `_lecture_main.md` for the topic — add or refine tagged
   blocks until it reflects the user's request. See `examples/file_systems_abstraction_lecture_main.md`
   for a canonical example.
3. Run the orchestrator. The parser validates first; hard errors (missing
   `[slide::]` on a `#blank`, `mc` question without `[answer::]`, unknown slide
   layout, missing `[alt::]` on a `#diagram`) abort generation with a clear
   message.

**Canonical command:**
```bash
node generate.js --main <vault>/classes/<course>/<topic>_lecture_main.md --out .
```

**Dependencies** (install once per skill checkout):
```bash
npm install
```

A LaTeX toolchain with `pdflatex` is required for the lecture-notes, Cornell, and
quiz PDFs. Required TeX packages: `texlive-needspace`, `texlive-ec`,
`texlive-tabulary`, `texlive-mdframed`, `texlive-collection-fontsrecommended`
(for `lmodern`):
```bash
pdflatex --version
```

For slides, `@slidev/cli` is required (installed via `npm install`):
```bash
npx slidev --version
```

**Existing script structure (modular — one file per artifact family):**

```
generate.js              # CLI orchestrator: parse → validate → dispatch → compile
parser/
  index.js               # parse(mainPath) + validate(parsed) entry points
  main-parser.js         # markdown + tag + inline-field walker
  validators.js          # invariant checks; hard errors block generation
examples/
  file_systems_abstraction_lecture_main.md   # canonical example (symlinked from vault)
  deadlock_study_questions.md
lib/
  tex-helpers.js         # shared LaTeX preamble + helpers + pdflatex driver
  cornell-tex.js         # Cornell-handout LaTeX palette + helpers
generators/
  lecture-notes.js       # → [topic]_lecture_notes.tex + .pdf
  cornell-handout.js     # → [topic]_cornell_handout.tex + .pdf (+ _key.tex/.pdf instructor key)
  study-questions.js     # → [topic]_study_questions.md
  quiz.js                # → [topic]_quiz.tex/.pdf + [topic]_quiz_key.tex/.pdf
  readme.js              # → README.md
  slides.js              # → [topic]_slides.md  (Slidev markdown)
  question-bank.js       # → [topic]_question_bank.md
  reading-list.js        # → [topic]_reading_list.md   (fenced scaffold; manual content preserved)
archive/
  spec-driven-2025/      # historical: init-spec.js + lecture-spec.json (do not author new specs)
```

**Execution model:**
- Standard single-session lecture set: lecture notes, Cornell handout, study questions, quiz, README, slides, reading-list scaffold
- Topic-wide bank generation: create or append to `[topic]_question_bank.md`

**Running (examples):**
```bash
# Generate every artifact for a topic from its lecture_main.md
node generate.js --main /mnt/es1/anthony/obsidian/vault/classes/326/file_systems_abstraction_lecture_main.md

# Single artifact
node generate.js --main path/to/topic_lecture_main.md --artifact slides
node generate.js --main path/to/topic_lecture_main.md --artifact bank
node generate.js --main path/to/topic_lecture_main.md --artifact reading-list

# Override output directory and skip pdflatex
node generate.js --main path/to/topic_lecture_main.md --out ./out --no-pdf

# Reproducing a past semester's deck (strict — only items used in sp24)
node generate.js --main path/to/topic_lecture_main.md --strict-semester sp24

# Building the current semester's deck (loose — keep current-tagged + untagged)
node generate.js --main path/to/topic_lecture_main.md --semester sp26

# Staleness audit — list items whose newest #used/<term> is older than current
node generate.js audit --main path/to/topic_lecture_main.md --current-term sp26
```

### Reproducibility & staleness — the `#used/<term>` workflow

Mark an item with `#used/<term>` (e.g. `#used/sp26`) every semester it's used.
Tags accumulate, so a question on the sp24 final and again on sp26 carries
both `#used/sp24` and `#used/sp26`. Two filter modes use these tags:

- `--semester sp26` (loose): keep items tagged `#used/sp26` AND items with no
  `#used/*` tag at all. Use this for a current-semester deck that mixes
  recently-tagged content with general-purpose unmarked content.
- `--strict-semester sp26` (strict): keep ONLY items tagged `#used/sp26`. Use
  this to reproduce a past semester's handout exactly as it shipped.

`node generate.js audit --main <path>` produces a staleness report grouped by
section: items whose newest `#used/*` is older than `--current-term` (or the
main's frontmatter `term:`), plus a "Never marked used" section for items that
have never been tagged. Items 4+ semesters stale flag with `⚠`.

## Prompt-To-Main Translation

When the user asks for lecture materials from a topic and some content, translate
the request into the `_lecture_main.md` source rather than writing generator code.

- Topic / course / length → YAML frontmatter
- Sections / agenda → `## Section …` headings tagged `#section/I`, `#section/II`, …
- Covered concepts → blocks tagged `#concept`
- Cornell blanks → blocks tagged `#blank` with `[slide:: N]` pointing at the
  source slide
- Slides → blocks tagged `#slide` with `[layout:: …]` (one of the 11 layouts in
  the enum) and an `[alt:: …]` field on diagram-bearing layouts
- Quiz / bank / study questions → blocks tagged `#question` with `#type/{mc,tf,code,fib,sa}`,
  `#difficulty/{1,2,3}`, and `[answer:: …]`
- Adversarial / exam-eligible status → `#adversarial`, `#exam-eligible`
- Audience overrides — if a block belongs to only one artifact: `#cornell-only`,
  `#notes-only`, `#slides-only`

If a user request is incomplete, scaffold the `_lecture_main.md` with the best
available defaults, then fill gaps conservatively. The full tag taxonomy and
inline-field reference live in `references/style-guide.md` § *Tag Taxonomy
(canonical, v1.0)*.

**Toolchain:**
- `.tex` / `.pdf` (lecture notes, Cornell handout, quiz) → LaTeX (`pdflatex`)
- `.md` (slides, question bank, README, study questions, reading-list) → Markdown; slides presented via `@slidev/cli` (`npx slidev [topic]_slides.md`)

When updating existing materials, edit the `_lecture_main.md` first and preserve
scope, numbering, and file naming unless the user asks for a restructure. For
question banks, never overwrite an existing bank blindly: read it first, then
append or merge intentionally.

**Slide QA workflow:**

Slidev serves the deck as a live HTML presentation. Launch with:

```bash
npx slidev [topic]_slides.md
# opens http://localhost:3030 — navigate slides in a browser
```

For headless layout inspection (CI or server environments), export a screenshot
pass via Playwright if needed — but the primary review path is the live dev server.

**PDF render path for hand-authored markdown companions (ad-hoc handouts that aren't generator output):**

When a `.md` companion needs to be posted to Canvas as a PDF, use **pandoc + lualatex** with a small preprocessing pass to keep Obsidian-flavored markdown legible. `xelatex` chokes on Noto's variable-weight TTFs; `lualatex` with default Latin Modern works.

```bash
SRC=/path/to/companion.md
STAGED=/tmp/$(basename "$SRC")
awk 'BEGIN{fm=0} /^---$/{fm++; next} fm<2{next} {print}' "$SRC" > "$STAGED"
sed -i -E 's/\[\[([^|]+)\|([^]]+)\]\]/\2/g' "$STAGED"          # [[a|b]] -> b
perl -i -pe 's/\[\[([^]]+)\]\]/my $s=$1; $s=~s|_| |g; $s/ge' "$STAGED"   # [[a_b]] -> a b
perl -i -pe 's/≥/>=/g; s/≤/<=/g; s/⩾/>=/g; s/⩽/<=/g;' "$STAGED"          # LM Roman lacks these

pandoc "$STAGED" \
  -o "$(dirname "$SRC")/$(basename "$SRC" .md).pdf" \
  --pdf-engine=lualatex \
  -V geometry:margin=0.9in \
  -V colorlinks=true -V linkcolor=blue -V urlcolor=blue \
  --highlight-style=tango \
  -V documentclass=article \
  --toc --toc-depth=2 \
  -V linestretch=1.15 -V fontsize=11pt
```

This is the canonical render for any handout-companion `.md` → `.pdf`. The cornell handouts themselves still go through the LaTeX generator; this path is for the markdown-only artifacts that don't have a generator.

Always perform Cornell ↔ slide alignment audit after generating both artifacts.
Do not declare the handout complete until every blank is audited. The blank-audit
invariant is enforced by `parser/validators.js` as a hard error: every `#blank`
must carry `[slide:: N]`. See the **Blank Audit** section in
`references/style-guide.md`.

---

## File Naming

Lowercase with underscores. Course code does **not** appear in filenames.

```
cryptography_lecture_main.md            # source of truth
cryptography_lecture_notes.pdf
cryptography_cornell_handout.pdf
cryptography_cornell_handout_key.pdf   # instructor answer key (never distribute)
cryptography_study_questions.md
cryptography_quiz.pdf
cryptography_quiz_key.pdf
cryptography_question_bank.md
cryptography_slides.md
cryptography_reading_list.md
README.md

# Reading-list companion (multi-topic — covers a unit or final third):
final_third_reading_list.md
```

---

## Style Reference

Use `references/style-guide.md` for all artifact-specific formatting and content
rules. In particular, check it for:

- tag taxonomy and inline-field reference (canonical)
- lecture-note callout types and section order
- Cornell blank density, blank audit, and diagram rules
- student-facing coverage limits and omission requirements
- printed color usage for handouts and instructor notes
- study-question tier counts and required question variety
- quiz timing, answer-key format, and question constraints
- question-bank schema, numbering, dedupe, and tagging
- reading-list companion frontmatter, callouts, cue-table format, and References discipline
- GitHub README boilerplate and Markdown rules
- Slidev theme palettes (blueprint / terminal), layout mapping, `<Schematic>` and `<EventChain>` components, and standard deck structure
- ADA Title II compliance: `[alt::]` requirement on `#diagram` and diagram slide layouts; color-and-glyph pairing on Cornell sections; tagged-PDF preference
