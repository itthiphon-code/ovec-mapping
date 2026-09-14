import test from "node:test";
import assert from "node:assert/strict";
import {
  createCertificateReport,
  createMappingReport,
  editableCopyNotice,
} from "../lib/report-data";
import {
  createReportWord,
  pdfDefinition,
  reportLayout,
} from "../lib/report-export";
import {
  certificateResult,
  type CertificateFile,
} from "../lib/certificate-matcher";
import { fixture } from "./fixtures/mapping";
import type { Mapping, Review } from "../lib/types";
import { readFileSync } from "node:fs";

const p = fixture();
const file: CertificateFile = {
  standard: p.standard,
  provenance: {},
  runId: "test-run",
  sourceRunId: "source-run",
  sourceHash: "a".repeat(64),
  results: [
    {
      levelId: 1,
      levelName: "ระดับ 3",
      criteria: [
        {
          unit: "U1",
          eoc: "E1",
          text: "อธิบายความปลอดภัย",
          locator: "U1 / E1 / PC 1",
        },
        {
          unit: "U2",
          eoc: "E2",
          text: "เกณฑ์นอกขอบเขตใบรับรอง",
          locator: "U2 / E2 / PC 1",
        },
      ],
      courses: [
        {
          id: "D:C1",
          summary: {
            code: "C1",
            nameTh: "ติดตั้งอย่างปลอดภัย",
            credit: "1-2-2",
            deptCode: "D",
            deptName: "สาขาทดสอบ",
            level: "ปวส.",
            category: "",
            pdfUrl: "https://example.test/course.pdf",
            pdfPage: 12,
          },
          targets: [
            {
              id: "T1",
              kind: "competency",
              text: "ติดตั้งและทดสอบความปลอดภัย",
              locator: "หน้า 12",
            },
          ],
          reference: { text: "อ้างอิง U1 U2", codes: ["U1", "U2"], level: "3" },
          basis: "DIRECT_CODE",
          mismatch: false,
          retrievalScore: 99.12345,
          matches: [
            [
              [0, 0.81],
              [1, 0.99],
            ],
          ],
          sourcePath: "/bulk/test.json",
          sourceHash: "b".repeat(64),
        },
      ],
    },
  ],
};
function cert(detailed = true) {
  const level = file.results[0];
  return createCertificateReport({
    file,
    level,
    selected: ["U1"],
    results: level.courses.map((c) => certificateResult(c, level, ["U1"])),
    detailed,
    sources: {
      "D:C1": {
        runId: "test-run",
        courseId: "D:C1",
        summary: file.results[0].courses[0].summary,
        course: {
          ...p.course,
          description: "ศึกษาการติดตั้งอย่างปลอดภัย",
          competencies: "ติดตั้งและทดสอบความปลอดภัย",
          learningOutcomes: "ติดตั้งและทดสอบความปลอดภัย",
        },
        provenance: {},
        courseHash: "c".repeat(64),
        targets: [],
        pairs: [],
        status: "COMPUTED",
        note: "",
      },
    },
    filterDescription: "ระดับ ปวส.",
    generatedAt: "2026-09-12T12:00:00Z",
  });
}
const m: Mapping = {
  id: "test-mapping",
  title: p.course.courseCode + " " + p.course.courseName,
  course_id: "C",
  standard_id: "S",
  owner: "test@example.test",
  status: "DRAFT",
  revision: 2,
  payload: JSON.stringify(p),
  content_hash: "d".repeat(64),
  created_at: "2026-09-12T00:00:00Z",
  updated_at: "2026-09-12T00:00:00Z",
};

