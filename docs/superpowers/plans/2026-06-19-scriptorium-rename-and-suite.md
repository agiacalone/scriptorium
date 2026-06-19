# Scriptorium Rename + Suite-Linking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand `lecture-materials-assistant` → **Scriptorium** (repo, package, docs, Claude Code skill — with a working `lecture-materials-assistant` alias), fix the Oracle-attribution error, and embed the suite cross-link.

**Architecture:** A single branch (`rename/scriptorium`) carries in-repo edits. Title becomes **Scriptorium** (capital); identifier becomes `scriptorium` (lowercase: repo, npm name, skill registry name). The old skill name is kept as an **alias** so `/lecture-materials-assistant` keeps resolving during transition. Historical `docs/superpowers/**`, `docs/specs/**`, and `archive/**` are left untouched.

**Tech Stack:** Node.js generator toolchain (`generate.js`, `generators/`, `exam-reading-list-cli.js`), Claude Code skill (`SKILL.md`), Slidev output.

## Global Constraints

- See `agiacalone/oracle` repo `docs/superpowers/specs/2026-06-19-lms-suite-rebrand-design.md` for the suite-wide rules. Summary:
- Product **title** is **`Scriptorium`** (capital) in ALL prose + README H1. **Identifier** `scriptorium` lowercase: repo, `package.json` name, skill registry name, install paths.
- Keep **`lecture-materials-assistant` as a working skill alias** — do not break `/lecture-materials-assistant` invocation.
- **Do NOT touch** historical/dated files: `docs/superpowers/**`, `docs/specs/**`, `archive/**`.
- **Dual-operability:** the Node CLI (`node generate.js …`, `node exam-reading-list-cli.js …`) is the human path and must keep working; ship/keep an `AGENTS.md` AI path.
- Embed the canonical **suite section** (suite spec §4) in the README, verbatim, with *You are here: **Scriptorium***.
- Commits GPG-signed (`git commit -S`), per task.

---

### Task 1: Branch + baseline + rename inventory

**Files:** none modified (inventory only)

- [ ] **Step 1: Branch**

```bash
cd ~/git/lecture-materials-assistant
git switch -c rename/scriptorium
```

- [ ] **Step 2: Baseline smoke (toolchain runs)**

```bash
node --version
cat package.json | grep -A8 '"scripts"'        # discover the real smoke/test command
node generate.js --help 2>&1 | head -20          # confirm the generator entry point runs
```
Record the smoke command (e.g. `npm test` or a `--help`); it is the regression check for later tasks.

- [ ] **Step 3: Inventory the rename surface (excluding history)**

```bash
git grep -n -i 'lecture-materials-assistant' -- ':!docs/superpowers' ':!docs/specs' ':!archive'
```
Expected: a finite list across `package.json`, `package-lock.json`, `README.md`, `SKILL.md`, `CLAUDE.md`, `CLAUDE.md.example`, `install.sh`, `generators/slides.js`. These are the only files Tasks 2–5 touch.

---

### Task 2: Package + tooling rename

**Files:**
- Modify: `package.json`, `package-lock.json`, `install.sh`, `generators/slides.js`

- [ ] **Step 1: Rename the npm package**

In `package.json`, set `"name": "scriptorium"`. Update the `"description"` if it embeds the old name. In `package-lock.json`, update the top-level `"name"` (and the root `""` package `name`, if present) to `scriptorium` — match what `npm install` would write (run `npm install --package-lock-only` after editing `package.json` to regenerate cleanly rather than hand-editing, if the lockfile is large).

- [ ] **Step 2: Update install.sh + generator metadata**

In `install.sh`, replace `lecture-materials-assistant` in install paths/names with `scriptorium` (read the script first — preserve any path that is a *user* directory vs the *project* name). In `generators/slides.js`, update the old-name string (likely a deck footer/metadata) to `Scriptorium`.

- [ ] **Step 3: Smoke test**

```bash
node generate.js --help 2>&1 | head -5        # still runs
node -e "require('./package.json').name === 'scriptorium' && console.log('pkg ok')"
```
Expected: runs; `pkg ok`.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json install.sh generators/slides.js
git commit -S -m "rename: package + tooling lecture-materials-assistant -> scriptorium"
```

---

### Task 3: Skill rename + `lecture-materials-assistant` alias

**Files:**
- Modify: `SKILL.md`
- Create: an alias skill stub (path determined from how skills are registered — see Step 1)

- [ ] **Step 1: Understand skill registration**

Read `SKILL.md` frontmatter (`name:`, `description:`) and `install.sh` to learn where/how the skill is registered (e.g. symlinked into `~/.claude/skills/` or a plugin dir). Determine whether the loader supports an alias via (a) a second SKILL.md stub directory named `lecture-materials-assistant`, or (b) a symlink. Pick the mechanism the loader actually honors.

- [ ] **Step 2: Rename the skill**

In `SKILL.md`, set frontmatter `name: scriptorium`; update the `description:` and body references to **Scriptorium** (title) / `scriptorium` (identifier). Keep the trigger phrases (they describe *what* it does — "lecture materials", "slides", "quizzes" — which are still accurate).

- [ ] **Step 3: Create the alias**

Create a minimal alias so `/lecture-materials-assistant` still resolves to the same skill. Per the mechanism from Step 1: e.g. an alias `SKILL.md` whose `name: lecture-materials-assistant` and description says *"Alias for Scriptorium — see the scriptorium skill"*, delegating to the same instructions; or a symlink. Add a comment marking it a transitional alias to retire later.

- [ ] **Step 4: Verify both names resolve**

Document the verification Anthony runs on a device (the skill list shows both `scriptorium` and `lecture-materials-assistant`). If the loader cannot alias, STOP and report — fall back per suite spec §7 (registry flip becomes a flagged follow-up, repo/docs rename proceeds).

- [ ] **Step 5: Commit**

```bash
git add SKILL.md <alias path>
git commit -S -m "rename: skill -> scriptorium, keep lecture-materials-assistant alias"
```

---

### Task 4: README — retitle, suite section, Oracle-entry fix

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: the canonical suite section (suite spec §4).

- [ ] **Step 1: Retitle**

`# lecture-materials-assistant` → `# Scriptorium`. Directly under the H1, add the **Scriptorium name-trivia blockquote verbatim** from suite spec §4.1. Update the opening description to read "Scriptorium" while keeping the accurate one-source-Markdown-in, materials-out explanation.

