# Lecture-Materials-Assistant — Markdown Monolith Revamp

**Date:** 2026-05-07
**Status:** Design — pending review
**Scope:** Full rewrite of the intake layer + every generator
**Decision-maker:** Anthony Giacalone

---

## Summary

Replace `lecture-spec.json` as the intake to lecture-materials-assistant with a single Obsidian-tagged Markdown main file per lecture topic. Every generator (cornell handout, instructor lecture notes, slide deck, study questions, pop quiz, question bank, exam, reading-list companion, README) is rewritten as a tag-walker that reads from the main `.md`.

The main `.md` lives in the vault alongside the existing per-topic artifacts and is the sole authoring surface. It is a first-class Obsidian citizen — backlinks, tag pane, graph view, and Dataview queries all work natively.

This is a hard cutover: the old spec-driven path is removed once generator parity is achieved. There is no transitional coexistence.

## Goals

- **Single source of truth** per lecture topic. Everything else regenerates.
- **Vault-native authoring.** Edit on iPad, desktop, anywhere Obsidian runs. No JSON editing.
- **Tag-orthogonal slicing.** Generators query the AST by tag-set; section reorganization in the main doesn't break anything.
- **Validation invariants are tag-presence checks.** The current style-guide rules (every blank has a slide source, MC questions have options + answer, fib never appears in exams, etc.) become Dataview queries / parser assertions, not narrative discipline.
- **Cross-topic discoverability via Obsidian backlinks + graph.** Every lecture's concepts are linked into the broader curriculum.
- **Scale.** The skill currently handles ~5 topics across 3 courses. Target: 25+ topics across 4 courses without architecture stress.

## Non-Goals

- Replacing pdflatex / pptxgenjs / docx renderers. The output toolchain stays.
- Replacing the README and exam-assembly logic. Those are largely boilerplate or already lib-driven and don't benefit from the markdown intake.
- Two-way sync (generator output ↔ main). One-way: main is canonical, outputs regenerate.
- Multi-author collaboration. Single-author tool.

---

## Architecture

```
lecture-materials-assistant/
├── SKILL.md                         (updated: main.md flow, tag taxonomy reference)
├── CLAUDE.md                        (updated: living-notes table reflects main.md)
├── parser/                          NEW
│   ├── main-parser.js             reads main.md → AST + tag index
│   └── validators.js                invariant checks
├── generators/                      ALL REWRITTEN as tag-walkers
│   ├── cornell-handout.js
│   ├── lecture-notes.js
│   ├── slides.js
│   ├── question-bank.js
│   ├── exam.js                      consumes question-bank.js output
│   ├── study-questions.js
│   ├── reading-list.js              NEW (hybrid: scaffold + manual fill)
│   └── readme.js                    largely unchanged
├── lib/                             retained
│   ├── tex-helpers.js
│   ├── cornell-tex.js
│   ├── pptx-helpers.js
│   └── md-helpers.js                NEW (shared markdown emission helpers)
├── references/
│   └── style-guide.md               updated: tag taxonomy, main.md skeleton
├── examples/
│   └── file_systems_abstraction_lecture_main.md   NEW canonical example
├── archive/                         NEW
│   └── spec-driven-2025/            old generators + spec.json examples (frozen)
└── package.json
```

### Data flow

```
[author edits in Obsidian]
        │
        ▼
<vault>/classes/<course>/<topic>_lecture_main.md
        │
        ▼  (parser/main-parser.js)
in-memory AST + tag index
        │
        ▼  (generators query the index)
        ├──► cornell_handout.tex → pdflatex → cornell_handout.pdf
        ├──► lecture_notes.tex → pdflatex → lecture_notes.pdf
        ├──► slides.pptx (pptxgenjs)
        ├──► study_questions.md
        ├──► quiz.tex/.pdf + quiz_key.tex/.pdf
        ├──► question_bank.md (kept artifact; also feeds exam.js)
        ├──► reading_list.md (scaffold; author fills supplementary rows)
        ├──► README.md (boilerplate + tag-derived sections)
        └──► exam.tex/.pdf + key (reads question_bank.md)
```

### Why JavaScript

