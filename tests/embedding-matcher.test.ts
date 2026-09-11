import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EMBEDDING,
  buildEmbeddingPlan,
  cosine,
  decodeVectors,
  matchEmbeddings,
  bestEmbeddingSelections,
  similarityPercent,
} from "../lib/embedding-matcher";
import { applyCandidates } from "../lib/auto-mapping";
import { fixture } from "./fixtures/mapping";
const unit = (i: number) => Array.from({ length: 384 }, (_, j) => +(i === j));
const encode = (v: number[]) => {
  const b = Buffer.alloc(v.length * 4);
  v.forEach((x, i) => b.writeFloatLE(x, i * 4));
  return b.toString("base64");
};
test("cosine percentages do not rescale the model distribution or imply coverage", () => {
  assert.equal(cosine([1, 0], [0, 1]), 0);
  assert.ok(Math.abs(cosine([1, 1], [1, 1]) - 1) < 1e-12);
  assert.equal(similarityPercent(-0.2), 0);
  assert.equal(similarityPercent(0.82744), 82.7);
  assert.throws(() => cosine([0, 0], [1, 1]));
});
test("vector boundary rejects truncated, nonfinite, zero and unnormalized vectors", () => {
  assert.deepEqual(decodeVectors([encode(unit(0))], 1), [unit(0)]);
  assert.throws(() => decodeVectors([], 1));
  assert.throws(() => decodeVectors(["x"], 1));
  for (const value of [0, NaN, Infinity, 2]) {
    const v = unit(0);
    v[0] = value;
    assert.throws(() => decodeVectors([encode(v)], 1));
  }
});
test("plan contains complete original texts, chunks long Thai strings, and pins model revision", () => {
  const p = fixture();
  p.rows[0].target = "ระบบไฟฟ้าโซลาร์🛠️".repeat(100);
  const plan = buildEmbeddingPlan(p),
    g = plan.targets[0].group;
  assert.equal(
    g.indices.map((i) => plan.texts[i].slice(7)).join(""),
    p.rows[0].target,
  );
  assert.ok(plan.texts.every((t) => Array.from(t).length <= 327));
  assert.equal(plan.config.revision, EMBEDDING.revision);
  assert.equal(plan.sections.length, 4);
  assert.equal(plan.criteria.length, 3);
});
test("reference priority is separate from cosine percentages and auto-links stay unverified", () => {
  const p = fixture(),
    plan = buildEmbeddingPlan(p);
  const vectors = plan.texts.map(() => unit(0));
  plan.criteria[0].group.indices.forEach((i) => {
    vectors[i] = unit(1);
  });
  plan.criteria[1].group.indices.forEach((i) => {
    vectors[i] = unit(1);
  });
  const result = matchEmbeddings(p, plan, vectors),
    top = result.rows[0].candidates[0];
  assert.equal(top.basis, "DIRECT_CODE");
  assert.equal(top.similarity, 0);
  assert.equal(result.rows[0].candidates[2].similarity, 100);
  const next = applyCandidates(p, result, bestEmbeddingSelections(p, result));
  assert.equal(next.rows[0].status, "INSUFFICIENT_EVIDENCE");
  assert.equal(next.sourceVerified, false);
  assert.equal(next.scopeConfirmed, false);
  assert.equal(next.rows[0].criterion, top.standardQuote);
});
test("mismatched levels get scores but no automatic links", () => {
  const p = fixture();
  p.course.standardRef = p.course.standardRef.replace("ระดับ 3", "ระดับ 4");
  const plan = buildEmbeddingPlan(p),
    r = matchEmbeddings(
      p,
      plan,
      plan.texts.map(() => unit(0)),
    );
  assert.equal(r.rows[0].candidates[0].similarity, 100);
  assert.deepEqual(bestEmbeddingSelections(p, r), []);
});
test("human notes, choices, safety flags and duplicate targets are preserved", () => {
  for (const field of [
    "criterion",
    "uoc",
    "eoc",
    "reason",
    "gap",
    "standardQuote",
  ] as const) {
    const p = fixture();
    p.rows[0][field] = "human";
    const plan = buildEmbeddingPlan(p),
      r = matchEmbeddings(
        p,
        plan,
        plan.texts.map(() => unit(0)),
      );
    assert.deepEqual(bestEmbeddingSelections(p, r), []);
  }
  const p = fixture();
  p.rows.push({ ...p.rows[0], id: "T2" });
  const plan = buildEmbeddingPlan(p);
  assert.equal(plan.targets.length, 1);
});
test("empty and oversized scopes fail explicitly", () => {
  const p = fixture();
  p.standard.levels[0].units = [];
  assert.throws(() => buildEmbeddingPlan(p));
  const q = fixture();
  q.rows[0].target = Array.from({ length: 3001 }, (_, i) =>
    String(i).padEnd(320, "ก"),
  ).join("");
  assert.throws(() => buildEmbeddingPlan(q));
});
