/** Integration checks use a disposable local DB and real production authentication. */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = await mkdtemp(join(tmpdir(), "ovec-node-http-"));
const base = "http://localhost:3219";
process.env.NODE_ENV = "production";
process.env.MAPPING_DATA_DIR = root;
process.env.APP_ORIGIN = base;
process.env.ADMIN_EMAIL = "admin@example.test";
process.env.VINEXT_TRUST_PROXY = "1";
process.env.VINEXT_TRUSTED_HOSTS = "localhost:3219";
const { startMappingServer } = await import("../deployment/server.mjs");
const { env } = await import("../deployment/node-bindings.mjs");
const service = await startMappingServer({ port: 3219, host: "127.0.0.1" });
let checks = 0;
async function request(path, { cookie, method = "GET", body, expected = 200, headers = {} } = {}) {
  const response = await fetch(base + path, { method, redirect: "manual", headers: {
    Origin: base, ...(cookie ? { Cookie: cookie } : {}),
    ...(body && !(body instanceof FormData) && !(body instanceof URLSearchParams) ? { "Content-Type": "application/json" } : {}), ...headers,
  }, body: body instanceof FormData || body instanceof URLSearchParams ? body : body ? JSON.stringify(body) : undefined });
  assert.equal(response.status, expected, `${path}: ${response.status}`); checks++;
  return response;
}
async function login(email) {
  await service.auth.createUser(email, "Initial-local-password-123!");
  const signed = await request("/auth/login", { method: "POST", body: new URLSearchParams({ email, password: "Initial-local-password-123!" }), expected: 303 });
  let cookie = signed.headers.get("set-cookie").split(";")[0];
  assert.equal(signed.headers.get("location"), "/auth/password");
  assert.equal((await (await request("/api/me", { cookie })).json()).user, null);
  const changed = await request("/auth/password", { cookie, method: "POST", body: new URLSearchParams({ current: "Initial-local-password-123!", password: "Changed-local-password-456!", confirm: "Changed-local-password-456!" }), expected: 303 });
  cookie = changed.headers.get("set-cookie").split(";")[0];
  return cookie;
}
async function upload(cookie, kind) {
  const form = new FormData(); form.set("title", "TEST ONLY node"); form.set("kind", kind);
  form.set("file", new Blob(["%PDF-1.4\n% local fixture\n%%EOF"], { type: "application/pdf" }), "test.pdf");
  return (await (await request("/api/documents", { cookie, method: "POST", body: form, expected: 201 })).json()).id;
}
try {
  await request("/api/health");
  const forged = await (await request("/api/me", { headers: { "oai-authenticated-user-email": "admin@example.test", "x-test-email": "admin@example.test", "x-test-key": "anything" } })).json();
  assert.equal(forged.user, null); assert.equal(forged.local, false); assert.equal(forged.authMode, "password");
  await request("/api/members", { method: "POST", body: {}, expected: 401 });
  await request("/auth/login", { method: "POST", body: new URLSearchParams(), headers: { Origin: "https://evil.test" }, expected: 403 });
  await request("/api/certificates?pageSize=12");
  const admin = await login("admin@example.test");
  assert.equal((await (await request("/api/me", { cookie: admin })).json()).user.role, "admin");
  const learner = await login("learner@example.test");
  const other = await login("other@example.test");
  assert.equal((await (await request("/api/me", { cookie: learner })).json()).user.role, "learner");
  await request("/auth/accounts", { cookie: learner, expected: 403 });
  await request("/auth/accounts", { cookie: admin });
  await request("/api/members", { cookie: learner, method: "POST", body: {}, expected: 403 });
  const credential = await upload(learner, "CREDENTIAL");
  const extra = await upload(learner, "EVIDENCE");
  const foreign = await upload(other, "EVIDENCE");
  await request(`/api/documents/${credential}`, { expected: 401 });
  await request(`/api/documents/${credential}`, { cookie: other, expected: 404 });
  assert.ok((await (await request(`/api/documents/${credential}`, { cookie: learner })).text()).startsWith("%PDF-1.4"));
  const body = { name: "TEST ONLY", credentialNumber: "LOCAL-TEST", issuer: "TEST ONLY", courseCode: "30104-2022", note: "TEST ONLY", documentId: credential };
  await request("/api/applications", { cookie: learner, method: "POST", body: { ...body, additionalDocumentIds: [foreign] }, expected: 422 });
  const application = await (await request("/api/applications", { cookie: learner, method: "POST", body: { ...body, additionalDocumentIds: [extra] }, expected: 201 })).json();
  const own = await (await request("/api/applications?mine=1", { cookie: learner })).json();
  assert.ok(own.items.some((item) => item.id === application.id));
  assert.equal((await (await request("/api/applications?mine=0", { cookie: other })).json()).items.length, 0);
  for (const path of ["/", "/header", "/prepare", "/help", "/documents", "/applications", "/dashboard"]) await request(path);
  const found = await (await request("/api/bulk?q=30104-2022&searchIn=course")).json();
  assert.ok(found.items.length);
  await request(`/api/bulk/${encodeURIComponent(found.items[0].course_id)}`);
  await request("/auth/logout", { cookie: learner, method: "POST", expected: 303 });
  assert.equal((await (await request("/api/me", { cookie: learner })).json()).user, null);
  console.log(`PASS: ${checks} production-mode HTTP checks with real sessions and private attachments`);
} finally {
  await new Promise((resolve) => service.server.close(resolve));
  await new Promise((resolve) => service.internal.server.close(resolve));
  service.auth.close(); env.DB.close();
  await rm(root, { recursive: true, force: true });
}
