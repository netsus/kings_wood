#!/usr/bin/env bash
set -euo pipefail

CODEX_HOME_DIR="${CODEX_HOME:-$HOME/.codex}"
INSTALLER="/Users/cwj/.codex/skills/.system/skill-installer/scripts/install-skill-from-github.py"

install_if_missing() {
  local skill_name="$1"
  local skill_path="$2"

  if [ -d "$CODEX_HOME_DIR/skills/$skill_name" ]; then
    echo "Already installed: $skill_name"
    return
  fi

  echo "Installing: $skill_name"
  python3 "$INSTALLER" --repo openai/skills --path "$skill_path"
}

# System skills such as openai-docs are already available and do not need installation here.
install_if_missing "playwright-interactive" "skills/.curated/playwright-interactive"
install_if_missing "screenshot" "skills/.curated/screenshot"

echo "Skill installation complete. Restart Codex to pick up new skills."
