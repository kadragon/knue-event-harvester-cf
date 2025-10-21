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
 * Race Condition:
 * - The get -> compare -> put sequence is NOT atomic
 * - This is acceptable because the worker runs as a scheduled singleton
 * - If reused in concurrent contexts (HTTP handlers), implement atomic operations
 *
 * Data Loss Prevention:
 * - Failed items are NOT marked in per-item records (getProcessedRecord/putProcessedRecord)
 * - Only successful items update maxProcessedId
 * - Failures are retried in subsequent scheduled runs
 * - Mitigation: If processing fails after maxProcessedId is updated, the failed item
 *   will be retried on the next run if its ID is >= the stored maxProcessedId
 * - For safety-critical scenarios, consider: atomic updates, batch commits, or checksums
 */
