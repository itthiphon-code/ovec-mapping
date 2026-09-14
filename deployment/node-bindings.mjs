import { DatabaseSync } from "node:sqlite";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, createReadStream } from "node:fs";
import { readFile, writeFile, rename, unlink, stat } from "node:fs/promises";
import { resolve, join, sep } from "node:path";
import { Readable } from "node:stream";

export class SqliteBinding {
  constructor(path) {
    this.connection = new DatabaseSync(path);
    this.connection.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;");
  }
  prepare(sql) {
    const connection = this.connection;
    function prepared(args = []) {
      const execute = () => {
        const results = connection.prepare(sql).all(...args);
        const meta = connection.prepare("SELECT changes() AS changes, last_insert_rowid() AS last_row_id").get();
        return { success: true, results, meta: { ...meta, duration: 0 } };
      };
      return {
        bind: (...values) => prepared(values),
        all: async () => execute(),
        run: async () => execute(),
        first: async (column) => {
          const row = connection.prepare(sql).get(...args);
          return row ? (column ? row[column] : row) : null;
        },
        raw: async (options) => {
          const statement = connection.prepare(sql);
          statement.setReturnArrays(true);
          const rows = statement.all(...args);
          return options?.columnNames ? [statement.columns().map((c) => c.name), ...rows] : rows;
        },
        execute,
      };
    }
    return prepared();
  }
  async batch(statements) {
    this.connection.exec("BEGIN IMMEDIATE");
    try {
      const results = statements.map((statement) => statement.execute());
      this.connection.exec("COMMIT");
      return results;
    } catch (error) {
      this.connection.exec("ROLLBACK");
      throw error;
    }
  }
  async exec(sql) {
    this.connection.exec(sql);
    return { count: 1, duration: 0 };
  }
  close() { this.connection.close(); }
}

export class DocumentBucket {
  constructor(directory) {
    this.directory = directory;
    mkdirSync(directory, { recursive: true, mode: 0o700 });
  }
  path(key) {
    return join(this.directory, createHash("sha256").update(key).digest("hex"));
  }
  async put(key, value) {
    const target = this.path(key);
    const temp = `${target}.${randomUUID()}.tmp`;
    const bytes = value instanceof ArrayBuffer ? Buffer.from(value) :
      ArrayBuffer.isView(value) ? Buffer.from(value.buffer, value.byteOffset, value.byteLength) :
      Buffer.from(await new Response(value).arrayBuffer());
    try {
      await writeFile(temp, bytes, { mode: 0o600, flag: "wx", flush: true });
      await rename(temp, target);
    } finally {
      await unlink(temp).catch((error) => { if (error.code !== "ENOENT") throw error; });
    }
    return { key, size: bytes.length };
  }
  async get(key) {
    const path = this.path(key);
    try {
      const info = await stat(path);
      return { key, size: info.size, body: Readable.toWeb(createReadStream(path)),
        arrayBuffer: async () => { const b = await readFile(path); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); } };
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
  }
  async delete(key) {
    await unlink(this.path(key)).catch((error) => { if (error.code !== "ENOENT") throw error; });
  }
}

export function createBindings({ dataDir, assetsDir, adminEmail = "itp@utc.ac.th" }) {
  const root = resolve(dataDir);
  const assets = resolve(assetsDir);
  mkdirSync(root, { recursive: true, mode: 0o700 });
  return {
    DB: new SqliteBinding(join(root, "mapping.sqlite")),
    DOCUMENTS: new DocumentBucket(join(root, "documents")),
    ADMIN_EMAIL: adminEmail,
    AUTH_MODE: "password",
    ASSETS: {
      async fetch(request) {
        let pathname;
        try { pathname = decodeURIComponent(new URL(request.url).pathname); }
        catch { return new Response(null, { status: 400 }); }
        const file = resolve(assets, `.${pathname}`);
        if (!file.startsWith(assets + sep)) return new Response(null, { status: 404 });
        try { return new Response(await readFile(file)); }
        catch (error) {
          if (["ENOENT", "EISDIR", "ENOTDIR"].includes(error.code)) return new Response(null, { status: 404 });
          throw error;
        }
      },
    },
  };
}

let bindings;
export const env = new Proxy({}, {
  get(_, property) {
    if (!bindings) {
      if (!process.env.MAPPING_DATA_DIR) throw new Error("MAPPING_DATA_DIR is required for the Node deployment");
      bindings = createBindings({ dataDir: process.env.MAPPING_DATA_DIR,
        assetsDir: process.env.MAPPING_ASSETS_DIR || "dist/client", adminEmail: process.env.ADMIN_EMAIL });
    }
    return bindings[property];
  },
});
