/** Local-only worker regression: synthetic fixtures never enter production. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
const key = readFileSync(".dev.vars", "utf8")
  .match(/^LOCAL_TEST_KEY=(.+)$/m)?.[1]
  ?.trim()
  .replace(/^["']|["']$/g, "");
assert.ok(key);
const marker = `auto-qa-${Date.now()}`,
  courseId = `course:${marker}:TEST-1001`,
  standardId = `standard:${marker}`;
const other = `${marker}@example.test`,
  mappingIds = [];
let checks = 0;
async function request(
  path,
  { method = "GET", body, expected = 200, email } = {},
) {
  const r = await fetch(`http://localhost:3000/api/${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-test-key": key,
      ...(email ? { "x-test-email": email } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const value = await r.json();
  assert.equal(
    r.status,
    expected,
    `${method} ${path}: ${JSON.stringify(value).slice(0, 800)}`,
  );
  checks++;
  return value;
}
const course = {
  success: true,
  courseCode: "TEST-1001",
  courseName: "TEST ONLY ติดตั้งแผงเซลล์แสงอาทิตย์",
  standardRef: "สถาบันคุณวุฒิวิชาชีพ SOLAR-INST-101 ระดับ 3",
  learningOutcomes: "ติดตั้งแผงเซลล์แสงอาทิตย์และตรวจสอบความปลอดภัย",
  competencies: "ตรวจสอบแผงเซลล์แสงอาทิตย์ตามมาตรฐานความปลอดภัย",
  description: "ศึกษาและปฏิบัติเกี่ยวกับการติดตั้งแผงเซลล์แสงอาทิตย์",
  objectives: "มีทักษะการติดตั้งแผงเซลล์แสงอาทิตย์",
  pdfUrl: "https://bsq.vec.go.th/test-only.pdf",
  pdfPage: 1,
  level: "ปวช.",
  credit: "3",
};
const unit = {
  uoc_code: "SOLAR-INST-101",
  uoc_desc: "ติดตั้งแผงเซลล์แสงอาทิตย์",
  elements: [
    {
      eoc_code: "101.1",
      eoc_desc: "ตรวจสอบแผง",
      pc_items: [
        "ติดตั้งแผงเซลล์แสงอาทิตย์ตามข้อกำหนดความปลอดภัย",
        "ตรวจสอบแผงเซลล์แสงอาทิตย์และความปลอดภัย",
      ],
      assess_items: ["ทดสอบปฏิบัติจริง"],
    },
  ],
};
const standard = {
  id: 999999,
  title: "TEST ONLY ติดตั้งแผงเซลล์แสงอาทิตย์",
  category: "TEST",
  sourceUrl: "https://tpqinet.tpqi.go.th/test-only",
  levels: [3, 4].map((level) => ({
    levelId: level,
    levelName: `ระดับ ${level}`,
    qualificationId: level,
    units: [unit],
  })),
};
mkdirSync("tmp", { recursive: true });
await request("health");
writeFileSync(
  "tmp/auto-api-fixture.json",
  JSON.stringify({ courseId, standardId, course, standard }),
);
execFileSync("python3", [
  "-c",
  `import json,sqlite3,pathlib,hashlib,datetime
x=json.load(open('tmp/auto-api-fixture.json'))
for path in pathlib.Path('.wrangler').rglob('*.sqlite'):
 c=sqlite3.connect(path)
 if not c.execute("SELECT name FROM sqlite_master WHERE name='catalog'").fetchone():c.close();continue
 for kind in ['course','standard']:
  detail=json.dumps(x[kind],ensure_ascii=False);id=x[kind+'Id']
  c.execute('INSERT INTO catalog(id,kind,code,title,level,category,department,payload,detail,source_url,fetched_at,hash) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',(id,kind,'TEST ONLY','TEST ONLY','TEST','TEST','TEST','{}',detail,'https://dles.vec.go.th/',datetime.datetime.now().isoformat(),hashlib.sha256(detail.encode()).hexdigest()))
 c.commit();c.close()
`,
]);
try {
  const created = await request("mappings", {
    method: "POST",
    body: { courseId, standardId, levelName: "ระดับ 3" },
    expected: 201,
  });
  const id = created.id;
  mappingIds.push(id);
  const before = (await request(`mappings/${id}`)).mapping;
  await request(`mappings/${id}/analyze`, {
    method: "POST",
    body: { revision: 1 },
    email: other,
    expected: 404,
  });
  const analysis = await request(`mappings/${id}/analyze`, {
    method: "POST",
    body: { revision: 1 },
    expected: 201,
  });
  assert.ok(analysis.result.rows[0].candidates.length);
  assert.equal(analysis.result.reference.status, "DIRECT_CODE");
  const after = (await request(`mappings/${id}`)).mapping;
  assert.equal(after.content_hash, before.content_hash);
  assert.equal(after.revision, 1);
  assert.equal(after.status, "DRAFT");
  const stored = await request(`mappings/${id}/analyses`);
  assert.equal(stored.items[0].input_hash, before.content_hash);
  assert.equal(stored.items[0].engine, analysis.result.engine);
  const candidate = analysis.result.rows[0].candidates[0],
    rowId = analysis.result.rows[0].rowId;
  await request(`mappings/${id}/apply-analysis`, {
    method: "POST",
    body: {
      revision: 1,
      analysisId: analysis.id,
      selections: [{ rowId, candidateId: "invented" }],
    },
    expected: 422,
  });
  await request(`mappings/${id}/apply-analysis`, {
    method: "POST",
    body: {
      revision: 1,
      analysisId: analysis.id,
      selections: [{ rowId, candidateId: candidate.id }],
    },
  });
  const applied = await request(`mappings/${id}`),
    p = JSON.parse(applied.mapping.payload);
  assert.equal(applied.mapping.revision, 2);
  assert.equal(p.rows[0].criterion, candidate.criterion);
  assert.equal(p.rows[0].status, "INSUFFICIENT_EVIDENCE");
  assert.equal(p.referenceStatus, "VERSION_UNRESOLVED");
  assert.equal(applied.reviews.length, 0);
  assert.equal(p.sourceVerified, false);
  await request(`mappings/${id}/apply-analysis`, {
    method: "POST",
    body: {
      revision: 2,
      analysisId: analysis.id,
      selections: [{ rowId, candidateId: candidate.id }],
    },
    expected: 409,
  });
  const current = await request(`mappings/${id}/analyze`, {
    method: "POST",
    body: { revision: 2 },
    expected: 201,
  });
  await request(`mappings/${id}/apply-analysis`, {
    method: "POST",
    body: {
      revision: 2,
      analysisId: current.id,
      selections: [{ rowId, candidateId: candidate.id }],
    },
    expected: 422,
  });
  await request(`mappings/${id}/submit`, {
    method: "POST",
    body: { revision: 2 },
    expected: 422,
  });
  const otherLevel = await request("mappings", {
    method: "POST",
    body: { courseId, standardId, levelName: "ระดับ 4" },
    expected: 201,
  });
  mappingIds.push(otherLevel.id);
  const mismatch = await request(`mappings/${otherLevel.id}/analyze`, {
    method: "POST",
    body: { revision: 1 },
    expected: 201,
  });
  assert.equal(mismatch.result.reference.mismatch, true);
  await request(`mappings/${otherLevel.id}/apply-analysis`, {
    method: "POST",
    body: {
      revision: 1,
      analysisId: mismatch.id,
      selections: [{ rowId, candidateId: candidate.id }],
    },
    expected: 422,
  });
  await request(`mappings/${otherLevel.id}/apply-analysis`, {
    method: "POST",
    body: {
      revision: 1,
      analysisId: current.id,
      selections: [{ rowId, candidateId: candidate.id }],
    },
    expected: 404,
  });
  await request("recommendations", {
    method: "POST",
    email: other,
    body: { courseId },
    expected: 403,
  });
  const live = await request("recommendations", {
    method: "POST",
    body: { courseId: "course:20101:20100-1001" },
  });
  assert.ok(live.queries.includes("CIP-NPEC-103B"));
  assert.ok(live.scope);
  assert.ok(live.detailsChecked <= 8);
  console.log(
    `PASS: ${checks} automatic-analysis HTTP checks; worker segmentation, persistence, provenance, stale results, isolation and live recommendations`,
  );
  console.log(
    JSON.stringify({
      liveRecommendationCount: live.items.length,
      queries: live.queries,
      detailsChecked: live.detailsChecked,
      sourceDegraded: live.sourceDegraded,
    }),
  );
} finally {
  writeFileSync(
    "tmp/auto-api-cleanup.json",
    JSON.stringify({ mappingIds, courseId, standardId, other }),
  );
  execFileSync("python3", [
    "-c",
    `import json,sqlite3,pathlib
x=json.load(open('tmp/auto-api-cleanup.json'))
for path in pathlib.Path('.wrangler').rglob('*.sqlite'):
 c=sqlite3.connect(path)
 if not c.execute("SELECT name FROM sqlite_master WHERE name='mappings'").fetchone():c.close();continue
 for id in x['mappingIds']:
  for table in ['mapping_analyses','reviews','revisions']:c.execute('DELETE FROM '+table+' WHERE mapping_id=?',(id,))
  c.execute('DELETE FROM mappings WHERE id=?',(id,));c.execute('DELETE FROM audit WHERE entity_id=?',(id,))
 for id in [x['courseId'],x['standardId']]:c.execute('DELETE FROM catalog WHERE id=?',(id,))
 c.execute('DELETE FROM members WHERE email=?',(x['other'],));c.commit();c.close()
`,
  ]);
}
