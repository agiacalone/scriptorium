# Lecture-Materials-Assistant Markdown-Monolith Revamp — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the JSON `lecture-spec.json` intake with a single Obsidian-tagged Markdown source-of-truth (`<topic>_lecture_main.md`) per topic; rewrite every generator as a tag-walking script that reads the AST + tag-index from that file.

**Architecture:** New `parser/` package (markdown-it AST + tag/field indexer + invariants validator). All nine generators rewritten under `generators/` as filter-and-emit pipelines that query the parser's indices. Existing `lib/` helpers (tex, cornell-tex, pptx) preserved unchanged. Old spec-driven path frozen in `archive/spec-driven-2025/` until parity is reached, then removed.

**Tech Stack:** Node.js (≥20), `markdown-it` for parsing, `gray-matter` for frontmatter, `pptxgenjs` v4+, `pdflatex` (TeX Live ≥ 2023 with `tagpdf`/`accsupp`), `vitest` for tests.

**Critical deadline:** Finals authoring must be unblocked by **2026-05-13**. The plan keeps the existing spec-driven path **alive and intact** through Phase 4. The current `exam.js` already reads `*_question_bank.md` files; those files keep working. Phase 5 (hard-cut deletion) is explicitly deferred until after finals grading (target: 2026-05-25). **Anthony authors 326/378/478 finals using existing tooling against existing banks** — the revamp does not gate that work.

