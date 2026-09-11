import type { CourseDetail, MappingPayload, StandardDetail } from "./types";

export const ENGINE_VERSION = "document-first-lexical/1.0.0";
const segmenter = new Intl.Segmenter("th", { granularity: "word" });
const stop = new Set([
  "การ",
  "งาน",
  "และ",
  "ใน",
  "ของ",
  "ที่",
  "ได้",
  "ให้",
  "ตาม",
  "ด้วย",
  "เป็น",
  "มี",
  "กับ",
  "โดย",
  "เพื่อ",
  "จาก",
  "หรือ",
  "สามารถ",
  "อย่าง",
  "เกี่ยวกับ",
  "ใช้",
  "ผู้",
  "ข้อ",
  "มาตรฐาน",
  "ถูกต้อง",
  "เหมาะสม",
  "หลักการ",
  "ความ",
  "ปฏิบัติ",
]);
export function terms(text: string) {
  return [
    ...new Set(
      [...segmenter.segment(text.normalize("NFKC").toLowerCase())]
        .filter((x) => x.isWordLike)
        .map((x) => x.segment)
        .filter((x) => x.length > 1 && !stop.has(x) && !/^\d+$/.test(x)),
    ),
  ];
}
export function referenceCodes(text: string) {
  return [
    ...new Set(text.toUpperCase().match(/\b[A-Z]{2,}(?:-[A-Z0-9]+)+\b/g) || []),
  ];
}
function sameCode(a: string, b: string) {
  return a.trim().toUpperCase() === b.trim().toUpperCase();
}
export function assessReference(
  course: CourseDetail,
  standard: StandardDetail,
  levelName: string,
) {
  const reference = course.standardRef || "";
  const tpqi =
    reference
      .split(/\n(?=\s*\d+[.)])/)
      .find((line) => /สถาบันคุณวุฒิ|สคช\.|TPQI/i.test(line)) || "";
  const codes = referenceCodes(tpqi);
  const allUnits = standard.levels.flatMap((l) => l.units);
  const matched = codes.filter((c) =>
    allUnits.some((u) => sameCode(u.uoc_code, c)),
  );
  const shortCodes = codes.filter((c) =>
    allUnits.some(
      (u) =>
        !sameCode(u.uoc_code, c) && c.endsWith("-" + u.uoc_code.toUpperCase()),
    ),
  );
  const level = tpqi.match(/ระดับ\s*([0-9]+)/)?.[1];
  const selected = levelName.match(/[0-9]+/)?.[0];
  const levelMismatch = !!level && !!selected && level !== selected;
  const selectedUnits =
    standard.levels.find((l) => l.levelName === levelName)?.units || [];
  const outsideLevel =
    matched.length > 0 &&
    !selectedUnits.some((u) => matched.some((c) => sameCode(c, u.uoc_code)));
  const mismatch = levelMismatch || outsideLevel;
  return {
    codes,
    matched,
    shortCodes,
    expectedLevel: level || null,
    selectedLevel: selected || null,
    mismatch,
    status: mismatch
      ? "LEVEL_MISMATCH"
      : matched.length
        ? "DIRECT_CODE"
        : shortCodes.length
          ? "AMBIGUOUS_CODE"
          : tpqi
            ? "UNRESOLVED"
            : "NO_REFERENCE",
    note: levelMismatch
      ? `เอกสารอ้างระดับ ${level} แต่เลือก ${levelName}`
      : outsideLevel
        ? "รหัสที่เอกสารอ้างอิงอยู่ในมาตรฐาน แต่ไม่อยู่ในระดับที่เลือก"
        : matched.length
          ? `พบรหัสเต็มตรงในมาตรฐาน: ${matched.join(", ")} — ยังต้องตรวจอาชีพและฉบับเอกสาร`
          : shortCodes.length
            ? "พบเฉพาะส่วนท้ายของรหัส ยังยืนยันว่าเป็นมาตรฐานเดียวกันไม่ได้"
            : tpqi
              ? "ยังไม่พบรหัสเต็มที่ยืนยันคู่มาตรฐานนี้"
              : "ยังไม่พบอ้างอิง TPQI โดยตรงในรายวิชา",
  };
}
export type AutoCandidate = {
  id: string;
  uoc: string;
  eoc: string;
  criterion: string;
  standardQuote: string;
  standardLocator: string;
  standardUrl: string;
  basis: "DIRECT_CODE" | "TEXT" | "EMBEDDING";
  similarity?: number;
  cosine?: number;
  sharedTerms: string[];
  rankScore: number;
  reason: string;
  gaps: string[];
  critical: boolean;
  courseSupport: {
    kind: string;
    quote: string;
    locator: string;
    sharedTerms: string[];
    similarity?: number;
  }[];
};
export type AutoResult = {
  engine: string;
  embedding?: import("./embedding-matcher").EmbeddingMetadata;
  courseTitle: string;
  standardTitle: string;
  levelName: string;
  reference: ReturnType<typeof assessReference>;
  comparedSections: { kind: string; available: boolean }[];
  rows: {
    rowId: string;
    target: string;
    targetKind: string;
    courseQuote: string;
    courseLocator: string;
    courseUrl: string;
    candidates: AutoCandidate[];
    gaps: string[];
  }[];
  summary: {
    targets: number;
    targetsWithCandidates: number;
    targetsWithoutCandidates: number;
    criteria: number;
    criteriaWithoutCandidates: number;
  };
  unmatchedCriteria: { uoc: string; eoc: string; criterion: string }[];
  limitations: string[];
};