The output toolchain (pptxgenjs, pdflatex driver, docx fallback) is JS. The lib/ helpers are JS. Switching languages doubles surface area for marginal gain in parser elegance. Markdown-it has a workable AST API (`md.parse(src, env)` returns tokens). Inline-field extraction is regex over text content nodes.

The change is **intake**, not output. JS stays.

---

## Main.md format

### Frontmatter

```yaml
---
title: <Topic Title>
course: CECS <NNN>
topic-slug: <snake_case_slug>
term: <sp|fa|su><yy>
adversarial-thinking: <true|false>
type: lecture-main
tags:
  - cecs<nnn>
  - <subject-slug>
  - lecture-main
icon: LiGraduationCap
iconColor: var(--text-normal)
---
```

`topic-slug` is canonical for filename derivation. `adversarial-thinking` drives the security-content invariants (at least one `#question #adversarial` per exam). `term` lets Dataview surface "all lecture-mains used this term."

### Skeleton

```markdown
# <Topic Title>

## Learning Objectives
- #objective <text>
- ...

## Vocabulary
- **<term>** — <definition> #vocab #section/vocab [slide:: N]
- ...

## I. <Section Title> (<NN> min)

### Concepts
- <prose> #concept #section/I [slide:: N] [citation:: <source>]
- ...

### Cornell blanks
- <prose with _______ in place of the blanked token> #blank #section/I [slide:: N] [answer:: <token>] [citation:: <source>]
- ...

### KEY
- <key-callout text> #key-callout #section/I [slide:: N]
- ...

### Case studies
- <prose> #case-study #section/I [slide:: N] [citation:: <source>]
- ...

### Discussion / activity            (optional)
- <prompt> #discussion #section/I
- <prompt> #activity #section/I

### Slide deck source
- #slide [slide:: N] [layout:: <type>] **<slide title>**
  - <bullet>
  - <bullet>
- ...

## II. <next section> (same shape)
…

## Question Bank

### MC
- #question #type/mc #difficulty/2 #section/III #exam-eligible [answer:: B] [points:: 2]
  Stem: <stem>
  - A. <option>
  - B. <option>
  - C. <option>
  - D. <option>

### TF / code
- #question #type/tf #difficulty/1 #section/IV [answer:: F]
  <statement>

### Short answer
- #question #type/sa #difficulty/2 #section/IV [points:: 5]
  <prompt>

### Fill-in-blank
- #question #type/fib #difficulty/1 #section/III [answer:: <token>]
  <stem with _______>

## Self-Quiz
- #self-quiz #section/IV `Q1.` <synthesis prompt>
- ...

## Summary
<author's prose ungated by tags — wraps the lecture set>

## References
- <citation>
- ...
```

### Tag taxonomy

| Axis | Tags | Meaning |
|---|---|---|
| Role | `#concept`, `#vocab`, `#blank`, `#key-callout`, `#case-study`, `#diagram`, `#self-quiz`, `#summary`, `#discussion`, `#activity`, `#question`, `#objective`, `#slide` | Drives generator pickup |
| Scope | `#section/I` … `#section/XII`, `#section/objectives`, `#section/vocab`, `#section/references` | Roman-numeral section assignment |
| Audience override | `#cornell-only`, `#notes-only`, `#slides-only`, `#exam-only` | Explicit opt-out from default routing |
| Question type | `#type/mc`, `#type/tf`, `#type/code`, `#type/fib`, `#type/sa` | Required when `#question` |
| Difficulty | `#difficulty/1`, `#difficulty/2`, `#difficulty/3` | ★ / ★★ / ★★★ |
| Bloom (study questions) | `#bloom/recall`, `#bloom/apply`, `#bloom/analyze` | For study-questions tier requirement |
| Eligibility | `#exam-eligible` (default true), `#adversarial` | Exam routing + security course mandate |
| Status | `#draft`, `#needs-source` | Auto-skipped by generators |

### Inline fields (Dataview-style `[field:: value]`)

