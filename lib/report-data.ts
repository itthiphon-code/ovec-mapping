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
};
export const reportDisclaimer =
  "เอกสารนี้ใช้ประกอบการพิจารณา ไม่ใช่คำตัดสินเทียบโอนหน่วยกิตหรือใบรับรองคุณวุฒิของบุคคล ต้องตรวจใบรับรอง หลักฐาน และนโยบายสถานศึกษาก่อนพิจารณาเทียบโอน";
export const editableCopyNotice = "สำเนาแก้ไขได้ โปรดตรวจฉบับรับรอง";
const basisLabels: Record<string, string> = {
  DIRECT_CODE: "พบรหัสหน่วยที่ตรงในเอกสารรายวิชา",
  DOCUMENT_TITLE: "ชื่อมาตรฐานอยู่ในเอกสารรายวิชา",
  EMBEDDING: "เสนอจากความหมายข้อความ",
};
const kindLabels: Record<string, string> = {
  outcome: "ผลลัพธ์การเรียนรู้",
  competency: "สมรรถนะรายวิชา",
  objective: "จุดประสงค์รายวิชา",
  description: "คำอธิบายรายวิชา",
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
  filterDescription: string;
  generatedAt?: string;
}): TransferReport {
  const { file, level, selected, results, detailed } = input;
  if (!selected.length || !results.length)
    throw new Error("เลือกระดับ หน่วยที่สอบผ่าน และรายวิชาก่อนดาวน์โหลดรายงาน");
  const selectedSet = new Set(selected);
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
    const paragraphs = [
      `รายวิชา: ${c.code} ${c.nameTh} | ${c.level} | ${c.deptCode} ${c.deptName}`,
      `ที่มาของข้อเสนอ: ${basisLabels[r.basis] || r.basis}`,
      `ข้อความอ้างอิงมาตรฐานในรายวิชา: ${present(r.course.reference.text)}`,
      `เอกสารรายวิชา: ${present(c.pdfUrl)} | หน้า ${c.pdfPage || "ยังไม่ระบุ"}`,
      `ไฟล์หลักฐาน: ${r.course.sourcePath} | SHA-256: ${r.course.sourceHash}`,
    ];
    sections.push({
      title: `${detailed ? "ตารางหลักฐาน" : "แหล่งอ้างอิง"} ${c.code}`,
      pageBreak: detailed,
      paragraphs,
      ...(detailed
        ? {
            table: {
              headers: [
                "ข้อกำหนดรายวิชา",
                "UoC EoC และเกณฑ์ PC",
                "สิ่งที่ต้องตรวจ",
              ],
              rows: r.matches.map((m) => {
                // Never export a PC outside the user-selected certificate scope.
                const pc =
                  m.criterion && selectedSet.has(m.criterion.unit)
                    ? m.criterion
                    : null;
                const notes = [
                  "ข้อเสนอรอตรวจ ยังไม่ยืนยันว่าผ่านผลลัพธ์รายวิชา",
                ];
                if (!pc) notes.push("ยังไม่มี PC ในหน่วยที่เลือก");
                if (
                  pc &&
                  /ปฏิบัติ|ติดตั้ง|ทดสอบ|ซ่อม|บำรุง|ตรวจสอบ/.test(
                    m.target.text,
                  ) &&
                  /อธิบาย|ความรู้|เข้าใจ/.test(pc.text)
                )
                  notes.push(
                    "PC กล่าวถึงความรู้หรือการอธิบาย ต้องตรวจหลักฐานปฏิบัติเพิ่ม",
                  );
                if (
                  /ปลอดภัย|อันตราย|ฉุกเฉิน/.test(
                    m.target.text + (pc?.text || ""),
                  )
                )
                  notes.push("ต้องตรวจหลักฐานด้านความปลอดภัย");
                return [
                  `${kindLabels[m.target.kind] || m.target.kind}\n${m.target.text}\n${m.target.locator}`,
                  pc
                    ? `${pc.unit} / ${pc.eoc}\n${pc.text}\n${pc.locator}`
                    : "ยังไม่มี PC ในหน่วยที่เลือก",
                  notes.join("\n"),
                ];
              }),
            },
          }
        : {}),
    });
  }
  return {
    title: detailed
      ? "รายงานผลการเทียบรายวิชาพร้อมหลักฐาน"
      : "รายงานสรุปผลการเทียบรายวิชา",
    filename: `ovec-certificate-${file.standard.id}-level-${level.levelId}-${detailed ? "evidence" : "summary"}`,
    generatedAt: input.generatedAt || new Date().toISOString(),
    status: "ข้อเสนอประกอบการพิจารณา ยังไม่ได้ตรวจใบรับรองหรืออนุมัติเทียบโอน",
    meta: [
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
  if (mode === "matrix")
    sections.push({
      title: "ตารางเทียบข้อกำหนด",
      table: {
        headers: [
          "ข้อกำหนดรายวิชา",
          "UoC EoC และ PC",
          "ผล เหตุผล และช่องว่าง",
          "ตำแหน่งหลักฐาน",
        ],
        rows: p.rows.map((r) => [
          `${r.id} ${r.targetKind}\n${r.target}`,
          `${present(r.uoc)} / ${present(r.eoc)}\n${present(r.criterion)}`,
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
