#!/usr/bin/env bash
# .claude/hooks/sweep-stale-guard.sh
# Fires tools/sweep.sh in the background if tools/.sweep-stamp is missing or >7 days old.
# Called from .claude/settings.json SessionStart hook.

set -euo pipefail

STAMP="tools/.sweep-stamp"

if [[ ! -f "$STAMP" ]] || [[ -n "$(find "$STAMP" -mtime +7 2>/dev/null)" ]]; then
  echo "[sweep-stale-guard] Sweep stamp missing or >7 days old — running tools/sweep.sh in background" >&2
  bash tools/sweep.sh &>/dev/null &
fi

exit 0