| Field | Where used | Meaning |
|---|---|---|
| `[slide:: N]` | `#blank`, `#concept`, `#vocab`, `#key-callout`, `#case-study`, `#slide` | Slide number for cornell-blank-audit |
| `[answer:: X]` | `#question` | Correct answer (letter for mc, T/F, token for fib, sentence for sa) |
| `[options:: A; B; C; D]` | `#question #type/mc` | Pipe- or semicolon-delimited choices |
| `[points:: N]` | `#question` | Exam point value |
| `[citation:: <source>]` | `#blank`, `#concept`, `#vocab`, `#case-study` | Reading-list companion source |
| `[layout:: <type>]` | `#slide` | One of: `title`, `agenda`, `concept`, `split`, `code`, `diagram`, `vocab`, `case-study`, `key`, `summary` |

---

## Generators

Each generator is a focused filter. Inputs: parsed main AST + tag index. Outputs: one or more files.

### parser/main-parser.js

```js
parse(mainMdPath) → {
  frontmatter: { title, course, topicSlug, term, adversarialThinking, ... },
  byTag: Map<tag, Item[]>,           // tag → all items carrying that tag
  bySection: Map<sectionId, Item[]>, // section → all items in that section
  byRole: Map<role, Item[]>,         // role tag → all items with that role
  items: Item[],                     // flat list, in source order
}

Item = {
  text: string,                      // raw markdown text of the bullet/block
  tags: Set<string>,                 // all #tags present
  fields: Map<string, string>,       // [field:: value] pairs
  sourceLine: number,                // for error reporting
  children: Item[],                  // for nested bullets (mc options, slide bullets)
}
```

### parser/validators.js

Runs after parse, before any generator. Returns `{ ok, errors, warnings }`.

Hard errors (block generation):
- `#blank` without `[slide:: N]`
- `#question #type/mc` without `[options::]` or `[answer::]`
- `#question` without exactly one `#type/*`
- `#question` without exactly one `#section/*`
- `#question #type/fib` carrying `#exam-eligible` (illegal — auto-stripped with warning)
- Duplicate `#section/*` on the same item
- adversarial-course frontmatter `false` but `#adversarial` items present (or vice versa, soft warning)

Soft warnings (non-blocking):
- `#draft` items reachable by a non-draft generator
- `#question` with no difficulty
- `#blank` without `[answer:: …]` (some legitimate cases — synthesis blanks — but unusual)

### Per-generator query specs

| Generator | Tags queried | Output |
|---|---|---|
| `cornell-handout.js` | `#blank`, `#vocab`, `#key-callout`, `#case-study`, `#self-quiz`, `#diagram`, `#summary`, `#section/*` | `<topic>_cornell_handout.tex` + `.pdf` |
| `lecture-notes.js` | `#concept`, `#key-callout`, `#case-study`, `#diagram`, `#discussion`, `#activity`, `#section/*` | `<topic>_lecture_notes.tex` + `.pdf` |
| `slides.js` | `#slide` (with `[layout::]`) | `<topic>_slides.pptx` |
| `study-questions.js` | `#self-quiz` + `#question` filtered to `#bloom/*` | `<topic>_study_questions.md` |
| `quiz.js` | sample of `#question` (5 items: 2 recall, 1 apply, 1 analyze, 1 code/fib) | `<topic>_quiz.tex/.pdf` + key |
| `question-bank.js` | `#question` (all) | `<topic>_question_bank.md` (kept artifact) |
| `exam.js` | reads `*_question_bank.md` files (unchanged from current) | `<course>-exam-N-<term>.tex/.pdf` + key |
| `reading-list.js` | `#blank`, `#concept`, `#vocab` with `[citation::]` | `<topic>_reading_list.md` (scaffold; author edits) |
| `readme.js` | frontmatter + `#objective` + `#section/*` titles | `README.md` (GitHub Classroom) |

---

## Reading-list as hybrid artifact

`reading-list.js` walks `#blank`, `#concept`, `#vocab` items carrying `[citation::]` and emits a draft `<topic>_reading_list.md` populated row-by-row with the citations. The author then hand-edits to add:

