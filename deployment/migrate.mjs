import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export function migrateDatabase(dataDir, migrationsDir = "drizzle") {
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(join(dataDir, "mapping.sqlite"));
  try {
    db.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;");
    db.exec("CREATE TABLE IF NOT EXISTS _mapping_migrations(name TEXT PRIMARY KEY, hash TEXT NOT NULL, applied_at TEXT NOT NULL)");
    for (const name of readdirSync(migrationsDir).filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort()) {
      const sql = readFileSync(join(migrationsDir, name), "utf8");
      const hash = createHash("sha256").update(sql).digest("hex");
      const applied = db.prepare("SELECT hash FROM _mapping_migrations WHERE name=?").get(name);
      if (applied) {
        if (applied.hash !== hash) throw new Error(`Previously applied migration was modified: ${name}`);
        continue;
      }
      db.exec("BEGIN IMMEDIATE");
      try {
        db.exec(sql);
        db.prepare("INSERT INTO _mapping_migrations VALUES(?,?,?)").run(name, hash, new Date().toISOString());
        db.exec("COMMIT");
      } catch (error) { db.exec("ROLLBACK"); throw error; }
    }
  } finally { db.close(); }
}
