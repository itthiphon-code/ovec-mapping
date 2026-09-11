import type { MappingPayload, MappingRow, Review, User } from "./types";

export function coverage(rows: MappingRow[]) {
  const targets = new Map<string, MappingRow[]>();
  for (const row of rows) {
    const key = row.target.trim();
    targets.set(key, [...(targets.get(key) || []), row]);
  }
  const total = targets.size;
  const groups = [...targets.values()];
  const full = groups.filter((group) =>
    group.every((row) => row.status === "FULL"),
  ).length;
  return {
    total,
    full,
    partial: groups.filter(
      (group) =>
        !group.every((r) => r.status === "FULL") &&
        group.some((r) => ["FULL", "PARTIAL"].includes(r.status)),
    ).length,
    unknown: groups.filter((group) =>
      group.some((r) => r.status === "INSUFFICIENT_EVIDENCE"),
    ).length,
    percentage: total ? Math.round((full / total) * 100) : null,
  };
}
export function referenceCheck(reference: string, levelName: string) {
  const tpqiLine =
    reference
      .split(/\n/)
      .find((line) => /สถาบันคุณวุฒิ|สคช\.|TPQI/i.test(line)) || "";
  if (!tpqiLine)
    return {
      status: "NO_REFERENCE",
      note: "ยังไม่พบอ้างอิง TPQI โดยตรง ต้องยืนยันขอบเขตกับเอกสาร",
    };
  const expected = tpqiLine.match(/ระดับ\s*(\d+)/)?.[1];
  const selected = levelName.match(/\d+/)?.[0];
  if (expected && selected && expected !== selected)
    return {
      status: "LEVEL_MISMATCH",
      note: `เอกสารอ้างระดับ ${expected} แต่เลือก ${levelName}`,
    };
  return {
    status: "VERSION_UNRESOLVED",
    note: "พบอ้างอิง TPQI ต้องตรวจรหัสเต็ม อาชีพ และฉบับก่อนยืนยัน",
  };
}
export function evidenceProblems(payload: MappingPayload) {
  const errors: string[] = [];
  if (!payload.scopeConfirmed)
    errors.push("ยืนยันขอบเขตข้อกำหนดรายวิชาให้ครบก่อนส่งตรวจ");
  if (!payload.sourceVerified)
    errors.push("ตรวจเอกสารต้นฉบับทั้งสองฝั่งก่อนส่งตรวจ");
  if (payload.referenceStatus !== "VERIFIED")
    errors.push("ยังไม่ได้ยืนยันรหัส ระดับ และฉบับมาตรฐาน");
  if (!payload.rows.length)
    errors.push("ต้องมีข้อกำหนดรายวิชาอย่างน้อยหนึ่งข้อ");
  for (const row of payload.rows) {
    if (
      ["FULL", "PARTIAL"].includes(row.status) &&
      (!row.uoc ||
        !row.eoc ||
        !row.criterion ||
        !row.standardQuote ||
        !row.courseQuote ||
        !row.standardLocator ||
        !row.courseLocator ||
        !row.reason)
    )
      errors.push(
        `ข้อ ${row.id}: ต้องมีเกณฑ์ หลักฐาน ตำแหน่ง และเหตุผลทั้งสองฝั่ง`,
      );
    if (row.status === "FULL" && row.critical && row.gap.trim())
      errors.push(`ข้อ ${row.id}: ยังมีช่องว่างสำคัญ`);
    if (row.status === "PARTIAL" && !row.gap.trim())
      errors.push(`ข้อ ${row.id}: ระบุสิ่งที่ยังขาด`);
    if (["NONE", "CONFLICT"].includes(row.status) && !row.reason.trim())
      errors.push(`ข้อ ${row.id}: ระบุเหตุผลการวินิจฉัย`);
  }
  return errors;
}
export function canReview(user: User, owner: string, reviewers: string[]) {
  return (
    user.email !== owner &&
    reviewers.includes(user.email) &&
    ["expert_tpqi", "expert_course"].includes(user.role) &&
    !!user.active &&
    !!user.scope &&
    !!user.valid_until &&
    user.valid_until >= new Date().toISOString().slice(0, 10)
  );
}
export function approvalProblems(
  payload: MappingPayload,
  reviews: Review[],
  hash: string,
) {
  const errors = evidenceProblems(payload);
  const valid = reviews.filter(
    (r) => r.content_hash === hash && r.verdict === "ACCEPT",
  );
  if (
    !valid.some((r) => r.role === "expert_tpqi") ||
    !valid.some((r) => r.role === "expert_course") ||
    new Set(valid.map((r) => r.reviewer)).size < 2
  )
    errors.push(
      "ต้องมีความเห็นรับรองจากผู้เชี่ยวชาญ TPQI และหลักสูตรคนละคนในฉบับนี้",
    );
  if (reviews.some((r) => r.content_hash === hash && r.verdict !== "ACCEPT"))
    errors.push("ยังมีความเห็นให้แก้ไขหรือไม่รับรอง");
  return errors;
}
export function safeSourceUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      [
        "dles.vec.go.th",
        "bsq.vec.go.th",
        "tpqinet.tpqi.go.th",
        "tpqinet-api.tpqi.go.th",
        "qualifications.tpqi.go.th",
        "www.tpqi.go.th",
      ].includes(url.hostname)
    );
  } catch {
    return false;
  }
}
