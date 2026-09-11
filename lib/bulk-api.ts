import {
  all,
  one,
  runtime,
  sha,
  statement,
  now,
  requireUser,
  HttpError,
  catalogStatement,
  normalized,
} from "./runtime";
import type { User, MappingPayload, MappingRow, SourceStandard } from "./types";
import type {
  BulkManifest,
  BulkCourseRow,
  BulkDetail,
  BulkStandardFile,
} from "./bulk-types";
import { safeSourceUrl } from "./policy";
import { z } from "zod";
const response = (value: unknown, status = 200) =>
  Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
export async function artifact<T>(
  request: Request,
  path: string,
  expectedHash: string,
): Promise<T> {
  if (
    !/^\/(?:bulk\/[a-z0-9-]+\/(courses|standards)|certificates\/[a-z0-9-]+)\/[a-zA-Z0-9_-]+\.json(?:\.gz)?$/.test(
      path,
    )
  )
    throw new HttpError(422, "ตำแหน่งผลคำนวณไม่ถูกต้อง");
  const url = new URL(path, request.url);
  const local =
    process.env.NODE_ENV !== "production" &&
    ["localhost", "127.0.0.1"].includes(url.hostname);
  const r = local
    ? await fetch(url)
    : await runtime.ASSETS.fetch(new Request(url));
  if (!r.ok) throw new HttpError(503, "ไฟล์ผลคำนวณยังไม่พร้อม กรุณาลองใหม่");
  const bytes = await r.arrayBuffer();
  const signature = new Uint8Array(bytes, 0, Math.min(2, bytes.byteLength));
  const text =
    path.endsWith(".gz") && signature[0] === 0x1f && signature[1] === 0x8b
      ? await new Response(
          new Response(bytes).body!.pipeThrough(
            new DecompressionStream("gzip"),
          ),
        ).text()
      : new TextDecoder().decode(bytes);
  if ((await sha(text)) !== expectedHash)
    throw new HttpError(503, "ไฟล์ผลคำนวณไม่ตรงกับฉบับที่ลงทะเบียนไว้");
  return JSON.parse(text) as T;
}
export async function handleBulk(
  request: Request,
  user: User | null,
  id?: string,
  action?: string,
) {
  const url = new URL(request.url),
    run = await one<{ id: string; manifest: string }>(
      "SELECT id,manifest FROM bulk_runs ORDER BY created_at DESC LIMIT 1",
    );
  if (!run)
    return response({
      manifest: null,
      items: [],
      total: 0,
      page: 1,
      categories: [],
    });
  const manifest = JSON.parse(run.manifest) as BulkManifest;
  if (!id && request.method === "GET") {
    const q = (url.searchParams.get("q") || "").trim().slice(0, 160),
      level = url.searchParams.get("level") || "",
      category = url.searchParams.get("category") || "",
      status = url.searchParams.get("status") || "",
      basis = url.searchParams.get("basis") || "";
    const page = Math.max(
      1,
      Math.min(1000, Math.floor(Number(url.searchParams.get("page")) || 1)),
    );
    const min = Math.max(
      0,
      Math.min(100, Number(url.searchParams.get("min")) || 0),
    );
    const clauses = ["run_id=?"],
      args: (string | number)[] = [run.id];
    if (q) {
      clauses.push(
        "(code LIKE ? OR title LIKE ? OR department LIKE ? OR standard_title LIKE ?)",
      );
      args.push(...Array(4).fill("%" + q + "%"));
    }
    for (const [key, value] of [
      ["level", level],
      ["category", category],
      ["status", status],
      ["basis", basis],
    ])
      if (value) {
        clauses.push(`${key}=?`);
        args.push(value);
      }
    if (min) {
      clauses.push("score>=?");
      args.push(min * 10);
    }
    const where = clauses.join(" AND ");
    const total = (await one<{ n: number }>(
      `SELECT COUNT(*) n FROM bulk_courses WHERE ${where}`,
      ...args,
    ))!.n;
    const sort =
      url.searchParams.get("sort") === "score"
        ? "score DESC,code,course_id"
        : "CASE status WHEN 'PENDING_REVIEW' THEN 0 WHEN 'LEVEL_MISMATCH' THEN 1 WHEN 'INSUFFICIENT_DATA' THEN 2 ELSE 3 END,CASE basis WHEN 'DIRECT_CODE' THEN 0 WHEN 'DOCUMENT_TITLE' THEN 1 ELSE 2 END,code,course_id";
    if (url.searchParams.get("format") === "csv") {
      const rows = await all<BulkCourseRow>(
        `SELECT * FROM bulk_courses WHERE ${where} ORDER BY ${sort}`,
        ...args,
      );
      const quote = (value: unknown) => {
        let text = String(value ?? "");
        if (/^[\t\r\n ]*[=+@-]/.test(text)) text = "'" + text;
        return '"' + text.replaceAll('"', '""') + '"';
      };
      const csv = [
        [
          "รหัสวิชา",
          "รายวิชา",
          "ระดับ",
          "สาขา",
          "มาตรฐานอันดับแรก",
          "Embedding %",
          "หลักฐาน",
          "สถานะ",
          "รอบคำนวณ",
        ],
        ...rows.map((r) => [
          r.code,
          r.title,
          r.level,
          r.department,
          r.standard_title,
          r.score === null ? "" : (r.score / 10).toFixed(1),
          r.basis,
          r.status,
          r.run_id,
        ]),
      ]
        .map((row) => row.map(quote).join(","))
        .join("\r\n");
      return new Response("\uFEFF" + csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition":
            'attachment; filename="compass-bulk-results.csv"',
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    const items = await all<BulkCourseRow>(
      `SELECT * FROM bulk_courses WHERE ${where} ORDER BY ${sort} LIMIT 25 OFFSET ?`,
      ...args,
      (page - 1) * 25,
    );
    const categories = await all<{ category: string }>(
      "SELECT DISTINCT category FROM bulk_courses WHERE run_id=? ORDER BY category",
      run.id,
    );
    return response({
      manifest,
      items,
      total,
      page,
      categories: categories.map((x) => x.category),
    });
  }
  const row = await one<BulkCourseRow>(
    "SELECT * FROM bulk_courses WHERE run_id=? AND course_id=?",
    run.id,
    id || "",
  );
  if (!row) throw new HttpError(404, "ไม่พบรายวิชาในผลคำนวณรอบนี้");
  const detail = await artifact<BulkDetail>(
    request,
    row.result_path,
    row.result_hash,
  );
  if (request.method === "GET") return response({ manifest, row, detail });
  if (request.method !== "POST" || action !== "adopt")
    throw new HttpError(405, "ไม่รองรับการทำรายการนี้");
  const actor = requireUser(user, ["admin", "editor"]);
  const raw = await request.text();
  if (raw.length > 1000) throw new HttpError(413, "ข้อมูลใหญ่เกินไป");
  const input = z
    .object({ pairId: z.string().max(150) })
    .parse(JSON.parse(raw));
  const pair = detail.pairs.find((p) => p.id === input.pairId);
  if (!pair || !detail.course)
    throw new HttpError(422, "ไม่มีผลคำนวณที่ใช้จัดทำได้");
  if (pair.mismatch)
    throw new HttpError(422, "ระดับอ้างอิงไม่ตรง ต้องแก้คู่มาตรฐานก่อนส่งตรวจ");
  const source = await artifact<BulkStandardFile>(
    request,
    pair.standardPath,
    pair.standardHash,
  );
  if (source.standard.id !== pair.standardId)
    throw new HttpError(422, "มาตรฐานอ้างอิงไม่ตรง");
  const seed = await sha(
    [actor.email, run.id, detail.courseId, pair.id].join("|"),
  );
  const mappingId = `${seed.slice(0, 8)}-${seed.slice(8, 12)}-5${seed.slice(13, 16)}-a${seed.slice(17, 20)}-${seed.slice(20, 32)}`;
  const exists = await one<{ id: string }>(
    "SELECT id FROM mappings WHERE id=?",
    mappingId,
  );
  if (exists) return response(exists);
  const rows: MappingRow[] = detail.targets.map((t) => {
    const m = pair.matches.find((m) => m.targetId === t.id)!;
    return {
      id: t.id,
      target: t.text,
      targetKind: t.kind,
      status: "INSUFFICIENT_EVIDENCE",
      uoc: m.uoc,
      eoc: m.eoc,
      criterion: m.criterion,
      standardQuote: m.criterion,
      courseQuote: t.text,
      standardUrl: pair.sourceUrl,
      courseUrl: detail.course!.pdfUrl,
      standardLocator: m.locator,
      courseLocator: t.locator,
      reason: `ข้อเสนอ Embedding ทั้งคลัง ${m.similarity.toFixed(1)}% · ${pair.referenceNote}`,
      gap: [
        "ต้องตรวจเอกสารฉบับจริง งาน บริบท เครื่องมือ และคุณภาพก่อนรับรอง",
        m.critical ? "ตรวจข้อกำหนดสำคัญด้านความปลอดภัย" : "",
        m.negation ? "พบคำปฏิเสธหรือข้อยกเว้น" : "",
        m.theoryGap ? "ต้องตรวจหลักฐานการปฏิบัติจริง" : "",
      ]
        .filter(Boolean)
        .join("\n"),
      critical: m.critical,
    };
  });
  if (
    rows.some(
      (r) => !safeSourceUrl(r.standardUrl) || !safeSourceUrl(r.courseUrl),
    )
  )
    throw new HttpError(
      422,
      "เอกสารต้นทางยังไม่มี URL ที่ใช้ยืนยันได้ กรุณาเพิ่มหลักฐานก่อน",
    );
  const payload: MappingPayload = {
    course: detail.course,
    standard: source.standard,
    levelName: pair.level,
    referenceStatus: "VERSION_UNRESOLVED",
    referenceNote: pair.referenceNote,
    scopeConfirmed: false,
    sourceVerified: false,
    rows,
    reviewers: [],
    policyNote: "",
    bulkSource: { runId: run.id, courseId: detail.courseId, pairId: pair.id },
  };
  const course = await normalized("course", detail.summary),
    standard = await normalized("standard", {
      id: source.standard.id,
      title: source.standard.title,
      category: source.standard.category,
      levelNames: source.standard.levels.map((l) => l.levelName),
      unitCount: 0,
      elementCount: 0,
      hasContent: true,
    } as SourceStandard);
  course.detail = JSON.stringify(detail.course);
  course.hash = await sha(course.detail);
  standard.detail = JSON.stringify(source.standard);
  standard.hash = await sha(standard.detail);
  const json = JSON.stringify(payload),
    hash = await sha(json),
    date = now();
  await runtime.DB.batch([
    catalogStatement(course),
    catalogStatement(standard),
    statement(
      "INSERT OR IGNORE INTO mappings(id,title,course_id,standard_id,owner,status,revision,payload,content_hash,created_at,updated_at) VALUES (?,?,?,?,?,'DRAFT',1,?,?,?,?)",
      mappingId,
      `${detail.summary.code} ${detail.summary.nameTh}`,
      course.id,
      standard.id,
      actor.email,
      json,
      hash,
      date,
      date,
    ),
    statement(
      "INSERT OR IGNORE INTO revisions(id,mapping_id,revision,payload,hash,actor,created_at) VALUES (?,?,1,?,?,?,?)",
      mappingId,
      mappingId,
      json,
      hash,
      actor.email,
      date,
    ),
    statement(
      "INSERT OR IGNORE INTO audit(id,actor,action,entity_id,detail,created_at) VALUES (?,?,'BULK_ADOPT',?,?,?)",
      mappingId,
      actor.email,
      mappingId,
      JSON.stringify({
        runId: run.id,
        courseId: detail.courseId,
        pairId: pair.id,
        sourceHash: row.result_hash,
      }),
      date,
    ),
  ]);
  return response({ id: mappingId }, 201);
}
