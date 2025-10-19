import type { ProcessedRecord } from "../types";

export interface StateEnv {
  PROCESSED_STORE: KVNamespace;
}

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
