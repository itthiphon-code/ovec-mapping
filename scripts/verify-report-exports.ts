/** Generate local QA artifacts from real public evidence; never writes hosted data. */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import assert from "node:assert/strict";
import {
  certificateResult,
  orderCertificateResults,
  type CertificateFile,
} from "../lib/certificate-matcher";
import {
  createCertificateReport,
  createMappingReport,
} from "../lib/report-data";
import { createReportPdf, createReportWord } from "../lib/report-export";
import { fixture } from "../tests/fixtures/mapping";
import type { Mapping } from "../lib/types";

const directory = "tmp/report-qa";
mkdirSync(directory, { recursive: true });
const file: CertificateFile = JSON.parse(
  gunzipSync(
    readFileSync("public/certificates/certificate-20260911-e5-01/151.json.gz"),
  ).toString(),
);
const level = file.results.find(
  (l) => l.courses.length > 1 && l.criteria.length,
)!;
assert.ok(level);
const selected = [...new Set(level.criteria.map((c) => c.unit))];
const results = level.courses
  .map((c) => certificateResult(c, level, selected))
  .sort(orderCertificateResults);
const fonts = {
  regular: readFileSync("public/fonts/Sarabun-Regular.ttf"),
  bold: readFileSync("public/fonts/Sarabun-Bold.ttf"),
};
const base = { file, level, selected, generatedAt: "2026-09-12T12:00:00Z" };
const mapping: Mapping = {
  id: "qa-draft",
  title: "ตัวอย่างทดสอบรูปแบบเอกสาร ไม่ใช่ผลรับรอง",
  course_id: "qa-course",
  standard_id: "qa-standard",
  owner: "qa@example.test",
  status: "DRAFT",
  revision: 1,
  payload: JSON.stringify(fixture()),
  content_hash: "a".repeat(64),
  created_at: base.generatedAt,
  updated_at: base.generatedAt,
};
const reports = [
  [
    "learner-summary",
    createCertificateReport({
      ...base,
      results,
      detailed: false,
      filterDescription:
        "ตัวอย่างตรวจรูปแบบ เลือกทุกหน่วยเพื่อทดสอบ ไม่ใช่ข้อมูลใบรับรองของบุคคล",
    }),
  ],
  [
    "learner-evidence",
    createCertificateReport({
      ...base,
      results: results.slice(0, 2),
      detailed: true,
      filterDescription:
        "ตัวอย่างตรวจรูปแบบ จำกัดสองวิชา ไม่ใช่ข้อมูลใบรับรองของบุคคล",
    }),
  ],
  [
    "staff-matrix",
    createMappingReport(mapping, [], "matrix", base.generatedAt),
  ],
] as const;
for (const [name, report] of reports) {
  writeFileSync(`${directory}/${name}.json`, JSON.stringify(report, null, 2));
  const pdf = await createReportPdf(report, fonts);
  const pdfBytes = new Uint8Array(await pdf.arrayBuffer());
  assert.equal(new TextDecoder().decode(pdfBytes.subarray(0, 5)), "%PDF-");
  writeFileSync(`${directory}/${name}.pdf`, pdfBytes);
  const word = await createReportWord(report, fonts);
  writeFileSync(
    `${directory}/${name}.docx`,
    new Uint8Array(await word.arrayBuffer()),
  );
  console.log(`${name}: PDF ${pdf.size} bytes, DOCX ${word.size} bytes`);
}
