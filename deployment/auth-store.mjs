import { DatabaseSync } from "node:sqlite";
import { randomBytes, createHash, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const derive = promisify(scrypt);
const digest = (value) => createHash("sha256").update(value).digest("hex");
export const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
export function validatePassword(password) {
  if (typeof password !== "string" || password.length < 12 || password.length > 128)
    throw new Error("รหัสผ่านต้องมีความยาว 12–128 ตัวอักษร");
}
export async function hashPassword(password) {
  validatePassword(password);
  const salt = randomBytes(16).toString("hex");
  const key = await derive(password, salt, 32, { N: 65536, r: 8, p: 2, maxmem: 128 * 1024 * 1024 });
  return `scrypt-v1:${salt}:${key.toString("hex")}`;
}
export async function verifyPassword(password, encoded) {
  if (typeof password !== "string" || password.length > 128) return false;
  const [version, salt, expected] = encoded.split(":");
  if (version !== "scrypt-v1" || !/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{64}$/.test(expected)) return false;
  const actual = await derive(password, salt, 32, { N: 65536, r: 8, p: 2, maxmem: 128 * 1024 * 1024 });
  return timingSafeEqual(actual, Buffer.from(expected, "hex"));
}

export class AuthStore {
  constructor(path) {
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS accounts(email TEXT PRIMARY KEY, password_hash TEXT NOT NULL, must_change INTEGER NOT NULL DEFAULT 1, active INTEGER NOT NULL DEFAULT 1);
      CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY, email TEXT NOT NULL REFERENCES accounts(email) ON DELETE CASCADE, expires INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS session_email ON sessions(email);`);
  }
  async createUser(email, password) {
    email = normalizeEmail(email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error("อีเมลไม่ถูกต้อง");
    const hash = await hashPassword(password);
    this.db.prepare("INSERT INTO accounts(email,password_hash) VALUES (?,?)").run(email, hash);
    return email;
  }
  account(email) { return this.db.prepare("SELECT * FROM accounts WHERE email=?").get(normalizeEmail(email)); }
  async authenticate(email, password) {
    const user = this.account(email);
    // Run the same KDF for unknown accounts to avoid a fast user-enumeration path.
    const dummy = `scrypt-v1:${"0".repeat(32)}:${"0".repeat(64)}`;
    const valid = await verifyPassword(password, user?.password_hash || dummy);
    return user?.active && valid ? user : null;
  }
  session(token) {
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
    return this.db.prepare("SELECT accounts.email, accounts.must_change FROM sessions JOIN accounts USING(email) WHERE token_hash=? AND expires>? AND active=1").get(digest(token), Date.now()) || null;
  }
  issue(email) {
    const token = randomBytes(32).toString("hex");
    this.db.prepare("DELETE FROM sessions WHERE expires<=?").run(Date.now());
    this.db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(digest(token), email, Date.now() + 8 * 3600_000);
    return token;
  }
  revoke(token) { if (token) this.db.prepare("DELETE FROM sessions WHERE token_hash=?").run(digest(token)); }
  async changePassword(email, password) {
    const hash = await hashPassword(password);
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db.prepare("UPDATE accounts SET password_hash=?, must_change=0 WHERE email=?").run(hash, email);
      this.db.prepare("DELETE FROM sessions WHERE email=?").run(email);
      this.db.exec("COMMIT");
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  close() { this.db.close(); }
}

export class LoginLimiter {
  constructor() { this.entries = new Map(); this.inFlight = 0; }
  take(key) {
    const now = Date.now();
    for (const [id, item] of this.entries) if (item.until <= now) this.entries.delete(id);
    const current = this.entries.get(key) || { count: 0, until: now + 15 * 60_000 };
    if (current.count >= 5 || this.inFlight >= 2 || this.entries.size >= 5000) return false;
    current.count++;
    this.entries.set(key, current);
    return true;
  }
}
