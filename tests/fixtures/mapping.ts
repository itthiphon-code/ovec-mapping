import type {
  MappingPayload,
  MappingRow,
  StandardDetail,
} from "../../lib/types";
export const row: MappingRow = {
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
export function fixture(): MappingPayload {
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
