import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./fixtures/mapping";
import {
  bulkTargets,
  bulkReference,
  referenceTier,
  uniqueStandardCandidates,
  dot,
  normalizedMean,
} from "../lib/bulk-matcher";
test("bulk retrieval puts full source references before stronger semantic similarity", () => {
  const p = fixture(),
    ref = bulkReference(p.course);
  const direct = referenceTier(ref, p.standard, p.standard.levels[0]);
  assert.equal(direct.basis, "DIRECT_CODE");
  const selected = uniqueStandardCandidates([
    { standardId: 1, key: "1", score: 0.65, tier: 0, mismatch: false },
    { standardId: 2, key: "2", score: 0.99, tier: 2, mismatch: false },
  ]);
  assert.equal(selected[0].standardId, 1);
});
test("references from other agencies cannot establish TPQI identity", () => {
  const p = fixture();
  p.course.standardRef = "กรมพัฒนาฝีมือแรงงาน SOLAR-INST-101 ระดับ 3";
  assert.equal(bulkReference(p.course).codes.length, 0);
});
test("mismatched document level stays blocked even with full code and high similarity", () => {
  const p = fixture();
  p.course.standardRef = p.course.standardRef.replace("ระดับ 3", "ระดับ 4");
  assert.equal(
    referenceTier(bulkReference(p.course), p.standard, p.standard.levels[0])
      .mismatch,
    true,
  );
});
test("alternative results represent different standards instead of repeated levels", () => {
  const c = [
    { standardId: 1, key: "1a", score: 0.9, tier: 2, mismatch: false },
    { standardId: 1, key: "1b", score: 0.85, tier: 2, mismatch: false },
    { standardId: 2, key: "2", score: 0.8, tier: 2, mismatch: false },
    { standardId: 3, key: "3", score: 0.7, tier: 2, mismatch: false },
  ];
  assert.deepEqual(
    uniqueStandardCandidates(c).map((x) => x.standardId),
    [1, 2, 3],
  );
});
test("bulk target denominator deduplicates equal learning outcomes and competencies", () => {
  const p = fixture();
  assert.equal(bulkTargets(p.course).length, 1);
});
test("weighted pooling remains normalized and rejects empty evidence", () => {
  const a = new Float32Array(384),
    b = new Float32Array(384);
  a[0] = 1;
  b[1] = 1;
  const v = normalizedMean([a, b], [3, 4]);
  assert.ok(Math.abs(v[0] - 0.6) < 1e-6);
  assert.ok(Math.abs(v[1] - 0.8) < 1e-6);
  assert.ok(Math.abs(dot(v, v) - 1) < 1e-6);
  assert.throws(() => normalizedMean([]));
});
