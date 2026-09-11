import { test } from "node:test";
import assert from "node:assert/strict";
import {
  coverage,
  referenceCheck,
  evidenceProblems,
  approvalProblems,
  canReview,
  safeSourceUrl,
} from "../lib/policy";
import type { MappingRow, MappingPayload, User, Review } from "../lib/types";

const row: MappingRow = {
  id: "T1",
  target: "ปฏิบัติงานตามข้อกำหนด",
  targetKind: "สมรรถนะ",
  status: "FULL",
  uoc: "U1",
  eoc: "E1",
  criterion: "เกณฑ์จริง",
  standardQuote: "เกณฑ์จริง",
  courseQuote: "ปฏิบัติงานตามข้อกำหนด",
  standardUrl: "https://dles.vec.go.th/standards",
  courseUrl: "https://bsq.vec.go.th/example.pdf",
  standardLocator: "หน้า 10",
  courseLocator: "หน้า 20",
  reason: "หลักฐานระบุงานและบริบทตรงกัน",
  gap: "",
  critical: false,
};
const payload = () =>
  ({
    rows: [{ ...row }],
    scopeConfirmed: true,
    sourceVerified: true,
    referenceStatus: "VERIFIED",
    referenceNote: "ตรวจเอกสารและระดับแล้ว",
    reviewers: ["expert1@example.test", "expert2@example.test"],
  }) as MappingPayload;
test("multiple criteria for one target do not inflate coverage", () => {
  assert.equal(coverage([row, { ...row, id: "T2" }]).total, 1);
  assert.equal(coverage([row, { ...row, id: "T2" }]).percentage, 100);
});
test("partial or unknown contributions cannot become full by adding percentages", () => {
  assert.equal(
    coverage([row, { ...row, id: "T2", status: "PARTIAL" }]).full,
    0,
  );
  assert.equal(
    coverage([row, { ...row, id: "T2", status: "INSUFFICIENT_EVIDENCE" }])
      .unknown,
    1,
  );
});
test("unknown targets stay in the denominator", () => {
  const c = coverage([
    row,
    {
      ...row,
      id: "T2",
      target: "อีกข้อกำหนด",
      status: "INSUFFICIENT_EVIDENCE",
    },
  ]);
  assert.equal(c.total, 2);
  assert.equal(c.percentage, 50);
});
test("empty scope has no percentage", () =>
  assert.equal(coverage([]).percentage, null));
test("official reference level 3 cannot silently map to level 4", () =>
  assert.equal(
    referenceCheck(
      "มาตรฐานอาชีพ สถาบันคุณวุฒิวิชาชีพ รหัส CIP-NPEC-103B ระดับ 3",
      "ระดับ 4",
    ).status,
    "LEVEL_MISMATCH",
  ));
test("same level is not automatic identity/version verification", () =>
  assert.equal(
    referenceCheck("มาตรฐานอาชีพ สถาบันคุณวุฒิวิชาชีพ ระดับ 3", "ระดับ 3")
      .status,
    "VERSION_UNRESOLVED",
  ));
test("other source references are not TPQI references", () =>
  assert.equal(
    referenceCheck("กรมพัฒนาฝีมือแรงงาน ระดับ 3", "ระดับ 3").status,
    "NO_REFERENCE",
  ));
test("full relationship without evidence locator is blocked", () => {
  const p = payload();
  p.rows[0].standardLocator = "";
  assert.ok(evidenceProblems(p).length > 0);
});
test("critical gap blocks full relationship", () => {
  const p = payload();
  p.rows[0].critical = true;
  p.rows[0].gap = "ขาดการปฏิบัติจริง";
  assert.ok(evidenceProblems(p).length > 0);
});
test("author cannot review own mapping", () => {
  const expert: User = {
    email: "expert1@example.test",
    name: "Expert",
    role: "expert_tpqi",
    scope: "TPQI appointment",
    valid_until: "2099-01-01",
    active: 1,
  };
  assert.equal(canReview(expert, expert.email, [expert.email]), false);
  assert.equal(canReview(expert, "author@example.test", [expert.email]), true);
});
test("expired or unassigned experts cannot review", () => {
  const expert: User = {
    email: "expert1@example.test",
    name: "Expert",
    role: "expert_tpqi",
    scope: "TPQI appointment",
    valid_until: "2020-01-01",
    active: 1,
  };
  assert.equal(canReview(expert, "author@example.test", [expert.email]), false);
  assert.equal(
    canReview(
      { ...expert, valid_until: "2099-01-01" },
      "author@example.test",
      [],
    ),
    false,
  );
});
test("approval requires independent roles reviewing the exact hash", () => {
  const p = payload();
  const r = {
    id: "r1",
    reviewer: "expert1@example.test",
    role: "expert_tpqi",
    verdict: "ACCEPT",
    comment: "test",
    revision: 1,
    created_at: "2026-09-11",
    content_hash: "hash",
  } as Review;
  assert.ok(approvalProblems(p, [r], "hash").length);
  assert.equal(
    approvalProblems(
      p,
      [
        r,
        {
          ...r,
          id: "r2",
          reviewer: "expert2@example.test",
          role: "expert_course",
        },
      ],
      "hash",
    ).length,
    0,
  );
  assert.ok(
    approvalProblems(
      p,
      [
        r,
        {
          ...r,
          id: "r2",
          reviewer: "expert2@example.test",
          role: "expert_course",
        },
      ],
      "new-hash",
    ).length,
  );
});
test("source URLs reject script URLs and private networks", () => {
  assert.equal(safeSourceUrl("javascript:alert(1)"), false);
  assert.equal(safeSourceUrl("http://127.0.0.1/admin"), false);
  assert.equal(safeSourceUrl("https://dles.vec.go.th.evil.test/file"), false);
  assert.equal(safeSourceUrl("https://bsq.vec.go.th/example.pdf"), true);
});
