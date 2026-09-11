import {
  all,
  one,
  normalized,
  runtime,
  catalogStatement,
  statement,
  sha,
  now,
  HttpError,
} from "./runtime";
import type {
  CatalogItem,
  SourceCourse,
  SourceStandard,
  CourseDetail,
  StandardDetail,
} from "./types";

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(18000),
    headers: { Accept: "application/json" },
    redirect: "manual",
  });
  if (!response.ok)
    throw new HttpError(
      502,
      `แหล่งข้อมูลตอบกลับ ${response.status} กรุณาลองใหม่`,
    );
  return response.json() as Promise<T>;
}
export async function searchCatalog(
  kind: "course" | "standard",
  q: string,
  page: number,
  level: string,
  localOnly = false,
) {
  if (!localOnly)
    try {
      const params = new URLSearchParams({ q, limit: "18" });
      if (kind === "course") {
        params.set("offset", String((page - 1) * 18));
        if (level) params.set("level", level);
      } else params.set("page", String(page));
      const url =
        kind === "course"
          ? `https://dles.vec.go.th/subject/api/search?${params}`
          : `https://dles.vec.go.th/api/standards/tpqi/search?${params}`;
      const data = await fetchJson<{
        subjects?: SourceCourse[];
        results?: SourceStandard[];
        totalSubjects?: number;
        total?: number;
        hasMore?: boolean;
        totalPages?: number;
      }>(url);
      const raw = kind === "course" ? data.subjects : data.results;
      if (!Array.isArray(raw)) throw new Error("SOURCE_SCHEMA_CHANGED");
      const items = await Promise.all(
        raw.map((item) => normalized(kind, item)),
      );
      if (items.length) await runtime.DB.batch(items.map(catalogStatement));
      return {
        items,
        total: kind === "course" ? data.totalSubjects : data.total,
        page,
        hasMore:
          kind === "course" ? !!data.hasMore : page < (data.totalPages || 1),
        source: "live",
        fetchedAt: now(),
      };
    } catch {
      /* The verified local catalogue remains available when upstream fails. */
    }
  const where =
    "kind=? AND (title LIKE ? OR code LIKE ? OR department LIKE ?) AND (?='' OR level=?)";
  const bind = [kind, `%${q}%`, `%${q}%`, `%${q}%`, level, level];
  const items = await all<CatalogItem>(
    `SELECT * FROM catalog WHERE ${where} ORDER BY code LIMIT 18 OFFSET ?`,
    ...bind,
    (page - 1) * 18,
  );
  const total =
    (
      await one<{ count: number }>(
        `SELECT COUNT(*) as count FROM catalog WHERE ${where}`,
        ...bind,
      )
    )?.count || 0;
  return {
    items,
    total,
    page,
    hasMore: page * 18 < total,
    source: "snapshot",
    fetchedAt: items[0]?.fetched_at || null,
  };
}
export async function catalogDetail(id: string) {
  const row = await one<CatalogItem>("SELECT * FROM catalog WHERE id=?", id);
  if (!row) throw new HttpError(404, "ไม่พบรายการนี้ กรุณาค้นและเลือกใหม่");
  if (row.detail)
    return { item: row, data: JSON.parse(row.detail), cached: true };
  const raw = JSON.parse(row.payload) as SourceCourse;
  const url =
    row.kind === "course"
      ? `https://dles.vec.go.th/subject/api/subject-detail?code=${encodeURIComponent(raw.code)}&dept=${encodeURIComponent(raw.deptCode)}`
      : `https://dles.vec.go.th/api/standards/tpqi/${encodeURIComponent(row.code)}`;
  const detail = await fetchJson<CourseDetail | StandardDetail>(url);
  if (row.kind === "course" && !(detail as CourseDetail).success)
    throw new HttpError(
      422,
      "ต้นทางยังไม่มีคำอธิบายรายวิชาครบ กรุณาเปิดเอกสารหลักสูตร",
    );
  if (
    row.kind === "standard" &&
    !Array.isArray((detail as StandardDetail).levels)
  )
    throw new HttpError(422, "โครงสร้างมาตรฐานไม่ครบ");
  const json = JSON.stringify(detail);
  await statement(
    "UPDATE catalog SET detail=?,fetched_at=?,hash=? WHERE id=?",
    json,
    now(),
    await sha(json),
    id,
  ).run();
  return { item: { ...row, detail: json }, data: detail, cached: false };
}
