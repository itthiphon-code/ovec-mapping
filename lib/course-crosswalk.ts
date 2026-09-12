import type {
  CertificateFile,
  CertificateLevel,
  certificateResult,
} from "./certificate-matcher";
import type { CourseDetail, StandardDetail } from "./types";

export type CrosswalkDepth = "uoc" | "eoc";
export const courseDimensions = [
  ["คำอธิบายรายวิชา", "description"],
  ["สมรรถนะรายวิชา", "competencies"],
  ["ผลลัพธ์การเรียนรู้", "learningOutcomes"],
] as const;
export const targetKindLabels: Record<string, string> = {
  outcome: "ผลลัพธ์การเรียนรู้",
  competency: "สมรรถนะรายวิชา",
  objective: "จุดประสงค์รายวิชา",
  description: "คำอธิบายรายวิชา",
};
export function occupationEvidence(
  standard: StandardDetail,
  level: StandardDetail["levels"][number] | undefined,
  uoc: string,
  eoc: string,
  pc: string,
  depth: CrosswalkDepth = "eoc",
) {
  const unit = level?.units.find((u) => u.uoc_code === uoc);
  const element = unit?.elements.find((e) => e.eoc_code === eoc);
  return [
    `อาชีพ: ${standard.title}`,
    `ระดับ: ${level?.levelName || "ยังไม่ยืนยันระดับ"}`,
    `UoC ${uoc || "ยังไม่ระบุ"}: ${unit?.uoc_desc || "ยังไม่พบชื่อหน่วยในระดับนี้"}`,
    depth === "eoc"
      ? `EoC ${eoc || "ยังไม่ระบุ"}: ${element?.eoc_desc || "ยังไม่พบชื่อหน่วยย่อยใน UoC นี้"}`
      : `หลักฐานภายในหน่วย: EoC ${eoc || "ยังไม่ระบุ"} ${element?.eoc_desc || ""}`,
    `PC: ${pc || "ยังไม่ระบุเกณฑ์การปฏิบัติงาน"}`,
  ].join("\n");
}
export type CrosswalkRow = {
  kind: string;
  courseText: string;
  courseLocator: string;
  standardText: string;
  notes: string[];
};
export function certificateCrosswalk(input: {
  file: CertificateFile;
  level: CertificateLevel;
  selected: string[];
  result: ReturnType<typeof certificateResult>;
  course: CourseDetail | null;
  depth: CrosswalkDepth;
}): CrosswalkRow[] {
  const { file, level, selected, result: r, course, depth } = input;
  const standardLevel = file.standard.levels.find(
    (l) => l.levelId === level.levelId,
  );
  const selectedSet = new Set(selected);
  const referencedUnits =
    standardLevel?.units.filter(
      (u) =>
        !r.mismatch &&
        selectedSet.has(u.uoc_code) &&
        r.course.reference.codes.includes(u.uoc_code.trim().toUpperCase()),
    ) || [];
  const rows: CrosswalkRow[] = [
    {
      kind: "คำอธิบายรายวิชา",
      courseText:
        course?.description?.trim() ||
        "ไม่ระบุคำอธิบายรายวิชาในข้อมูลต้นฉบับที่โหลดได้",
      courseLocator: `หน้าไฟล์ ${course?.pdfPage || "ยังไม่ระบุ"} / คำอธิบายรายวิชา`,
      standardText: referencedUnits.length
        ? [
            `อาชีพ: ${file.standard.title} | ${level.levelName}`,
            ...referencedUnits.map((u) => `UoC ${u.uoc_code}: ${u.uoc_desc}`),
          ].join("\n")
        : "ยังไม่มีคู่ UoC/EoC สำหรับคำอธิบายรายวิชาในชุดผลนี้",
      notes: [
        "คำอธิบายแสดงขอบเขตเนื้อหารายวิชา ชุดคำนวณเดิมยังไม่มีผลจับคู่คำอธิบายรายข้อความ",
        ...(referencedUnits.length
          ? [
              "UoC ด้านข้างมาจากรหัสในช่องอ้างอิงมาตรฐานของรายวิชา ใช้เป็นขอบเขตให้ผู้เชี่ยวชาญตรวจ ไม่ใช่ผลยืนยันความสอดคล้องของคำอธิบาย",
            ]
          : []),
        "ต้องตรวจเนื้อหา เงื่อนไข และการปฏิบัติจริงก่อนสรุปความสอดคล้อง",
      ],
    },
  ];
  for (const m of r.matches) {
    const pc =
      m.criterion && selectedSet.has(m.criterion.unit) ? m.criterion : null;
    const notes = ["ข้อเสนอรอตรวจ ยังไม่ยืนยันว่าผ่านผลลัพธ์รายวิชา"];
    if (!pc) notes.push("ยังไม่มี PC ในหน่วยที่เลือก");
    if (
      pc &&
      /ปฏิบัติ|ติดตั้ง|ทดสอบ|ซ่อม|บำรุง|ตรวจสอบ/.test(m.target.text) &&
      /อธิบาย|ความรู้|เข้าใจ/.test(pc.text)
    )
      notes.push("PC กล่าวถึงความรู้หรือการอธิบาย ต้องตรวจหลักฐานปฏิบัติเพิ่ม");
    if (/ปลอดภัย|อันตราย|ฉุกเฉิน/.test(m.target.text + (pc?.text || "")))
      notes.push("ต้องตรวจหลักฐานด้านความปลอดภัย");
    rows.push({
      kind: targetKindLabels[m.target.kind] || m.target.kind,
      courseText: m.target.text,
      courseLocator: m.target.locator,
      standardText: pc
        ? `${occupationEvidence(file.standard, standardLevel, pc.unit, pc.eoc, pc.text, depth)}\nตำแหน่ง: ${pc.locator}`
        : "ยังไม่มี PC ในหน่วยที่เลือก",
      notes,
    });
  }
  // Keep requested dimensions visible even if missing or deduplicated upstream.
  for (const [kind, field] of courseDimensions.slice(1)) {
    if (!rows.some((row) => row.kind === kind))
      rows.push({
        kind,
        courseText:
          course?.[field]?.trim() || "ไม่ระบุในข้อมูลต้นฉบับที่โหลดได้",
        courseLocator: `หน้าไฟล์ ${course?.pdfPage || "ยังไม่ระบุ"} / ${kind}`,
        standardText: "ไม่มีแถวผลจับคู่แยกสำหรับหัวข้อนี้ในชุดคำนวณ",
        notes: [
          "ให้ผู้เชี่ยวชาญตรวจเพิ่มเติม ไม่สรุปว่าไม่ครอบคลุมจากการไม่มีแถวผล",
        ],
      });
  }
  return rows;
}
