#!/usr/bin/env bash
# .claude/hooks/bash-output-cap.sh
# Read PostToolUse payload from stdin, cap tool_response output past a line threshold.
# Emits the (possibly truncated) payload back on stdout for the agent to consume.

set -euo pipefail

MAX_LINES="${BASH_OUTPUT_MAX_LINES:-200}"
HEAD_KEEP=50
TAIL_KEEP=100

payload=$(cat)
output=$(jq -r '.tool_response // empty' <<<"$payload")
[[ -z "$output" ]] && { printf '%s' "$payload"; exit 0; }

line_count=$(printf '%s' "$output" | wc -l | tr -d ' ')
[[ "$line_count" -le "$MAX_LINES" ]] && { printf '%s' "$payload"; exit 0; }

head_part=$(printf '%s' "$output" | head -n "$HEAD_KEEP")
tail_part=$(printf '%s' "$output" | tail -n "$TAIL_KEEP")
omitted=$((line_count - HEAD_KEEP - TAIL_KEEP))

truncated="${head_part}
… [truncated ${omitted} lines — re-run with a narrower command if the middle matters] …
${tail_part}"

jq --arg t "$truncated" '.tool_response = $t' <<<"$payload"
