#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

LOG_DIR="$SCRIPT_DIR/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/harvester-$(date +%Y-%m-%d).log"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting harvester" >> "$LOG_FILE"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Pulling latest code" >> "$LOG_FILE"
if git -C "$SCRIPT_DIR" pull --ff-only >> "$LOG_FILE" 2>&1; then
  LOCK_HASH_FILE="$SCRIPT_DIR/.lock-hash"
  CURRENT_HASH="$(md5 -q "$SCRIPT_DIR/package-lock.json" 2>/dev/null || md5sum "$SCRIPT_DIR/package-lock.json" 2>/dev/null | cut -d' ' -f1)"
  PREV_HASH="$(cat "$LOCK_HASH_FILE" 2>/dev/null || true)"

  if [ "$CURRENT_HASH" != "$PREV_HASH" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Installing dependencies" >> "$LOG_FILE"
    npm ci --ignore-scripts --prefer-offline >> "$LOG_FILE" 2>&1

    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Building" >> "$LOG_FILE"
    npm run build >> "$LOG_FILE" 2>&1

    echo "$CURRENT_HASH" > "$LOCK_HASH_FILE"
  else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Dependencies unchanged, skipping install/build" >> "$LOG_FILE"
  fi
else
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] git pull failed, continuing with existing build" >> "$LOG_FILE"
fi

node "$SCRIPT_DIR/dist/index.js" >> "$LOG_FILE" 2>&1
EXIT_CODE=$?

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Finished (exit: $EXIT_CODE)" >> "$LOG_FILE"
exit $EXIT_CODE
