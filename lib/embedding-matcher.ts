import { EMBEDDING } from "../public/embedding-config.js";
import {
  analyzeMapping,
  assessReference,
  terms,
  type AutoResult,
  type AutoCandidate,
} from "./auto-mapping";
import type { MappingPayload } from "./types";
export { EMBEDDING };
type Group = { indices: number[]; weights: number[] };
export type EmbeddingPlan = {
  config: typeof EMBEDDING;
  texts: string[];
  targets: { rowId: string; group: Group }[];
  criteria: {
    id: string;
    uoc: string;
    eoc: string;
    criterion: string;
    group: Group;
  }[];
  sections: { kind: string; quote: string; group: Group }[];
};
export type EmbeddingMetadata = {
  config: typeof EMBEDDING;
  planHash: string;
  vectorHash: string;
  archiveKey: string;
  provenance: "browser-inference-server-cosine";
  meanSimilarity: number | null;
  scoredTargets: number;
  linkedCount: number;
  appliedRevision?: number;
  appliedHash?: string;
};
export function buildEmbeddingPlan(payload: MappingPayload): EmbeddingPlan {
  const texts: string[] = [],
    lookup = new Map<string, number>();
  const group = (text: string): Group => {
    const chars = Array.from(text.trim());
    const indices: number[] = [],
      weights: number[] = [];
    for (
      let start = 0;
      start < chars.length;
      start += EMBEDDING.chunkCodepoints
    ) {
      const chunk = chars
        .slice(start, start + EMBEDDING.chunkCodepoints)
        .join("");
      const input = EMBEDDING.prefix + chunk;
      let index = lookup.get(input);
      if (index === undefined) {
        index = texts.length;
        lookup.set(input, index);
        texts.push(input);
      }
      indices.push(index);
      weights.push(Array.from(chunk).length);
    }
    return { indices, weights };
  };
  const seen = new Set<string>();
  const targets = payload.rows
    .filter((r) => {
      const key = r.target.trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((r) => ({ rowId: r.id, group: group(r.target) }));
  const level = payload.standard.levels.find(
    (l) => l.levelName === payload.levelName,
  );
  if (!level) throw new Error("ไม่พบระดับมาตรฐานที่เลือก");
  // Preserve full UoC/EoC context and PC, without truncation or code-token boosting.
  const criteria = level.units.flatMap((u, ui) =>
    u.elements.flatMap((e, ei) =>
      e.pc_items.flatMap((pc, pi) =>
        pc.trim()
          ? [
              {
                id: `${ui}:${ei}:${pi}`,
                uoc: u.uoc_code,
                eoc: e.eoc_code,
                criterion: pc,
                group: group(
                  [u.uoc_desc, e.eoc_desc, pc].filter(Boolean).join("\n"),
                ),
              },
            ]
          : [],
      ),
    ),
  );
  const sections = [
    { kind: "ผลลัพธ์การเรียนรู้", quote: payload.course.learningOutcomes },
    { kind: "สมรรถนะรายวิชา", quote: payload.course.competencies },
    { kind: "จุดประสงค์รายวิชา", quote: payload.course.objectives },
    { kind: "คำอธิบายรายวิชา", quote: payload.course.description },
  ]
    .filter((s) => s.quote?.trim())
    .map((s) => ({ ...s, group: group(s.quote) }));
  if (!targets.length || !criteria.length)
    throw new Error("ต้องมีข้อกำหนดรายวิชาและเกณฑ์มาตรฐานก่อนเปรียบเทียบ");
  if (
    criteria.length > 3000 ||
    texts.length > EMBEDDING.maxTexts ||
    targets.length > 250
  )
    throw new Error(
      "ข้อมูลเกินขอบเขตการประมวลผล กรุณาแบ่งข้อกำหนดก่อน (ไม่เกิน 3,000 ข้อความและ 250 เป้าหมาย)",
    );
  return { config: EMBEDDING, texts, targets, criteria, sections };
}
export function decodeVectors(encoded: string[], count: number): number[][] {
  if (encoded.length !== count)
    throw new Error("จำนวนเวกเตอร์ไม่ตรงกับข้อความต้นทาง");
  return encoded.map((value) => {
    if (!/^[A-Za-z0-9+/]{2048}$/.test(value))
      throw new Error("รูปแบบเวกเตอร์ไม่ถูกต้อง");
    const bytes = Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
    const view = new DataView(bytes.buffer);
    const vector = Array.from({ length: EMBEDDING.dimensions }, (_, i) =>
      view.getFloat32(i * 4, true),
    );
    const norm = Math.hypot(...vector);
    if (!vector.every(Number.isFinite) || Math.abs(norm - 1) > 0.01)
      throw new Error("เวกเตอร์ต้องมีค่าจำกัดและผ่านการปรับความยาวเป็นหนึ่ง");
    return vector;
  });
}
export function cosine(a: number[], b: number[]) {
  if (!a.length || a.length !== b.length) throw new Error("มิติเวกเตอร์ไม่ตรง");
  const norm = Math.hypot(...a) * Math.hypot(...b);
  if (!Number.isFinite(norm) || !norm) throw new Error("เวกเตอร์ไม่ถูกต้อง");
  return Math.max(
    -1,
    Math.min(1, a.reduce((sum, v, i) => sum + v * b[i], 0) / norm),
  );
}
export const similarityPercent = (score: number) =>
  Math.round(Math.max(0, Math.min(1, score)) * 1000) / 10;
function aggregate(g: Group, vectors: number[][]) {
  const mean = Array<number>(EMBEDDING.dimensions).fill(0);
  g.indices.forEach((index, i) => {
    if (!vectors[index] || vectors[index].length !== EMBEDDING.dimensions)
      throw new Error("ขาดเวกเตอร์ที่ใช้เปรียบเทียบ");
    vectors[index].forEach((v, j) => {
      mean[j] += v * g.weights[i];
    });
  });
  const norm = Math.hypot(...mean);
  if (!Number.isFinite(norm) || norm < 1e-10)
    throw new Error("ไม่สามารถรวมเวกเตอร์ข้อความ");
  return mean.map((v) => v / norm);
}
export function matchEmbeddings(
  payload: MappingPayload,
  plan: EmbeddingPlan,
  vectors: number[][],
): AutoResult {
  // Reuse evidence flags/quotes only; every candidate below is ranked by actual vectors.
  const result = analyzeMapping(payload);
  result.engine = EMBEDDING.engine;
  const reference = assessReference(
    payload.course,
    payload.standard,
    payload.levelName,
  );
  const criteria = plan.criteria.map((c) => ({
    ...c,
    vector: aggregate(c.group, vectors),
    direct: reference.matched.includes(c.uoc.trim().toUpperCase()),
  }));
  const sections = plan.sections.map((s) => ({
    ...s,
    vector: aggregate(s.group, vectors),
    words: new Set(terms(s.quote)),
  }));
  const used = new Set<string>();
  const baseRows = new Map(result.rows.map((r) => [r.rowId, r]));
  result.rows = plan.targets.map((t) => {
    const row = baseRows.get(t.rowId)!;
    const vector = aggregate(t.group, vectors);
    const candidates: AutoCandidate[] = criteria
      .map((c) => ({ ...c, score: cosine(vector, c.vector) }))
      .sort(
        (a, b) =>
          Number(b.direct) - Number(a.direct) ||
          b.score - a.score ||
          a.id.localeCompare(b.id),
      )
      .slice(0, 3)
      .map((c) => {
        used.add(c.id);
        const prior = row.candidates.find((x) => x.id === c.id);
        const critical = /ปลอดภัย|อันตราย|ป้องกัน|ไฟฟ้าแรงสูง|ฉุกเฉิน/.test(
          row.target + c.criterion,
        );
        const gaps = prior?.gaps || [
          "ต้องตรวจงาน บริบท เครื่องมือ คุณภาพ และวิธีประเมินจากเอกสารทั้งสองฝั่ง",
        ];
        if (
          !prior &&
          /ห้าม|ไม่(?:ต้อง|ให้|สามารถ)|ยกเว้น/.test(row.target + c.criterion)
        )
          gaps.push("พบคำปฏิเสธหรือข้อยกเว้น ต้องตรวจความหมาย");
        if (
          !prior &&
          /ความรู้|เข้าใจ|อธิบาย/.test(row.target) &&
          /ปฏิบัติ|ติดตั้ง|ทดสอบ|ซ่อม|ตรวจสอบ/.test(c.criterion)
        )
          gaps.push("ต้องตรวจหลักฐานปฏิบัติจริงเพิ่มเติมจากความรู้");
        if (reference.mismatch && !gaps.includes(reference.note))
          gaps.push(reference.note);
        if (critical && !prior)
          gaps.push("มีประเด็นความปลอดภัย ต้องตรวจเป็นข้อกำหนดสำคัญ");
        const percent = similarityPercent(c.score);
        return {
          id: c.id,
          uoc: c.uoc,
          eoc: c.eoc,
          criterion: c.criterion,
          standardQuote: c.criterion,
          standardUrl: payload.standard.sourceUrl,
          standardLocator: `${payload.levelName} / UoC ${c.uoc} / EoC ${c.eoc} / PC ลำดับ ${Number(c.id.split(":")[2]) + 1}`,
          basis: c.direct ? "DIRECT_CODE" : "EMBEDDING",
          sharedTerms: [],
          rankScore: c.score,
          similarity: percent,
          cosine: c.score,
          reason: `${c.direct ? "อ้างอิงรหัสเต็มตรง จัดลำดับก่อน · " : ""}Embedding ${percent.toFixed(1)}% (cosine × 100) จากความหมายข้อความ UoC/EoC/PC กับข้อกำหนดรายวิชา ยังไม่ใช่ผลรับรอง`,
          gaps,
          critical,
          courseSupport: sections.map((s) => ({
            kind: s.kind,
            quote: s.quote,
            locator: `หน้าไฟล์ ${payload.course.pdfPage || "ยังไม่ระบุ"} / ${s.kind}`,
            sharedTerms: terms(c.criterion).filter((w) => s.words.has(w)),
            similarity: similarityPercent(cosine(s.vector, c.vector)),
          })),
        };
      });
    return { ...row, candidates, gaps: [] };
  });
  result.unmatchedCriteria = criteria
    .filter((c) => !used.has(c.id))
    .map(({ uoc, eoc, criterion }) => ({ uoc, eoc, criterion }));
  result.summary = {
    targets: result.rows.length,
    targetsWithCandidates: result.rows.length,
    targetsWithoutCandidates: 0,
    criteria: criteria.length,
    criteriaWithoutCandidates: result.unmatchedCriteria.length,
  };
  result.limitations = [
    "เปอร์เซ็นต์ = max(0, cosine similarity) × 100 ของ Embedding ความหมายข้อความ ไม่ใช่โอกาสถูกต้อง ร้อยละสมรรถนะ หรือหน่วยกิต",
    "E5 มักให้คะแนนอยู่ใกล้กันแม้ข้อความต่างกัน ใช้จัดอันดับภายในคู่ที่เลือก ยังไม่มีเกณฑ์คะแนนผ่านที่สอบเทียบด้วยผู้เชี่ยวชาญ",
    "จัดรหัสอ้างอิงเต็มก่อนคะแนนข้อความ และไม่เชื่อมอัตโนมัติเมื่อระดับในเอกสารไม่ตรง",
    "เทียบข้อกำหนดกับบริบท UoC + EoC + PC ครบทุกข้อความ แบ่งช่วงละ 320 ตัวอักษรยูนิโค้ด รวมเวกเตอร์โดยถ่วงน้ำหนักความยาวและปรับความยาวเป็นหนึ่ง",
    "คะแนนจากหัวข้อรายวิชาทั้งสี่แสดงแยกเพื่อช่วยตรวจ ไม่มีการเพิ่มคะแนนอ้างอิงหรือคำร่วมลงใน cosine",
    "โมเดลประมวลผลในเบราว์เซอร์ เซิร์ฟเวอร์ตรวจรูปแบบเวกเตอร์และคำนวณคะแนน ไม่ได้รับรองว่าอุปกรณ์ผู้ใช้รันโมเดลโดยไม่มีการดัดแปลง",
    "คู่ที่ได้อันดับสูงสุดเป็นข้อเสนอรอตรวจเท่านั้น เก็บฉบับต้นทาง รุ่นโมเดล เวกเตอร์ และประวัติการเชื่อมเพื่อทบทวนย้อนหลัง",
  ];
  return result;
}
export function bestEmbeddingSelections(
  payload: MappingPayload,
  result: AutoResult,
) {
  if (result.reference.mismatch) return [];
  return result.rows.flatMap((r) => {
    const row = payload.rows.find((x) => x.id === r.rowId);
    return row &&
      !row.criterion &&
      !row.reason &&
      !row.standardQuote &&
      !row.uoc &&
      !row.eoc &&
      !row.gap &&
      !row.critical &&
      row.status === "INSUFFICIENT_EVIDENCE" &&
      r.candidates.length
      ? [{ rowId: r.rowId, candidateId: r.candidates[0].id }]
      : [];
  });
}
