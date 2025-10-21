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
  return raw ? Number.parseInt(raw, 10) : 0;
}

export async function updateMaxProcessedId(env: StateEnv, id: string): Promise<void> {
  const numId = Number.parseInt(id, 10);
  const currentMax = await getMaxProcessedId(env);
  if (numId > currentMax) {
    await env.PROCESSED_STORE.put(MAX_PROCESSED_ID_KEY, numId.toString());
  }
}
