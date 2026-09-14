import {
  certificateCrosswalk,
  courseDimensions,
  occupationEvidence,
  type CrosswalkDepth,
} from "./course-crosswalk";
import type { BulkDetail } from "./bulk-types";
import { certificateResult } from "./certificate-matcher";
import type { CertificateFile, CertificateLevel } from "./certificate-matcher";
import { roleLabels, statusLabels } from "./types";
import type { Mapping, MappingPayload, Review, Role } from "./types";

export type ReportSection = {
  title: string;
  paragraphs?: string[];
  table?: { headers: string[]; rows: string[][] };
  pageBreak?: boolean;
};
export type TransferReport = {
  title: string;
  filename: string;
  generatedAt: string;
  landscape?: boolean;
  status: string;
  meta: string[];
  sections: ReportSection[];
  official?: OfficialReportDetails;
};
// User-entered print details are not verified institutional identity or approval.
export type OfficialReportDetails = {
  organization?: string;
  department?: string;
  referenceNumber?: string;
  preparedBy?: string;
  position?: string;
};
export const reportDisclaimer =
  "เอกสารนี้ใช้ประกอบการพิจารณา ไม่ใช่คำตัดสินเทียบโอนหน่วยกิตหรือใบรับรองคุณวุฒิของบุคคล ต้องตรวจใบรับรอง หลักฐาน และนโยบายสถานศึกษาก่อนพิจารณาเทียบโอน";
export const editableCopyNotice = "สำเนาแก้ไขได้ โปรดตรวจฉบับรับรอง";
const basisLabels: Record<string, string> = {
  DIRECT_CODE: "พบรหัสหน่วยที่ตรงในเอกสารรายวิชา",
  DOCUMENT_TITLE: "ชื่อมาตรฐานอยู่ในเอกสารรายวิชา",
  EMBEDDING: "เสนอจากความหมายข้อความ",
};
const present = (s: string | undefined) => s?.trim() || "ยังไม่ระบุในข้อมูล";
const timestamp = (s: string) =>
  new Date(s).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
