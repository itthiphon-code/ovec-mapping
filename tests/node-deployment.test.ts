import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqliteBinding, DocumentBucket, createBindings } from "../deployment/node-bindings.mjs";
import { AuthStore, LoginLimiter } from "../deployment/auth-store.mjs";
import { cleanProxyHeaders, safeReturn } from "../deployment/server.mjs";

test("Node database batch rolls back all statements and persists committed rows", async () => {
  const dir = await mkdtemp(join(tmpdir(), "mapping-db-"));
  let db = new SqliteBinding(join(dir, "test.sqlite"));
  try {
    await db.exec("CREATE TABLE values_test(id INTEGER PRIMARY KEY, value TEXT UNIQUE)");
    await assert.rejects(db.batch([
      db.prepare("INSERT INTO values_test VALUES (?,?)").bind(1, "duplicate"),
      db.prepare("INSERT INTO values_test VALUES (?,?)").bind(2, "duplicate"),
    ]));
    assert.equal(await db.prepare("SELECT count(*) AS n FROM values_test").first("n"), 0);
    const result = await db.batch([db.prepare("INSERT INTO values_test VALUES (?,?) RETURNING id").bind(3, "saved")]);
    assert.equal(result[0].meta.changes, 1);
    assert.equal(result[0].results[0].id, 3);
    db.close(); db = new SqliteBinding(join(dir, "test.sqlite"));
    assert.equal(await db.prepare("SELECT value FROM values_test WHERE id=?").bind(3).first("value"), "saved");
    assert.deepEqual(await db.prepare("SELECT id,value FROM values_test").raw(), [[3, "saved"]]);
  } finally { db.close(); await rm(dir, { recursive: true, force: true }); }
});

test("Document storage persists exact bytes and does not interpret keys as paths", async () => {
  const dir = await mkdtemp(join(tmpdir(), "mapping-files-"));
  try {
    const bucket = new DocumentBucket(join(dir, "objects"));
    const bytes = new TextEncoder().encode("private document");
    await bucket.put("../../secret.pdf", bytes);
    const restarted = new DocumentBucket(join(dir, "objects"));
    assert.equal(await new Response((await restarted.get("../../secret.pdf"))!.body as unknown as ReadableStream).text(), "private document");
    await restarted.delete("../../secret.pdf");
    assert.equal(await restarted.get("../../secret.pdf"), null);
    await restarted.delete("../../secret.pdf");
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("Asset binding refuses encoded traversal outside the public directory", async () => {
  const dir = await mkdtemp(join(tmpdir(), "mapping-assets-"));
  const bindings = createBindings({ dataDir: join(dir, "data"), assetsDir: join(dir, "public") });
  try {
    await writeFile(join(dir, "secret"), "secret");
    const response = await bindings.ASSETS.fetch(new Request("https://mapping.test/%2e%2e%2fsecret"));
    assert.equal(response.status, 404);
  } finally { bindings.DB.close(); await rm(dir, { recursive: true, force: true }); }
});

test("Password sessions survive restart, expire, and are revoked by password changes", async () => {
  const dir = await mkdtemp(join(tmpdir(), "mapping-auth-"));
  let auth = new AuthStore(join(dir, "auth.sqlite"));
  try {
    await auth.createUser("Member@Example.test", "Initial-test-password-123");
    assert.equal(await auth.authenticate("member@example.test", "wrong"), null);
    assert.ok(await auth.authenticate("MEMBER@example.test", "Initial-test-password-123"));
    const token = auth.issue("member@example.test");
    assert.equal(auth.session(token)?.must_change, 1);
    auth.close(); auth = new AuthStore(join(dir, "auth.sqlite"));
    assert.equal(auth.session(token)?.email, "member@example.test");
    await auth.changePassword("member@example.test", "Changed-test-password-456");
    assert.equal(auth.session(token), null);
    const fresh = auth.issue("member@example.test");
    assert.equal(auth.session(fresh)?.must_change, 0);
    auth.db.prepare("UPDATE sessions SET expires=0").run();
    assert.equal(auth.session(fresh), null);
    assert.notEqual(auth.account("member@example.test")?.password_hash, "Changed-test-password-456");
  } finally { auth.close(); await rm(dir, { recursive: true, force: true }); }
});

test("Gateway removes forged identities and only injects a verified session", () => {
  const origin = new URL("https://mapping.utc.ac.th");
  const spoofed = { "oai-authenticated-user-email": "admin@example.test", "OAI-other": "x", "x-test-email": "admin@example.test", "x-forwarded-host": "evil.test", cookie: "session" };
  const anonymous = cleanProxyHeaders(spoofed, null, origin);
  assert.equal(anonymous["oai-authenticated-user-email"], undefined);
  assert.equal(anonymous["x-test-email"], undefined);
  assert.equal(anonymous["x-forwarded-host"], "mapping.utc.ac.th");
  assert.equal(cleanProxyHeaders(spoofed, { email: "learner@example.test", must_change: 0 }, origin)["oai-authenticated-user-email"], "learner@example.test");
  assert.equal(cleanProxyHeaders(spoofed, { email: "learner@example.test", must_change: 1 }, origin)["oai-authenticated-user-email"], undefined);
  for (const value of ["https://evil.test/", "//evil.test/", "/\\evil.test/", "/auth/login"]) assert.equal(safeReturn(value), "/");
  assert.equal(safeReturn("/documents?mine=1"), "/documents?mine=1");
  const limiter = new LoginLimiter();
  for (let attempt = 0; attempt < 5; attempt++) assert.equal(limiter.take("test"), true);
  assert.equal(limiter.take("test"), false);
});
