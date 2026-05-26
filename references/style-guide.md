# Style Guide — Lecture Materials Assistant

Full style specifications for all artifact types.

---

## Tag Taxonomy (canonical, v1.0)

The `_lecture_main.md` source uses Obsidian-style tags + Dataview-style inline
fields. Every generator walks the same parsed AST + tag indexes. Validators
enforce the invariants below as hard errors and block compilation.

**Role tags** (what kind of block this is):
- `#concept` — a teachable idea or definition
- `#blank` — a Cornell-handout fill-in cue. **Requires `[slide:: N]`** (hard error if missing).
- `#question` — a quiz / bank / study question. **`mc` requires `[answer::]`** (hard error).
- `#slide` — a slide block. **Requires `[layout:: …]`** from the 11-layout enum.
- `#diagram` — a figure or partial diagram. **Requires `[alt:: …]`** (ADA Title II).
- `#example`, `#case-study`, `#activity`, `#discussion`

**Scope tags** (which lecture section the block belongs to):
- `#section/I`, `#section/II`, … through `#section/XII`
- `#section/vocab` — vocabulary block, surfaces in handout key-terms region

**Audience overrides** (block emits to only one artifact):
- `#cornell-only` — handout only
- `#notes-only` — instructor lecture notes only
- `#slides-only` — slide deck only

**Question type** (`#question` blocks):
- `#type/mc` — multiple choice, 4 options, requires `[answer::]`
- `#type/tf` — true/false, requires `[answer::]`
- `#type/code` — code-interpretation T/F, requires `[answer::]`
- `#type/fib` — fill-in-the-blank (quiz/handout only, never exams)
- `#type/sa` — short answer

**Difficulty** (`#question` blocks):
- `#difficulty/1` — ★, recall
- `#difficulty/2` — ★★, apply
- `#difficulty/3` — ★★★, analyze / synthesize

**Eligibility:**
- `#exam-eligible` — bank entry available for exam assembly
- `#adversarial` — attacker-mindset framing (Security courses)

**Status:**
- `#draft` — block is in flight, may be excluded from generation
- `#needs-source` — citation pending; reading-list will surface this

