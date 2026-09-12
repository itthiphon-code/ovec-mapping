import test from "node:test";
import assert from "node:assert/strict";
import {
  occupationEvidence,
  certificateCrosswalk,
} from "../lib/course-crosswalk";
import { loadReportSources } from "../lib/report-source-loader";
import { fixture } from "./fixtures/mapping";
import {
  certificateResult,
  type CertificateFile,
  type CertificateCourse,
} from "../lib/certificate-matcher";
import type { BulkDetail } from "../lib/bulk-types";
const p = fixture();
const unit = {
  uoc_code: "U1",
  uoc_desc: "ติดตั้งระบบ",
  elements: [
    {
      eoc_code: "E1",
      eoc_desc: "ตรวจความพร้อมของระบบ",
      pc_items: ["ตรวจความพร้อมก่อนติดตั้ง"],
      assess_items: [],
    },
  ],
};
const standard = {
  ...p.standard,
  title: "ช่างระบบทดสอบ",
  levels: [
    { levelId: 1, levelName: "ระดับ 3", qualificationId: 1, units: [unit] },
    {
      levelId: 2,
      levelName: "ระดับ 4",
      qualificationId: 2,
      units: [{ ...unit, uoc_desc: "หน่วยคนละระดับห้ามนำมาใช้" }],
    },
  ],
};
const course: CertificateCourse = {
  id: "D:C",
  summary: {
    code: "C",
    nameTh: "วิชาทดสอบ",
    deptCode: "D",
    deptName: "สาขาทดสอบ",
    level: "ปวส.",
    category: "",
    credit: "1-2-2",
    pdfUrl: "https://example.test/c.pdf",
    pdfPage: 3,
  },
  targets: [
    {
      id: "T1",
      kind: "สมรรถนะรายวิชา",
      text: "ตรวจความพร้อมก่อนติดตั้ง",
      locator: "หน้า 3",
    },
  ],
  reference: { text: "อ้างอิง TPQI U1 ระดับ 3", codes: ["U1"], level: "3" },
  basis: "DIRECT_CODE",
  mismatch: false,
  retrievalScore: 90,
  matches: [[[0, 0.8]]],
  sourcePath: "/test.json",
  sourceHash: "a".repeat(64),
};
const level = {
  levelId: 1,
  levelName: "ระดับ 3",
  criteria: [
    {
      unit: "U1",
      eoc: "E1",
      text: "ตรวจความพร้อมก่อนติดตั้ง",
      locator: "U1/E1/PC1",
    },
  ],
  courses: [course],
};
const file: CertificateFile = {
  standard,
  provenance: {},
  runId: "R",
  sourceRunId: "S",
  sourceHash: "a",
  results: [level],
};
const detail: BulkDetail = {
  runId: "R",
  courseId: "D:C",
  summary: course.summary,
  course: {
    ...p.course,
    description: "ศึกษาการติดตั้งระบบ",
    competencies: "ตรวจความพร้อมก่อนติดตั้ง",
    learningOutcomes: "ปฏิบัติงานติดตั้งได้",
  },
  courseHash: "b",
  provenance: {},
  targets: course.targets,
  pairs: [],
  status: "COMPUTED",
  note: "",
};
test("occupational names resolve only inside the selected qualification level and UoC", () => {
  for (const depth of ["uoc", "eoc"] as const) {
    const text = occupationEvidence(
      standard,
      standard.levels[0],
      "U1",
      "E1",
      "เกณฑ์ PC",
      depth,
    );
    assert.ok(text.includes("ช่างระบบทดสอบ"));
    assert.ok(text.includes("ติดตั้งระบบ"));
    assert.ok(text.includes("ตรวจความพร้อมของระบบ"));
    assert.ok(!text.includes("หน่วยคนละระดับ"));
  }
});
test("description is retained but documentary scope is not misrepresented as a computed match", () => {
  const rows = certificateCrosswalk({
    file,
    level,
    selected: ["U1"],
    result: certificateResult(course, level, ["U1"]),
    course: detail.course,
    depth: "eoc",
  });
  assert.equal(rows[0].courseText, "ศึกษาการติดตั้งระบบ");
  assert.ok(rows[0].standardText.includes("UoC U1: ติดตั้งระบบ"));
  assert.ok(
    rows[0].notes.some((s) => s.includes("ยังไม่มีผลจับคู่คำอธิบายรายข้อความ")),
  );
  assert.ok(
    rows
      .find((r) => r.kind === "สมรรถนะรายวิชา")
      ?.standardText.includes("EoC E1: ตรวจความพร้อมของระบบ"),
  );
  assert.ok(
    rows
      .find((r) => r.kind === "ผลลัพธ์การเรียนรู้")
      ?.standardText.includes("ไม่มีแถวผลจับคู่แยก"),
  );
});
test("unselected units cannot be borrowed for either description context or PC evidence", () => {
  const rows = certificateCrosswalk({
    file,
    level,
    selected: [],
    result: certificateResult(course, level, []),
    course: detail.course,
    depth: "eoc",
  });
  assert.ok(!rows.some((r) => r.standardText.includes("UoC U1")));
  assert.ok(rows[0].standardText.includes("ยังไม่มีคู่"));
});
test("source loader rejects a same-code course belonging to a different department", async () => {
  await assert.rejects(
    loadReportSources([course], async () => ({
      ...detail,
      summary: { ...detail.summary, deptCode: "OTHER" },
    })),
    /ไม่ตรงกับรายวิชา/,
  );
});
test("source loader fails the report when any required source fails instead of emitting an incomplete document", async () => {
  await assert.rejects(
    loadReportSources([course], async () => {
      throw new Error("ข้อมูลต้นฉบับไม่พร้อม");
    }),
    /ไม่พร้อม/,
  );
  const sources = await loadReportSources([course], async () => detail);
  assert.equal(sources["D:C"].course?.description, "ศึกษาการติดตั้งระบบ");
});

test("a qualification mismatch cannot establish description scope from a reused UoC code", () => {
  const mismatched = { ...course, mismatch: true };
  const rows = certificateCrosswalk({
    file,
    level,
    selected: ["U1"],
    result: certificateResult(mismatched, level, ["U1"]),
    course: detail.course,
    depth: "eoc",
  });
  assert.ok(!rows[0].standardText.includes("UoC U1"));
});