function certificateGaps(r: ReturnType<typeof certificateResult>) {
  return [
    ...(r.mismatch
      ? ["ระดับหรือ UoC ที่รายวิชาอ้างอิงไม่ตรงกับระดับใบรับรอง ต้องตรวจเพิ่ม"]
      : []),
    ...(r.missingUnits.length
      ? [
          `หน่วยที่รายวิชาอ้างอิงแต่ยังไม่ได้เลือก: ${r.missingUnits.join(", ")}`,
        ]
      : []),
    ...(r.score === null
      ? ["หน่วยที่เลือกยังไม่มี PC เพียงพอสำหรับคำนวณ"]
      : []),
    "รอผู้เชี่ยวชาญตรวจขอบเขตใบรับรอง ฉบับหลักสูตร และหลักฐานปฏิบัติ",
  ];
}
export function createCertificateReport(input: {
  file: CertificateFile;
  level: CertificateLevel;
  selected: string[];
  results: ReturnType<typeof certificateResult>[];
  detailed: boolean;
  depth?: CrosswalkDepth;
  sources?: Record<string, BulkDetail>;
  filterDescription: string;
  generatedAt?: string;
}): TransferReport {
  const { file, level, selected, results, detailed } = input;
  if (!selected.length || !results.length)
    throw new Error("เลือกระดับ หน่วยที่สอบผ่าน และรายวิชาก่อนดาวน์โหลดรายงาน");
  const sections: ReportSection[] = [
    {
      title: "รายวิชาที่เสนอให้พิจารณาเทียบโอน",
      table: {
        headers: [
          "รายวิชาและสาขา",
          "ทฤษฎี ปฏิบัติ หน่วยกิต",
          "หลักฐานและสิ่งที่ต้องตรวจ",
        ],
        rows: results.map((r) => [
          `${r.course.summary.code} ${r.course.summary.nameTh}\n${r.course.summary.level} ${r.course.summary.deptCode} ${r.course.summary.deptName}`,
          present(r.course.summary.credit),
          `${basisLabels[r.basis] || r.basis}\n${certificateGaps(r).join("\n")}`,
        ]),
      },
    },
    {
      title: "เอกสารและแนวทางดำเนินการ",
      paragraphs: [
        "เตรียมใบรับรองคุณวุฒิหรือหนังสือรับรองผลสอบ และเอกสารแนบที่ระบุระดับและหน่วยสมรรถนะที่สอบผ่าน",
        "แนบข้อมูลรายวิชาและหลักฐานการปฏิบัติงานหรือการประเมินที่เกี่ยวข้อง เอกสารยืนยันตัวบุคคลให้ส่งตามที่สถานศึกษาร้องขอ",
        "ยื่นคำร้องกับสถานศึกษาเพื่อให้ผู้เชี่ยวชาญตรวจหลักฐานและกำหนดการประเมินเพิ่มเติม รายการข้างต้นเป็นคำแนะนำ ต้องตรวจข้อกำหนดกับงานทะเบียนอีกครั้ง",
      ],
    },
  ];
  for (const r of results) {
    const c = r.course.summary;
    const source = input.sources?.[r.course.id];
    if (detailed && !source)
      throw new Error(
        `ยังโหลดต้นฉบับรายวิชา ${c.code} ไม่ครบ กรุณาลองดาวน์โหลดใหม่`,
      );
    const course = source?.course || null;
    const paragraphs = [
      `รายวิชา: ${c.code} ${c.nameTh} | ${c.level} | ${c.deptCode} ${c.deptName}`,
      `ที่มาของข้อเสนอ: ${basisLabels[r.basis] || r.basis}`,
      `ข้อความอ้างอิงมาตรฐานในรายวิชา: ${present(r.course.reference.text)}`,
      `เอกสารรายวิชา: ${present(course?.pdfUrl || c.pdfUrl)} | หน้า ${course?.pdfPage || c.pdfPage || "ยังไม่ระบุ"}`,
      `ไฟล์หลักฐาน: ${r.course.sourcePath} | SHA-256: ${r.course.sourceHash}`,
    ];
    sections.push({
      title: `${detailed ? "เอกสารต้นฉบับรายวิชา" : "แหล่งอ้างอิง"} ${c.code}`,
      pageBreak: detailed,
      paragraphs: [
        ...paragraphs,
        ...(detailed
          ? [
              `อาชีพ: ${file.standard.title} | ${level.levelName}`,
              ...courseDimensions.map(
                ([label, key]) => `${label}: ${present(course?.[key])}`,
              ),
              ...(course && course.courseName !== c.nameTh
                ? [
                    `ชื่อในต้นฉบับรายละเอียด: ${course.courseName} ต่างจากดัชนี ต้องตรวจฉบับเอกสาร`,
                  ]
                : []),
            ]
          : []),
      ],
    });
    if (detailed)
      sections.push({
        title: `ตารางเทียบรายวิชา ${c.code} กับอาชีพและ ${input.depth === "uoc" ? "UoC" : "EoC"}`,
        pageBreak: true,
        table: {
          headers: [
            "คำอธิบาย สมรรถนะ และผลลัพธ์การเรียนรู้",
            "อาชีพ หน่วย UoC และ EoC",
            "สถานะและสิ่งที่ต้องตรวจ",
          ],
          rows: certificateCrosswalk({
            file,
            level,
            selected,
            result: r,
            course,
            depth: input.depth || "eoc",
          }).map((row) => [
            `${row.kind}\n${row.courseText}\n${row.courseLocator}`,
            row.standardText,
            row.notes.join("\n"),
          ]),
        },
      });
  }
  return {
    title: detailed
      ? "รายงานผลการเทียบรายวิชาพร้อมหลักฐาน"
      : "รายงานสรุปผลการเทียบรายวิชา",
    landscape: detailed,
    filename: `ovec-certificate-${file.standard.id}-level-${level.levelId}-${detailed ? "evidence" : "summary"}`,
    generatedAt: input.generatedAt || new Date().toISOString(),
    status: "ข้อเสนอประกอบการพิจารณา ยังไม่ได้ตรวจใบรับรองหรืออนุมัติเทียบโอน",
    meta: [
      ...(detailed
        ? [
            `แสดงระดับการเทียบ: ${input.depth === "uoc" ? "UoC หน่วยสมรรถนะ พร้อมหลักฐาน EoC/PC ภายในหน่วย" : "EoC หน่วยสมรรถนะย่อย ภายใต้ UoC พร้อมเกณฑ์ PC"}`,
          ]
        : []),
      `มาตรฐาน: ${file.standard.title} | ${level.levelName}`,
      `UoC ที่ผู้ใช้ระบุว่าสอบผ่าน: ${selected.join(", ")}`,
      `ขอบเขตรายงาน: ${results.length} จาก ${level.courses.length} วิชาที่คัดไว้สำหรับระดับนี้ | ${input.filterDescription}`,
      "ผลนี้เป็นชุดรายวิชาที่คัดไว้ อาจมีวิชาอื่นที่เกี่ยวข้องนอกชุดนี้ การไม่พบผลไม่ใช่ข้อสรุปว่าเทียบโอนไม่ได้",
      `แหล่งมาตรฐาน: ${file.standard.sourceUrl}`,
      `รอบคำนวณ: ${file.runId} | รอบข้อมูลต้นฉบับ: ${file.sourceRunId}`,
      `SHA-256 ข้อมูลต้นฉบับ: ${file.sourceHash}`,
    ],
    sections,
  };
}

