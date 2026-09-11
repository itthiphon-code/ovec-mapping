/** Local-only learner search, private-document and supporting-attachment checks. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
const key = readFileSync(".dev.vars", "utf8")
  .match(/^LOCAL_TEST_KEY=(.+)$/m)?.[1]
  ?.trim()
  .replace(/^["']|["']$/g, "");
assert.ok(key);
const marker = `portal-qa-${Date.now()}`;
const emails = ["learner", "other", "registrar"].map(
  (role) => `${marker}-${role}@example.test`,
);
const ids = { emails, documents: [], applications: [] };
let checks = 0;
async function request(
  path,
  { email, method = "GET", body, expected = 200 } = {},
) {
  const r = await fetch(`http://localhost:3000/api/${path}`, {
    method,
    headers: {
      "x-test-key": key,
      ...(email ? { "x-test-email": email } : {}),
      ...(body && !(body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
    },
    body:
      body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  const data = r.headers.get("content-type")?.includes("json")
    ? await r.json()
    : await r.arrayBuffer();
  assert.equal(
    r.status,
    expected,
    `${path}: ${JSON.stringify(data).slice(0, 500)}`,
  );
  checks++;
  return data;
}
async function upload(email, kind) {
  const form = new FormData();
  form.set("title", marker + " " + kind);
  form.set("kind", kind);
  form.set(
    "file",
    new Blob(["%PDF-1.4\n% TEST ONLY local portal fixture\n%%EOF"], {
      type: "application/pdf",
    }),
    "portal-test-only.pdf",
  );
  const doc = await request("documents", {
    email,
    method: "POST",
    body: form,
    expected: 201,
  });
  ids.documents.push(doc.id);
  return doc.id;
}
try {
  const me = await request("me");
  assert.equal(me.user.role, "admin");
  for (const [i, email] of emails.entries())
    await request("members", {
      method: "POST",
      body: {
        email,
        name: "TEST ONLY portal",
        role: i === 2 ? "registrar" : "learner",
        scope: "TEST ONLY temporary portal check",
        validUntil: "2099-01-01",
        active: true,
      },
    });
  const cert = await request("certificates?pageSize=12"),
    next = await request("certificates?pageSize=12&page=2");
  assert.equal(cert.items.length, 12);
  assert.equal(cert.total, 1022);
  assert.ok(next.items.every((i) => !cert.items.some((j) => j.id === i.id)));
  const category = cert.items[0].category;
  const filtered = await request(
    "certificates?" + new URLSearchParams({ pageSize: "12", category }),
  );
  assert.ok(filtered.total > 0);
  assert.ok(filtered.items.every((i) => i.category === category));
  const course = await request(
    "bulk?" + new URLSearchParams({ q: "30104-2022", searchIn: "course" }),
  );
  assert.ok(course.items.length);
  assert.ok(
    course.items.every((c) =>
      (c.code + c.title + c.department).includes("30104-2022"),
    ),
  );
  const detail = await request(
    "bulk/" + encodeURIComponent(course.items[0].course_id),
  );
  assert.ok(detail.detail.pairs.length);
  for (const pair of detail.detail.pairs)
    assert.equal(
      (await request(`certificates/${pair.standardId}`)).standard.id,
      pair.standardId,
    );
  const main = await upload(emails[0], "CREDENTIAL"),
    extra = await upload(emails[0], "EVIDENCE"),
    foreign = await upload(emails[1], "EVIDENCE");
  await request(`documents/${extra}`, { email: emails[2], expected: 404 });
  const body = {
    name: "TEST ONLY learner",
    credentialNumber: marker,
    issuer: "TEST ONLY",
    courseCode: "30104-2022",
    note: "TEST ONLY portal",
    documentId: main,
  };
  for (const additionalDocumentIds of [
    [foreign],
    [main],
    [extra, extra],
    ["00000000-0000-4000-8000-000000000000"],
    Array(11).fill(extra),
  ]) {
    await request("applications", {
      email: emails[0],
      method: "POST",
      body: { ...body, additionalDocumentIds },
      expected: 422,
    });
  }
  const created = await request("applications", {
    email: emails[0],
    method: "POST",
    body: { ...body, additionalDocumentIds: [extra] },
    expected: 201,
  });
  ids.applications.push(created.id);
  const mine = await request("applications?mine=1", { email: emails[0] });
  const saved = JSON.parse(mine.items.find((a) => a.id === created.id).payload);
  assert.deepEqual(saved.additionalDocumentIds, [extra]);
  assert.equal(saved.credentialVerified, false);
  assert.equal(saved.decision, null);
  const other = await request("applications?mine=0", { email: emails[1] });
  assert.ok(other.items.every((a) => a.owner === emails[1]));
  const adminPersonal = await request("applications?mine=1");
  assert.ok(adminPersonal.items.every((a) => a.owner === me.user.email));
  assert.ok(
    (await request("applications")).items.some((a) => a.id === created.id),
  );
  for (const email of [emails[0], emails[2]])
    await request(`documents/${extra}`, { email });
  await request(`documents/${extra}`, { email: emails[1], expected: 404 });
  const privateDocs = await request("documents?mine=1");
  assert.ok(privateDocs.items.every((d) => d.owner === me.user.email));
  const learnerDocs = await request("documents?mine=0", { email: emails[0] });
  assert.ok(learnerDocs.items.every((d) => d.owner === emails[0]));
  const legacy = await request("applications", {
    email: emails[0],
    method: "POST",
    body,
    expected: 201,
  });
  ids.applications.push(legacy.id);
  for (const [path, text] of [
    ["/", "OVEC Mapping"],
    ["/prepare", "15 MB"],
    ["/help", "https://www.tpqi.go.th/e-service/tpqi-net/"],
    ["/documents", "OVEC Mapping"],
    ["/applications", "OVEC Mapping"],
    ["/dashboard", "OVEC Mapping"],
  ]) {
    const r = await fetch("http://localhost:3000" + path);
    assert.equal(r.status, 200);
    assert.ok((await r.text()).includes(text));
    checks++;
  }
  console.log(
    `PASS: ${checks} learner-portal HTTP checks; filtered search, private views, attachments, legacy requests and pages`,
  );
} finally {
  mkdirSync("tmp", { recursive: true });
  writeFileSync("tmp/portal-test-cleanup.json", JSON.stringify(ids));
  execFileSync("python3", [
    "-c",
    `import json,sqlite3,pathlib
x=json.load(open('tmp/portal-test-cleanup.json'))
for p in pathlib.Path('.wrangler').rglob('*.sqlite'):
 c=sqlite3.connect(p);tables={r[0] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table'")}
 if 'applications' not in tables:c.close();continue
 for table in ['applications','documents']:
  for ident in x[table]:c.execute('DELETE FROM '+table+' WHERE id=?',(ident,));c.execute('DELETE FROM audit WHERE entity_id=?',(ident,))
 for email in x['emails']:
  c.execute('DELETE FROM audit WHERE actor=? OR entity_id=?',(email,email));c.execute('DELETE FROM members WHERE email=?',(email,))
 c.commit();c.close()
`,
  ]);
}
