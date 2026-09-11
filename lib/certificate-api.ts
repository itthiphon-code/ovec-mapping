import registry from "./certificate-registry.json";
import { artifact } from "./bulk-api";
import { HttpError } from "./runtime";
import type { CertificateIndex, CertificateFile } from "./certificate-matcher";
import type { BulkDetail } from "./bulk-types";

export async function handleCertificates(
  request: Request,
  id?: string,
  action?: string,
) {
  if (request.method !== "GET")
    throw new HttpError(405, "ใช้การอ่านข้อมูลเท่านั้น");
  const index = await artifact<CertificateIndex>(
    request,
    registry.path,
    registry.hash,
  );
  const url = new URL(request.url);
  const response = (data: unknown) =>
    Response.json(data, { headers: { "Cache-Control": "no-store" } });
  if (!id) {
    const q = (url.searchParams.get("q") || "")
      .trim()
      .toLocaleLowerCase()
      .slice(0, 160);
    const page = Math.max(
      1,
      Math.min(1000, Math.floor(Number(url.searchParams.get("page")) || 1)),
    );
    const matches = index.items.filter((i) =>
      `${i.title} ${i.category}`.toLocaleLowerCase().includes(q),
    );
    const { items: _, ...manifest } = index;
    void _;
    return response({
      manifest,
      total: matches.length,
      page,
      items: matches
        .slice((page - 1) * 24, page * 24)
        .map(({ path: _p, hash: _h, ...i }) => {
          void _p;
          void _h;
          return i;
        }),
    });
  }
  const item = index.items.find((i) => String(i.id) === id);
  if (!item) throw new HttpError(404, "ไม่พบมาตรฐานในชุดคำนวณนี้");
  const data = await artifact<CertificateFile>(request, item.path, item.hash);
  if (action === "course") {
    const course = data.results
      .flatMap((l) => l.courses)
      .find((c) => c.id === url.searchParams.get("courseId"));
    if (!course) throw new HttpError(404, "ไม่พบรายวิชาในผลของใบรับรองนี้");
    return response(
      await artifact<BulkDetail>(request, course.sourcePath, course.sourceHash),
    );
  }
  if (action) throw new HttpError(404, "ไม่พบรายการ");
  return response(data);
}