export type MappingReportMode = "matrix" | "summary" | "evidence" | "reviews";
export function createMappingReport(
  mapping: Mapping,
  reviews: Review[],
  mode: MappingReportMode,
  generatedAt = new Date().toISOString(),
): TransferReport {
  const p = JSON.parse(mapping.payload) as MappingPayload;
  const approved = ["APPROVED", "PUBLISHED"].includes(mapping.status);
  const rowLabel = (s: string) => statusLabels[s] || s;
  const sections: ReportSection[] = [];
  if (mode === "matrix" || mode === "evidence")
    sections.push({
      title: "คำอธิบาย สมรรถนะ และผลลัพธ์การเรียนรู้จากต้นฉบับ",
      paragraphs: courseDimensions.map(
        ([label, key]) => `${label}: ${present(p.course[key])}`,
      ),
    });
  if (mode === "matrix")
    sections.push({
      title: "ตารางเทียบข้อกำหนด",
      pageBreak: true,
      table: {
        headers: [
          "ข้อกำหนดรายวิชา",
          "อาชีพ UoC EoC และ PC",
          "ผล เหตุผล และช่องว่าง",
          "ตำแหน่งหลักฐาน",
        ],
        rows: p.rows.map((r) => [
          `${r.id} ${r.targetKind}\n${r.target}`,
          occupationEvidence(
            p.standard,
            p.standard.levels.find((l) => l.levelName === p.levelName),
            r.uoc,
            r.eoc,
            r.criterion,
          ),
          `${rowLabel(r.status)}\n${r.reason || "ยังไม่มีข้อวินิจฉัย"}\nสิ่งที่ขาด: ${r.gap || "ยังไม่ระบุ"}${r.critical ? "\nข้อกำหนดสำคัญ ต้องตรวจยืนยัน" : ""}`,
          `มาตรฐาน: ${present(r.standardLocator)}\nรายวิชา: ${present(r.courseLocator)}`,
        ]),
      },
    });
  if (mode === "summary")
    sections.push({
      title: "สรุปตามขอบเขตในตาราง",
      paragraphs: [
        `ข้อกำหนดทั้งหมด ${p.rows.length} ข้อ | ระบุว่าครบ ${p.rows.filter((r) => r.status === "FULL").length} ข้อ`,
        `สถานะอ้างอิง: ${present(p.referenceNote)}`,
        `ขอบเขตและข้อจำกัด: ${present(p.policyNote)}`,
      ],
      table: {
        headers: ["ข้อที่ยังต้องดำเนินการ", "ผลและช่องว่าง"],
        rows: p.rows
          .filter((r) => r.status !== "FULL")
          .map((r) => [r.target, `${rowLabel(r.status)}\n${present(r.gap)}`]),
      },
    });
  if (mode === "matrix" || mode === "evidence") {
    for (const r of p.rows)
      sections.push({
        title: `หลักฐาน ${r.id}`,
        paragraphs: [
          `มาตรฐาน: ${present(r.standardQuote)}`,
          `ตำแหน่ง: ${present(r.standardLocator)} | ${present(r.standardUrl)}`,
          `รายวิชา: ${present(r.courseQuote)}`,
          `ตำแหน่ง: ${present(r.courseLocator)} | ${present(r.courseUrl)}`,
        ],
      });
  }
  if (mode === "reviews") {
    sections.push({
      title: "ความเห็นผู้เชี่ยวชาญ",
      paragraphs: reviews.length
        ? [
            "ตรวจเลขฉบับและ SHA-256 ของแต่ละความเห็น ความเห็นฉบับเก่าไม่ใช่การรับรองฉบับปัจจุบัน",
          ]
        : ["ยังไม่มีความเห็นผู้เชี่ยวชาญในระบบ"],
    });
    for (const r of reviews)
      sections.push({
        title: `${r.reviewer} ${roleLabels[r.role as Role] || r.role}`,
        paragraphs: [
          r.comment,
          `ความเห็น: ${r.verdict} | ฉบับ ${r.revision} | ${timestamp(r.created_at)}`,
          `SHA-256 ฉบับที่ตรวจ: ${r.content_hash}`,
          r.revision === mapping.revision &&
          r.content_hash === mapping.content_hash
            ? "ตรงกับฉบับข้อมูลในรายงาน"
            : "ความเห็นนี้เป็นคนละฉบับข้อมูลกับรายงาน",
        ],
      });
  }
  return {
    title: {
      matrix: "ตารางเทียบสมรรถนะรายวิชา",
      summary: "สรุปผลการเทียบเคียงสมรรถนะ",
      evidence: "บัญชีหลักฐานอ้างอิง",
      reviews: "บันทึกความเห็นผู้เชี่ยวชาญ",
    }[mode],
    filename: `ovec-mapping-${mapping.id}-v${mapping.revision}-${mode}`,
    generatedAt,
    landscape: mode === "matrix",
    status: approved
      ? "ตารางผ่านการรับรองตามขอบเขตที่ระบุ ไม่ใช่ผลอนุมัติเทียบโอนรายบุคคล"
      : `${rowLabel(mapping.status)} ยังไม่ใช่ตารางรับรองที่ใช้พิจารณาได้`,
    meta: [
      `เลขรายงาน: ${mapping.id} | ฉบับ ${mapping.revision}`,
      `รายวิชา: ${mapping.title} | ${p.course.level} | ทฤษฎี ปฏิบัติ หน่วยกิต: ${p.course.credit}`,
      `มาตรฐาน: ${p.standard.title} | ${p.levelName}`,
      `อ้างอิงหลักสูตร: ${present(p.course.standardRef)}`,
      `เอกสารรายวิชา: ${p.course.pdfUrl} | หน้า ${p.course.pdfPage}`,
      `แหล่งมาตรฐาน: ${p.standard.sourceUrl}`,
      `ปรับปรุงข้อมูล: ${timestamp(mapping.updated_at)} | สถานะ: ${rowLabel(mapping.status)}`,
      `SHA-256 ฉบับข้อมูล: ${mapping.content_hash}`,
      `ตรวจสถานะปัจจุบันในระบบ: /mappings/${mapping.id}`,
    ],
    sections,
  };
}