- "NOT in textbook — see X" rows for material newer than the assigned edition
- Supplementary primary sources (Aleph One Phrack 49-14, Solar Designer 1997, etc.) that go beyond the textbook citation
- The "How to use" + "Primary source" + "Cues newer than the textbook" callouts at the top
- Multi-topic consolidations (Part A / Part B headers when one reading-list spans multiple cornell handouts)

Generator output is a scaffold. Editorial judgment is preserved. Re-running the generator overwrites only the cue-table rows; the callouts and supplementary additions are preserved via a `<!-- generator: cue-tables -->` … `<!-- /generator -->` fence.

---

## Slides

Each lecture section in the main ends with a `### Slide deck source` subsection containing `#slide` items in slide-presentation order. Each slide carries `[slide:: N]` (its position) and `[layout:: <type>]` (one of the ten enumerated layouts).

```markdown
- #slide [slide:: 6] [layout:: concept] **Layering — blocks vs files**
  - File system layers an abstraction of named files over a flat array of blocks
  - Cross-ref: §I cornell-blank "Layering" cue
- #slide [slide:: 7] [layout:: split] **Operations split: metadata vs data**
  - Metadata: open, rename, link, unlink
  - Data: read, write, lseek
- #slide [slide:: 8] [layout:: key] **A file system is an abstract data structure laid over a flat block device**
```

`slides.js` walks `#slide` items in source order (which equals slide-deck order), resolves `[layout::]` to a pptx-template, and emits the deck. Layout enum is fixed at v1; new layouts added explicitly to the enum + style guide.

The `[slide:: N]` field on cornell `#blank` items references a slide *position*, not a slide ID. Validator confirms every `[slide:: N]` cited by a `#blank` corresponds to a `#slide` item with the same `[slide:: N]`.

### Slide-deck quality — "humanize the slides"

Of all generated artifacts, the slide deck has the strongest tendency to read as machine-generated: same template every slide, dense bullet lists, no visual breathing room, mechanical pacing. The slides generator must work harder than the others to produce a deck that feels hand-crafted by a real instructor preparing for a real lecture.

Concrete requirements layered on top of the layout enum:

- **Pacing variety** — not every slide is `[layout:: concept]` with three bullets. Mix in `[layout:: split]`, `[layout:: diagram]`, `[layout:: case-study]`, `[layout:: key]` (one big idea, no bullets), and `[layout:: code]`. Generator should warn (soft) when ≥4 consecutive slides share the same layout.
- **Visual breath** — at least one `[layout:: key]` (single sentence, large type, generous whitespace) per ~10 slides; functions as a pacing pause and reinforces the section's load-bearing idea.
- **Speaker-voice in notes** — pptxgenjs supports speaker notes per slide. Notes are populated from `[notes:: <text>]` inline field on `#slide` items. Notes should sound like Anthony talking through the slide aloud, not a restatement of the bullets. Authoring guidance: write the notes in first person, with the rhythm of speech, and the off-deck examples + asides that make a lecture feel alive. The generator never invents notes; if `[notes::]` is missing, leave the slide's notes field empty rather than auto-filling with a paraphrase of the bullets.
- **Bullet density cap** — 4 bullets per slide is the soft cap, 6 is the hard cap. Generator splits to a continuation slide if exceeded. Title carries `(cont.)` suffix.
- **Real visuals over text** — when a `#diagram` exists for a section, prefer routing it onto a slide as `[layout:: diagram]` over restating its content as bullets. Diagram slides need `[alt::]` per the accessibility section.
- **Section transitions** — between Roman-numeral sections, emit a `[layout:: section-divider]` slide that names the next section. This breaks the visual monotony and gives Anthony a natural pacing beat to pause at.
- **Title slide personality** — the `[layout:: title]` slide carries the topic title + course code + date, but also a hand-chosen tagline or epigraph from the lecture content (a `[tagline:: …]` field on the title slide). Empty by default; encourages Anthony to add one.
- **Closing slide** — every deck ends with a `[layout:: summary]` slide whose body is the key-callout from the final section, not a generic "Questions?" slide.

These rules are enforced in `slides.js` as soft warnings during generation, not hard errors. The goal is friction in the *right* places (encourage authoring richer slides) without blocking output when the master is in early draft form.

