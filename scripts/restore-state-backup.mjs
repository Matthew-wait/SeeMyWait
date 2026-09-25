#!/usr/bin/env node
/**
 * Restores a state backup produced by scripts/backup-state.mjs. Upserts
 * every row from the backup file back in by npi, so this is safe to run
 * even if some of those rows still exist unchanged.
 *
 * Usage: node scripts/restore-state-backup.mjs NPI_Data/backups/FL_2026-09-26T01-15-00-000Z.json
 */
import { readFile } from "node:fs/promises";
import { pushToDb } from "./lib/nppes-pipeline.mjs";

const path = process.argv[2];
if (!path) { console.error("usage: node scripts/restore-state-backup.mjs <backup-file.json>"); process.exit(1); }

const URL = process.env.SUPABASE_URL || "https://ziisjgtvqmturpljnvfh.supabase.co";
const KEY = process.env.SUPABASE_SECRET_KEY;
if (!KEY) { console.error("SUPABASE_SECRET_KEY must be set"); process.exit(1); }

const rows = JSON.parse(await readFile(path, "utf8"));
console.log(`Restoring ${rows.length} rows from ${path}…`);
const n = await pushToDb(rows, { supabaseUrl: URL, supabaseKey: KEY, onProgress: (m) => console.log(m) });
console.log(`Restored ${n}/${rows.length} rows.`);
