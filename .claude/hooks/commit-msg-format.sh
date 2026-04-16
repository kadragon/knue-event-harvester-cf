#!/usr/bin/env bash
# .claude/hooks/commit-msg-format.sh
# Enforces [TYPE] description commit format.
#
# Behaviour:
#   - Advisory (warn, exit 0) for human and bot commits
#   - Strict (block, exit 1) when $CLAUDE_SESSION_ID is set (Claude Code sessions)
#
# Allowlisted subjects (never blocked):
#   - Dependabot: build(deps):...
#   - GitHub merge commits: Merge pull request / Merge branch
#   - Reverts: Revert "..."

set -euo pipefail

MSG_FILE="${1:-}"
[[ -z "$MSG_FILE" ]] && exit 0
MSG=$(head -1 "$MSG_FILE")

# Allowlist — always pass through
if [[ "$MSG" =~ ^build\(deps\): ]] || \
   [[ "$MSG" =~ ^Merge[[:space:]] ]] || \
   [[ "$MSG" =~ ^Revert[[:space:]]\" ]]; then
  exit 0
fi

# Valid format: [TYPE] description
VALID_TYPES="FEAT|FIX|REFACTOR|DOCS|HARNESS|CONSTRAINT|PLAN|TEST|CHORE"
if [[ "$MSG" =~ ^\[(${VALID_TYPES})\][[:space:]].+ ]]; then
  exit 0
fi

# Non-conforming — warn or block
if [[ -n "${CLAUDE_SESSION_ID:-}" ]]; then
  echo "" >&2
  echo "VIOLATION: Commit message does not match [TYPE] description format." >&2
  echo "  Got: $MSG" >&2
  echo "  Expected: [FEAT|FIX|REFACTOR|DOCS|HARNESS|CONSTRAINT|PLAN|TEST|CHORE] description" >&2
  echo "REF: docs/conventions.md § Commit Format" >&2
  exit 1
else
  echo "WARNING: Commit message does not match [TYPE] description format." >&2
  echo "  Got: $MSG" >&2
  echo "  Expected: [FEAT|FIX|REFACTOR|DOCS|HARNESS|CONSTRAINT|PLAN|TEST|CHORE] description" >&2
  echo "  (Blocking only for Claude Code sessions — human commits pass through)" >&2
  exit 0
fi
