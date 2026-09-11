import test from "node:test";
import assert from "node:assert/strict";
import {
  certificateResult,
  orderCertificateResults,
  type CertificateCourse,
  type CertificateLevel,
} from "../lib/certificate-matcher";
const course: CertificateCourse = {
  id: "D:C",
  summary: {
    code: "C",
    nameTh: "Course",
    credit: "3",
    deptCode: "D",
    deptName: "Dept",
    level: "ปวส.",
    category: "",
    pdfUrl: "",
    pdfPage: 1,
  },
  targets: [
    { id: "T1", text: "Install", kind: "outcome", locator: "page 1" },
    { id: "T2", text: "Test", kind: "competency", locator: "page 1" },
  ],
  reference: { codes: ["U1"], level: "3", text: "TPQI U1" },
  basis: "DIRECT_CODE",
  mismatch: false,
  retrievalScore: 91,
  sourcePath: "",
  sourceHash: "",
  matches: [
    [
      [0, 0.8],
      [1, 0.99],
    ],
    [
      [2, 0.7],
      [3, 0.9],
    ],
  ],
};
const level: CertificateLevel = {
  levelId: 1,
  levelName: "ระดับ 3",
  courses: [course],
  criteria: [
    { unit: "U1", eoc: "E1", text: "PC1", locator: "1" },
    { unit: "U2", eoc: "E2", text: "PC2", locator: "2" },
    { unit: "U1", eoc: "E1", text: "PC3", locator: "3" },
    { unit: "U2", eoc: "E2", text: "PC4", locator: "4" },
  ],
};
test("no certificate units means no numerical claim", () => {
  const r = certificateResult(course, level, []);
  assert.equal(r.score, null);
  assert.ok(r.matches.every((m) => m.criterion === null));
});
test("selected certificate units restrict every matched PC and recompute score", () => {
  const r = certificateResult(course, level, ["U2"]);
  assert.equal(r.score, 94.5);
  assert.ok(r.matches.every((m) => m.criterion?.unit === "U2"));
  assert.deepEqual(r.missingUnits, ["U1"]);
  assert.equal(r.basis, "EMBEDDING");
});
test("document reference takes precedence over a higher cosine in another passed unit", () => {
  const r = certificateResult(course, level, ["U1", "U2"]);
  assert.equal(r.score, 75);
  assert.equal(r.basis, "DIRECT_CODE");
  assert.deepEqual(r.missingUnits, []);
});
test("unknown or empty-PC units cannot borrow evidence from other units", () => {
  assert.equal(certificateResult(course, level, ["unknown"]).score, null);
});
test("ranking keeps documentary support before high semantic similarity", () => {
  const reference = certificateResult(course, level, ["U1"]),
    semantic = certificateResult(course, level, ["U2"]);
  assert.ok(orderCertificateResults(reference, semantic) < 0);
});
test("selection does not mutate stored evidence; mismatch remains explicit", () => {
  const before = JSON.stringify(course);
  certificateResult(course, level, ["U2"]);
  assert.equal(JSON.stringify(course), before);
  assert.equal(
    certificateResult({ ...course, mismatch: true }, level, ["U1"]).mismatch,
    true,
  );
});