The new layout enum (updated): `title`, `agenda`, `concept`, `split`, `code`, `diagram`, `vocab`, `case-study`, `key`, `summary`, `section-divider`. Eleven total.

The new inline field: `[notes:: <speaker-notes prose>]` on `#slide` items. Optional but encouraged.
The new inline field: `[tagline:: <epigraph>]` on `#slide [layout:: title]`. Optional.

---

## Migration plan

### Phase 0 — Preserve old toolchain

Before any deletion, snapshot existing generators + spec.json examples to `archive/spec-driven-2025/`. Frozen, never edited again. Delete from main paths after generator parity is reached.

### Phase 1 — Build parser + validators

Implement `parser/main-parser.js` and `parser/validators.js` against a hand-crafted minimal main.md (Vocabulary + 1 Section + 1 question). Unit tests for tag indexing, inline-field extraction, multi-tag items, hierarchical bullets (mc options, slide sub-bullets).

### Phase 2 — Migrate file_systems_abstraction as canonical example

Convert the existing artifacts (lecture_notes.md, cornell_handout.md, study_questions.md, question_bank.md, slides.pptx) into one main.md by hand. This is both the migration test case and the canonical example checked into `examples/`.

The conversion is partly mechanical (existing question_bank.md items already have type/difficulty tags in legacy form), partly editorial (deciding which prose belongs as `#concept` vs `#case-study`, assigning `[slide:: N]` from the existing slide deck).

### Phase 3 — Implement generators in dependency order

1. `lecture-notes.js` — simplest (no slide-source, no question logic)
2. `cornell-handout.js` — adds blank-audit invariants
3. `question-bank.js` — adds question-typing logic
4. `slides.js` — adds layout resolution
5. `study-questions.js` — combines self-quiz + bloom-filtered questions
6. `quiz.js` — sample-from-bank logic
7. `reading-list.js` — citation extraction
8. `exam.js` — minimally changed (reads bank.md)
9. `readme.js` — minimally changed (boilerplate)

After each generator, run it against the file_systems_abstraction main and diff against the existing kept artifacts in `<vault>/classes/326/`. Treat any structural difference as a generator bug or a main-content gap; resolve before moving on.

### Phase 4 — Migrate remaining topics

For each existing topic that has artifacts in `<vault>/classes/<course>/`:

- buffer_overflow (378-478)
- user_authentication (378-478)
- access_control (378-478)
- social_engineering (378-478)
- input_and_output (326)
- file_systems (326) — done in Phase 2

Each migration is hand-conversion to a main.md. Run all generators. Diff vs existing artifacts. Manual review, then commit.

### Phase 5 — Hard-cut

Delete spec-driven generators from main paths (already in `archive/`). Delete `init-spec.js`. Update SKILL.md and CLAUDE.md to remove all spec-driven references. Update README.md.

---

## Validation invariants (formalized)

Implemented in `parser/validators.js`. Every generator runs validation first; hard errors block output, warnings are logged.

| Invariant | Hard / Soft | Rationale |
|---|---|---|
| Every `#blank` has `[slide:: N]` | Hard | Blank-audit (preserves attendance mechanism) |
| `[slide:: N]` on `#blank` references an existing `#slide [slide:: N]` | Hard | Audit completeness |
| Every `#question #type/mc` has `[options::]` and `[answer::]` | Hard | Generation correctness |
| Every `#question` has exactly one `#section/*` | Hard | Section assignment unambiguous |
| Every `#question` has exactly one `#type/*` | Hard | Type unambiguous |
| `#type/fib` cannot carry `#exam-eligible` | Hard (auto-strip + warn) | Existing style-guide rule preserved |
| Adversarial course → ≥1 `#question #adversarial` | Soft (warn) | Security-course mandate; check at exam-assembly time |
| Adversarial course → ≥1 `#self-quiz #adversarial` | Soft (warn) | Study-questions mandate |
| `#draft` items reachable by a non-draft generator | Soft (warn) | Avoid shipping in-progress content |
| Every `#question` has exactly one `#difficulty/*` | Soft (warn) | Exam balance — but allow drafts without difficulty |
| `[layout:: X]` is in the enum | Hard | Slide generator can't render unknown layouts |
| Roman numeral `#section/*` is contiguous from I (no gaps) | Soft (warn) | Section ordering sanity |

