# Operator Runbook: lecture-materials-assistant → Scriptorium

This runbook covers the post-merge steps needed to complete the rename on each
device and retire the transitional alias.

Cross-reference: `agiacalone/oracle` repo
`docs/superpowers/specs/2026-06-19-lms-suite-rebrand-design.md` (suite-wide rules).

---

## Phase 1 — GitHub repo rename

1. Go to `https://github.com/agiacalone/lecture-materials-assistant` → Settings →
   Repository name → change to `scriptorium` → Rename.
   GitHub will set up a redirect from the old URL automatically.

2. Update your local remote URL:

   ```bash
   cd ~/git/lecture-materials-assistant
   git remote set-url origin git@github.com:agiacalone/scriptorium.git
   git remote -v   # verify
   ```

3. Rename the local working directory (optional but recommended):

   ```bash
   mv ~/git/lecture-materials-assistant ~/git/scriptorium
   ```

---

## Phase 2 — Sync the skill on each device

The skill is installed as a directory (or symlink) under `~/.claude/skills/`.
After the repo rename, run the updated `install.sh` on each device to install under
the new `scriptorium` name:

```bash
cd ~/git/scriptorium   # (or wherever the repo now lives)
./install.sh           # copies to ~/.claude/skills/scriptorium/ + npm install
```

This creates `~/.claude/skills/scriptorium/` with `name: scriptorium` in SKILL.md.
The `/scriptorium` slash command will now resolve.

### Keep the alias working (transition period)

Until all course repos are updated to reference `scriptorium`, keep the old
`lecture-materials-assistant` skill name resolvable. Do this by symlinking the alias
stub from the repo into `~/.claude/skills/`:

```bash
ln -sfn ~/git/scriptorium/aliases/lecture-materials-assistant \
        ~/.claude/skills/lecture-materials-assistant
```

This makes `~/.claude/skills/lecture-materials-assistant/SKILL.md` point to the
`aliases/` stub, so `/lecture-materials-assistant` continues to resolve.

**On `metaverse` (the home server):** the current setup has
`~/.claude/skills/lecture-materials-assistant` symlinked to the vault copy at
`/mnt/es1/anthony/obsidian/vault/skills/lecture-materials-assistant/`. After
running `install.sh` to populate `~/.claude/skills/scriptorium/`, re-point the
lecture-materials-assistant symlink to the alias stub:

```bash
rm ~/.claude/skills/lecture-materials-assistant
ln -sfn ~/git/scriptorium/aliases/lecture-materials-assistant \
        ~/.claude/skills/lecture-materials-assistant
```

### Verify both skill names resolve

In a Claude Code session, run `/scriptorium` and `/lecture-materials-assistant` —
both should load the skill. The system-reminder skill list should show both names.

---

## Phase 3 — Update course repos

For each course repo (`CLAUDE.md`) still referencing the old skill path, update:

```markdown
# OLD
- Use the lecture materials assistant skill at ~/.claude/skills/lecture-materials-assistant/SKILL.md

# NEW
- Use the Scriptorium skill at ~/.claude/skills/scriptorium/SKILL.md
```

---

## Phase 4 — Retire the alias

Once all devices are synced to `scriptorium` and all course repos reference the new
name, retire the transitional alias:

```bash
# On each device:
rm ~/.claude/skills/lecture-materials-assistant
```

Then, in the `scriptorium` repo, remove the alias stub:

```bash
git rm -r aliases/lecture-materials-assistant
git commit -S -m "cleanup: retire lecture-materials-assistant alias (transition complete)"
```

---

## Checklist

- [ ] GitHub repo renamed to `scriptorium`
- [ ] `origin` remote URL updated on each device
- [ ] `install.sh` run on each device → `~/.claude/skills/scriptorium/` populated
- [ ] `~/.claude/skills/lecture-materials-assistant` re-pointed to alias stub
- [ ] Both `/scriptorium` and `/lecture-materials-assistant` resolve in Claude Code
- [ ] All course repo `CLAUDE.md` files updated to reference `scriptorium`
- [ ] Alias stub removed once transition is complete
