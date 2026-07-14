import path from "node:path";
import { fileURLToPath } from "node:url";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, "..", "data", "ipdcec.sqlite");

export async function getDb() {
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  await db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS registrations (
      id TEXT PRIMARY KEY,
      submitted_at TEXT NOT NULL,
      updated_at TEXT,
      status TEXT NOT NULL,
      participant_type TEXT NOT NULL,
      leader_name TEXT NOT NULL,
      member_2 TEXT,
      member_3 TEXT,
      email TEXT NOT NULL,
      whatsapp TEXT NOT NULL,
      school_name TEXT NOT NULL,
      country TEXT NOT NULL,
      poster_title TEXT NOT NULL,
      subtheme TEXT NOT NULL,
      files_json TEXT NOT NULL DEFAULT '[]'
    );
  `);

  return db;
}