---

## Testing strategy

### Parser unit tests

`parser/main-parser.test.js` covers:
- Frontmatter extraction
- Tag extraction (single tag, multiple tags, nested under bullets)
- Inline-field extraction (single field, multiple fields, fields with semicolons in value)
- Hierarchical items (mc options as children, slide bullets as children)
- Empty sections
- Malformed items (missing tags, dangling fields)

### Validator unit tests

`parser/validators.test.js` exercises every invariant with a passing case and a failing case.

### Generator integration tests

For each generator, fixed input main.md + golden expected output (held in `tests/golden/`). Generator runs, output diffed against golden. Updating goldens is an explicit step requiring review.

### End-to-end test

`tests/e2e/file_systems_abstraction.test.js`:
1. Read the canonical `examples/file_systems_abstraction_lecture_main.md`
2. Run every generator
3. Verify all expected output files exist and pass basic shape checks (file size > 1KB, tex compiles, pptx parses, md is valid)

### Manual review checkpoint

After Phase 3 completes for file_systems_abstraction, manual side-by-side review of every generated artifact vs the existing vault artifact. Differences either:
- Indicate a generator bug → fix the generator
- Indicate the main.md is missing content → fix the main
- Indicate the existing artifact is wrong → fix the existing artifact (rare but possible)

---

## Rollout & success criteria

### Definition of done

- All 9 generators implemented and pass unit + integration tests
- file_systems_abstraction has a main.md in `<vault>/classes/326/` and all 9 artifacts regenerate from it cleanly
- All 5 other in-vault topics are migrated to main.md form
- SKILL.md, CLAUDE.md, references/style-guide.md updated to reflect main.md as the only intake
- examples/lecture-spec.json removed; init-spec.js removed; archive/spec-driven-2025/ retains the historical record
- One full finals exam authored from the new system end-to-end

### Risks

- **Tag taxonomy lock-in**: changes after migration require re-tagging every existing main. Mitigation: lock the v1 taxonomy in style-guide.md before Phase 4 begins.
- **Main.md authoring is verbose**: one bullet per blank, per concept, per slide can feel heavy. Mitigation: provide an Obsidian template (`<vault>/templates/lecture-main.md`) and a snippet pack for common items.
- **Validator strictness friction**: hard errors block output, may be obstructive during early authoring. Mitigation: validators can be run in `--warn-only` mode during draft authoring; generators use strict mode.
- **Slide layout enum too rigid**: 10 layouts may not cover every case. Mitigation: explicit enum extension procedure (PR-equivalent: edit style-guide + slides.js + add to validator). Adding a layout costs ~30 minutes.

### Out of scope (explicitly deferred)

- Multi-topic main files (one main can only span one topic)
- Author collaboration / merge tooling
- Reverse generation (artifact → main.md backfill) — Phase 2 hand-conversion is the only conversion path
- Theming (color palettes etc.) beyond what the existing lib/ helpers provide

---

## Accessibility — ADA Title II compliance (non-functional requirement)

CSULB's ADA Title II digital-accessibility deadline extends to **2027-04-26** (DOJ Interim Final Rule, May 2026). Standards have not changed — same WCAG 2.1 AA equivalent, same scope (every digital deliverable distributed to students). The revamp is a natural forcing function: every artifact is re-emitted from `_lecture_main.md`, so compliance fixes propagate across the full set without per-PDF retroactive remediation.

### Tag taxonomy additions

Two new inline fields on relevant items:

| Field | Where used | Meaning |
|---|---|---|
| `[alt:: <text>]` | `#diagram`, `#slide [layout:: diagram]`, any item carrying an embedded image | Alt-text for screen readers. Required on every visual. |
| `[caption:: <text>]` | `#diagram` | Visible caption (in addition to alt). Optional but encouraged. |

Validators add a hard error: every `#diagram` item must have `[alt:: …]`. Every `#slide` item with `[layout:: diagram]` must have `[alt:: …]` on its referenced visual.

### Per-generator requirements

