/** Local-only checks against the real, precomputed public corpus. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const key = readFileSync(".dev.vars", "utf8")
  .match(/^LOCAL_TEST_KEY=(.+)$/m)?.[1]
  ?.trim()
  .replace(/^["']|["']$/g, "");
assert.ok(key);
const outsider = `bulk-qa-${Date.now()}@example.test`;
const cleanup = [];
let checks = 0;
async function request(
  path,
  { method = "GET", body, expected = 200, email } = {},
) {
  const r = await fetch("http://localhost:3000/api/" + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-test-key": key,
      ...(email ? { "x-test-email": email } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const v = await r.json();
  assert.equal(
    r.status,
    expected,
    `${path}: ${JSON.stringify(v).slice(0, 600)}`,
  );
  checks++;
  return v;
}
try {
  const page = await request("bulk");
  assert.equal(page.total, 6900);
  assert.equal(page.manifest.computed, 6277);
  assert.equal(page.manifest.pairs, 18831);
  assert.equal(page.items.length, 25);
  const next = await request("bulk?page=2");
  assert.ok(next.items.every((x) => !page.items.some((y) => y.id === x.id)));
  const empty = await request("bulk?q=not-a-real-course-xyz");
  assert.equal(empty.total, 0);
  const missing = await request("bulk?status=INSUFFICIENT_DATA");
  assert.equal(missing.total, 11);
  assert.ok(missing.items.every((x) => x.score === null));
  const excluded = await request("bulk?status=OUT_OF_SCOPE");
  assert.equal(excluded.total, 612);
  const high = await request("bulk?min=95&sort=score");
  assert.ok(high.items.every((x) => x.score >= 950));
  const wrong = await request("bulk?status=LEVEL_MISMATCH");
  assert.equal(wrong.total, page.manifest.blocked);
  const wrongDetail = await request(
    "bulk/" + encodeURIComponent(wrong.items[0].course_id),
  );
  await request(
    "bulk/" + encodeURIComponent(wrong.items[0].course_id) + "/adopt",
    {
      method: "POST",
      body: { pairId: wrongDetail.detail.pairs[0].id },
      expected: 422,
    },
  );
  let selected;
  for (const row of page.items) {
    const d = await request("bulk/" + encodeURIComponent(row.course_id));
    if (
      d.detail.course?.pdfUrl &&
      d.detail.pairs[0] &&
      !d.detail.pairs[0].mismatch
    ) {
      selected = d;
      break;
    }
  }
  assert.ok(selected);
  const id = selected.row.course_id,
    pair = selected.detail.pairs[0];
  assert.ok(pair.matches.length);
  assert.equal(Math.round(pair.score * 10), selected.row.score);
  await request("bulk/" + encodeURIComponent(id) + "/adopt", {
    method: "POST",
    body: { pairId: pair.id },
    email: outsider,
    expected: 403,
  });
  await request("bulk/" + encodeURIComponent(id) + "/adopt", {
    method: "POST",
    body: { pairId: "invented" },
    expected: 422,
  });
  const draft = await request("bulk/" + encodeURIComponent(id) + "/adopt", {
    method: "POST",
    body: { pairId: pair.id },
    expected: 201,
  });
  cleanup.push(draft.id);
  const repeated = await request("bulk/" + encodeURIComponent(id) + "/adopt", {
    method: "POST",
    body: { pairId: pair.id },
  });
  assert.equal(repeated.id, draft.id);
  const record = await request("mappings/" + draft.id),
    payload = JSON.parse(record.mapping.payload);
  assert.equal(record.mapping.status, "DRAFT");
  assert.equal(record.reviews.length, 0);
  assert.equal(payload.sourceVerified, false);
  assert.ok(
    payload.rows.every(
      (r) => r.status === "INSUFFICIENT_EVIDENCE" && r.criterion,
    ),
  );
  assert.equal(payload.bulkSource.runId, page.manifest.id);
  await request("mappings/" + draft.id + "/submit", {
    method: "POST",
    body: { revision: 1 },
    expected: 422,
  });
  const csv = await fetch(
    "http://localhost:3000/api/bulk?status=INSUFFICIENT_DATA&format=csv",
  );
  assert.equal(csv.status, 200);
  assert.ok(csv.headers.get("content-type").includes("text/csv"));
  assert.equal((await csv.text()).trim().split("\r\n").length, 12);
  checks++;
  console.log(
    JSON.stringify({
      checks,
      courses: page.total,
      pairs: page.manifest.pairs,
      adoptedRows: payload.rows.length,
      sourceCourse: id,
      publication: "none",
    }),
  );
} finally {
  writeFileSync(
    "tmp/bulk-api-cleanup.json",
    JSON.stringify({ ids: cleanup, outsider }),
  );
  execFileSync("python3", [
    "-c",
    `import json,sqlite3,pathlib
x=json.load(open('tmp/bulk-api-cleanup.json'))
for p in pathlib.Path('.wrangler').rglob('*.sqlite'):
 c=sqlite3.connect(p)
 if not c.execute("SELECT name FROM sqlite_master WHERE name='mappings'").fetchone():c.close();continue
 for id in x['ids']:
  for t in ['mapping_analyses','reviews','revisions']:c.execute('DELETE FROM '+t+' WHERE mapping_id=?',(id,))
  c.execute('DELETE FROM mappings WHERE id=?',(id,));c.execute('DELETE FROM audit WHERE entity_id=?',(id,))
 c.execute('DELETE FROM members WHERE email=?',(x['outsider'],));c.commit();c.close()
`,
  ]);
}
