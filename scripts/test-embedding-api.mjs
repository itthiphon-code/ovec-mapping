/** Local-only worker regression: synthetic fixtures never enter production. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
const key = readFileSync(".dev.vars", "utf8")
  .match(/^LOCAL_TEST_KEY=(.+)$/m)?.[1]
  ?.trim()
  .replace(/^["']|["']$/g, "");
assert.ok(key);
const marker = `embedding-qa-${Date.now()}`,
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
  "tmp/embedding-api-fixture.json",
  JSON.stringify({ courseId, standardId, course, standard }),
);
execFileSync("python3", [
  "-c",
  `import json,sqlite3,pathlib,hashlib,datetime
x=json.load(open('tmp/embedding-api-fixture.json'))
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
  await request(`mappings/${id}/embedding-input`, {
    email: other,
    expected: 404,
  });
  const input = await request(`mappings/${id}/embedding-input`);
  const { pipeline } = await import("@huggingface/transformers");
  const model = await pipeline("feature-extraction", input.plan.config.model, {
    revision: input.plan.config.revision,
    dtype: "q8",
  });
  const output = await model(input.plan.texts, {
    pooling: "mean",
    normalize: true,
  });
  const vectors = output.tolist().map((v) => {
    const b = Buffer.alloc(v.length * 4);
    v.forEach((x, i) => b.writeFloatLE(x, i * 4));
    return b.toString("base64");
  });
  const submission = {
    revision: input.revision,
    inputHash: input.inputHash,
    planHash: input.planHash,
    vectors,
  };
  await request(`mappings/${id}/embedding-analyze`, {
    method: "POST",
    body: { ...submission, planHash: "0".repeat(64) },
    expected: 422,
  });
  await request(`mappings/${id}/embedding-analyze`, {
    method: "POST",
    body: { ...submission, vectors: vectors.slice(1) },
    expected: 422,
  });
  const result = await request(`mappings/${id}/embedding-analyze`, {
    method: "POST",
    body: submission,
    expected: 201,
  });
  assert.equal(result.linked, 2);
  assert.equal(result.revision, 2);
  const m = await request(`mappings/${id}`),
    p = JSON.parse(m.mapping.payload);
  assert.equal(m.mapping.status, "DRAFT");
  assert.equal(m.reviews.length, 0);
  assert.equal(p.sourceVerified, false);
  assert.ok(
    p.rows.every((r) => r.criterion && r.status === "INSUFFICIENT_EVIDENCE"),
  );
  const records = await request(`mappings/${id}/analyses`),
    r = JSON.parse(records.items[0].result);
  assert.equal(r.embedding.appliedHash, m.mapping.content_hash);
  assert.equal(r.embedding.config.dimensions, 384);
  assert.equal(r.embedding.linkedCount, 2);
  assert.ok(
    r.rows[0].candidates[0].similarity > 0 &&
      r.rows[0].candidates[0].similarity <= 100,
  );
  const evidence = await request(
    `mappings/${id}/embedding-evidence?analysisId=${result.id}`,
  );
  assert.deepEqual(evidence.vectors, vectors);
  await request(`mappings/${id}/embedding-evidence?analysisId=${result.id}`, {
    email: other,
    expected: 404,
  });
  await request(`mappings/${id}/embedding-analyze`, {
    method: "POST",
    body: submission,
    expected: 409,
  });
  await request(`mappings/${id}/submit`, {
    method: "POST",
    body: { revision: 2 },
    expected: 422,
  });
  const fresh = await request(`mappings/${id}/embedding-input`);
  const rerun = await request(`mappings/${id}/embedding-analyze`, {
    method: "POST",
    body: {
      ...submission,
      revision: 2,
      inputHash: fresh.inputHash,
      planHash: fresh.planHash,
    },
    expected: 201,
  });
  assert.equal(rerun.linked, 0);
  assert.equal(rerun.revision, 2);
  const wrong = await request("mappings", {
    method: "POST",
    body: { courseId, standardId, levelName: "ระดับ 4" },
    expected: 201,
  });
  mappingIds.push(wrong.id);
  const wrongInput = await request(`mappings/${wrong.id}/embedding-input`);
  const mismatch = await request(`mappings/${wrong.id}/embedding-analyze`, {
    method: "POST",
    body: {
      ...submission,
      revision: 1,
      inputHash: wrongInput.inputHash,
      planHash: wrongInput.planHash,
    },
    expected: 201,
  });
  assert.equal(mismatch.linked, 0);
  assert.equal(mismatch.mismatch, true);
  // Separate untouched local fixture for an optional real browser worker test.
  if (process.argv.includes("--keep")) {
    const ui = await request("mappings", {
      method: "POST",
      body: { courseId, standardId, levelName: "ระดับ 3" },
      expected: 201,
    });
    mappingIds.push(ui.id);
    writeFileSync(
      "tmp/embedding-browser-fixture.json",
      JSON.stringify({ id: ui.id, mappingIds, courseId, standardId, other }),
    );
    console.log(
      "Browser fixture: http://localhost:3000/mappings/" +
        ui.id +
        "?tab=automatic",
    );
  }
  console.log(
    JSON.stringify({
      checks,
      mean: r.embedding.meanSimilarity,
      scores: r.rows.map((x) => x.candidates[0].similarity),
      linked: result.linked,
      model: r.embedding.config.model,
    }),
  );
} finally {
  if (!process.argv.includes("--keep")) {
    writeFileSync(
      "tmp/embedding-api-cleanup.json",
      JSON.stringify({ mappingIds, courseId, standardId, other }),
    );
    execFileSync("python3", [
      "-c",
      `import json,sqlite3,pathlib
x=json.load(open('tmp/embedding-api-cleanup.json'))
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
}
