#!/usr/bin/env bash
# .claude/hooks/pre-commit-schema-guard.sh
# Invoked by lefthook on pre-commit when src/lib/state.ts is staged.
# Fails with an agent-readable message if destructive schema operations are detected.
#
# Golden Principle 3: SQLite schema is additive only.
# Forbidden: DROP COLUMN, DROP TABLE, RENAME COLUMN

set -euo pipefail

VIOLATIONS=()

while IFS= read -r line; do
  if [[ "$line" =~ DROP[[:space:]]+COLUMN ]]; then
    VIOLATIONS+=("DROP COLUMN detected: $line")
  fi
  if [[ "$line" =~ DROP[[:space:]]+TABLE ]]; then
    VIOLATIONS+=("DROP TABLE detected: $line")
  fi
  if [[ "$line" =~ RENAME[[:space:]]+COLUMN ]]; then
    VIOLATIONS+=("RENAME COLUMN detected: $line")
  fi
done < src/lib/state.ts

if [[ ${#VIOLATIONS[@]} -gt 0 ]]; then
  echo "" >&2
  echo "VIOLATION: Golden Principle 3 — SQLite schema must be additive only." >&2
  echo "" >&2
  for v in "${VIOLATIONS[@]}"; do
    echo "  FOUND: $v" >&2
  done
  echo "" >&2
  echo "FIX: Use ALTER TABLE ... ADD COLUMN to add new columns." >&2
  echo "     If you must remove a column, first deprecate it (document in architecture.md)," >&2
  echo "     then delete data/state.db and let the app recreate the schema." >&2
  echo "REF: docs/architecture.md § Data Model" >&2
  exit 1
fi

exit 0
