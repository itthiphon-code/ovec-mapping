import type { CourseDetail, StandardDetail } from "./types";
import type { BulkTarget } from "./bulk-types";
import { referenceCodes } from "./auto-mapping";
export function bulkTargets(course: CourseDetail): BulkTarget[] {
  const values = [
    { text: course.learningOutcomes, kind: "ผลลัพธ์การเรียนรู้" },
    ...(course.competencies || "")
      .split(/\n(?=\s*\d+[.)])/)
      .map((text) => ({ text, kind: "สมรรถนะรายวิชา" })),
  ];
  const seen = new Set<string>();
  return values
    .filter((t) => {
      const text = t.text?.trim();
      if (!text || seen.has(text)) return false;
      seen.add(text);
      return true;
    })
    .map((t, i) => ({
      id: `T${i + 1}`,
      text: t.text,
      kind: t.kind,
      locator: `หน้าไฟล์ ${course.pdfPage || "ยังไม่ระบุ"} / ${t.kind}`,
    }));
}
export function bulkReference(course: CourseDetail) {
  const text = (course.standardRef || "")
    .split(/\n(?=\s*\d+[.)])/)
    .filter((t) => /สถาบันคุณวุฒิ|สคช\.|TPQI/i.test(t))
    .join("\n");
  return {
    text,
    codes: referenceCodes(text),
    level: text.match(/ระดับ\s*([0-9]+)/)?.[1] || null,
  };
}
export function referenceTier(
  ref: ReturnType<typeof bulkReference>,
  standard: StandardDetail,
  level: StandardDetail["levels"][number],
) {
  const codes = new Set(
    level.units.map((u) => u.uoc_code.trim().toUpperCase()),
  );
  const direct = ref.codes.some((c) => codes.has(c));
  const allCodeMatch = standard.levels.some((l) =>
    l.units.some((u) => ref.codes.includes(u.uoc_code.trim().toUpperCase())),
  );
  const named = standard.title.length > 4 && ref.text.includes(standard.title);
  const mismatch =
    (!!ref.level && ref.level !== level.levelName.match(/[0-9]+/)?.[0]) ||
    (allCodeMatch && !direct);
  return {
    tier: direct ? 0 : named ? 1 : 2,
    basis: direct ? "DIRECT_CODE" : named ? "DOCUMENT_TITLE" : "EMBEDDING",
    mismatch,
    note: mismatch
      ? "ระดับหรือหน่วยที่อ้างอิงไม่ตรง จึงยังเชื่อมเป็นข้อสรุปไม่ได้"
      : direct
        ? "รหัสเต็มตรงกับอ้างอิงในรายวิชา ยังต้องตรวจอาชีพและฉบับ"
        : named
          ? "ชื่อมาตรฐานอยู่ในอ้างอิงรายวิชา ยังต้องตรวจรหัสและฉบับ"
          : "เสนอจากความหมายข้อความ ยังไม่มีรหัสเต็มยืนยันคู่มาตรฐาน",
  };
}
export function dot(a: ArrayLike<number>, b: ArrayLike<number>) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return Math.max(-1, Math.min(1, sum));
}
export function normalizedMean(
  vectors: ArrayLike<number>[],
  weights?: number[],
) {
  const out = new Float32Array(384);
  vectors.forEach((v, i) => {
    const w = weights?.[i] ?? 1;
    for (let j = 0; j < 384; j++) out[j] += v[j] * w;
  });
  let n = 0;
  for (const x of out) n += x * x;
  if (!n || !Number.isFinite(n)) throw Error("Invalid aggregate vector");
  n = Math.sqrt(n);
  return out.map((v) => v / n);
}
export function candidateOrder(
  a: { tier: number; mismatch: boolean; score: number; key: string },
  b: { tier: number; mismatch: boolean; score: number; key: string },
) {
  return (
    a.tier - b.tier ||
    Number(a.mismatch) - Number(b.mismatch) ||
    b.score - a.score ||
    a.key.localeCompare(b.key)
  );
}
export function uniqueStandardCandidates<
  T extends {
    standardId: number;
    tier: number;
    mismatch: boolean;
    score: number;
    key: string;
  },
>(candidates: T[], limit = 3) {
  const used = new Set<number>();
  return candidates
    .sort(candidateOrder)
    .filter((c) => {
      if (used.has(c.standardId)) return false;
      used.add(c.standardId);
      return true;
    })
    .slice(0, limit);
}
