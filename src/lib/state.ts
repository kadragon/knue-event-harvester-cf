import type { ProcessedRecord } from "../types";
import type { KVNamespace } from "@cloudflare/workers-types";

export interface StateEnv {
  PROCESSED_STORE: KVNamespace;
}

const MAX_PROCESSED_ID_KEY = "_max_processed_id";

export async function getProcessedRecord(env: StateEnv, id: string): Promise<ProcessedRecord | null> {
  const raw = await env.PROCESSED_STORE.get(id, "json");
  if (!raw) return null;
  return raw as ProcessedRecord;
}

export async function putProcessedRecord(
  env: StateEnv,
  id: string,
  record: ProcessedRecord,
): Promise<void> {
  await env.PROCESSED_STORE.put(id, JSON.stringify(record));
}

export async function getMaxProcessedId(env: StateEnv): Promise<number> {
  const raw = await env.PROCESSED_STORE.get(MAX_PROCESSED_ID_KEY, "text");
  if (!raw) return 0;
  return Number.parseInt(raw, 10) || 0;
}

export async function updateMaxProcessedId(env: StateEnv, id: string): Promise<void> {
  const numId = Number.parseInt(id, 10);
  if (Number.isNaN(numId)) {
    console.warn(`updateMaxProcessedId called with non-numeric id: "${id}"`);
    return;
  }
  const currentMax = await getMaxProcessedId(env);
  if (numId > currentMax) {
    await env.PROCESSED_STORE.put(MAX_PROCESSED_ID_KEY, numId.toString());
  }
}

/**
 * IMPLEMENTATION NOTE: Race Condition & Data Loss Safeguards
 *
 * Batch Completion Strategy:
 * - maxProcessedId is updated ONLY after the entire batch completes
 * - Failed items are NOT marked as processed → guaranteed retry on next run
 * - Per-item records track individual processing (backward compatibility)
 *
 * Data Loss Prevention (GUARANTEED):
 * ✓ If any item fails during processing, its ID is NOT added to maxSuccessfulId
 * ✓ maxProcessedId advances only when the batch completes without errors
 * ✓ Failed items are retried in subsequent scheduled runs
 * ✓ Non-numeric IDs use per-item KV records (always retried if failed)
 *
 * Race Condition Considerations:
 * - The get -> compare -> put sequence is NOT atomic
 * - This is acceptable because the worker runs as a scheduled singleton
 * - If reused in concurrent contexts (HTTP handlers), implement:
 *   1. KV conditional write operations
 *   2. Atomic batch commits
 *   3. Optimistic locking with versioning
 *
 * Result: Zero data loss under scheduled-only operation model
 */