**Semester usage** (multi-valued — accumulates over an item's lifetime):
- `#used/<term>` — record that this item was used in semester `<term>` (e.g.
  `#used/sp26`, `#used/fa25`). Terms use the same shorthand as frontmatter
  `term:` (sp/su/fa + 2-digit year). Items may carry many `#used/*` tags; the
  Obsidian tag pane lets the author list every item used in any past semester.

### Reproducibility & staleness

The `#used/<term>` tag has two interlocking purposes:

1. **Reproduce a past semester exactly.** `node generate.js ... --strict-semester sp24`
   filters every role-based query to items tagged `#used/sp24`. Untagged items
   are excluded — the deck/handout matches what shipped that semester.
2. **Find stale content that needs revisiting.** `node generate.js audit
   --main <path>` lists items whose newest `#used/*` is older than the current
   term, plus items with no `#used/*` tag at all. Items 4+ semesters stale flag
   visibly so they bubble to the top during semester prep.

Mark items with `#used/<term>` manually after each semester, or append the tag
in bulk via a text editor pass over the bank file. The `audit` sub-command
surfaces items that have never been tagged so nothing is silently stale.

A loose filter — `--semester sp26` — keeps `#used/sp26`-tagged items AND items
with no `#used/*` tag at all (untagged = evergreen, always usable). Use loose
when building a current-semester deck that should pull in recently-validated
content alongside general-purpose unmarked content.

In Obsidian, find every item used in a given semester via the tag pane
(`#used/sp26`) or with Dataview, e.g.

```dataview
LIST FROM "classes/326" WHERE !contains(file.tags, "#used/sp26")
```

**Inline fields** (`[key:: value]` syntax, Dataview-compatible): `[slide::]`,
`[layout::]`, `[alt::]`, `[answer::]`, `[difficulty::]`, `[points::]`,
`[time::]`, `[source::]`, `[topic::]`.

The 11-layout slide enum (validated): `title`, `agenda`, `concept`, `diagram`,
`code`, `comparison`, `case-study`, `activity`, `discussion`, `summary`, `blank`.

For the full design rationale (why tags + inline fields, why a markdown
monolith over a JSON spec, migration story from `lecture-spec.json` to
`_lecture_main.md`) see `docs/specs/2026-05-07-md-monolith-revamp-design.md`.

---

## Student-Facing Coverage Policy

Student-facing lecture materials are a replacement for distributing the slide deck,
not a substitute for attending lecture. They should expose roughly **40% of the
slide material**: anchor vocabulary, section structure, and a limited set of
guiding prompts.

The remaining ~60% should stay attendance-dependent. Omit or partially omit the
elements that carry the lecture's real explanatory value:
- complete definitions and full worked examples
- final labels in diagrams, state transitions, and tables
- key comparison criteria, tradeoff conclusions, and synthesis statements
- solution steps, filled-in formulas, and end-state takeaways

Design student-facing artifacts so a student who skips class cannot reconstruct the
full lecture from the handout alone. They should leave with a usable scaffold, but
they must attend to capture the missing explanations and key elements.

Artifacts that follow this policy directly:
- Cornell handout
- any student-facing lecture notes or guided notes
- in-class review sheets tied to the lecture

Artifacts that may be more complete because they are not slide replacements:
- instructor lecture notes
- quizzes, exams, and question banks
- instructor-facing README or assignment drafting materials

## Printed Color Policy

Student handouts and instructor lecture notes are printed teaching materials. Use
color intentionally so instructors and students can locate structure quickly in the
middle of a live public lecture.

Color in printed PDF artifacts is functional, not decorative:
- section headers should visibly segment the page
- cue columns, badges, and callouts should be distinguishable at a glance
- prompts, definitions, warnings, and takeaways should use consistent color families
- diagrams and partial structures should preserve enough color contrast to orient the page during live teaching

The color system should remain readable from normal lectern distance. An instructor
should be able to glance down and immediately identify where they are on the page.

Do not flatten lecture notes or handouts into grayscale-first layouts unless the
user explicitly asks for a monochrome print mode. Assume normal course printing can
preserve light fills and dark accents well enough to serve as lecture cues.

## Symbols Policy

Symbols may be used in printed PDF materials to add clarity, but they are
secondary to text labels and color. Use them sparingly as redundant cues, not as a
third visual system competing for attention.

Appropriate uses:
- a small symbol prefix on section banners
- a simple symbol prefix on callout badges

Avoid:
- decorative icon clutter
- using symbols without text labels
- introducing many symbols that users must memorize

Printed materials should still be understandable if a reader ignores the symbols.

---

## Code and Pseudocode (all artifacts)

### Inline Code

Monospace font (Menlo), same size as surrounding text, light gray background `F5F5F5`,
4pt padding. Used for: variable names, function calls, system calls, file paths,
keywords referenced mid-sentence.

### Code Blocks

Bordered box, Menlo 10pt, 4pt internal padding. A small language label (e.g., `C`,
`Python`, `pseudocode`) appears in muted gray above the block when the language is
not obvious from context.

**In lecture notes and quiz (.tex/.pdf):** `\begin{lstlisting}` from the `listings`
package, framed, monospaced, 5%-black background, full text-width. Use `language=`
hint when the language is recognized by `listings`; otherwise omit.

**In Cornell handout (.tex/.pdf):** same `lstlisting` block, kept narrow enough to
fit inside the notes column. If a block would exceed ~10 lines, split across rows
or use an ellipsis comment (`// ...`) to abbreviate.

**In slides (Beamer .tex/.pdf):** dark panel `1E293B`, Menlo 11pt, body text color `F1F5F9`.
Limited syntax highlighting:
- Keywords / control flow: indigo `6366F1`
- String literals: amber `F59E0B`
- Comments: muted `94A3B8`
- Everything else: body white `F1F5F9`

Keep slide code blocks to ≤15 lines. If the relevant section is longer, show the
key lines and replace omitted sections with a comment: `// ... (full impl in notes)`.

**In question bank (.md):** standard fenced code block with language hint.

**In exam (.tex):** `\begin{lstlisting}` (same package as the lecture-note PDFs).

### Pseudocode

Use when the concept is algorithm-level and language-independent:
- Keywords: `while`, `for`, `if / else`, `return`, `function`, `//` for comments
- Indentation-based structure, no braces required
- Label the block `pseudocode` — do not use a real language name
- Prefer pseudocode over real code in Cornell handouts and study questions unless
  the course specifically requires reading real source (e.g., OS kernel code)

### Code Blanks in Cornell Handout

When a code block contains a blank for students to fill in:
- Replace the target token or line with `_______`
- The surrounding structure (function signature, loop, surrounding lines) stays intact
  so students can infer context from the projected slide
- One blank per logical unit — do not blank multiple lines in the same block

---

## Diagrams and Visual Content (all artifacts)

### When a Diagram Is Required

If a concept is taught visually on a slide (state machine, memory layout, sequence
diagram, network topology, tree/hierarchy), it must appear in the lecture notes and
Cornell handout in some form. Do not leave major visual concepts slide-only.

### Diagram Representation in PDF Artifacts

The `docx` npm package cannot render vector diagrams. Use structured tables and
bordered text boxes to approximate diagrams:

| Concept | Representation |
|---|---|
| State machine | Table: states as cells, transitions as arrows drawn with `→` / `←` in adjacent cells |
| Memory layout | Single-column table with labeled rows (stack, heap, BSS, text) and size annotations |
| Process/thread hierarchy | Indented table or nested bordered boxes |
| Timeline / sequence | Two-column table: left = actor, right = events in order |
| Tree / hierarchy | Indented list inside a bordered box |

Label every diagram with a bold caption above it: **Figure: [Description]**.

### Partial Diagrams in Cornell Handout

Since students do not receive slides, key diagrams must appear in the handout as
partially-complete structures for students to fill in during lecture:
- Draw the full structure (boxes, rows, arrows) with labels removed
- Students write in labels as the professor walks through the slide
- Blank cells use `_______`; blank state transition labels use `→ _______`
- Mark the cue column with the figure caption so students know what they're looking at

### Diagrams in Slides (Beamer .tex/.pdf)

Use the card/panel pattern (`1E293B` background) for diagram containers. For
structured diagrams (state machines, memory maps):
- Boxes: rounded rectangle, panel color `334155`, border indigo `6366F1`
- Arrows: sky `38BDF8`, 2pt weight
- Labels: body white `F1F5F9`, Calibri 11pt
- Active/highlighted state: indigo fill `6366F1`, white label

For sequence/timeline diagrams, use a horizontal swimlane layout with one row per
actor. Highlight the current step in amber `F59E0B`.

---

## Lecture Notes (.pdf)

- **Font:** Arial throughout
- **Colors:** Navy headers `1F3864`, blue accent `2E5FA3`, body text black
- **Page size:** US Letter, 1" margins
- **Header:** "LECTURE NOTES — [Topic]" with blue bottom border
- **Footer:** "Instructor Copy — Not for Distribution" + page X of Y
- **Color usage:** Required. Printed instructor notes should use color to mark section transitions, callout types, and table structure so the instructor can navigate the document quickly while teaching and find the right region at a glance.

### Callout Boxes

2-column table: colored left badge (label) + tinted right cell (content).
Badges may include one simple symbol prefix for faster scanning, but the text label
remains mandatory.

| Badge | Background | Use |
|---|---|---|
| `ASK` | blue `EBF3FB` | Audience engagement prompts |
| `THESIS` | gold `FFF8E7` | Core arguments to state explicitly |
| `DEMO` | green `F0FAF0` | Live demonstration suggestions |
| `KEY` | gold `FFF8E7` | Takeaway statements |

### Speaker Notes

Indented, italic, prefixed with 📢, muted gray `555555`.

### Timing

Each major section labeled with approximate minutes.

### Section Order

1. Opening Hook
2. Framework
3. Taxonomy / Concepts
4. Case Studies
5. Activities
6. Defense / Takeaways
7. Discussion Questions
8. References

### Tables

Dark navy header `1F3864` white text; alternating white / `F0F4FA` rows.

---

## Cornell Handout (.pdf)

**Design premise:** The handout is distributed before class via Canvas. Students bring
it to lecture and fill in blanks from the projected slides. The professor adds verbal
explanation beyond the slides — this is not blanked out, but assessed separately through
short answer questions.

This creates a deliberate two-layer system:
- **Partial guided notes** → expose only anchor content from projected slides; confirm attendance by withholding key labels, examples, and conclusions
- **Short answer assessments** → test comprehension of verbal explanation; cannot be answered from the guided notes alone

Students do not receive a personal copy of the slides. The completed handout
(blanks filled from slides + scaffolded context) serves as a partial study scaffold,
not a complete lecture record. Key frameworks and diagrams from slides must be
represented in the handout as partial structures so students can orient themselves
during lecture without receiving a full slide replacement afterward.

Color is required in the printed handout. Use it to make the page legible in real
time: students should be able to identify cue areas, note-taking space, section
breaks, and summary boxes immediately during lecture, and the instructor should be
able to spot those same regions instantly while presenting.

### Layout

Rendered with LaTeX (`pdflatex`) via `lib/cornell-tex.js`. Per-section content uses
a 2-column `tabularx`, full width:
- **Left cue column:** ~26% of text width, tinted in the section's "kind" color
  (very light shade), bold cue keywords in the section's accent color
- **Right notes column:** remainder of text width, scaffolded prose or yellow fill-in cell
- **Vertical divider:** 2pt rule in the section's accent color

Each section's color carries through three places — banner fill, cue tint, and KEY
callout — so a student flipping through can read which "kind" of section they are
in at a glance.

### Section "Kind" Colors

The section banner color encodes the section's role in the lecture rhythm. Set
`section.kind` in the spec; if omitted, the generator picks a positional default
(first → motivation, last → synthesis, middle → concept).

| Kind | Color | When to use |
|---|---|---|
| `motivation` | teal `0F766E` | opening section that grounds the topic in a concrete problem |
| `concept` | navy `1F3864` | core conceptual content (default for middle sections) |
| `strategy` | indigo `4338CA` | comparing approaches, decision frameworks |
| `application` | green `15803D` | when-to-use, applied examples |
| `case-study` | purple `6D28D9` | extended worked example or named historical case |
| `pitfall` | rose `BE185D` | common mistakes, anti-patterns (use sparingly) |
| `synthesis` | amber `B45309` | wrap-up, connection back to the bigger picture |

Functional regions keep stable semantic colors regardless of section kind:
- **Fill-in cells:** yellow `FEF9C3` (universal "fill in here" convention)
- **Learning Objectives box:** light green `F0FDF4` with green left bar
- **Vocabulary grid:** light lavender `F5F3FF` with purple left bar
- **Summary strip:** light blue `DBEAFE` with blue top bar

### Blank Types (mix deliberately)

| Type | Example |
|---|---|
| Fill-in-the-blank mid-sentence | `exploits _______, not software` |
| Open bullet with label | `• Cognitive load — attacks timed for _______` |
| Open line with italic hint | `*Key concept* _______` |
| Synthesis bullets | `Key lesson: _______` |

**Coverage target:** student-facing handouts should carry roughly 40% of the slide
material by content, not just by blank count.
- Keep the visible content to section anchors, cue phrases, and minimal context
- Omit the highest-value explanatory moves so lecture attendance is still required
- Use blanks and partial diagrams as the main omission mechanism

### Diagrams and Visual Content

See **Diagrams and Visual Content** in the cross-artifact section above for full
representation rules. In the Cornell handout specifically, all diagrams must be
partial — structure visible, labels blank — so students fill them in from the
projected slide during lecture.

### Section Headers

Full-width dark navy `1F3864` rows spanning both columns.

### Summary Boxes

Blue-tinted `EBF3FB` header + white lines, one at bottom of each page.

### Self-Quiz Section

4 review questions at end of page 2, answered after class.

### Vocabulary Section

Key terms with blank definitions.

---

## Blank Audit (MANDATORY)

Every blank must be answerable from a projected slide during class. This is the
attendance mechanism — students fill blanks by watching the lecture, not by guessing.
The audit should also confirm that the handout does not expose enough detail to
reconstruct the full slide sequence without attending.

| Blank type | Required source |
|---|---|
| Specific fact (%, name, value) | Must appear on a slide — cite slide number in audit |
| Definition or concept | Must appear on a slide |
| Process / chain step | Must appear on a slide (process diagram, chain card, or table row) |
| Synthesis / open-ended | No slide source needed — mark cue column *(synthesis)* |

**Verbal explanation is not a blank source.** If the professor elaborates verbally
beyond a slide, that content belongs in the scaffolded text of the handout, not as
a blank — and it should be assessed through short answer questions, not fill-in.

Mark the cue column *(verbal)* only as a professor reminder to say something
explicitly. The corresponding notes-column cell must be scaffolded, not blank.

**Never leave silent gaps.** Every blank must map to a readable answer on a specific
projected slide. If no slide covers it, either add it to a slide or convert the blank
to scaffolded text.

---

## Reading-List Companion (.md)

A markdown companion to the Cornell handout. For every cue/blank on the handout,
the reading list points students at the specific textbook section + supplementary
primary sources where the answer lives. Two use cases:

1. **Study guide** — students consult it to fill in blanks they missed during lecture.
2. **Lecture replacement** — when formal lecture is cancelled (e.g. last day of
   semester pre-exam review), the reading list is the deliverable that takes its
   place. Self-sufficient: every cue cites a section students can read.

**Hand-authored, not generated.** This artifact is content-driven and domain-aware
— it requires reading both the cornell handout and the textbook outline and writing
the cue-by-cue mapping by hand. There is no JS generator. The skill's job here is
structure enforcement (the rules below), not content production.

### Variants by scope

| Variant | Filename | When |
|---|---|---|
| Single-topic | `[topic]_reading_list.md` | Companion to one Cornell handout |
| Multi-topic | `[scope]_reading_list.md` (e.g. `final_third_reading_list.md`) | Covers an entire unit or section of the semester; one document holds Part A, Part B, etc. — one part per cornell handout |

### Frontmatter shape

```yaml
---
title: [Topic Name] — Reading List
course: [Course code] — [Course name]
type: reading-list
companion-to: "[[<topic>_cornell_handout]]"   # or a list for multi-topic
tags:
  - <course-slug>          # cecs326 / cecs378 / etc.
  - <subject-slug>         # operating-systems / introduction-to-computer-security-principles
  - <topic-slug>           # e.g. file-systems-abstraction-and-naming
  - reading-list
  - study-guide
icon: LiGraduationCap
iconColor: var(--text-normal)
---
```

For multi-topic variants, add `final-third` (or analogous scope tag) to `tags:`,
and convert `companion-to:` to a YAML list of all paired cornell handouts.

### Required callouts at the top

1. **How-to-use callout** — orient the student. Explain that the doc pairs with
   the Cornell handout, and that they should read the cited section, fill the
   blank in their own words, then complete the post-lecture Self-Quiz and Summary
   strips.

   ```markdown
   > [!info] How to use this document
   > Pair this side-by-side with your **[Topic] Cornell handout**. For each blank
   > you didn't fill in during lecture, this map tells you exactly where in the
   > assigned reading the answer lives. ...
   ```

2. **Primary-source callout** — name the textbook + chapter + page-range
   approximation. State that section numbers below are relative to that chapter.

   ```markdown
   > [!source] Primary source
   > [Author], *[Title]*, [edition] — **Chapter [N], §[X.Y]–§[X.Z]**.
   > Section numbers below refer to that chapter.
   ```

3. **"Cues newer than the textbook" warning** *(when applicable)* — when material
   on the handout postdates the assigned edition (modern hardware features,
   recent CVEs, current industry milestones), warn students explicitly that some
   cues will not resolve in the textbook and that the row will cite a primary
   source instead.

   ```markdown
   > [!warning] Cues newer than the textbook
   > Several cues — especially [list] — cover material newer than [Author] [edition].
   > For modern content, follow the supplementary citations in those rows. Each row
   > tells you which path applies.
   ```

### Per-section cue → source-pointer table

Each section of the cornell handout gets a corresponding section in the reading
list, with the same Roman-numeral numbering and section title. Inside each
section, render a two-column markdown table:

```markdown
## I. [Section title from cornell handout]

| Cue from handout | Read here |
|---|---|
| **[Cue label, verbatim or trimmed]** ([brief context if helpful]) | §[X.Y] *[Subsection title]* — [optional one-liner: "diagram + field-by-field walk", "explicit definition", etc.] |
| **[Cue label]** | NOT in [edition] — see [supplementary primary source] |
| ... | ... |
```

Rules:

- Every cue from the handout's section appears as a row. Don't skip cues, even
  if the answer is implied by an adjacent row.
- Cue labels are bold and match the cornell handout's wording closely so students
  can ctrl-F between the two documents.
- The "Read here" column is concrete: section number + subsection title, or
  primary-source citation if the textbook doesn't cover it. Page ranges are
  optional and approximate (note this in the primary-source callout).
- Mark out-of-textbook cues clearly: `NOT in [edition] — see [source]`.
- One-liner clarifications in the source column are fine when the section title
  alone is ambiguous (e.g., *§4.3.4 Shared Files — second half, after hard-link
  mechanism*).

### Vocabulary block (sub-section)

If the cornell handout has a Vocabulary block, mirror it as the **first sub-section**
of the reading list (before Section I). Use a vocabulary table mapping each term
to where it's defined:

```markdown
## Vocabulary

Read all of [primary-source range] before answering vocabulary. Every term is
defined or used across [those sections].

| Term | Where it's defined |
|---|---|
| **[term]** | §[X.Y] *[Subsection]* — [optional: "opening paragraph", "diagram", etc.] |
```

### Self-Quiz mapping

If the cornell handout has a Self-Quiz, do **not** answer the questions.
Self-quiz answers are still the student's words. Instead, render a "sections
to draw from" mapping so students know where to read for each synthesis question:

```markdown
## Self-Quiz

The Self-Quiz at the end of the handout is a synthesis exercise — there's no
single section that answers each question. Use the relevant sections above to
compose your own answers.

| Quiz question | Sections to draw from |
|---|---|
| **Q1.** [Verbatim or summarized question] | §[X.Y] + [supplementary source if relevant] |
```

### Summary section reminder

Surface that the Summary block is the student's own words. Don't fill it in.

```markdown
## Summary section

The Summary block on the handout is **your own words**. After working the cues
above, write [N] sentences that capture (a) [theme A], (b) [theme B], and
(c) [theme C].
```

### References

End with a comprehensive References section grouping sources by category:
**Textbook**, **Standards / federal guidance**, **Foundational papers**,
**Hardware / architecture** (when applicable), **Modern reportage and
incidents** (when applicable), **Tooling and educational**, **Cheat sheets**.

Every URL or document cited in the cue tables must appear in References. This
gives students a single place to find every source the document references and
makes it self-auditing — if a row cites a source not in References, something
is wrong.

### Multi-topic structure

For consolidated multi-topic reading lists (e.g. `final_third_reading_list.md`):

- Keep the single-document frontmatter and top-of-document callouts.
- Split the body into `# Part A — [Topic A]` and `# Part B — [Topic B]` sections
  (level-1 headings), each one a complete reading list (Vocabulary →
  Sections I, II, … → Self-Quiz → Summary).
- Prefix each part's section anchors with the part letter so they don't collide:
  `## A.I — [Section title]`, `## B.III — [Section title]`, etc.
- One unified References section at the bottom covering both parts.

### PDF render path

When the `.md` companion needs to be a Canvas-attachable PDF, use the pandoc +
lualatex pipeline documented in `SKILL.md` (frontmatter strip + wikilink
flattening + Unicode-glyph normalization, then `--pdf-engine=lualatex` with
`--toc`). Keep the `.md` as the canonical artifact; regenerate the `.pdf`
whenever the `.md` updates.

### Don'ts

- **Don't fill in answers.** Cues map to *where* the answer lives, not to the
  answer itself. Students filling blanks in their own words is the load-bearing
  pedagogy.
- **Don't omit cues to make the doc shorter.** Every cue on the handout deserves
  a row. If the cue is genuinely synthesis-only (no readable source), mark it
  *(synthesis — no source; use the cornell context)* — but those should be rare.
- **Don't use page numbers as the primary citation** — section + subsection
  numbers are stable across editions; pages drift. Page ranges are an optional
  affordance, not the primary identifier.
- **Don't generate this artifact programmatically.** It is hand-authored.

---

## Study Questions (.md)

- **Count:** 10 questions
- **Tiers:**
  - `[Recall]` green `2E7D32` — 2 questions — direct from lecture
  - `[Apply]` blue `1565C0` — 3 questions — use concepts in new scenarios
  - `[Analyze]` purple `6A1B9A` — 5 questions — synthesize, evaluate, argue

### Format Per Question

- Bold `Q#.` prefix in navy
- Question text in normal weight
- Colored difficulty badge inline
- Optional italic hint in gray `888888`
- Answer lines sized to expected response length

### Required Design Rules

- If `adversarial-thinking: yes` — at least 1 question requires attacker-mindset or adversarial thinking
- At least 1 has no single correct answer (graded on reasoning quality)
- At least 1 references a specific case study from lecture
- Multi-part questions use lettered sub-items (a, b, c)

### Collaboration Note

> "You may work with one or two partners but all students must submit individually"

---

## Pop Quiz (.pdf)

- **Count:** 5 questions
- **Time:** ~10 minutes
- **Font / page:** Arial, US Letter, 1" margins — matches lecture notes

### Header Block (top of page)

```
POP QUIZ — [Topic in ALL CAPS]
[Course Code] — [Course Name]
Name: ______________________________    Date: ___________
```

Course code line in navy `1F3864`, bold. Name/Date line in body text.

### Question Types and Distribution

| # | Type | Tier |
|---|---|---|
| Q1–Q2 | Multiple choice (4 options A–D) | Recall |
| Q3 | Fill-in-the-blank (1–2 blanks) | Recall / Apply |
| Q4 | Short answer (2–3 sentences expected) | Apply |
| Q5 | Short answer (3–5 sentences expected) | Analyze |

- MC options each on their own line, indented, labeled `A.` `B.` `C.` `D.`
- Short-answer questions followed by ruled answer lines sized to expected response
- All questions drawn from slide content or stated lecture material — no curveballs

### Format Per Question

- Bold `Q#.` prefix in navy `1F3864`
- Question text in normal weight
- No difficulty badge (unlike study questions — keep the quiz feel clean)
- Ruled lines below short-answer questions: 3 lines for Apply, 5 lines for Analyze

### Answer Key

Page break after Q5. Separate page with red header:

```
ANSWER KEY — NOT FOR DISTRIBUTION
[Course Code] — [Topic]
```

Header background red `C0392B`, white text. Each answer listed `Q1: [answer]` in bold,
followed by a brief explanation (1–2 sentences) that could serve as a grading rubric.
MC answers include why the distractors are wrong.

### Design Rules

- Every question must have an unambiguous correct answer (or clear rubric for short answer)
- MC distractors must be plausible — no throwaway wrong answers
- Do not reuse questions verbatim from the study questions document
- Quiz should be completable in 10 minutes by a prepared student

---

## Question Bank (.md)

A **persistent, append-only** Markdown file — the source of truth for exam and quiz
authoring. One file per topic; questions accumulate as the topic is taught over
semesters. Never regenerate or overwrite an existing bank — only append new questions.

The bank is queryable by **type** and **difficulty**, which are the two scoring
dimensions the exam assembly step uses to select questions. A typical exam spec says
"give me N questions of difficulty ★ from type mc/tf/code" — the bank is the pool
that selection draws from.

- **Format:** Markdown — human-editable, diffable, readable in any viewer
- **File naming:** `[topic]_question_bank.md`

### File Header

```markdown
---
topic: [Topic Name]
course: [Course Code]
sessions: [Subtopic 1], [Subtopic 2], [Subtopic 3] …
---
```

### Question Types

| Type tag | Description | Exam use |
|---|---|---|
| `mc` | Standard 4-option multiple choice | MC section |
| `tf` | True / False statement | MC section (mixed with `mc`) |
| `code` | Code interpretation T/F — show snippet, ask if correct | MC section (mixed with `mc`) |
| `fib` | Fill-in-the-blank | Quizzes and handouts only |
| `sa` | Short answer / short essay | Essay section |

`tf` and `code` render as 2-option questions in the exam MC section — there is no
separate T/F section. `fib` questions never appear in exams.

### Question Format

Each question is a level-3 heading followed by structured fields:

```markdown
### [TYPE]-[N] · [★/★★/★★★] · [Subtopic]

[Question stem or statement]

```c
// code block here for `code` type questions
```

A. [option]
B. [option]
C. [option]
D. [option]

**Answer:** [letter or True/False]
**Explanation:** [one or two sentences; for SA, a model response + grading note]
```

- `mc`: 4 options (A–D)
- `tf` and `code`: 2 options only — `A. True` / `B. False`
- `fib`: no options — blank represented as `_______`
- `sa`: no options — include model answer and grading rubric note

### Difficulty Tags

- `★` — Recall: direct from lecture, factual
- `★★` — Apply: use concepts in a new context or scenario
- `★★★` — Analyze: synthesize, evaluate, or trace through logic

Target mix across each type: ~40% `★`, ~35% `★★`, ~25% `★★★`.

### Design Rules

- **Never overwrite an existing bank** — read the file first, then append new questions at the end
- Assign the next available sequence number within each type (e.g. if `mc-12` exists, next is `mc-13`)
- All questions answerable from lecture content or assigned readings — no outside knowledge
- `mc` distractors must be plausible — no throwaway wrong answers
- `tf` statements: avoid absolute qualifiers ("always", "never") unless that is the point
- `code` questions: incorrect implementations must have a subtle, realistic bug
- Every subtopic must appear in at least two question types
- Do not duplicate questions already in the bank — read existing entries before adding

---

## Exam — see lectern

Exams are controlled documents built by lectern's `reg-exam-build`, not by this
skill. Question banks here are the source pool; assemble the exam `.tex` by hand
from lectern's `references/reference_exam.tex` skeleton. Format rules live in
[[notes/exam-tex-doctrine]].

---

## GitHub Assignment (README.md)

Two variants. Choose based on `assessment format` in the course context:
- **Reading assignment** — answer questions from a chapter or paper
- **Lab / programming assignment** — build something and document it

Both share the same Deliverables and "Please note" boilerplate (copy verbatim).

---

### Variant A: Reading Assignment

#### Structure

```markdown
# [COURSE] Reading Assignment: [Topic]

### Assignment Description
Answer the following questions from the [Chapter X] reading...
[collaboration note]

1. Question text

2. Question text

   1. Sub-question
   2. Sub-question

3. Question with code block:

   ``` language
   code here
   ```

### Deliverables
[standard boilerplate — copy verbatim]

#### Please note:
[standard boilerplate — copy verbatim]
```

#### Rules

- Numbered questions only (no bullets at top level)
- Sub-questions: nested `1.` / `2.` / `3.` indented 4 spaces
- Code blocks: triple backticks with language hint
- Figures: `![Alt text](filename.png "Title")`
- Blockquotes (`>`) for notes, warnings, contextual callouts
- Deliverables and "Please note" sections are **verbatim boilerplate — never change**

---

### Variant B: Lab / Programming Assignment

#### Structure

```markdown
# [COURSE] Lab Assignment: [Lab Name]

### Overview
[1–2 sentences describing what the student will build or investigate]

### Background
[Optional: 1–3 paragraphs or bullet points of relevant context, pseudocode,
or system description the student needs to complete the lab]

### Requirements

1. [Specific, verifiable deliverable]
2. [Specific, verifiable deliverable]
3. [Deliverable with sub-tasks:]
   1. Sub-task
   2. Sub-task

### Questions
[Optional: numbered questions the student answers as part of their writeup]

1. Question text

### Deliverables
[standard boilerplate — copy verbatim]

#### Please note:
[standard boilerplate — copy verbatim]
```

#### Rules

- Requirements are numbered, specific, and verifiable — not vague ("implement X" not "learn about X")
- Background section is optional but should be included whenever the lab involves
  an algorithm, protocol, or system not fully covered in recent lecture
- Questions section is optional; use it when you want written analysis alongside code
- Blockquotes (`>`) for warnings, hints, or constraints (e.g., `> You must use POSIX threads`)
- Code blocks: triple backticks with language hint; use for starter code, expected output, or examples
- Deliverables and "Please note" sections are **verbatim boilerplate — never change**

---

### Standard Deliverables Boilerplate (copy exactly)

```
### Deliverables

Commit the answers to the questions in a readable file to your git repository by the
due date and time indicated with your repository on GitHub Classroom. The only approved
file submission format is Markdown. Other formats will only be accepted with explicit
approval.

#### Please note:

* Your writeup file *must* be done in [Markdown](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax) format and must be included in the repository as a separate file. View the file [`README.md`](README.md?plain=1) for an example of Markdown.
* Any included images or screenshots should be done in `*.jpg`, `*.png`, or `*.gif` formats, and be included individually as files in your repository (i.e. no binary 'document' with the images pasted inside).
* Screenshots or images *may* be linked in your Markdown file writeup if you wish to do so.
```

---

## Slide Deck (Beamer .tex / .pdf)

### Color Palette — "CS Modern" Dark Theme

| Role | Color |
|---|---|
| Background | deep slate `0F172A` |
| Panel / card background | `1E293B` |
| Secondary panel | `334155` |
| Primary accent | indigo `6366F1` |
| Bright accent (hover / highlight) | `818CF8` |
| Body text | `F1F5F9` |
| Muted text | `94A3B8` |
| Warning / stat | amber `F59E0B` |
| Positive / success | emerald `22C55E` |
| Secondary accent | sky `38BDF8` |

### Layout

- 16×9, 10" × 5.625"
- Calibri Black for titles (36–40pt)
- Calibri for body (11–14pt)

### Every Content Slide Must Have

- Indigo frametitle accent stripe (Beamer frametitle template, 6pt, full width, `6366F1`)
- Section tag badge (indigo rectangle `6366F1`, white all-caps label, top-left)
- Slide title (large, white or indigo, Calibri Black)
- Footer: `[COURSE] — [Topic]   |   N / TOTAL` centered, muted, 8pt

### Card / Panel Pattern

Dark panel `1E293B` with shadow; left accent bar in section color for emphasis rows.

### Icons

Use simple, high-contrast icons only when they clarify the slide. Prefer native
Beamer/TikZ shapes or bundled image assets over introducing extra icon-processing
dependencies. If raster icons are used, render them at 256px minimum before
placing them on slides.

### No accent lines under titles — use whitespace or background color.

### Standard Slide Structure

| Slide | Content |
|---|---|
| 1 | Title (topic, subtitle, 3 stat callouts in bottom bar) |
| 2 | Agenda (6-card grid with numbered sections) |
| 3 | Opening hook / motivation |
| 4 | Core thesis / central argument |
| 5–6 | Framework or taxonomy (tables, grids, icon rows) |
| 7–10 | Case studies (4-column process/event chain cards + key lesson bar) |
| 11 | Real-world context / implications |
| 12 | Activity slide (problem, scenario, or live demo) |
| 13–14 | Solutions / best practices |
| 15 | Discussion questions |
| 16 | Closing / key takeaways + reading list |
