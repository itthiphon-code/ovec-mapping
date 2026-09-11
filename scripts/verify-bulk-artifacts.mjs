import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
const root = "public/bulk/bulk-20260911-e5-01",
  m = JSON.parse(await readFile(root + "/manifest.json"));
const files = await readdir(root + "/courses");
assert.equal(files.length, m.courses);
const standards = new Map();
for (const f of await readdir(root + "/standards")) {
  const text = await readFile(root + "/standards/" + f, "utf8"),
    data = JSON.parse(text);
  standards.set(data.standard.id, {
    ...data,
    hash: createHash("sha256").update(text).digest("hex"),
  });
}
let pairs = 0,
  computed = 0,
  missing = 0,
  excluded = 0,
  checked = 0;
for (const f of files) {
  const d = JSON.parse(await readFile(root + "/courses/" + f));
  assert.equal(d.runId, m.id);
  assert.equal(d.summary.code, d.courseId.split(":")[1]);
  if (d.status === "INSUFFICIENT_DATA") missing++;
  if (d.status === "OUT_OF_SCOPE") excluded++;
  if (d.pairs.length) computed++;
  assert.equal(new Set(d.pairs.map((p) => p.standardId)).size, d.pairs.length);
  for (const p of d.pairs) {
    pairs++;
    assert.ok(Number.isFinite(p.score) && p.score >= 0 && p.score <= 100);
    const source = standards.get(p.standardId);
    assert.equal(source.hash, p.standardHash);
    const level = source.standard.levels.find((l) => l.levelName === p.level);
    assert.ok(level);
    assert.equal(p.matches.length, d.targets.length);
    for (const x of p.matches) {
      const t = d.targets.find((t) => t.id === x.targetId);
      assert.ok(t);
      assert.ok(
        level.units.some(
          (u) =>
            u.uoc_code === x.uoc &&
            u.elements.some(
              (e) => e.eoc_code === x.eoc && e.pc_items.includes(x.criterion),
            ),
        ),
      );
      assert.equal(x.similarity, Math.round(Math.max(0, x.cosine) * 1000) / 10);
      checked++;
    }
    assert.equal(
      p.score,
      Math.round(
        (p.matches.reduce((s, x) => s + Math.max(0, x.cosine) * 100, 0) /
          p.matches.length) *
          10,
      ) / 10,
    );
  }
}
assert.equal(pairs, m.pairs);
assert.equal(computed, m.computed);
assert.equal(missing, m.missing);
assert.equal(excluded, m.excluded);
const sql = await readFile("drizzle/0003_bulk_embedding_snapshot.sql", "utf8");
const maxStatement = Math.max(
  ...sql.split("--> statement-breakpoint").map((s) => Buffer.byteLength(s)),
);
assert.ok(maxStatement < 100000, "D1 statement size");
console.log(
  JSON.stringify({
    courses: files.length,
    standards: standards.size,
    pairs,
    criterionMatchesChecked: checked,
    computed,
    missing,
    excluded,
    maxSqlStatementBytes: maxStatement,
  }),
);