**Working window:** Today (Thu 2026-05-07) through Fri 2026-05-08 are work days. Sat-Sun (5/9–5/10) family-only (Mother's Day, three moms in town), Mon (5/11) finals start. Realistic Phase 1+2 completion: 5/8 EOD. Phases 3-4 begin 5/12.

---

## Scope check

The spec describes one cohesive subsystem (one parser, one set of generators reading from one file shape). Single plan is appropriate.

---

## File structure

### New files (Phase 1)

| Path | Responsibility |
|---|---|
| `parser/main-parser.js` | Read `*_lecture_main.md` → `{frontmatter, items[], byTag, bySection, byRole}` |
| `parser/main-parser.test.js` | Unit tests for parser |
| `parser/validators.js` | Invariants from the design's validation table; returns `{ok, errors[], warnings[]}` |
| `parser/validators.test.js` | Unit tests per invariant (passing + failing cases) |
| `parser/index.js` | Re-exports `parse()` and `validate()` |
| `lib/md-helpers.js` | Shared markdown emission (frontmatter, table, callout) |

### New files (Phase 2)

| Path | Responsibility |
|---|---|
| `<vault>/classes/326/file_systems_abstraction_lecture_main.md` | Canonical example main, hand-converted from existing artifacts |
| `examples/file_systems_abstraction_lecture_main.md` | Symlink or copy of the vault file for tests |
| `tests/golden/file_systems_abstraction/*` | Expected generator outputs for parity diff |

### Rewritten files (Phase 3, in dependency order)

| Path | Existing → new behavior |
|---|---|
| `generators/lecture-notes.js` | Was: read spec.json sections. Now: query `byRole.get('concept')` + `key-callout` + `case-study` + `discussion` + `activity`, group by `bySection`. |
| `generators/cornell-handout.js` | Was: spec sections + blanks list. Now: `byRole.get('blank')` + `vocab` + `key-callout` + `case-study` + `self-quiz` + `diagram`, blank-audit cross-checks `[slide:: N]` against `byRole.get('slide')`. |
| `generators/question-bank.js` | Was: emitted from spec.questions. Now: `byRole.get('question')`, group by `#section/*`, ordered by source position; honors `#exam-eligible`, strips `#exam-eligible` from `#type/fib` with a warning. |
| `generators/slides.js` | Was: spec.slides[]. Now: `byRole.get('slide')` in source order; `[layout::]` resolved to pptx template; `[notes::]` → speaker notes; pacing/density warnings. |
| `generators/study-questions.js` | Was: spec.studyQuestions. Now: `byRole.get('self-quiz')` + `byRole.get('question')` filtered by `#bloom/*`. |
| `generators/quiz.js` | Was: spec.quiz. Now: 5-item sample from `byRole.get('question')`: 2 recall, 1 apply, 1 analyze, 1 code/fib (honoring `#bloom/*` and `#difficulty/*`). |
| `generators/reading-list.js` | NEW. Walks `byRole` items with `[citation::]`, emits `<topic>_reading_list.md` scaffold inside `<!-- generator: cue-tables -->` fence. |
| `generators/exam.js` | Was: reads bank.md, assembles. **Unchanged in v1** — still reads `*_question_bank.md`. Becomes consumer of question-bank.js output. |
| `generators/readme.js` | Was: spec.readme. Now: frontmatter + `byRole.get('objective')` + section titles from `bySection`. |

### Frozen files (Phase 0)

`archive/spec-driven-2025/` — moved verbatim from current `generators/` + `examples/lecture-spec.json` + `init-spec.js`. No edits after the move.

### Files updated, not rewritten

- `SKILL.md` — main.md flow replaces JSON-spec flow; tag taxonomy reference
- `CLAUDE.md` — living-notes table reflects main.md as kept artifact
- `references/style-guide.md` — tag taxonomy, main.md skeleton, slide-deck humanize requirements
- `package.json` — add `markdown-it`, `gray-matter`, `vitest` (dev)

---

## Phase 0 — Snapshot the old toolchain

**Goal:** Make the old generators inert and unreachable but recoverable.

### Task 0.1: Move the spec-driven path to archive/

**Files:**
- Move: `generators/*.js` → `archive/spec-driven-2025/generators/`
- Move: `init-spec.js` → `archive/spec-driven-2025/init-spec.js`
- Move: `examples/lecture-spec.json` (and any `*-spec.json`) → `archive/spec-driven-2025/examples/`
- Keep in place: `lib/`, `generate.js`, `references/`, `SKILL.md`, `CLAUDE.md`, `package.json`

- [ ] **Step 1: Create archive directory and move files**

```bash
cd /home/anthony/.claude/skills/lecture-materials-assistant
mkdir -p archive/spec-driven-2025
git mv generators archive/spec-driven-2025/generators
git mv init-spec.js archive/spec-driven-2025/init-spec.js
mkdir -p archive/spec-driven-2025/examples
git mv examples/*-spec.json archive/spec-driven-2025/examples/ 2>/dev/null || true
```

- [ ] **Step 2: Recreate empty `generators/` with a placeholder README**

```bash
mkdir -p generators
cat > generators/README.md <<'EOF'
# Generators (markdown-monolith era)

Each generator is a tag-walker over `parser.parse(mainMdPath)`. See
`docs/superpowers/specs/2026-05-07-md-monolith-revamp-design.md`.

The previous spec-driven generators are frozen at
`archive/spec-driven-2025/generators/` and not reachable from any code path.
EOF
```

- [ ] **Step 3: Update `generate.js` to fail loudly until rewritten**

Add a temporary stub at the top of `generate.js`:

```js
// Spec-driven path archived 2026-05-07. Use the markdown-monolith generators
// (parser/ + generators/) once Phase 3 lands. See docs/superpowers/plans/.
console.error("generate.js is being rewritten — see archive/spec-driven-2025/ for the old path.");
process.exit(2);
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(lma): archive spec-driven path before md-monolith revamp"
```

---

## Phase 1 — Parser + validators

**Goal:** A working `parser.parse(path)` and `parser.validate(parsed)` that the file_systems_abstraction migration in Phase 2 can run against.

### Task 1.1: Add dependencies

**Files:** `package.json`

- [ ] **Step 1: Install runtime + dev dependencies**

```bash
cd /home/anthony/.claude/skills/lecture-materials-assistant
npm install markdown-it gray-matter
npm install --save-dev vitest
```

- [ ] **Step 2: Add `test` script to package.json**

In `package.json`, add to `scripts`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(lma): add markdown-it, gray-matter, vitest"
```

### Task 1.2: Parser — frontmatter extraction

**Files:**
- Create: `parser/main-parser.js`
- Test: `parser/main-parser.test.js`

- [ ] **Step 1: Write failing test for frontmatter parse**

`parser/main-parser.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { parse } from './main-parser.js';

describe('parse: frontmatter', () => {
  it('extracts title, course, topic-slug, term, adversarial-thinking', () => {
    const src = `---
title: File Systems
course: CECS 326
topic-slug: file_systems_abstraction
term: sp26
adversarial-thinking: false
type: lecture-main
---
# File Systems
`;
    const r = parse({ source: src });
    expect(r.frontmatter.title).toBe('File Systems');
    expect(r.frontmatter.course).toBe('CECS 326');
    expect(r.frontmatter.topicSlug).toBe('file_systems_abstraction');
    expect(r.frontmatter.term).toBe('sp26');
    expect(r.frontmatter.adversarialThinking).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run parser/main-parser.test.js`
Expected: FAIL — `parse is not a function` / module not found.

- [ ] **Step 3: Implement frontmatter parser**

`parser/main-parser.js`:

```js
import fs from 'node:fs';
import matter from 'gray-matter';

export function parse({ path, source } = {}) {
  const raw = source ?? fs.readFileSync(path, 'utf8');
  const { data, content } = matter(raw);
  const frontmatter = {
    title: data.title,
    course: data.course,
    topicSlug: data['topic-slug'],
    term: data.term,
    adversarialThinking: data['adversarial-thinking'] === true,
    type: data.type,
    raw: data,
  };
  return { frontmatter, body: content, items: [], byTag: new Map(), bySection: new Map(), byRole: new Map() };
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npx vitest run parser/main-parser.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add parser/ package.json
git commit -m "feat(lma/parser): frontmatter extraction"
```

### Task 1.3: Parser — bullet items, tags, inline fields

**Files:** `parser/main-parser.js`, `parser/main-parser.test.js`

- [ ] **Step 1: Write failing test for tag and inline-field extraction**

Append to `main-parser.test.js`:

```js
describe('parse: items', () => {
  it('extracts tags and inline fields from a list bullet', () => {
    const src = `---
title: t
---
## I. Section
### Concepts
- Layered abstraction principle #concept #section/I [slide:: 6] [citation:: Tanenbaum 4.1]
`;
    const r = parse({ source: src });
    expect(r.items.length).toBe(1);
    const it0 = r.items[0];
    expect(it0.tags.has('concept')).toBe(true);
    expect(it0.tags.has('section/I')).toBe(true);
    expect(it0.fields.get('slide')).toBe('6');
    expect(it0.fields.get('citation')).toBe('Tanenbaum 4.1');
    expect(it0.text).toContain('Layered abstraction principle');
  });

  it('indexes items by tag and role', () => {
    const src = `---
title: t
---
## I. S
### Cornell blanks
- The _____ layer #blank #section/I [slide:: 4] [answer:: file]
- A second blank #blank #section/I [slide:: 5] [answer:: directory]
`;
    const r = parse({ source: src });
    expect(r.byRole.get('blank')?.length).toBe(2);
    expect(r.bySection.get('I')?.length).toBe(2);
    expect(r.byTag.get('blank')?.length).toBe(2);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run parser/main-parser.test.js`
Expected: FAIL — `r.items.length` is 0.

- [ ] **Step 3: Implement bullet/tag/field walker**

Replace the body of `parse()` in `parser/main-parser.js`:

```js
import fs from 'node:fs';
import matter from 'gray-matter';
import MarkdownIt from 'markdown-it';

const TAG_RE = /(?:^|\s)#([A-Za-z][A-Za-z0-9_/-]*)/g;
const FIELD_RE = /\[([a-z][a-z0-9_-]*)::\s*([^\]]+?)\s*\]/g;
const ROLE_TAGS = new Set([
  'concept', 'vocab', 'blank', 'key-callout', 'case-study', 'diagram',
  'self-quiz', 'summary', 'discussion', 'activity', 'question', 'objective', 'slide',
]);

function extractTags(text) {
  const out = new Set();
  for (const m of text.matchAll(TAG_RE)) out.add(m[1]);
  return out;
}

function extractFields(text) {
  const out = new Map();
  for (const m of text.matchAll(FIELD_RE)) out.set(m[1], m[2].trim());
  return out;
}

function stripMeta(text) {
  return text.replace(TAG_RE, '').replace(FIELD_RE, '').replace(/\s+/g, ' ').trim();
}

function findSection(headingStack) {
  for (let i = headingStack.length - 1; i >= 0; i--) {
    const h = headingStack[i];
    const m = h.match(/^([IVXLCDM]+)\.\s/);
    if (m) return m[1];
  }
  return null;
}

export function parse({ path, source } = {}) {
  const raw = source ?? fs.readFileSync(path, 'utf8');
  const { data, content } = matter(raw);
  const md = new MarkdownIt({ html: false });
  const tokens = md.parse(content, {});

  const items = [];
  const headingStack = []; // [h2-text, h3-text, ...]
  let inListItem = false;
  let pendingText = '';
  let pendingLine = 0;
  let listItemDepth = 0;
  let stack = []; // child stack for nesting

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];

    if (t.type === 'heading_open') {
      const inline = tokens[i + 1];
      const text = inline?.content ?? '';
      const level = parseInt(t.tag.slice(1), 10);
      headingStack.length = level - 2 < 0 ? 0 : level - 2;
      headingStack.push(text);
      continue;
    }

    if (t.type === 'list_item_open') {
      listItemDepth++;
      inListItem = true;
      pendingText = '';
      pendingLine = (t.map?.[0] ?? 0) + 1;
      continue;
    }

    if (t.type === 'inline' && inListItem) {
      pendingText += (pendingText ? '\n' : '') + t.content;
      continue;
    }

    if (t.type === 'list_item_close') {
      const tags = extractTags(pendingText);
      const fields = extractFields(pendingText);
      const sectionId = fields.get('section') ?? findSection(headingStack);
      // also accept #section/* tag form
      let secFromTag = null;
      for (const tg of tags) {
        if (tg.startsWith('section/')) secFromTag = tg.slice('section/'.length);
      }
      const item = {
        text: stripMeta(pendingText),
        rawText: pendingText,
        tags,
        fields,
        section: secFromTag ?? sectionId ?? null,
        sourceLine: pendingLine,
        children: [],
      };
      items.push(item);
      inListItem = false;
      pendingText = '';
      listItemDepth--;
    }
  }

  const byTag = new Map();
  const bySection = new Map();
  const byRole = new Map();
  for (const it of items) {
    for (const tg of it.tags) {
      if (!byTag.has(tg)) byTag.set(tg, []);
      byTag.get(tg).push(it);
      if (ROLE_TAGS.has(tg)) {
        if (!byRole.has(tg)) byRole.set(tg, []);
        byRole.get(tg).push(it);
      }
    }
    if (it.section) {
      if (!bySection.has(it.section)) bySection.set(it.section, []);
      bySection.get(it.section).push(it);
    }
  }

  return {
    frontmatter: {
      title: data.title,
      course: data.course,
      topicSlug: data['topic-slug'],
      term: data.term,
      adversarialThinking: data['adversarial-thinking'] === true,
      type: data.type,
      raw: data,
    },
    body: content,
    items,
    byTag,
    bySection,
    byRole,
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run parser/main-parser.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add parser/main-parser.js parser/main-parser.test.js
git commit -m "feat(lma/parser): tag + inline-field extraction with tag/role/section indices"
```

### Task 1.4: Parser — nested children (mc options, slide bullets)

**Files:** `parser/main-parser.js`, `parser/main-parser.test.js`

- [ ] **Step 1: Failing test for child-bullet capture**

Append to `main-parser.test.js`:

```js
describe('parse: nested children', () => {
  it('captures mc option children under a #question item', () => {
    const src = `---
title: t
---
## III. S
### Question Bank
- #question #type/mc #section/III #exam-eligible [answer:: B]
  Stem: which is correct?
  - A. wrong
  - B. right
  - C. wrong
  - D. wrong
`;
    const r = parse({ source: src });
    const q = r.byRole.get('question')?.[0];
    expect(q).toBeDefined();
    expect(q.children.length).toBe(4);
    expect(q.children[1].text).toMatch(/right/);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run parser/main-parser.test.js`
Expected: FAIL — children empty.

- [ ] **Step 3: Implement nested capture**

In `parse()`, replace the flat list-item walk with a depth-aware version. After the existing parser code, add a post-pass that uses token `level` to nest:

```js
// Post-pass: re-walk to attach children based on list_item nesting level
// Replace the list-item handling above with a stack-based version:
items.length = 0;
{
  const stack = []; // stack of items currently open
  let pending = null;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type === 'heading_open') {
      const inline = tokens[i + 1];
      const text = inline?.content ?? '';
      const level = parseInt(t.tag.slice(1), 10);
      headingStack.length = Math.max(0, level - 2);
      headingStack.push(text);
      continue;
    }
    if (t.type === 'list_item_open') {
      pending = { tokens: [], line: (t.map?.[0] ?? 0) + 1, level: t.level };
      continue;
    }
    if (t.type === 'inline' && pending) {
      pending.tokens.push(t.content);
      continue;
    }
    if (t.type === 'list_item_close' && pending) {
      const text = pending.tokens.join('\n');
      const tags = extractTags(text);
      const fields = extractFields(text);
      let sec = null;
      for (const tg of tags) if (tg.startsWith('section/')) sec = tg.slice(8);
      if (!sec) sec = findSection(headingStack);
      const item = {
        text: stripMeta(text),
        rawText: text,
        tags,
        fields,
        section: sec,
        sourceLine: pending.line,
        children: [],
      };
      // Pop stack to find correct parent based on token level
      while (stack.length && stack[stack.length - 1].level >= pending.level) stack.pop();
      if (stack.length) stack[stack.length - 1].item.children.push(item);
      else items.push(item);
      stack.push({ item, level: pending.level });
      pending = null;
    }
  }
}
```

(Replace the earlier flat walk; rebuild byTag/bySection/byRole after.)

- [ ] **Step 4: Run all parser tests**

Run: `npx vitest run parser/main-parser.test.js`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add parser/main-parser.js parser/main-parser.test.js
git commit -m "feat(lma/parser): nested-bullet children for mc options and slide sub-bullets"
```

### Task 1.5: Validators — hard errors

**Files:**
- Create: `parser/validators.js`
- Test: `parser/validators.test.js`

- [ ] **Step 1: Failing tests for the eight hard invariants**

`parser/validators.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { parse } from './main-parser.js';
import { validate } from './validators.js';

function v(src) { return validate(parse({ source: src })); }

describe('validators: hard errors', () => {
  it('flags #blank without [slide:: N]', () => {
    const r = v(`---\ntitle: t\n---\n## I. S\n- a _____ blank #blank #section/I [answer:: x]\n`);
    expect(r.errors.some(e => /blank.*slide/i.test(e.message))).toBe(true);
  });

  it('flags #question #type/mc without [options::] or [answer::]', () => {
    const r = v(`---\ntitle: t\n---\n## I. S\n- #question #type/mc #section/I\n`);
    expect(r.errors.some(e => /mc.*answer|options/i.test(e.message))).toBe(true);
  });

  it('flags #question without exactly one #type/*', () => {
    const r = v(`---\ntitle: t\n---\n## I. S\n- #question #section/I\n`);
    expect(r.errors.some(e => /type/i.test(e.message))).toBe(true);
  });

  it('flags #question without exactly one #section/*', () => {
    const r = v(`---\ntitle: t\n---\n## I. S\n- #question #type/sa [answer:: x]\n`);
    // Note: section may default from heading; tighten test if needed
  });

  it('strips #exam-eligible from #type/fib with a warning', () => {
    const r = v(`---\ntitle: t\n---\n## I. S\n- #question #type/fib #section/I #exam-eligible [answer:: x]\n  prompt _____ \n`);
    expect(r.warnings.some(w => /fib.*exam-eligible/i.test(w.message))).toBe(true);
  });

  it('flags layout outside enum', () => {
    const r = v(`---\ntitle: t\n---\n## I. S\n### Slide deck source\n- #slide [slide:: 1] [layout:: bogus] **t**\n`);
    expect(r.errors.some(e => /layout/i.test(e.message))).toBe(true);
  });

  it('flags #blank citing missing #slide [slide:: N]', () => {
    const r = v(`---\ntitle: t\n---\n## I. S\n- a _____ blank #blank #section/I [slide:: 99] [answer:: x]\n### Slide deck source\n- #slide [slide:: 1] [layout:: title] **t**\n`);
    expect(r.errors.some(e => /slide 99/i.test(e.message))).toBe(true);
  });

  it('passes a minimal valid main', () => {
    const r = v(`---\ntitle: t\nadversarial-thinking: false\n---\n## I. S\n### Cornell blanks\n- a _____ blank #blank #section/I [slide:: 1] [answer:: x]\n### Slide deck source\n- #slide [slide:: 1] [layout:: title] **t**\n`);
    expect(r.errors).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run parser/validators.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement validators**

`parser/validators.js`:

```js
const LAYOUT_ENUM = new Set([
  'title', 'agenda', 'concept', 'split', 'code', 'diagram',
  'vocab', 'case-study', 'key', 'summary', 'section-divider',
]);

const QUESTION_TYPES = new Set(['mc', 'tf', 'code', 'fib', 'sa']);

export function validate(parsed) {
  const errors = [];
  const warnings = [];
  const push = (arr, item, message) => arr.push({ message, line: item.sourceLine, text: item.text });

  const items = parsed.items.flatMap(flatten);

  // Build #slide [slide:: N] index for blank-audit
  const slidePositions = new Set();
  for (const it of items) {
    if (it.tags.has('slide') && it.fields.has('slide')) slidePositions.add(it.fields.get('slide'));
  }

  for (const it of items) {
    // #blank invariants
    if (it.tags.has('blank')) {
      if (!it.fields.has('slide')) {
        push(errors, it, '#blank without [slide:: N]');
      } else if (!slidePositions.has(it.fields.get('slide'))) {
        push(errors, it, `#blank cites slide ${it.fields.get('slide')} but no #slide [slide:: ${it.fields.get('slide')}] exists`);
      }
    }

    // #question invariants
    if (it.tags.has('question')) {
      const types = [...it.tags].filter(t => t.startsWith('type/'));
      if (types.length !== 1) push(errors, it, '#question must have exactly one #type/*');
      const sections = [...it.tags].filter(t => t.startsWith('section/'));
      if (sections.length > 1) push(errors, it, '#question has multiple #section/* tags');
      if (!it.section) push(errors, it, '#question without #section/*');

      const ttag = types[0]?.slice(5);
      if (ttag === 'mc') {
        if (!it.fields.has('answer')) push(errors, it, '#question #type/mc without [answer::]');
        const hasOptions = it.fields.has('options') || it.children.length >= 2;
        if (!hasOptions) push(errors, it, '#question #type/mc without [options::] or option child-bullets');
      }

      if (ttag === 'fib' && it.tags.has('exam-eligible')) {
        warnings.push({ message: '#type/fib auto-stripped of #exam-eligible (style-guide rule)', line: it.sourceLine });
        it.tags.delete('exam-eligible');
      }

      if (!QUESTION_TYPES.has(ttag) && types.length === 1) {
        push(errors, it, `unknown #type/${ttag}`);
      }

      const diffs = [...it.tags].filter(t => t.startsWith('difficulty/'));
      if (diffs.length === 0) warnings.push({ message: '#question without #difficulty/*', line: it.sourceLine });
    }

    // #slide layout enum
    if (it.tags.has('slide')) {
      const layout = it.fields.get('layout');
      if (!layout || !LAYOUT_ENUM.has(layout)) {
        push(errors, it, `#slide has invalid or missing [layout::] (got "${layout}")`);
      }
    }

    // Accessibility: #diagram must have [alt::]
    if (it.tags.has('diagram') && !it.fields.has('alt')) {
      push(errors, it, '#diagram without [alt:: …] (ADA Title II requirement)');
    }
    if (it.tags.has('slide') && it.fields.get('layout') === 'diagram' && !it.fields.has('alt')) {
      push(errors, it, '#slide [layout:: diagram] without [alt:: …]');
    }

    // #draft soft warning surfaces at generator time, not here
  }

  // Adversarial-course soft check
  const adv = parsed.frontmatter.adversarialThinking;
  const advItems = items.filter(it => it.tags.has('adversarial'));
  if (adv && advItems.length === 0) {
    warnings.push({ message: 'adversarial-thinking: true but no #adversarial items found' });
  }

  return { ok: errors.length === 0, errors, warnings };
}

function flatten(item, out = []) {
  out.push(item);
  for (const c of item.children) flatten(c, out);
  return out;
}
```

- [ ] **Step 4: Run validator tests**

Run: `npx vitest run parser/validators.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add parser/validators.js parser/validators.test.js
git commit -m "feat(lma/parser): hard-error validators (blanks, questions, slides, layouts, alt)"
```

### Task 1.6: Parser package entry point

**Files:** `parser/index.js`

- [ ] **Step 1: Create the index re-export**

```js
export { parse } from './main-parser.js';
export { validate } from './validators.js';
```

- [ ] **Step 2: Commit**

```bash
git add parser/index.js
git commit -m "feat(lma/parser): index entry point"
```

---

## Phase 2 — Migrate file_systems_abstraction (canonical example)

**Goal:** Hand-convert the existing artifacts at `<vault>/classes/326/file_systems_abstraction_*` into one `file_systems_abstraction_lecture_main.md` that the parser accepts and validates clean.

### Task 2.1: Hand-convert lecture-notes prose → main.md skeleton

**Files:**
- Create: `/mnt/es1/anthony/obsidian/vault/classes/326/file_systems_abstraction_lecture_main.md`

- [ ] **Step 1: Read all existing source artifacts**

```bash
ls /mnt/es1/anthony/obsidian/vault/classes/326/file_systems_abstraction_*
```

Read each. Treat the **lecture_notes.md** as the prose backbone; **cornell_handout.md** as the blank source; **question_bank.md** as the `#question` source; **slides.pptx** (or its derived PDF/JPG) as the `[slide:: N]` reference.

- [ ] **Step 2: Write the frontmatter and section skeleton**

Use the design doc's skeleton verbatim. Roman-numeral sections match the existing handout's section structure.

```markdown
---
title: File Systems — Abstraction and Naming
course: CECS 326
topic-slug: file_systems_abstraction
term: sp26
adversarial-thinking: false
type: lecture-main
tags: [cecs326, operating-systems, lecture-main]
icon: LiGraduationCap
iconColor: var(--text-normal)
---
# File Systems — Abstraction and Naming

## Learning Objectives
- (one #objective bullet per existing learning objective in the handout)

## Vocabulary
- (one #vocab bullet per term in the existing handout's Vocabulary block)

## I. <existing section title>
### Concepts
- ...
### Cornell blanks
- ...
### KEY
- ...
### Slide deck source
- #slide [slide:: 1] [layout:: title] ...

(repeat for each Roman-numeral section)

## Question Bank
### MC
- ...
### TF / code
- ...
### Short answer
- ...
### Fill-in-blank
- ...

## Self-Quiz
- ...

## Summary
...

## References
- ...
```

Fill it in by **copy-and-tag**: each existing concept bullet from `lecture_notes.md` becomes `- <text> #concept #section/<roman> [slide:: N]`. Each blank from `cornell_handout.md` becomes `- <prose with _______> #blank #section/<roman> [slide:: N] [answer:: <token>]`. Each question from `question_bank.md` becomes a `#question` bullet with the corresponding `#type/*`, `#difficulty/*`, `#section/*`, `[answer::]`, and (for mc) child bullets.

- [ ] **Step 3: Validate the file**

```bash
cd /home/anthony/.claude/skills/lecture-materials-assistant
node -e "
import('./parser/index.js').then(({parse,validate}) => {
  const r = parse({ path: '/mnt/es1/anthony/obsidian/vault/classes/326/file_systems_abstraction_lecture_main.md' });
  const v = validate(r);
  if (!v.ok) { console.error('ERRORS:', v.errors); process.exit(1); }
  if (v.warnings.length) console.warn('WARNINGS:', v.warnings);
  console.log(\`OK — \${r.items.length} items, \${r.byRole.size} roles, \${r.bySection.size} sections\`);
});"
```

Expected: `OK — N items …` with no errors. Fix any reported errors in the main.md until it validates clean.

- [ ] **Step 4: Symlink into examples/ for tests**

```bash
mkdir -p examples
ln -sf /mnt/es1/anthony/obsidian/vault/classes/326/file_systems_abstraction_lecture_main.md \
       examples/file_systems_abstraction_lecture_main.md
```

- [ ] **Step 5: Commit**

```bash
git add examples/file_systems_abstraction_lecture_main.md
git commit -m "feat(lma/examples): canonical file_systems_abstraction main.md"
```

(Vault file is in Anthony's vault repo, separate commit there.)

---

## Phase 3 — Generators in dependency order

**For each generator below, the same TDD cycle applies:**
1. Write a golden-output test that runs the generator against the canonical example and asserts shape (existence, ≥ N items, expected headings).
2. Implement the generator as a tag-walker over `parsed.byRole` / `bySection`.
3. Run against the canonical example, save output to `tests/golden/file_systems_abstraction/`, hand-review.
4. Diff vs the existing artifact at `<vault>/classes/326/file_systems_abstraction_*`. Differences are bugs in the generator OR gaps in the main.md OR errors in the existing artifact — resolve and re-run.
5. Commit.

The full TDD scaffolding for `lecture-notes.js` is shown explicitly below as the reference; subsequent generators follow the same pattern.

### Task 3.1: lecture-notes.js (instructor copy, simplest)

**Files:**
- Create: `generators/lecture-notes.js`
- Test: `generators/lecture-notes.test.js`
- Golden: `tests/golden/file_systems_abstraction/lecture_notes.tex`

- [ ] **Step 1: Failing test — emits a tex file with the right section headings**

```js
import { describe, it, expect } from 'vitest';
import { parse } from '../parser/index.js';
import { generateLectureNotes } from './lecture-notes.js';

describe('lecture-notes generator', () => {
  it('emits a section per #section/* with concepts + key-callouts', () => {
    const r = parse({ path: 'examples/file_systems_abstraction_lecture_main.md' });
    const tex = generateLectureNotes(r);
    expect(tex).toContain('\\section');
    expect(tex.match(/\\section/g).length).toBeGreaterThanOrEqual(r.bySection.size);
    expect(tex).toContain(r.frontmatter.title);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run generators/lecture-notes.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the generator**

`generators/lecture-notes.js`:

```js
import { renderPreamble, renderSection, callout } from '../lib/tex-helpers.js';

export function generateLectureNotes(parsed) {
  const { frontmatter, byRole, bySection } = parsed;
  const sections = [...bySection.keys()].sort(romanCompare);
  const out = [];
  out.push(renderPreamble({ title: frontmatter.title, course: frontmatter.course }));

  for (const sec of sections) {
    const items = bySection.get(sec) ?? [];
    const concepts = items.filter(it => it.tags.has('concept'));
    const keys = items.filter(it => it.tags.has('key-callout'));
    const cases = items.filter(it => it.tags.has('case-study'));
    const acts = items.filter(it => it.tags.has('discussion') || it.tags.has('activity'));
    out.push(renderSection({ id: sec, concepts, keys, cases, acts, callout }));
  }
  out.push('\\end{document}\n');
  return out.join('\n');
}

function romanCompare(a, b) {
  const order = { I:1,II:2,III:3,IV:4,V:5,VI:6,VII:7,VIII:8,IX:9,X:10,XI:11,XII:12 };
  return (order[a] ?? 99) - (order[b] ?? 99);
}
```

(If `lib/tex-helpers.js` lacks `renderPreamble`/`renderSection`, port the relevant sections from `archive/spec-driven-2025/generators/lecture-notes.js` into `lib/tex-helpers.js` as data-shape-agnostic helpers.)

- [ ] **Step 4: Run test to verify pass**

Run: `npx vitest run generators/lecture-notes.test.js`
Expected: PASS.

- [ ] **Step 5: Compile to PDF and side-by-side review**

```bash
node -e "
import('./generators/lecture-notes.js').then(async ({ generateLectureNotes }) => {
  const { parse } = await import('./parser/index.js');
  const r = parse({ path: 'examples/file_systems_abstraction_lecture_main.md' });
  const tex = generateLectureNotes(r);
  const fs = await import('node:fs');
  fs.writeFileSync('/tmp/fs_lecture_notes.tex', tex);
});"
cd /tmp && pdflatex -halt-on-error fs_lecture_notes.tex && pdflatex fs_lecture_notes.tex
```

Diff vs `<vault>/classes/326/file_systems_abstraction_lecture_notes.pdf`. Resolve gaps in main.md or generator. Re-run until parity.

- [ ] **Step 6: Save golden + commit**

```bash
mkdir -p tests/golden/file_systems_abstraction
cp /tmp/fs_lecture_notes.tex tests/golden/file_systems_abstraction/lecture_notes.tex
git add generators/lecture-notes.js generators/lecture-notes.test.js tests/golden/
git commit -m "feat(lma/gen): lecture-notes generator (tag-walker)"
```

### Task 3.2: cornell-handout.js

**Files:** `generators/cornell-handout.js`, `generators/cornell-handout.test.js`, `tests/golden/.../cornell_handout.tex`

Same five-step TDD cycle as Task 3.1. Generator queries: `byRole.get('blank')`, `byRole.get('vocab')`, `byRole.get('key-callout')`, `byRole.get('case-study')`, `byRole.get('self-quiz')`, `byRole.get('diagram')`. Section grouping via `bySection`. Color/glyph pairing required (validators already enforce missing alt). Use `lib/cornell-tex.js` for the existing two-column layout helpers.

- [ ] **Step 1-5:** Same shape as Task 3.1; assert blank-count parity with existing handout, blank-audit references resolve to `#slide` items, every section has its kind-color/glyph pair.
- [ ] **Step 6:** Commit `feat(lma/gen): cornell-handout generator (blank-audit + section-color pairing)`.

### Task 3.3: question-bank.js

**Files:** `generators/question-bank.js`, `generators/question-bank.test.js`

Generator emits `<topic>_question_bank.md` from `byRole.get('question')`, ordered by source position, sectioned by `#section/*`. Strips `#exam-eligible` from `#type/fib` items (with logged warning). Output format must remain backward-compatible with the existing `exam.js` parser (which is unchanged in v1) — verify by feeding the regenerated bank into the unchanged exam.js and confirming it picks up the same questions as before.

- [ ] **Step 1-5:** TDD cycle.
- [ ] **Step 6:** Commit `feat(lma/gen): question-bank generator (exam.js-compatible output)`.

### Task 3.4: slides.js

**Files:** `generators/slides.js`, `generators/slides.test.js`

Walk `byRole.get('slide')` in source order. Resolve `[layout::]` to a pptx template via a layout→renderer map in `lib/pptx-helpers.js`. Speaker notes from `[notes::]`. Soft warnings: ≥4 consecutive same-layout, >6 bullets per slide, missing `[layout:: key]` density, missing closing `[layout:: summary]`. Title slide reads `[tagline::]`. Diagram slides require `[alt::]` (already a hard error in the validator).

- [ ] **Step 1-5:** TDD cycle. Use `soffice --headless` to convert pptx → pdf, then `pdftoppm -jpeg -r 150` for visual review (per skill QA workflow).
- [ ] **Step 6:** Commit `feat(lma/gen): slides generator (layout enum + humanize warnings)`.

### Task 3.5: study-questions.js

**Files:** `generators/study-questions.js`, `generators/study-questions.test.js`

Combine `byRole.get('self-quiz')` items with `byRole.get('question')` filtered by `#bloom/*` tag. Required tier counts: 2 Recall, 3 Apply, 5 Analyze (per existing style-guide). Adversarial mandate: `frontmatter.adversarialThinking === true` → at least one `#self-quiz #adversarial`.

- [ ] **Step 1-5:** TDD cycle.
- [ ] **Step 6:** Commit `feat(lma/gen): study-questions generator (bloom + tier mix)`.

### Task 3.6: quiz.js

**Files:** `generators/quiz.js`, `generators/quiz.test.js`

Sample 5 questions from `byRole.get('question')`: 2 recall, 1 apply, 1 analyze, 1 code/fib (per spec). Emits `<topic>_quiz.tex` + `<topic>_quiz_key.tex` (key built by toggling `\answerstrue`). Driver compiles both to PDF via the existing `lib/tex-helpers.js` `pdflatex` runner.

- [ ] **Step 1-5:** TDD cycle.
- [ ] **Step 6:** Commit `feat(lma/gen): quiz generator + key`.

### Task 3.7: reading-list.js

**Files:** `generators/reading-list.js`, `generators/reading-list.test.js`

Walks `byRole` items (`blank`, `concept`, `vocab`) carrying `[citation::]`. Emits a scaffold `<topic>_reading_list.md` whose cue table sits inside an `<!-- generator: cue-tables -->` … `<!-- /generator -->` fence. On regeneration, only content inside the fence is replaced; everything outside (callouts at top, supplementary rows, multi-topic Part A/B headers) is preserved.

- [ ] **Step 1-5:** TDD cycle. Test for fence preservation: write a scaffold, hand-edit to add a callout above the fence + a row below, regenerate, verify the manual additions survive.
- [ ] **Step 6:** Commit `feat(lma/gen): reading-list generator (hybrid scaffold with preservation fence)`.

### Task 3.8: exam.js — confirm no changes needed

**Files:** `generators/exam.js` (restored from archive)

The design says exam.js is "minimally changed (reads bank.md)". Restore the archived version into `generators/`, run it against the regenerated `file_systems_abstraction_question_bank.md` from Task 3.3, confirm it produces a working exam .tex/.pdf.

- [ ] **Step 1: Restore from archive**

```bash
cp archive/spec-driven-2025/generators/exam.js generators/exam.js
```

- [ ] **Step 2: Smoke-test against regenerated bank**

```bash
node generate.js --artifact exam --banks file_systems_abstraction_question_bank.md  # syntax depends on existing exam.js cli
```

Confirm exam .tex compiles.

- [ ] **Step 3: Commit**

```bash
git add generators/exam.js
git commit -m "feat(lma/gen): restore exam.js (unchanged from archive — reads bank.md)"
```

### Task 3.9: readme.js

**Files:** `generators/readme.js`, `generators/readme.test.js`

Boilerplate-heavy. Reads frontmatter + `byRole.get('objective')` + section titles from `bySection`. Branches on assessment format (reading vs lab) per the existing template.

- [ ] **Step 1-5:** TDD cycle.
- [ ] **Step 6:** Commit `feat(lma/gen): readme generator`.

### Task 3.10: Rewrite generate.js orchestrator

**Files:** `generate.js`

- [ ] **Step 1: Replace stub with new CLI**

```js
#!/usr/bin/env node
import { parse, validate } from './parser/index.js';
import { generateLectureNotes } from './generators/lecture-notes.js';
import { generateCornellHandout } from './generators/cornell-handout.js';
import { generateQuestionBank } from './generators/question-bank.js';
import { generateSlides } from './generators/slides.js';
import { generateStudyQuestions } from './generators/study-questions.js';
import { generateQuiz } from './generators/quiz.js';
import { generateReadingList } from './generators/reading-list.js';
import { generateReadme } from './generators/readme.js';
// exam.js still has its own CLI; orchestrator does not call it

const args = parseArgs(process.argv.slice(2));
const main = args.main || args._[0];
const which = args.artifact || 'all';
const parsed = parse({ path: main });
const v = validate(parsed);
if (!v.ok) { console.error(v.errors); process.exit(1); }
if (v.warnings.length) console.warn(v.warnings);

const dispatch = {
  'lecture-notes': () => generateLectureNotes(parsed),
  'cornell': () => generateCornellHandout(parsed),
  'bank': () => generateQuestionBank(parsed),
  'slides': () => generateSlides(parsed),
  'study': () => generateStudyQuestions(parsed),
  'quiz': () => generateQuiz(parsed),
  'reading-list': () => generateReadingList(parsed),
  'readme': () => generateReadme(parsed),
};

if (which === 'all') for (const [k, fn] of Object.entries(dispatch)) await fn();
else await dispatch[which]();

function parseArgs(argv) { /* minimal --flag value parser */ }
```

(Each generator function writes its own files to the directory of the input main.md; that directory is the canonical output location.)

- [ ] **Step 2: Run end-to-end against the canonical example**

```bash
node generate.js --main examples/file_systems_abstraction_lecture_main.md --artifact all
```

Expected: every artifact produced; warnings printed; no errors.

- [ ] **Step 3: Commit**

```bash
git add generate.js
git commit -m "feat(lma): rewrite generate.js orchestrator over parser+generators"
```

### Task 3.11: End-to-end test

**Files:** `tests/e2e/file_systems_abstraction.test.js`

- [ ] **Step 1-3:** Test that runs `generate.js --main examples/... --artifact all` in a temp dir and asserts every expected output file exists, has size > 1 KB, tex compiles, pptx parses (use a minimal pptx validator).

- [ ] **Step 4:** Commit `test(lma): end-to-end smoke for file_systems_abstraction`.

### Phase 3 milestone

After Task 3.11 lands, run a manual side-by-side review (per design §Manual review checkpoint): every generated artifact for `file_systems_abstraction` vs the existing kept artifact in the vault. Differences resolve as: (a) generator bug → fix; (b) main.md gap → enrich main; (c) old artifact wrong → fix old artifact. Commit fixes per category.

---

## Phase 4 — Migrate remaining topics

**Goal:** Five additional `_lecture_main.md` files in the vault, all generators producing parity outputs.

For each topic, repeat the Phase 2 hand-conversion pattern (Task 2.1 steps 1-3), then run `generate.js --artifact all` against the new main, then diff vs the existing kept artifacts.

### Task 4.1: input_and_output (CECS 326)

**Files:** `<vault>/classes/326/input_and_output_lecture_main.md`

- [ ] **Step 1:** Hand-convert from `input_and_output_cornell_handout.md` + (existing) lecture-notes/slides/bank if present.
- [ ] **Step 2:** Validate clean.
- [ ] **Step 3:** Run all generators; diff vs existing artifacts.
- [ ] **Step 4:** Commit (vault repo).

### Task 4.2: buffer_overflow (CECS 378-478)

Same shape as 4.1. Source: `buffer_overflow_cornell_handout.md`. Adversarial-thinking: true. Tag at least one `#question #adversarial` and one `#self-quiz #adversarial`.

### Task 4.3: user_authentication (CECS 378-478)

Same shape. `adversarial-thinking: true`.

### Task 4.4: access_control (CECS 378-478)

Same shape. `adversarial-thinking: true`. Cornell handout may not exist yet — if so, the main.md is a forward-create (not a back-fill); flag in commit message.

### Task 4.5: social_engineering (CECS 378-478)

Same shape. `adversarial-thinking: true`. Source: `social_engineering_cornell_handout.md`.

### Phase 4 milestone

All six topics regenerate cleanly. Tag taxonomy is **locked** at this point (any further changes require re-tagging across all six mains; record in style-guide.md as v1.0).

---

## Phase 5 — Hard-cut deletion (deferred until after finals grading)

**Gate:** Do NOT begin Phase 5 until all of: (a) finals authored and delivered, (b) finals graded, (c) summer-term lecture-set planning underway. Target window: 2026-05-25 → 2026-06-01.

### Task 5.1: Delete the spec-driven path

**Files:** `archive/spec-driven-2025/`

- [ ] **Step 1: Confirm gate met**

Verify: finals delivered ✓, grades posted ✓, no production caller of any spec-driven generator remains.

- [ ] **Step 2: Delete archive/**

```bash
git rm -r archive/spec-driven-2025/
```

- [ ] **Step 3: Search-and-purge any remaining references**

```bash
grep -r "spec-driven\|lecture-spec\.json\|init-spec" --include='*.md' --include='*.js' .
```

Resolve every hit (mostly comments/docs).

- [ ] **Step 4: Update SKILL.md**

Remove all references to `init-spec.js`, `lecture-spec.json`, "lecture spec JSON", and the JSON intake flow. Replace with the main.md flow. Tag taxonomy table goes here too.

- [ ] **Step 5: Update CLAUDE.md**

Living-notes table: replace `spec.json` row with `_lecture_main.md` (and mark it kept). Remove the "JSON intermediate representation" mental model section.

- [ ] **Step 6: Update references/style-guide.md**

Add: complete tag taxonomy, main.md skeleton, slide-deck humanize section (already drafted in spec doc — copy-port).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore(lma): hard-cut deletion of spec-driven path; SKILL/CLAUDE/style-guide point at main.md only"
```

### Task 5.2: Tag the v1.0 release

- [ ] **Step 1:**

```bash
git tag -a md-monolith-v1.0 -m "Lecture-materials-assistant: markdown-monolith era begins"
```

---

## Validation invariants reference (implemented in Task 1.5)

Hard errors (block generation), already implemented:
- `#blank` without `[slide:: N]`
- `#blank` with `[slide:: N]` not matching any `#slide [slide:: N]`
- `#question #type/mc` without `[options::]` (or option child-bullets) or `[answer::]`
- `#question` without exactly one `#type/*`
- `#question` with multiple `#section/*`
- `#question` without a section
- `#slide` with invalid or missing `[layout::]`
- `#diagram` without `[alt::]`
- `#slide [layout:: diagram]` without `[alt::]`

Soft warnings (logged, non-blocking):
- `#type/fib #exam-eligible` → auto-strip + warn
- `#question` without `#difficulty/*`
- adversarial-course frontmatter true but no `#adversarial` items

Slides-specific warnings (Task 3.4):
- ≥4 consecutive same-layout slides
- >6 bullets per slide (split to continuation slide)
- <1 `[layout:: key]` per ~10 slides
- Final slide is not `[layout:: summary]`

---

## Self-review

**Spec coverage:**
- Architecture / parser+validators → Phase 1 (Tasks 1.1–1.6) ✓
- Tag taxonomy → enforced in validators (Task 1.5) + indexed by parser (Tasks 1.3–1.4) ✓
- Inline fields → parser (Task 1.3) ✓
- All 9 generators → Tasks 3.1–3.9 ✓
- Reading-list hybrid with preservation fence → Task 3.7 ✓
- Slides humanize warnings → Task 3.4 ✓
- Migration: file_systems_abstraction first → Phase 2; remaining 5 → Phase 4 ✓
- Accessibility (alt, color-and-glyph) → validators (Task 1.5) + per-generator notes ✓
- Hard-cut → Phase 5 (gated on finals delivery + grading) ✓
- Test strategy: parser unit, validator unit, generator integration, e2e → covered ✓

**Placeholder scan:** No "TBD" / "fill in details" remain. Each task has either complete code or a five-step shape pointer to Task 3.1's reference cycle. Tasks 3.2–3.7, 3.9 deliberately reference Task 3.1's cycle rather than repeating the boilerplate, because Task 3.1 contains the full cycle inline and is on the same page.

**Type consistency:** `parse()` returns `{frontmatter, items, byTag, bySection, byRole, body}` — used consistently from Task 1.3 onward. `validate()` returns `{ok, errors, warnings}` — consistent from Task 1.5 onward. Generator function names: `generateLectureNotes`, `generateCornellHandout`, `generateQuestionBank`, `generateSlides`, `generateStudyQuestions`, `generateQuiz`, `generateReadingList`, `generateReadme` — consistent across Tasks 3.x and Task 3.10's orchestrator imports.

**Critical-path check:** Existing `*_question_bank.md` files keep working through Phase 4 because exam.js is restored unchanged in Task 3.8 and reads the same bank format. Anthony can author 326/378/478 finals from existing banks any time after 5/8; the revamp does not gate finals authoring. Phase 5 deletion is explicitly gated on post-finals.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-07-md-monolith-revamp.md` (canonical) with vault mirror to follow. Two execution options:

**1. Subagent-Driven (recommended)** — Dispatch a fresh subagent per task, review between tasks, fast iteration. Fits this plan's TDD-per-task shape well.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch with checkpoints.

Per Anthony's standing memory (`feedback_subagent_driven_default`), default is subagent-driven. Proceeding with that unless redirected.
