import { catalogDetail, searchCatalog } from "./sources";
import { assessReference, referenceCodes, terms } from "./auto-mapping";
import type { CatalogItem, CourseDetail, StandardDetail } from "./types";

export type Recommendation = {
  id: string;
  title: string;
  sourceUrl: string;
  basis: "DIRECT_CODE" | "DOCUMENT_TITLE" | "AMBIGUOUS_CODE" | "TEXT";
  reason: string;
  sharedTerms: string[];
  levels: { name: string; mismatch: boolean; note: string }[];
};
export type RecommendationResult = {
  items: Recommendation[];
  queries: string[];
  searched: number;
  detailsChecked: number;
  detailsUnavailable: number;
  sourceDegraded: boolean;
  reference: string;
  courseUrl: string;
  courseLocator: string;
  scope: string;
};

export async function recommendStandards(
  courseId: string,
): Promise<RecommendationResult> {
  const courseResult = await catalogDetail(courseId);
  if (courseResult.item.kind !== "course")
    throw new Error("ต้องเลือกรายวิชาก่อนค้นมาตรฐาน");
  const course = courseResult.data as CourseDetail;
  const ref = course.standardRef || "";
  const tpqi =
    ref
      .split(/\n(?=\s*\d+[.)])/)
      .find((x) => /สถาบันคุณวุฒิ|สคช\.|TPQI/i.test(x)) || "";
  const occupation = tpqi
    .match(/(?:^|\s)อาชีพ\s*([^\n]+?)(?=\s*ระดับ|$)/)?.[1]
    ?.trim();
  const queries = [
    ...new Set(
      [referenceCodes(tpqi)[0], occupation, course.courseName].filter(
        (v): v is string => !!v,
      ),
    ),
  ].slice(0, 3);
  const discovered = new Map<string, CatalogItem>();
  const discoveryTier = new Map<string, number>();
  let sourceDegraded = false;
  for (const [queryIndex, q] of queries.entries()) {
    const result = await searchCatalog("standard", q, 1, "");
    sourceDegraded ||= result.source !== "live";
    for (const item of result.items) {
      if (!discovered.has(item.id)) discoveryTier.set(item.id, queryIndex);
      discovered.set(item.id, item);
    }
  }
  const courseWords = terms(
    [course.courseName, course.learningOutcomes, course.competencies].join(" "),
  );
  const priority = (item: CatalogItem) =>
    terms(item.title).filter((t) => courseWords.includes(t)).length +
    (tpqi.includes(item.title) ? 100 : 0);
  const shortlist = [...discovered.values()]
    .sort(
      (a, b) =>
        (discoveryTier.get(a.id) || 0) - (discoveryTier.get(b.id) || 0) ||
        priority(b) - priority(a) ||
        a.id.localeCompare(b.id),
    )
    .slice(0, 8);
  const detailResults = await Promise.allSettled(
    shortlist.map((item) => catalogDetail(item.id)),
  );
  let detailsUnavailable = 0;
  const items: Recommendation[] = [];
  for (let i = 0; i < detailResults.length; i++) {
    const result = detailResults[i];
    if (result.status === "rejected") {
      detailsUnavailable++;
      continue;
    }
    const standard = result.value.data as StandardDetail;
    const levels = standard.levels.map((l) => ({
      name: l.levelName,
      ...assessReference(course, standard, l.levelName),
    }));
    const direct = levels.some((l) => l.matched.length),
      short = levels.some((l) => l.shortCodes.length);
    const sharedTerms = terms(standard.title).filter((t) =>
      courseWords.includes(t),
    );
    const titleDirect =
      standard.title.length > 4 && tpqi.includes(standard.title);
    if (!direct && !short && !titleDirect && sharedTerms.length < 2) continue;
    const basis = direct
      ? "DIRECT_CODE"
      : titleDirect
        ? "DOCUMENT_TITLE"
        : short
          ? "AMBIGUOUS_CODE"
          : "TEXT";
    const reason = direct
      ? "พบรหัส UoC เต็มตามอ้างอิงในเอกสารรายวิชา"
      : titleDirect
        ? "ชื่ออาชีพปรากฏในอ้างอิง TPQI ของรายวิชา ยังต้องตรวจรหัส ระดับ และฉบับ"
        : short
          ? "พบรหัสตรงเฉพาะส่วนท้าย ยังยืนยันตัวมาตรฐานไม่ได้"
          : `ชื่อมาตรฐานมีคำร่วมกับรายวิชา: ${sharedTerms.join(", ")}`;
    items.push({
      id: shortlist[i].id,
      title: standard.title,
      sourceUrl: standard.sourceUrl,
      basis,
      reason,
      sharedTerms,
      levels: levels.map((l) => ({
        name: l.name,
        mismatch: l.mismatch,
        note: l.note,
      })),
    });
  }
  const order = {
    DIRECT_CODE: 0,
    DOCUMENT_TITLE: 1,
    AMBIGUOUS_CODE: 2,
    TEXT: 3,
  };
  items.sort(
    (a, b) =>
      order[a.basis] - order[b.basis] ||
      b.sharedTerms.length - a.sharedTerms.length,
  );
  return {
    items,
    queries,
    searched: discovered.size,
    detailsChecked: shortlist.length - detailsUnavailable,
    detailsUnavailable,
    sourceDegraded,
    reference: ref,
    courseUrl: course.pdfUrl,
    courseLocator: `หน้าไฟล์ ${course.pdfPage || "ยังไม่ระบุ"}`,
    scope:
      "ค้นไม่เกิน 3 คำค้น คำละ 18 รายการ และอ่านรายละเอียด 8 มาตรฐานแรกตามลำดับอ้างอิง/คำร่วม ผลนี้ไม่ใช่การตรวจทั้งคลังหรือการรับรองความเทียบเท่า",
  };
}