test("learner report preserves selected PC evidence, missing units, source locators and gaps without scores", () => {
  const report = cert();
  const text = JSON.stringify(report);
  assert.ok(text.includes("อธิบายความปลอดภัย"));
  assert.ok(text.includes("ยังไม่ได้เลือก: U2"));
  assert.ok(text.includes("ต้องตรวจหลักฐานปฏิบัติเพิ่ม"));
  assert.ok(text.includes("หน้า 12"));
  assert.ok(text.includes("source-run"));
  assert.ok(!text.includes("เกณฑ์นอกขอบเขตใบรับรอง"));
  assert.ok(!/81%|99\.12345|"score"|"cosine"/.test(text));
  assert.ok(report.status.includes("ยังไม่ได้ตรวจใบรับรอง"));
});
test("summary retains all filtered courses and source references but omits detailed PC tables", () => {
  const report = cert(false);
  assert.equal(report.sections[0].table?.rows.length, 1);
  assert.ok(report.meta.some((s) => s.includes("1 จาก 1")));
  assert.ok(
    report.sections.some((s) =>
      s.paragraphs?.some((t) => t.includes(p.course.pdfUrl)),
    ),
  );
  assert.ok(!JSON.stringify(report).includes("อธิบายความปลอดภัย"));
});
test("empty certificate scope cannot create a report", () => {
  assert.throws(() =>
    createCertificateReport({
      file,
      level: file.results[0],
      selected: [],
      results: [],
      detailed: false,
      filterDescription: "",
    }),
  );
});
test("mapping reports keep draft, withdrawn and approved table status distinct from credit decisions", () => {
  for (const status of ["DRAFT", "WITHDRAWN", "APPROVED", "PUBLISHED"]) {
    const report = createMappingReport({ ...m, status }, [], "matrix");
    assert.ok(report.meta.some((s) => s.includes(m.content_hash)));
    if (["APPROVED", "PUBLISHED"].includes(status))
      assert.ok(report.status.includes("ไม่ใช่ผลอนุมัติเทียบโอนรายบุคคล"));
    else assert.ok(report.status.includes("ยังไม่ใช่ตารางรับรอง"));
  }
});
test("review report explicitly marks stale review revisions and hashes", () => {
  const review: Review = {
    id: "R",
    reviewer: "expert@example.test",
    role: "expert_tpqi",
    verdict: "APPROVE",
    comment: "ทดสอบ",
    revision: 1,
    content_hash: "old",
    created_at: m.created_at,
  };
  const report = createMappingReport(m, [review], "reviews");
  assert.ok(JSON.stringify(report).includes("คนละฉบับข้อมูล"));
});
test("Word exporter produces genuine OOXML, escaped text, embedded font and editable-copy notice", async () => {
  const report = cert();
  report.official = {
    organization: "วิทยาลัยตัวอย่าง <ทดสอบ>",
    preparedBy: "ผู้จัดทำทดสอบ",
    referenceNumber: "ศธ 0000/ทดสอบ",
  };

  report.sections.push({
    title: "ทดสอบ XML",
    paragraphs: ['<script>&"เนื้อหา"</script>'],
  });
  const blob = await createReportWord(report, {
    regular: readFileSync("public/fonts/THSarabunNew-Regular.ttf"),
    bold: readFileSync("public/fonts/THSarabunNew-Bold.ttf"),
  });
  const data = new Uint8Array(await blob.arrayBuffer());
  assert.equal(data[0], 0x50);
  assert.equal(data[1], 0x4b);
  assert.ok(blob.size > 50_000);
  // A zip signature alone is insufficient: inspect the document payload.
  const { execFileSync } = await import("node:child_process");
  const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const dir = mkdtempSync(`${tmpdir()}/ovec-docx-`);
  try {
    writeFileSync(`${dir}/test.docx`, data);
    const xml = execFileSync(
      "unzip",
      ["-p", `${dir}/test.docx`, "word/document.xml"],
      { encoding: "utf8" },
    );
    assert.ok(xml.includes(editableCopyNotice));
    assert.ok(xml.includes("&lt;script&gt;&amp;"));
    assert.ok(xml.includes("w:tblHeader"));
    assert.ok(xml.includes("วิทยาลัยตัวอย่าง &lt;ทดสอบ&gt;"));
    assert.ok(xml.includes("ผู้จัดทำทดสอบ"));
    assert.ok(xml.includes("ผู้ตรวจสอบหลักฐาน"));
    assert.ok(xml.includes('w:left="1701"'));
    assert.ok(xml.includes('w:right="1134"'));
    assert.ok(xml.includes('w:top="1417"'));
    assert.ok(xml.includes('w:orient="landscape"'));
    const styles = execFileSync(
      "unzip",
      ["-p", `${dir}/test.docx`, "word/styles.xml"],
      { encoding: "utf8" },
    );
    assert.ok(styles.includes('w:sz w:val="32"'));
    assert.ok(styles.includes('w:szCs w:val="32"'));
    assert.ok(styles.includes('w:lang w:val="th-TH"'));
    assert.ok(!styles.includes("115E59"));
    const fonts = execFileSync(
      "unzip",
      ["-p", `${dir}/test.docx`, "word/fontTable.xml"],
      { encoding: "utf8" },
    );
    assert.ok(fonts.includes("embedRegular"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("PDF layout preserves the disclaimer, Thai font and repeating table headers", () => {
  const definition = pdfDefinition(cert());
  assert.equal(definition.defaultStyle?.font, "TH Sarabun New");
  assert.equal(definition.defaultStyle?.fontSize, 16);
  assert.deepEqual(definition.pageMargins, reportLayout.margins);
  function extract(value: unknown): string {
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.map(extract).join("");
    if (value && typeof value === "object")
      return Object.values(value).map(extract).join("");
    return "";
  }
  assert.ok(
    extract(definition.content)
      .replaceAll("\u200b", "")
      .normalize("NFKD")
      .includes("ไม่ใช่คำตัดสินเทียบโอนหน่วยกิต".normalize("NFKD")),
  );
  assert.ok(JSON.stringify(definition).includes('"headerRows":1'));
});