/** Candidate retrieval only: scores are lexical ranking, never competency coverage. */
export function analyzeMapping(payload: MappingPayload): AutoResult {
  const reference = assessReference(
    payload.course,
    payload.standard,
    payload.levelName,
  );
  const level = payload.standard.levels.find(
    (l) => l.levelName === payload.levelName,
  );
  if (!level) throw new Error("Selected qualification level does not exist");
  const sections = [
    {
      kind: "ผลลัพธ์การเรียนรู้",
      quote: payload.course.learningOutcomes || "",
    },
    { kind: "สมรรถนะรายวิชา", quote: payload.course.competencies || "" },
    { kind: "จุดประสงค์รายวิชา", quote: payload.course.objectives || "" },
    { kind: "คำอธิบายรายวิชา", quote: payload.course.description || "" },
  ].map((s) => ({ ...s, words: new Set(terms(s.quote)) }));
  const criteria = level.units.flatMap((u, ui) =>
    u.elements.flatMap((e, ei) =>
      e.pc_items.map((pc, pi) => ({
        id: `${ui}:${ei}:${pi}`,
        uoc: u.uoc_code,
        eoc: e.eoc_code,
        criterion: pc,
        words: terms(pc),
        direct: reference.matched.some((c) => sameCode(c, u.uoc_code)),
      })),
    ),
  );
  const supportByCriterion = new Map(
    criteria.map((c) => [
      c.id,
      sections
        .map((s) => ({
          kind: s.kind,
          quote: s.quote,
          locator: `หน้าไฟล์ ${payload.course.pdfPage || "ยังไม่ระบุ"} / ${s.kind}`,
          sharedTerms: c.words.filter((w) => s.words.has(w)),
        }))
        .filter((s) => s.sharedTerms.length >= 2),
    ]),
  );
  const frequency = new Map<string, number>();
  for (const c of criteria)
    for (const t of c.words) frequency.set(t, (frequency.get(t) || 0) + 1);
  const weight = (t: string) =>
    1 + Math.log((criteria.length + 1) / ((frequency.get(t) || 0) + 1));
  const used = new Set<string>();
  const seen = new Set<string>();
  const targets = payload.rows.filter((r) => {
    const key = r.target.trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const rows = targets.map((row) => {
    const words = terms(row.target);
    const wordSet = new Set(words);
    const candidates = criteria
      .map((c) => {
        const shared = c.words.filter((w) => wordSet.has(w));
        const courseSupport = supportByCriterion.get(c.id)!;
        const denominator = Math.sqrt(
          words.reduce((sum, w) => sum + weight(w) ** 2, 0) *
            c.words.reduce((sum, w) => sum + weight(w) ** 2, 0),
        );
        const score = denominator
          ? shared.reduce((sum, w) => sum + weight(w) ** 2, 0) / denominator
          : 0;
        return { ...c, shared, score, courseSupport };
      })
      .filter((c) => c.direct || (c.shared.length >= 2 && c.score >= 0.12))
      .sort(
        (a, b) =>
          Number(b.direct) - Number(a.direct) ||
          b.score - a.score ||
          b.courseSupport.length - a.courseSupport.length ||
          a.id.localeCompare(b.id),
      )
      .slice(0, 3)
      .map((c) => {
        used.add(c.id);
        const critical = /ปลอดภัย|อันตราย|ป้องกัน|ไฟฟ้าแรงสูง|ฉุกเฉิน/.test(
          c.criterion + " " + row.target,
        );
        const gaps = [
          "ต้องตรวจงาน บริบท เครื่องมือ ระดับคุณภาพ และวิธีประเมินกับเอกสารทั้งสองฝั่ง",
        ];
        if (reference.mismatch) gaps.push(reference.note);
        if (!c.shared.length)
          gaps.push("พบอ้างอิงรหัส แต่ยังไม่มีคำเฉพาะร่วมในข้อกำหนดนี้");
        if (
          /ความรู้|เข้าใจ|อธิบาย/.test(row.target) &&
          /ปฏิบัติ|ติดตั้ง|ทดสอบ|ซ่อม|ตรวจสอบ/.test(c.criterion)
        )
          gaps.push(
            "ตรวจว่าหลักฐานรายวิชาแสดงการปฏิบัติจริง ไม่ใช่เฉพาะความรู้",
          );
        if (
          /ห้าม|ไม่(?:ต้อง|ให้|สามารถ)|ยกเว้น/.test(
            row.target + " " + c.criterion,
          )
        )
          gaps.push("พบคำปฏิเสธหรือข้อยกเว้น ต้องตรวจความหมายก่อนใช้คู่เทียบ");
        if (critical)
          gaps.push("มีประเด็นความปลอดภัย ต้องตรวจเป็นข้อกำหนดสำคัญ");
        return {
          id: c.id,
          uoc: c.uoc,
          eoc: c.eoc,
          criterion: c.criterion,
          standardQuote: c.criterion,
          standardLocator: `${payload.levelName} / UoC ${c.uoc} / EoC ${c.eoc} / PC ลำดับ ${Number(c.id.split(":")[2]) + 1}`,
          standardUrl: payload.standard.sourceUrl,
          basis: c.direct ? ("DIRECT_CODE" as const) : ("TEXT" as const),
          sharedTerms: c.shared,
          rankScore: Math.round(c.score * 1000) / 1000,
          reason: c.direct
            ? `รหัส UoC เต็ม ${c.uoc} ตรงกับอ้างอิงในรายวิชา${c.shared.length ? ` และพบคำร่วม ${c.shared.join(", ")}` : ""}`
            : `พบคำเฉพาะร่วมในข้อกำหนดและเกณฑ์: ${c.shared.join(", ")}`,
          gaps,
          critical,
          courseSupport: c.courseSupport,
        };
      });
    return {
      rowId: row.id,
      target: row.target,
      targetKind: row.targetKind,
      courseQuote: row.courseQuote || row.target,
      courseLocator: row.courseLocator,
      courseUrl: row.courseUrl,
      candidates,
      gaps: candidates.length
        ? []
        : [
            "ยังไม่พบหลักฐานพอเสนอคู่เกณฑ์ ต้องตรวจเอกสารเพิ่ม ไม่สรุปว่าไม่ครอบคลุม",
          ],
    };
  });
  const unmatchedCriteria = criteria
    .filter((c) => !used.has(c.id))
    .map((c) => ({ uoc: c.uoc, eoc: c.eoc, criterion: c.criterion }));
  return {
    engine: ENGINE_VERSION,
    courseTitle: `${payload.course.courseCode} ${payload.course.courseName}`,
    standardTitle: payload.standard.title,
    levelName: payload.levelName,
    reference,
    comparedSections: sections.map((s) => ({
      kind: s.kind,
      available: !!s.quote.trim(),
    })),
    rows,
    summary: {
      targets: rows.length,
      targetsWithCandidates: rows.filter((r) => r.candidates.length).length,
      targetsWithoutCandidates: rows.filter((r) => !r.candidates.length).length,
      criteria: criteria.length,
      criteriaWithoutCandidates: unmatchedCriteria.length,
    },
    unmatchedCriteria,
    limitations: [
      "เป็นข้อเสนอจากกฎและคำร่วม ไม่ใช่ผลรับรองความเทียบเท่า",
      "ให้อ้างอิงรหัสเต็มก่อนการจัดอันดับข้อความ ไม่ใช้ส่วนท้ายของรหัสเป็นหลักฐานตรง",
      "เปรียบเทียบเฉพาะข้อกำหนดและระดับที่เลือกในฉบับนี้ ไม่ใช่การสำรวจทั้งคลัง",
      "การเลือกใช้ข้อเสนอคงสถานะหลักฐานไม่พอจนกว่าคนจะตรวจและวินิจฉัย",
      "ไม่วิเคราะห์ความหมายเชิงลึกด้วยโมเดลภาษาและไม่คำนวณหน่วยกิต",
    ],
  };
}

export function applyCandidates(
  payload: MappingPayload,
  result: AutoResult,
  selections: { rowId: string; candidateId: string }[],
): MappingPayload {
  if (result.reference.mismatch)
    throw new Error("ไม่สามารถใช้ข้อเสนอข้ามระดับที่เอกสารอ้างอิง");
  if (new Set(selections.map((s) => s.rowId)).size !== selections.length)
    throw new Error("เลือกได้หนึ่งข้อเสนอต่อแถวต่อครั้ง");
  const rows = payload.rows.map((row) => {
    const selection = selections.find((s) => s.rowId === row.id);
    if (!selection) return row;
    const candidate = result.rows
      .find((r) => r.rowId === row.id)
      ?.candidates.find((c) => c.id === selection.candidateId);
    if (!candidate) throw new Error("ไม่พบข้อเสนอในผลวิเคราะห์ฉบับนี้");
    if (row.criterion || row.status !== "INSUFFICIENT_EVIDENCE")
      throw new Error(
        "มีผลจัดทำในแถวที่เลือกแล้ว กรุณาแก้ด้วยมือเพื่อรักษางานเดิม",
      );
    return {
      ...row,
      uoc: candidate.uoc,
      eoc: candidate.eoc,
      criterion: candidate.criterion,
      standardQuote: candidate.standardQuote,
      standardLocator: candidate.standardLocator,
      reason: `ข้อเสนออัตโนมัติ รอตรวจ: ${candidate.reason}`,
      gap: candidate.gaps.join("\n"),
      critical: row.critical || candidate.critical,
      status: "INSUFFICIENT_EVIDENCE" as const,
    };
  });
  if (selections.some((s) => !payload.rows.some((r) => r.id === s.rowId)))
    throw new Error("ไม่พบข้อกำหนดในฉบับงาน");
  return { ...payload, rows, scopeConfirmed: false, sourceVerified: false };
}

export type AnalysisRecord = {
  id: string;
  mapping_id: string;
  revision: number;
  input_hash: string;
  engine: string;
  actor: string;
  result: string;
  created_at: string;
};
