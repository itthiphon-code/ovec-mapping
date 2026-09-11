export type Role =
  | "admin"
  | "editor"
  | "expert_tpqi"
  | "expert_course"
  | "approver"
  | "registrar"
  | "learner"
  | "viewer";
export type User = {
  email: string;
  name: string;
  role: Role;
  scope: string;
  valid_until: string | null;
  active: number;
};
export type CatalogItem = {
  id: string;
  kind: "course" | "standard";
  code: string;
  title: string;
  level: string;
  category: string;
  department: string;
  payload: string;
  detail: string | null;
  source_url: string;
  fetched_at: string;
  hash: string;
};
export type SourceCourse = {
  code: string;
  nameTh: string;
  nameEn?: string;
  credit: string;
  deptCode: string;
  deptName: string;
  level: string;
  category: string;
  pdfUrl: string;
  pdfPage: number;
};
export type CourseDetail = {
  success: boolean;
  courseCode: string;
  courseName: string;
  courseNameEn?: string;
  credit: string;
  standardRef: string;
  learningOutcomes: string;
  objectives: string;
  competencies: string;
  description: string;
  pdfUrl: string;
  pdfPage: number;
  level: string;
};
export type SourceStandard = {
  id: number;
  title: string;
  category: string;
  branch?: string;
  levelNames: string[];
  unitCount: number;
  elementCount: number;
  hasContent: boolean;
};
export type StandardDetail = {
  id: number;
  title: string;
  category: string;
  sourceUrl: string;
  publicDate?: string;
  levels: {
    levelId: number;
    levelName: string;
    qualificationId: number;
    units: {
      uoc_code: string;
      uoc_desc: string;
      uoc_cert?: string;
      elements: {
        eoc_code: string;
        eoc_desc: string;
        pc_items: string[];
        assess_items: string[];
      }[];
    }[];
  }[];
};
export type RowStatus =
  "INSUFFICIENT_EVIDENCE" | "FULL" | "PARTIAL" | "NONE" | "CONFLICT";
export type MappingRow = {
  id: string;
  target: string;
  targetKind: string;
  status: RowStatus;
  uoc: string;
  eoc: string;
  criterion: string;
  standardQuote: string;
  courseQuote: string;
  standardUrl: string;
  courseUrl: string;
  standardLocator: string;
  courseLocator: string;
  reason: string;
  gap: string;
  critical: boolean;
};
export type MappingPayload = {
  course: CourseDetail;
  standard: StandardDetail;
  levelName: string;
  referenceStatus: string;
  referenceNote: string;
  scopeConfirmed: boolean;
  sourceVerified: boolean;
  rows: MappingRow[];
  reviewers: string[];
  policyNote: string;
};
export type Mapping = {
  id: string;
  title: string;
  course_id: string;
  standard_id: string;
  owner: string;
  status: string;
  revision: number;
  payload: string;
  content_hash: string;
  created_at: string;
  updated_at: string;
};
export type Review = {
  id: string;
  reviewer: string;
  role: string;
  verdict: string;
  comment: string;
  revision: number;
  created_at: string;
  content_hash: string;
};
export type DocumentRecord = {
  id: string;
  owner: string;
  title: string;
  kind: string;
  filename: string;
  mime: string;
  bytes: number;
  hash: string;
  status: string;
  created_at: string;
};
export type Application = {
  id: string;
  owner: string;
  title: string;
  status: string;
  revision: number;
  payload: string;
  created_at: string;
  updated_at: string;
};
export const roleLabels: Record<Role, string> = {
  admin: "ผู้ดูแลระบบ",
  editor: "ผู้จัดทำตาราง",
  expert_tpqi: "ผู้เชี่ยวชาญ TPQI",
  expert_course: "ผู้เชี่ยวชาญหลักสูตร",
  approver: "ผู้มีอำนาจอนุมัติ",
  registrar: "งานทะเบียน",
  learner: "ผู้เรียน",
  viewer: "ผู้เยี่ยมชม",
};
export const statusLabels: Record<string, string> = {
  DRAFT: "ฉบับร่าง",
  IN_REVIEW: "รอผู้เชี่ยวชาญ",
  CHANGES_REQUESTED: "ส่งกลับแก้ไข",
  APPROVED: "รับรองแล้ว",
  PUBLISHED: "เผยแพร่แล้ว",
  REJECTED: "ไม่รับรอง",
  WITHDRAWN: "ถอนการรับรอง",
  REVIEW_REQUIRED: "ต้องทบทวน",
  SUBMITTED: "ยื่นคำร้องแล้ว",
  EVIDENCE_CHECK: "ตรวจหลักฐาน",
  NEEDS_INFORMATION: "ขอข้อมูลเพิ่มเติม",
  ASSESSMENT: "รอประเมิน",
  FULL: "ครอบคลุมครบ",
  PARTIAL: "ครอบคลุมบางส่วน",
  NONE: "ไม่ครอบคลุม",
  INSUFFICIENT_EVIDENCE: "หลักฐานไม่พอ",
  CONFLICT: "ข้อมูลขัดกัน",
  UPLOADED: "รอตรวจเอกสาร",
};