- [ ] **Step 2: Replace the "Companion project" block with the suite section**

Delete the current `> **Companion project:** [lectern]…GitHub-Actions autograding…` block (README lines ~13–16) — it wrongly credits autograding to lectern. Insert the **canonical suite section verbatim** from suite spec §4, with *You are here: **Scriptorium***. This both fixes the Oracle attribution (grading → Oracle) and adds the three-way cross-link.

- [ ] **Step 3: Sweep remaining old-name prose in README**

```bash
git grep -n -i 'lecture-materials-assistant' -- README.md
```
Replace any remaining title-position uses with `Scriptorium`; leave none except (if any) a "formerly known as" note.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -S -m "docs(readme): retitle Scriptorium, add suite section, fix Oracle attribution"
```

---

### Task 5: CLAUDE.md + AGENTS.md (dual-operability) sweep

**Files:**
- Modify: `CLAUDE.md`, `CLAUDE.md.example`
- Create or update: `AGENTS.md`

- [ ] **Step 1: Sweep CLAUDE.md + example**

Replace `lecture-materials-assistant` → `Scriptorium`/`scriptorium` as context dictates (title vs identifier). Leave the lectern references that are *correct* (exam build is lectern's) intact; only fix any that miscredit grading.

- [ ] **Step 2: Ship `AGENTS.md`**

If absent, create `AGENTS.md`: the AI-operation guide naming the CLI entry points (`node generate.js …`, `node exam-reading-list-cli.js …`), the kept-vs-disposable artifact rule, and the statement that every skill action maps to a CLI command (dual-operability). If present, update its naming.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md CLAUDE.md.example AGENTS.md
git commit -S -m "docs: rename to Scriptorium in agent docs, add/refresh AGENTS.md"
```

---

### Task 6: Final verification + operator runbook

**Files:**
- Create: `docs/RENAME-RUNBOOK.md`

- [ ] **Step 1: Leakage sweep (non-history)**

```bash
git grep -in 'lecture-materials-assistant' -- ':!docs/superpowers' ':!docs/specs' ':!archive' ':!docs/RENAME-RUNBOOK.md'
```
Expected: only the intentional alias references (Task 3) and any deliberate "formerly" note.

- [ ] **Step 2: Toolchain smoke**

```bash
node generate.js --help 2>&1 | head -5        # or the smoke command recorded in Task 1
```
Expected: runs clean.

- [ ] **Step 3: Write `docs/RENAME-RUNBOOK.md`**

Operator steps: GitHub repo rename `agiacalone/lecture-materials-assistant` → `agiacalone/scriptorium` (update `origin` + local dir `~/git/scriptorium`); re-sync the renamed skill on each device (Claude Code skill import); retire the `lecture-materials-assistant` alias once all devices are synced. Cross-link the suite spec.

- [ ] **Step 4: Commit**

```bash
git add docs/RENAME-RUNBOOK.md
git commit -S -m "docs: operator runbook for Scriptorium rename"
```

- [ ] **Step 5: Push + PR (only when Anthony says)**

```bash
git push -u origin rename/scriptorium
gh pr create --title "Rename to Scriptorium + suite cross-link" --body "<summary + suite-spec pointer>"
```

---

## Self-Review

**Spec coverage:** suite §2 casing → Tasks 2–5 + Global Constraints. §3 dual-operability → Task 5 (AGENTS.md) + smoke checks. §4 suite section → Task 4 Step 2. §5 Oracle-entry fix (autograding miscredit) → Task 4 Step 2. §6 decomposition (this is plan 2 of 3) → header. §7 alias risk → Task 3 Steps 3–4 with fallback. Covered.

**Placeholder scan:** Where exact strings can't be known without the file in hand (skill-registration mechanism, lockfile name fields, install.sh paths, slides.js metadata string), tasks say "read `<file>` first" + give a verification command — concrete instructions, not placeholders.

**Identifier consistency:** `Scriptorium` (title) vs `scriptorium` (identifier) held throughout; alias name `lecture-materials-assistant` consistent; `node generate.js` / `node exam-reading-list-cli.js` entry points consistent.
