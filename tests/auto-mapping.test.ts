import { test } from "node:test";
import assert from "node:assert/strict";
import {
  analyzeMapping,
  applyCandidates,
  assessReference,
  terms,
} from "../lib/auto-mapping";
import type { MappingPayload, MappingRow, StandardDetail } from "../lib/types";

const row: MappingRow = {
  id: "T1",
  target: "ติดตั้งแผงเซลล์แสงอาทิตย์และตรวจสอบความปลอดภัย",
  targetKind: "สมรรถนะรายวิชา",
  courseQuote: "ติดตั้งแผงเซลล์แสงอาทิตย์และตรวจสอบความปลอดภัย",
  courseLocator: "หน้า 4",
  courseUrl: "https://bsq.vec.go.th/course.pdf",
  standardUrl: "https://tpqinet.tpqi.go.th/standard",
  standardLocator: "",
  standardQuote: "",
  uoc: "",
  eoc: "",
  criterion: "",
  reason: "",
  gap: "",
  critical: false,
  status: "INSUFFICIENT_EVIDENCE",
};
function fixture(): MappingPayload {
  const unit = (code: string, pcs: string[]) => ({
    uoc_code: code,
    uoc_desc: "งานติดตั้งแผงเซลล์แสงอาทิตย์",
    elements: [
      {
        eoc_code: code + ".1",
        eoc_desc: "ติดตั้งและตรวจสอบ",
        pc_items: pcs,
        assess_items: ["ประเมินการปฏิบัติงานจริง"],
      },
    ],
  });
  const standard: StandardDetail = {
    id: 900,
    title: "TEST ONLY ช่างระบบเซลล์แสงอาทิตย์",
    category: "TEST ONLY",
    sourceUrl: row.standardUrl,
    levels: [
      {
        levelId: 1,
        qualificationId: 1,
        levelName: "ระดับ 3",
        units: [
          unit("SOLAR-INST-101", [
            "ติดตั้งแผงเซลล์แสงอาทิตย์ตามข้อกำหนดความปลอดภัย",
            "ทดสอบระบบไฟฟ้าและตรวจสอบความปลอดภัย",
          ]),
          unit("OTHER-INST-202", [
            "ติดตั้งแผงเซลล์แสงอาทิตย์และตรวจสอบความปลอดภัย",
          ]),
        ],
      },
    ],
  };
  return {
    course: {
      success: true,
      courseCode: "TEST-101",
      courseName: "TEST ONLY งานติดตั้งโซลาร์",
      level: "ปวช.",
      credit: "3",
      standardRef: "สถาบันคุณวุฒิวิชาชีพ รหัส SOLAR-INST-101 ระดับ 3",
      learningOutcomes: row.target,
      competencies: row.target,
      description:
        "ศึกษาและปฏิบัติเกี่ยวกับการติดตั้งแผงเซลล์แสงอาทิตย์ตามข้อกำหนดความปลอดภัย",
      objectives: "มีทักษะการติดตั้งแผงเซลล์แสงอาทิตย์",
      pdfUrl: row.courseUrl,
      pdfPage: 4,
    },
    standard,
    levelName: "ระดับ 3",
    referenceStatus: "VERSION_UNRESOLVED",
    referenceNote: "ยังไม่ได้ยืนยัน",
    sourceVerified: false,
    scopeConfirmed: false,
    reviewers: [],
    rows: [{ ...row }],
    policyNote: "",
  };
}
test("Thai segmentation retains occupational terms rather than only generic stopwords", () => {
  assert.ok(terms(row.target).length >= 3);
  assert.equal(terms("และ ของ ตาม โดย").length, 0);
});
test("full document reference precedes a stronger lexical match to another UoC", () => {
  const result = analyzeMapping(fixture());
  assert.equal(result.rows[0].candidates[0].uoc, "SOLAR-INST-101");
  assert.equal(result.rows[0].candidates[0].basis, "DIRECT_CODE");
});
test("suffix-only UoC is ambiguous and never direct identity", () => {
  const p = fixture();
  p.standard.levels[0].units[0].uoc_code = "101";
  const ref = assessReference(p.course, p.standard, p.levelName);
  assert.equal(ref.status, "AMBIGUOUS_CODE");
  assert.equal(ref.matched.length, 0);
  assert.ok(
    analyzeMapping(p).rows[0].candidates.every(
      (c) => c.basis !== "DIRECT_CODE",
    ),
  );
});
test("level mismatch blocks adopting any proposal", () => {
  const p = fixture();
  p.course.standardRef = p.course.standardRef.replace("ระดับ 3", "ระดับ 4");
  const result = analyzeMapping(p);
  assert.equal(result.reference.mismatch, true);
  assert.throws(() =>
    applyCandidates(p, result, [
      { rowId: "T1", candidateId: result.rows[0].candidates[0].id },
    ]),
  );
});
test("code located only in another qualification level is blocked", () => {
  const p = fixture();
  p.course.standardRef = "สถาบันคุณวุฒิวิชาชีพ SOLAR-INST-101";
  p.standard.levels.push({
    ...p.standard.levels[0],
    levelName: "ระดับ 4",
    units: [p.standard.levels[0].units[1]],
  });
  p.levelName = "ระดับ 4";
  assert.equal(analyzeMapping(p).reference.mismatch, true);
});
test("other-agency codes do not establish TPQI identity", () => {
  const p = fixture();
  p.course.standardRef = "กรมพัฒนาฝีมือแรงงาน SOLAR-INST-101 ระดับ 3";
  assert.equal(analyzeMapping(p).reference.status, "NO_REFERENCE");
});
test("empty candidates retain targets and do not declare NONE", () => {
  const p = fixture();
  p.course.standardRef = "";
  p.rows = [{ ...row, target: "เตรียมอาหารและบริการเครื่องดื่ม" }];
  const result = analyzeMapping(p);
  assert.equal(result.summary.targets, 1);
  assert.equal(result.summary.targetsWithoutCandidates, 1);
  assert.equal(result.summary.criteriaWithoutCandidates, 3);
  assert.deepEqual(result.rows[0].candidates, []);
});
test("duplicate target relationships do not inflate analysis denominator", () => {
  const p = fixture();
  p.rows.push({ ...row, id: "T2" });
  assert.equal(analyzeMapping(p).summary.targets, 1);
});
test("all suggested quotes and locators originate in the selected source", () => {
  const p = fixture();
  const result = analyzeMapping(p);
  for (const c of result.rows[0].candidates) {
    assert.equal(c.standardQuote, c.criterion);
    assert.ok(
      p.standard.levels[0].units.some(
        (u) =>
          u.uoc_code === c.uoc &&
          u.elements.some(
            (e) => e.eoc_code === c.eoc && e.pc_items.includes(c.standardQuote),
          ),
      ),
    );
    assert.equal(c.standardUrl, p.standard.sourceUrl);
  }
});
test("description and objectives are compared as supporting text with original quotes", () => {
  const p = fixture();
  const result = analyzeMapping(p);
  const c = result.rows[0].candidates[0];
  assert.ok(
    c.courseSupport.some(
      (s) => s.kind === "คำอธิบายรายวิชา" && s.quote === p.course.description,
    ),
  );
  assert.ok(c.courseSupport.some((s) => s.kind === "จุดประสงค์รายวิชา"));
});
test("analysis is deterministic and does not mutate the working mapping", () => {
  const p = fixture(),
    before = JSON.stringify(p);
  assert.deepEqual(analyzeMapping(p), analyzeMapping(p));
  assert.equal(JSON.stringify(p), before);
});
test("adoption stays unverified, preserves targets, and flags safety", () => {
  const p = fixture(),
    result = analyzeMapping(p);
  const next = applyCandidates(p, result, [
    { rowId: "T1", candidateId: result.rows[0].candidates[0].id },
  ]);
  assert.equal(next.rows[0].status, "INSUFFICIENT_EVIDENCE");
  assert.equal(next.rows[0].target, row.target);
  assert.equal(next.rows[0].critical, true);
  assert.equal(next.referenceStatus, "VERSION_UNRESOLVED");
  assert.equal(next.sourceVerified, false);
  assert.equal(p.rows[0].criterion, "");
});
test("adoption cannot overwrite prior human work or accept invented candidates", () => {
  const p = fixture(),
    result = analyzeMapping(p);
  assert.throws(() =>
    applyCandidates(p, result, [{ rowId: "T1", candidateId: "invented" }]),
  );
  p.rows[0].criterion = "human work";
  assert.throws(() =>
    applyCandidates(p, result, [
      { rowId: "T1", candidateId: result.rows[0].candidates[0].id },
    ]),
  );
});
test("duplicate selections and nonexistent targets are rejected", () => {
  const p = fixture(),
    r = analyzeMapping(p),
    s = { rowId: "T1", candidateId: r.rows[0].candidates[0].id };
  assert.throws(() => applyCandidates(p, r, [s, s]));
  assert.throws(() => applyCandidates(p, r, [{ ...s, rowId: "missing" }]));
});
test("negation and theory-only evidence surface review flags", () => {
  const p = fixture();
  p.rows[0].target = "อธิบายการติดตั้งแผงเซลล์แสงอาทิตย์ ไม่ต้องปฏิบัติ";
  const r = analyzeMapping(p);
  assert.ok(r.rows[0].candidates[0].gaps.some((g) => g.includes("คำปฏิเสธ")));
  assert.ok(
    r.rows[0].candidates[0].gaps.some((g) => g.includes("การปฏิบัติจริง")),
  );
});
