import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import {
  certificateCriteria,
  certificateResult,
  type CertificateIndex,
  type CertificateFile,
} from "../lib/certificate-matcher";
import type { BulkDetail, BulkStandardFile } from "../lib/bulk-types";
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const registry = JSON.parse(
  await readFile("lib/certificate-registry.json", "utf8"),
);
const rawIndex = await readFile("public" + registry.path, "utf8");
assert.equal(hash(rawIndex), registry.hash);
const index = JSON.parse(rawIndex) as CertificateIndex;
const cache = new Map<string, { raw: string; data: BulkDetail }>();
let pairs = 0,
  tuples = 0,
  levels = 0,
  largest = 0;
for (const item of index.items) {
  const raw = await readFile("public" + item.path, "utf8");
  largest = Math.max(largest, Buffer.byteLength(raw));
  assert.equal(hash(raw), item.hash);
  const file = JSON.parse(raw) as CertificateFile;
  const standardRaw = await readFile(
    `public/bulk/${index.sourceRunId}/standards/${item.id}.json`,
    "utf8",
  );
  assert.equal(hash(standardRaw), file.sourceHash);
  const original = JSON.parse(standardRaw) as BulkStandardFile;
  assert.deepEqual(file.standard, original.standard);
  assert.equal(file.results.length, original.standard.levels.length);
  for (const [li, level] of file.results.entries()) {
    assert.deepEqual(
      level.criteria,
      certificateCriteria(original.standard.levels[li]),
    );
    assert.equal(level.levelId, original.standard.levels[li].levelId);
    assert.equal(
      new Set(level.courses.map((c) => c.id)).size,
      level.courses.length,
    );
    if (level.criteria.length) {
      levels++;
      assert.ok(level.courses.length >= 20);
    }
    for (const course of level.courses) {
      pairs++;
      if (!cache.has(course.sourcePath)) {
        const raw = await readFile("public" + course.sourcePath, "utf8");
        cache.set(course.sourcePath, { raw, data: JSON.parse(raw) });
      }
      const source = cache.get(course.sourcePath)!;
      assert.equal(hash(source.raw), course.sourceHash);
      assert.equal(source.data.courseId, course.id);
      assert.deepEqual(source.data.summary, course.summary);
      assert.deepEqual(source.data.targets, course.targets);
      assert.equal(course.matches.length, course.targets.length);
      for (const target of course.matches) {
        const units = new Set<string>();
        for (const [pc, score] of target) {
          assert.ok(Number.isInteger(pc) && level.criteria[pc]);
          assert.ok(Number.isFinite(score) && score >= -1 && score <= 1);
          assert.ok(!units.has(level.criteria[pc].unit));
          units.add(level.criteria[pc].unit);
          tuples++;
        }
        assert.equal(
          units.size,
          new Set(level.criteria.map((pc) => pc.unit)).size,
        );
      }
      assert.equal(certificateResult(course, level, []).score, null);
      for (const unit of new Set(level.criteria.map((pc) => pc.unit))) {
        const result = certificateResult(course, level, [unit]);
        assert.ok(result.matches.every((m) => m.criterion?.unit === unit));
        const expected =
          Math.round(
            (course.matches.reduce(
              (sum, target) =>
                sum +
                Math.max(
                  0,
                  target.find(([pc]) => level.criteria[pc].unit === unit)![1],
                ),
              0,
            ) /
              course.targets.length) *
              1000,
          ) / 10;
        assert.equal(result.score, expected);
      }
    }
  }
}
assert.equal(pairs, index.pairs);
assert.equal(levels, index.levels);
assert.ok(largest < 25 * 1024 * 1024);
console.log(
  JSON.stringify({
    standards: index.items.length,
    levels,
    pairs,
    sourceCoursesVerified: cache.size,
    tuples,
    largestFileBytes: largest,
    verified: true,
  }),
);
