import type { ProcessedRecord } from "../types.js";
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export interface StateEnv {
  db: Database.Database;
}

const MAX_PROCESSED_ID_KEY = "_max_processed_id";

export function openDatabase(dbPath: string): Database.Database {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS processed_items (
      ntt_no       TEXT PRIMARY KEY,
      event_id     TEXT NOT NULL,
      processed_at TEXT NOT NULL,
      hash         TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  return db;
}

export async function getProcessedRecord(env: StateEnv, id: string): Promise<ProcessedRecord | null> {
  const row = env.db
    .prepare<[string], { ntt_no: string; event_id: string; processed_at: string; hash: string }>(
      "SELECT ntt_no, event_id, processed_at, hash FROM processed_items WHERE ntt_no = ?"
    )
    .get(id);
  if (!row) return null;
  return {
    nttNo: row.ntt_no,
    eventId: row.event_id,
    processedAt: row.processed_at,
    hash: row.hash,
  };
}

export async function putProcessedRecord(
  env: StateEnv,
  id: string,
  record: ProcessedRecord,
): Promise<void> {
  env.db
    .prepare(
      `INSERT INTO processed_items (ntt_no, event_id, processed_at, hash)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(ntt_no) DO UPDATE SET
         event_id     = excluded.event_id,
         processed_at = excluded.processed_at,
         hash         = excluded.hash`
    )
    .run(id, record.eventId, record.processedAt, record.hash);
}

export async function getMaxProcessedId(env: StateEnv): Promise<number> {
  const row = env.db
    .prepare<[string], { value: string }>("SELECT value FROM meta WHERE key = ?")
    .get(MAX_PROCESSED_ID_KEY);
  if (!row) return 0;
  return Number.parseInt(row.value, 10) || 0;
}

export async function updateMaxProcessedId(env: StateEnv, id: string): Promise<void> {
  const numId = Number.parseInt(id, 10);
  if (Number.isNaN(numId)) {
    console.warn(`updateMaxProcessedId called with non-numeric id: "${id}"`);
    return;
  }
  env.db.transaction(() => {
    const row = env.db
      .prepare<[string], { value: string }>("SELECT value FROM meta WHERE key = ?")
      .get(MAX_PROCESSED_ID_KEY);
    const currentMax = row ? Number.parseInt(row.value, 10) || 0 : 0;
    if (numId > currentMax) {
      env.db
        .prepare(
          `INSERT INTO meta (key, value) VALUES (?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value`
        )
        .run(MAX_PROCESSED_ID_KEY, numId.toString());
    }
  })();
}
