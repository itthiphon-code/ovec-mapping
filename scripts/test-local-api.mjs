/** Integration checks against the local worker only. Synthetic cases are removed afterward. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
const base = "http://localhost:3000/api";
const vars = readFileSync(".dev.vars", "utf8");
const key = vars
  .match(/^LOCAL_TEST_KEY=(.+)$/m)?.[1]
  ?.trim()
  .replace(/^["']|["']$/g, "");
assert.ok(key, "Set a local-only LOCAL_TEST_KEY in .dev.vars");
const marker = `compass-qa-${Date.now()}`;
const emails = Object.fromEntries(
  ["author", "tpqi", "course", "approver", "learner", "registrar"].map(
    (role) => [role, `${marker}-${role}@example.test`],
  ),
);
const ids = {
  mappings: [],
  documents: [],
  applications: [],
  emails: Object.values(emails),
};
let checks = 0;
async function request(
  path,
  { method = "GET", body, email, expected = 200 } = {},
) {
  const headers = { "x-test-key": key };
  if (email) headers["x-test-email"] = email;
  if (body && !(body instanceof FormData))
    headers["Content-Type"] = "application/json";
  const r = await fetch(`${base}/${path}`, {
    method,
    headers,
    body:
      body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  const data = r.headers.get("content-type")?.includes("json")
    ? await r.json()
    : await r.arrayBuffer();
  assert.equal(
    r.status,
    expected,
    `${method} ${path}: ${JSON.stringify(data)}`,
  );
  checks++;
  return data;
}
try {
  assert.equal((await request("me")).user.role, "admin");
  for (const [role, email] of Object.entries(emails))
    await request("members", {
      method: "POST",
      body: {
        email,
        name: `TEST ONLY ${role}`,
        role:
          { author: "editor", tpqi: "expert_tpqi", course: "expert_course" }[
            role
          ] || role,
        scope: "TEST ONLY temporary appointment",
        validUntil: "2099-01-01",
        active: true,
      },
    });
  await request("admin", { email: emails.learner, expected: 403 });
  await request("mappings", {
    method: "POST",
    email: emails.learner,
    body: {},
    expected: 403,
  });
  const courseId = "course:20101:20100-1001",
    standardId = "standard:104";
  await request(`catalog/${encodeURIComponent(courseId)}`);
  await request(`catalog/${encodeURIComponent(standardId)}`);
  const created = await request("mappings", {
    method: "POST",
    email: emails.author,
    body: { courseId, standardId, levelName: "ระดับ 3" },
    expected: 201,
  });
  const id = created.id;
  ids.mappings.push(id);
  await request(`mappings/${id}`, { email: emails.learner, expected: 404 });
  await request(`mappings/${id}/submit`, {
    method: "POST",
    email: emails.author,
    body: { revision: 1 },
    expected: 422,
  });
  await request(`mappings/${id}/publish`, {
    method: "POST",
    body: { revision: 1 },
    expected: 422,
  });
  const detail = await request(`mappings/${id}`, { email: emails.author });
  const p = JSON.parse(detail.mapping.payload);
  const edit = {
    revision: 1,
    rows: p.rows,
    referenceStatus: p.referenceStatus,
    referenceNote: p.referenceNote,
    scopeConfirmed: false,
    sourceVerified: false,
    reviewers: [],
    policyNote: "TEST ONLY: no real academic conclusion",
  };
  await request(`mappings/${id}`, {
    method: "PATCH",
    email: emails.author,
    body: { ...edit, rows: edit.rows.slice(1) },
    expected: 422,
  });
  await request(`mappings/${id}`, {
    method: "PATCH",
    email: emails.author,
    body: {
      ...edit,
      rows: edit.rows.map((r, i) =>
        i ? r : { ...r, standardUrl: "https://evil.test/file.pdf" },
      ),
    },
    expected: 422,
  });
  await request(`mappings/${id}`, {
    method: "PATCH",
    email: emails.author,
    body: edit,
  });
  await request(`mappings/${id}`, {
    method: "PATCH",
    email: emails.author,
    body: edit,
    expected: 409,
  });
  const actual = await request(`mappings/${id}`, { email: emails.author });
  assert.equal(actual.history.length, 2);
  assert.notEqual(actual.mapping.content_hash, detail.mapping.content_hash);
  // Explicit test fixture: no FULL matches or real expert decisions are introduced.
  const fixture = {
    ...edit,
    revision: 2,
    scopeConfirmed: true,
    sourceVerified: true,
    referenceStatus: "VERIFIED",
    referenceNote:
      "TEST ONLY: synthetic workflow verification, not a verified standard reference",
    reviewers: [emails.tpqi, emails.course],
    rows: edit.rows.map((r) => ({
      ...r,
      status: "NONE",
      reason: "TEST ONLY unrelated standard used to verify workflow gates",
    })),
  };
  await request(`mappings/${id}`, {
    method: "PATCH",
    email: emails.author,
    body: fixture,
  });
  await request(`mappings/${id}/submit`, {
    method: "POST",
    email: emails.author,
    body: { revision: 3 },
  });
  await request(`mappings/${id}/review`, {
    method: "POST",
    email: emails.author,
    body: {
      revision: 3,
      verdict: "ACCEPT",
      comment: "TEST ONLY author rejection",
    },
    expected: 403,
  });
  await request(`mappings/${id}/approve`, {
    method: "POST",
    email: emails.approver,
    body: { revision: 3 },
    expected: 422,
  });
  for (const role of ["tpqi", "course"])
    await request(`mappings/${id}/review`, {
      method: "POST",
      email: emails[role],
      body: {
        revision: 3,
        verdict: "ACCEPT",
        comment:
          "TEST ONLY accepts that this fixture has no matching competencies",
      },
    });
  await request(`mappings/${id}/review`, {
    method: "POST",
    email: emails.tpqi,
    body: {
      revision: 3,
      verdict: "ACCEPT",
      comment: "TEST ONLY duplicate decision",
    },
    expected: 409,
  });
  await request(`mappings/${id}/approve`, {
    method: "POST",
    email: emails.approver,
    body: { revision: 3 },
  });
  await request(`mappings/${id}`, {
    method: "PATCH",
    email: emails.author,
    body: { ...fixture, revision: 3 },
    expected: 403,
  });
  // Keep the test case unpublished; ensure the approved report source is readable.
  const final = await request(`mappings/${id}`, { email: emails.author });
  assert.equal(final.mapping.status, "APPROVED");
  assert.equal(final.reviews.length, 2);
  const bad = new FormData();
  bad.set("title", marker);
  bad.set("kind", "CREDENTIAL");
  bad.set(
    "file",
    new Blob(["not a PDF"], { type: "application/pdf" }),
    "invalid.pdf",
  );
  await request("documents", {
    method: "POST",
    email: emails.learner,
    body: bad,
    expected: 422,
  });
  const form = new FormData();
  form.set("title", `${marker} TEST ONLY`);
  form.set("kind", "CREDENTIAL");
  form.set(
    "file",
    new Blob(["%PDF-1.4\n% TEST ONLY local storage fixture\n%%EOF"], {
      type: "application/pdf",
    }),
    "test-only.pdf",
  );
  const doc = await request("documents", {
    method: "POST",
    email: emails.learner,
    body: form,
    expected: 201,
  });
  ids.documents.push(doc.id);
  await request(`documents/${doc.id}`, { email: emails.author, expected: 404 });
  await request(`documents/${doc.id}`, { email: emails.learner });
  const appBody = {
    name: "TEST ONLY learner",
    credentialNumber: marker,
    issuer: "TEST ONLY",
    courseCode: "20100-1001",
    note: "TEST ONLY",
    documentId: doc.id,
  };
  await request("applications", {
    method: "POST",
    email: emails.author,
    body: appBody,
    expected: 422,
  });
  const application = await request("applications", {
    method: "POST",
    email: emails.learner,
    body: appBody,
    expected: 201,
  });
  ids.applications.push(application.id);
  await request(`documents/${doc.id}`, { email: emails.registrar });
  await request(`applications/${application.id}`, {
    method: "POST",
    email: emails.registrar,
    body: {
      revision: 1,
      status: "ASSESSMENT",
      note: "TEST ONLY needs assessment",
    },
  });
  await request(`applications/${application.id}`, {
    method: "POST",
    email: emails.registrar,
    body: {
      revision: 1,
      status: "ASSESSMENT",
      note: "TEST ONLY outdated request",
    },
    expected: 409,
  });
  await request(`applications/${application.id}`, {
    method: "POST",
    email: emails.registrar,
    body: {
      revision: 2,
      status: "APPROVED",
      note: "TEST ONLY no policy decision",
    },
    expected: 422,
  });
  const csrf = await fetch(`${base}/mappings`, {
    method: "POST",
    headers: {
      origin: "https://evil.test",
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  assert.equal(csrf.status, 403);
  checks++;
  const search = await request("catalog?kind=course&q=20100-1001");
  assert.equal(search.source, "live");
  assert.ok(search.items.length);
  console.log(
    `PASS: ${checks} local HTTP checks; revision, evidence, expert, document and application gates`,
  );
} finally {
  mkdirSync("tmp", { recursive: true });
  writeFileSync("tmp/api-test-cleanup.json", JSON.stringify(ids));
  execFileSync("python3", [
    "-c",
    `import json,sqlite3,pathlib
x=json.load(open('tmp/api-test-cleanup.json'))
for p in pathlib.Path('.wrangler').rglob('*.sqlite'):
 c=sqlite3.connect(p);tables={r[0] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table'")}
 if 'mappings' not in tables: c.close();continue
 for mid in x['mappings']:
  c.execute('DELETE FROM reviews WHERE mapping_id=?',(mid,));c.execute('DELETE FROM revisions WHERE mapping_id=?',(mid,));c.execute('DELETE FROM mappings WHERE id=?',(mid,))
 for table in ['applications','documents']:
  for ident in x[table]:c.execute('DELETE FROM '+table+' WHERE id=?',(ident,))
 for email in x['emails']:
  c.execute('DELETE FROM audit WHERE actor=? OR entity_id=?',(email,email));c.execute('DELETE FROM members WHERE email=?',(email,))
 c.commit();c.close()
`,
  ]);
}