| Generator | Requirements |
|---|---|
| `cornell-handout.js` / `lecture-notes.js` / `quiz.js` / `exam.js` | Emit **tagged PDFs**: use `hyperref` with `pdfusetitle`, `accsupp` package for alt-text on `\includegraphics`, `pdfmanagement-testphase` or `tagpdf` package for tagged structure on TeX Live ≥ 2023. Reading order: source order. Color cannot be sole conveyer — section-kind colors (motivation/concept/synthesis/etc.) must be paired with the section's text label and the existing per-kind glyph. Table headers use `\thead{}` or equivalent. |
| `slides.js` | pptxgenjs `altText:` field on every shape that's not pure prose. Slide titles auto-emitted. Reading order = source order. Verify contrast: indigo `#6366F1` on slate `#0F172A` ≥ 7:1 (passes); amber `#F59E0B` on slate ≥ 4.5:1 (verify). Color stripe + indigo badge must be paired with text labels, never standalone. |
| `study-questions.js` / `question-bank.js` / `reading-list.js` / `readme.js` | Markdown outputs already largely compliant. Confirm: hierarchical heading levels (no `##` skipping `###`), descriptive link text (never bare "here" / "link"), semantic list markers, code blocks fenced with language hint. |

### Color-and-glyph pairing rule

The current style guide uses color as a live-navigation aid (Cornell section colors, lecture-notes callout palette). Under ADA, color cannot be the *sole* conveyer of information. The revamp pairs every color cue with a non-color signal:

- Cornell section-kind colors → also carry the section's existing glyph (already in style-guide); section H2 includes both
- Lecture-notes callouts (navy/teal/amber/indigo) → also carry a callout-type word ("**Insight:**", "**Pitfall:**", etc.) at the start of the body
- Slide indigo stripe → paired with the slide-section badge text

Validators flag: any callout/section emission that produces color without paired glyph or label.

### Renewal evidence

ADA compliance work is renewal evidence under both `teaching` (artifact production) and `service` (campus-wide compliance contribution). Work-log entries that touch the revamp should carry both tags going forward.

---

## File location

Main files live alongside existing per-topic artifacts:

```
<vault>/classes/326/
├── file_systems_abstraction_lecture_main.md     (NEW — source of truth)
├── file_systems_abstraction_cornell_handout.md    (generated)
├── file_systems_abstraction_cornell_handout.pdf   (generated)
├── file_systems_abstraction_lecture_notes.md      (generated)
├── file_systems_abstraction_lecture_notes.pdf     (generated)
├── file_systems_abstraction_slides.pptx           (generated)
├── file_systems_abstraction_study_questions.md    (generated)
├── file_systems_abstraction_quiz.pdf              (generated)
├── file_systems_abstraction_quiz_key.pdf          (generated)
├── file_systems_abstraction_question_bank.md      (generated; kept artifact)
└── file_systems_abstraction_reading_list.md       (generated scaffold + manual fill)
```

Naming: `<topic-slug>_lecture_main.md`. Distinct from `<topic-slug>_lecture_notes.*` (the generated instructor copy).

---

## Decisions locked in this brainstorm

1. **Scope**: Option A — full revamp v1, all artifacts migrated.
2. **Tag strategy**: Option 1 — block-level Obsidian-native, `#tag` for taxonomy + `[field:: value]` Dataview inline fields for parametric data.
3. **Migration**: Hard-cut. No coexistence period.
4. **File location**: Vault directly, alongside other artifacts. `<topic-slug>_lecture_main.md`.
5. **Generator language**: JavaScript, refactored. Existing lib/ helpers preserved.
6. **Architecture pattern**: Modular, separation of job function — one generator per artifact.
7. **Reading-list companion**: Hybrid — generator emits cue-table scaffold from `[citation::]`; author fills supplementary rows + callouts manually.
8. **Slide format**: Per-section `### Slide deck source` subsections in the main, with `#slide [slide:: N] [layout:: X]` items in deck order.

---

## Next step

Invoke writing-plans skill to produce phased implementation plan. Plan should map the five phases above onto concrete tasks, sub-tasks, and dispatch units suitable for subagent-driven-development execution.
