#!/usr/bin/env bash
# install.sh — Deploy Scriptorium as a Claude Code skill
#
# Usage:
#   ./install.sh              # install from this repo (local source)
#   ./install.sh --from-git   # clone fresh from GitHub into the skill slot
#   ./install.sh --uninstall  # remove the installed skill

set -euo pipefail

SKILL_NAME="scriptorium"
SKILL_DIR="${HOME}/.claude/skills/${SKILL_NAME}"
REPO_URL="git@github.com:agiacalone/scriptorium.git"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── helpers ──────────────────────────────────────────────────────────────────

info()    { printf '\033[1;34m[info]\033[0m  %s\n' "$*"; }
ok()      { printf '\033[1;32m[ok]\033[0m    %s\n' "$*"; }
warn()    { printf '\033[1;33m[warn]\033[0m  %s\n' "$*"; }
err()     { printf '\033[1;31m[error]\033[0m %s\n' "$*" >&2; exit 1; }

require() {
  command -v "$1" &>/dev/null || err "Required command not found: $1"
}

# ── uninstall ─────────────────────────────────────────────────────────────────

if [[ "${1:-}" == "--uninstall" ]]; then
  if [[ -e "${SKILL_DIR}" ]]; then
    rm -rf "${SKILL_DIR}"
    ok "Removed ${SKILL_DIR}"
  else
    warn "Skill not installed at ${SKILL_DIR} — nothing to remove"
  fi
  exit 0
fi

# ── preflight ─────────────────────────────────────────────────────────────────

require node
require npm

NODE_MAJOR=$(node --version | sed 's/v\([0-9]*\).*/\1/')
if (( NODE_MAJOR < 18 )); then
  err "Node.js 18+ required (found $(node --version))"
fi

# ── install ───────────────────────────────────────────────────────────────────

mkdir -p "${HOME}/.claude/skills"

if [[ "${1:-}" == "--from-git" ]]; then
  # Fresh clone from GitHub
  if [[ -e "${SKILL_DIR}" ]]; then
    info "Updating existing install via git pull..."
    git -C "${SKILL_DIR}" pull --ff-only
  else
    info "Cloning ${REPO_URL} → ${SKILL_DIR}"
    git clone "${REPO_URL}" "${SKILL_DIR}"
  fi
else
  # Copy from the repo containing this script
  info "Installing from local source: ${SCRIPT_DIR}"

  if [[ "${SCRIPT_DIR}" == "${SKILL_DIR}" ]]; then
    warn "Source and destination are the same directory — skipping file copy"
  else
    # Rsync everything except .git, node_modules, and generated output files
    rsync -a --delete \
      --exclude='.git' \
      --exclude='node_modules' \
      --exclude='*.docx' \
      --exclude='*.pptx' \
      --exclude='*.pdf' \
      --exclude='*.tex' \
      "${SCRIPT_DIR}/" "${SKILL_DIR}/"
    ok "Files copied to ${SKILL_DIR}"
  fi
fi

# ── npm dependencies ──────────────────────────────────────────────────────────

info "Installing npm dependencies in ${SKILL_DIR}..."
npm install --prefix "${SKILL_DIR}" --silent
ok "npm install complete"

# ── syntax check ─────────────────────────────────────────────────────────────

info "Running syntax check..."
(cd "${SKILL_DIR}" && npm run check --silent)
ok "Syntax check passed"

# ── optional: latex ───────────────────────────────────────────────────────────

if command -v pdflatex &>/dev/null; then
  ok "pdflatex found — exam generation is available"
else
  warn "pdflatex not found — exam PDF generation will not work"
  warn "Install via: brew install --cask mactex-no-gui"
fi

# ── done ──────────────────────────────────────────────────────────────────────

echo
ok "Skill installed at: ${SKILL_DIR}"
echo
echo "  To use this skill in a course repo, add the following to that repo's CLAUDE.md:"
echo
echo "    ## Skills"
echo "    - Use the Scriptorium skill at \`~/.claude/skills/${SKILL_NAME}/SKILL.md\`"
echo "      for all lecture content generation requests."
echo "    - Use the checked-in CLI from \`~/.claude/skills/${SKILL_NAME}/generate.js\`"
echo "      instead of regenerating JavaScript files in the course repo."
echo
echo "  Or copy CLAUDE.md.example from the skill directory as a starting point:"
echo "    cp ${SKILL_DIR}/CLAUDE.md.example ./CLAUDE.md"
