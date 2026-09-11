import { z } from "zod";
import { handleBulk } from "@/lib/bulk-api";
import { handleCertificates } from "@/lib/certificate-api";
import {
  EMBEDDING,
  buildEmbeddingPlan,
  decodeVectors,
  matchEmbeddings,
  bestEmbeddingSelections,
} from "@/lib/embedding-matcher";
import { recommendStandards } from "@/lib/recommendations";
import {
  analyzeMapping,
  applyCandidates,
  ENGINE_VERSION,
  type AnalysisRecord,
  type AutoResult,
} from "@/lib/auto-mapping";
import {
  ready,
  runtime,
  all,
  one,
  statement,
  auditStatement,
  uid,
  sha,
  now,
  getUser,
  requireUser,
  checkOrigin,
  HttpError,
} from "@/lib/runtime";
import { searchCatalog, catalogDetail } from "@/lib/sources";
import {
  evidenceProblems,
  referenceCheck,
  approvalProblems,
  canReview,
  safeSourceUrl,
} from "@/lib/policy";
import type {
  Mapping,
  MappingPayload,
  MappingRow,
  Review,
  User,
  CourseDetail,
  StandardDetail,
  DocumentRecord,
  Application,
} from "@/lib/types";

export const dynamic = "force-dynamic";
const txt = z.string().max(12000);
const rowSchema = z.object({
  id: z.string().min(1).max(100),
  target: txt,
  targetKind: z.string().max(80),
  status: z.enum([
    "FULL",
    "PARTIAL",
    "NONE",
    "INSUFFICIENT_EVIDENCE",
    "CONFLICT",
  ]),
  uoc: txt,
  eoc: txt,
  criterion: txt,
  standardQuote: txt,
  courseQuote: txt,
  standardUrl: z.string().max(2000),
  courseUrl: z.string().max(2000),
  standardLocator: txt,
  courseLocator: txt,
  reason: txt,
  gap: txt,
  critical: z.boolean(),
});
const editSchema = z.object({
  revision: z.number().int().positive(),
  rows: z.array(rowSchema).min(1).max(250),
  referenceStatus: z.enum([
    "VERIFIED",
    "NO_REFERENCE",
    "LEVEL_MISMATCH",
    "VERSION_UNRESOLVED",
  ]),
  referenceNote: txt,
  scopeConfirmed: z.boolean(),
  sourceVerified: z.boolean(),
  reviewers: z.array(z.email()).max(10),
  policyNote: txt,
});
const json = (value: unknown, status = 200) =>
  Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
const staff = [
  "admin",
  "editor",
  "expert_tpqi",
  "expert_course",
  "approver",
  "registrar",
] as const;
async function body(request: Request, limit = 1_000_000) {
  if (Number(request.headers.get("content-length")) > limit)
    throw new HttpError(413, "ข้อมูลมีขนาดใหญ่เกินไป");
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > limit)
    throw new HttpError(413, "ข้อมูลมีขนาดใหญ่เกินไป");
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "รูปแบบข้อมูลไม่ถูกต้อง");
  }
}
function visible(m: Mapping, user: User | null) {
  if (m.status === "PUBLISHED") return true;
  if (!user) return false;
  const p = JSON.parse(m.payload) as MappingPayload;
  return (
    m.owner === user.email ||
    ["admin", "approver"].includes(user.role) ||
    p.reviewers.includes(user.email)
  );
}
async function loadMapping(id: string, user: User | null) {
  const m = await one<Mapping>("SELECT * FROM mappings WHERE id=?", id);
  if (!m || !visible(m, user))
    throw new HttpError(404, "ไม่พบงานหรือคุณไม่มีสิทธิ์เข้าถึง");
  return m;
}
async function assertReviewers(payload: MappingPayload, owner: string) {
  const emails = [...new Set(payload.reviewers)];
  const users = await all<User>("SELECT * FROM members WHERE active=1");
  const selected = users.filter(
    (u) => emails.includes(u.email) && canReview(u, owner, emails),
  );
  if (
    selected.length !== emails.length ||
    !selected.some((u) => u.role === "expert_tpqi") ||
    !selected.some((u) => u.role === "expert_course")
  )
    throw new HttpError(
      422,
      "เลือกผู้เชี่ยวชาญ TPQI และหลักสูตรคนละคน ที่มีขอบเขตและการแต่งตั้งยังไม่หมดอายุ",
    );
}
async function changeMapping(
  m: Mapping,
  user: User,
  nextStatus: string,
  payload?: MappingPayload,
  auditDetail?: Record<string, unknown>,
) {
  const p = payload ? JSON.stringify(payload) : m.payload;
  const hash = payload ? await sha(p) : m.content_hash;
  const rev = payload ? m.revision + 1 : m.revision;
  const date = now();
  const queries = [
    statement(
      "UPDATE mappings SET payload=?,content_hash=?,revision=?,status=?,updated_at=? WHERE id=? AND revision=? AND status=? AND content_hash=?",
      p,
      hash,
      rev,
      nextStatus,
      date,
      m.id,
      m.revision,
      m.status,
      m.content_hash,
    ),
  ];
  if (payload)
    queries.push(
      statement(
        "INSERT INTO revisions (id,mapping_id,revision,payload,hash,actor,created_at) SELECT ?,id,revision,payload,content_hash,?,? FROM mappings WHERE id=? AND revision=? AND content_hash=?",
        uid(),
        user.email,
        date,
        m.id,
        rev,
        hash,
      ),
    );
  queries.push(
    statement(
      "INSERT INTO audit (id,actor,action,entity_id,detail,created_at) SELECT ?,?,?,id,?,? FROM mappings WHERE id=? AND revision=? AND content_hash=? AND status=?",
      uid(),
      user.email,
      payload ? "MAPPING_EDIT" : `MAPPING_${nextStatus}`,
      JSON.stringify({
        from: m.status,
        to: nextStatus,
        revision: rev,
        hash,
        ...auditDetail,
      }),
      date,
      m.id,
      rev,
      hash,
      nextStatus,
    ),
  );
  const result = await runtime.DB.batch(queries);
  if (!result[0].meta.changes)
    throw new HttpError(409, "งานถูกเปลี่ยนโดยผู้ใช้อื่น กรุณาโหลดฉบับล่าสุด");
  return { id: m.id, revision: rev, status: nextStatus };
}

async function handle(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    await ready();
    const user = await getUser(request);
    const { path } = await context.params;
    const [resource, id, action] = path;
    const url = new URL(request.url);
    const method = request.method;
    if (method !== "GET") checkOrigin(request);
    if (resource === "bulk") return await handleBulk(request, user, id, action);
    if (resource === "certificates")
      return await handleCertificates(request, id, action);
    if (resource === "health")
      return json({ ok: true, service: "TPQI Mapping", storage: "connected" });
    if (resource === "me")
      return json({
        user,
        local:
          process.env.NODE_ENV !== "production" && !!runtime.LOCAL_DEV_EMAIL,
      });
    if (resource === "dashboard") {
      const states = await all<{ status: string; count: number }>(
        "SELECT status,COUNT(*) count FROM mappings GROUP BY status",
      );
      const catalogue = await all<{ kind: string; count: number }>(
        "SELECT kind,COUNT(*) count FROM catalog GROUP BY kind",
      );
      const data = await one<{ value: string }>(
        "SELECT value FROM settings WHERE key='source-stats'",
      );
      const organization = await one<{ value: string }>(
        "SELECT value FROM settings WHERE key='organization'",
      );
      const recent = user
        ? await all<Mapping>(
            "SELECT * FROM mappings ORDER BY updated_at DESC LIMIT 40",
          )
        : [];
      return json({
        states:
          user?.role === "admin"
            ? states
            : states.filter((s) => s.status === "PUBLISHED"),
        catalogue,
        sourceStats: data ? JSON.parse(data.value) : null,
        organization: organization?.value,
        recent: recent.filter((m) => visible(m, user)).slice(0, 5),
      });
    }
    if (resource === "catalog" && method === "GET") {
      if (id) return json(await catalogDetail(id));
      const kind =
        url.searchParams.get("kind") === "standard" ? "standard" : "course";
      const page = Math.min(
        1000,
        Math.max(1, Number(url.searchParams.get("page")) || 1),
      );
      return json(
        await searchCatalog(
          kind,
          (url.searchParams.get("q") || "").slice(0, 120),
          page,
          (url.searchParams.get("level") || "").slice(0, 30),
          url.searchParams.get("local") === "1",
        ),
      );
    }
    if (resource === "recommendations" && method === "POST") {
      const actor = requireUser(user, ["admin", "editor"]);
      const input = z
        .object({ courseId: z.string().max(120) })
        .parse(await body(request));
      const result = await recommendStandards(input.courseId);
      await auditStatement(actor.email, "AUTO_RECOMMEND", input.courseId, {
        queries: result.queries,
        searched: result.searched,
        detailsChecked: result.detailsChecked,
        resultIds: result.items.map((i) => i.id),
        sourceDegraded: result.sourceDegraded,
      }).run();
      return json(result);
    }
    if (resource === "mappings") {
      if (method === "GET" && !id) {
        const items = await all<Mapping>(
          "SELECT * FROM mappings ORDER BY updated_at DESC LIMIT 200",
        );
        return json({ items: items.filter((m) => visible(m, user)) });
      }
      if (method === "POST" && !id) {
        const actor = requireUser(user, ["admin", "editor"]);
        const input = z
          .object({
            courseId: z.string().max(120),
            standardId: z.string().max(120),
            levelName: z.string().max(60),
          })
          .parse(await body(request));
        const courseResult = await catalogDetail(input.courseId);
        const standardResult = await catalogDetail(input.standardId);
        if (
          courseResult.item.kind !== "course" ||
          standardResult.item.kind !== "standard"
        )
          throw new HttpError(422, "ชนิดข้อมูลไม่ตรง");
        const course = courseResult.data as CourseDetail;
        const standard = standardResult.data as StandardDetail;
        if (!standard.levels.some((l) => l.levelName === input.levelName))
          throw new HttpError(422, "ไม่พบระดับคุณวุฒินี้");
        const targets = [
          { text: course.learningOutcomes, kind: "ผลลัพธ์การเรียนรู้" },
          ...(course.competencies || "")
            .split(/\n(?=\s*\d+[.)])/)
            .filter(Boolean)
            .map((text) => ({ text, kind: "สมรรถนะรายวิชา" })),
        ];
        const rows: MappingRow[] = targets
          .filter((t) => t.text?.trim())
          .map((t, i) => ({
            id: `T${i + 1}`,
            target: t.text,
            targetKind: t.kind,
            status: "INSUFFICIENT_EVIDENCE",
            uoc: "",
            eoc: "",
            criterion: "",
            standardQuote: "",
            courseQuote: t.text,
            standardUrl: standard.sourceUrl,
            courseUrl: course.pdfUrl,
            standardLocator: "",
            courseLocator: course.pdfPage
              ? `หน้าไฟล์ ${course.pdfPage} · ${t.kind}`
              : t.kind,
            reason: "",
            gap: "",
            critical: false,
          }));
        if (!rows.length)
          throw new HttpError(422, "รายวิชายังไม่มีข้อกำหนดเพียงพอ");
        const ref = referenceCheck(course.standardRef || "", input.levelName);
        const payload: MappingPayload = {
          course,
          standard,
          levelName: input.levelName,
          referenceStatus: ref.status,
          referenceNote: ref.note,
          scopeConfirmed: false,
          sourceVerified: false,
          rows,
          reviewers: [],
          policyNote: "",
        };
        const mappingId = uid(),
          date = now(),
          p = JSON.stringify(payload),
          hash = await sha(p);
        await runtime.DB.batch([
          statement(
            "INSERT INTO mappings(id,title,course_id,standard_id,owner,status,revision,payload,content_hash,created_at,updated_at) VALUES (?,?,?,?,?,'DRAFT',1,?,?,?,?)",
            mappingId,
            `${course.courseCode} ${course.courseName}`,
            input.courseId,
            input.standardId,
            actor.email,
            p,
            hash,
            date,
            date,
          ),
          statement(
            "INSERT INTO revisions(id,mapping_id,revision,payload,hash,actor,created_at) VALUES (?,?,1,?,?,?,?)",
            uid(),
            mappingId,
            p,
            hash,
            actor.email,
            date,
          ),
          auditStatement(actor.email, "MAPPING_CREATE", mappingId, {
            courseId: input.courseId,
            standardId: input.standardId,
          }),
        ]);
        return json({ id: mappingId }, 201);
      }
      const m = await loadMapping(id, user);
      const payload = JSON.parse(m.payload) as MappingPayload;
      if (method === "GET" && action === "embedding-evidence") {
        requireUser(user, [...staff]);
        const analysisId = z
          .string()
          .uuid()
          .parse(url.searchParams.get("analysisId"));
        const record = await one<AnalysisRecord>(
          "SELECT * FROM mapping_analyses WHERE id=? AND mapping_id=?",
          analysisId,
          id,
        );
        const metadata = record
          ? (JSON.parse(record.result) as AutoResult).embedding
          : null;
        if (!metadata)
          throw new HttpError(404, "ไม่พบหลักฐาน Embedding ของงานนี้");
        const archive = await runtime.DOCUMENTS.get(metadata.archiveKey);
        if (!archive) throw new HttpError(404, "ไม่พบไฟล์หลักฐานการคำนวณ");
        return new Response(archive.body, {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
            "Content-Disposition": `attachment; filename="embedding-${analysisId}.json"`,
          },
        });
      }
      if (method === "GET" && action === "embedding-input") {
        const actor = requireUser(user, ["admin", "editor"]);
        if (
          m.owner !== actor.email ||
          !["DRAFT", "CHANGES_REQUESTED"].includes(m.status)
        )
          throw new HttpError(403, "วิเคราะห์ได้เฉพาะผู้จัดทำในฉบับร่าง");
        try {
          const plan = buildEmbeddingPlan(payload);
          return json({
            revision: m.revision,
            inputHash: m.content_hash,
            planHash: await sha(JSON.stringify(plan)),
            plan,
          });
        } catch (error) {
          throw new HttpError(422, (error as Error).message);
        }
      }
      if (method === "GET" && action === "analyses")
        return json({
          items: await all<AnalysisRecord>(
            "SELECT * FROM mapping_analyses WHERE mapping_id=? ORDER BY created_at DESC LIMIT 10",
            id,
          ),
        });
      if (method === "GET")
        return json({
          mapping: m,
          reviews: await all<Review>(
            "SELECT * FROM reviews WHERE mapping_id=? ORDER BY created_at",
            id,
          ),
          history: await all(
            "SELECT revision,hash,actor,created_at FROM revisions WHERE mapping_id=? ORDER BY revision DESC",
            id,
          ),
        });
      const actor = requireUser(user);
      const input = await body(
        request,
        action === "embedding-analyze" ? 8_000_000 : 1_000_000,
      );
      if (method === "PATCH") {
        if (
          m.owner !== actor.email ||
          !["DRAFT", "CHANGES_REQUESTED"].includes(m.status)
        )
          throw new HttpError(
            403,
            "แก้ไขได้เฉพาะผู้จัดทำในสถานะร่างหรือส่งกลับแก้ไข",
          );
        const edit = editSchema.parse(input);
        if (edit.revision !== m.revision)
          throw new HttpError(409, "กรุณาโหลดฉบับล่าสุดก่อนบันทึก");
        if (new Set(edit.rows.map((r) => r.id)).size !== edit.rows.length)
          throw new HttpError(422, "รหัสข้อกำหนดซ้ำ");
        for (const old of payload.rows)
          if (
            !edit.rows.some((r) => r.id === old.id && r.target === old.target)
          )
            throw new HttpError(
              422,
              "ห้ามลบหรือเปลี่ยนข้อกำหนดต้นฉบับออกจากตัวหาร",
            );
        const check = referenceCheck(
          payload.course.standardRef,
          payload.levelName,
        );
        if (
          edit.referenceStatus === "VERIFIED" &&
          (check.status === "LEVEL_MISMATCH" ||
            edit.referenceNote.trim().length < 15)
        )
          throw new HttpError(
            422,
            "อ้างอิงต่างระดับหรือยังไม่มีเหตุผลยืนยันฉบับมาตรฐาน",
          );
        const available = JSON.stringify(
          payload.standard.levels.find(
            (l) => l.levelName === payload.levelName,
          ),
        );
        const courseText = [
          payload.course.learningOutcomes,
          payload.course.competencies,
          payload.course.objectives,
          payload.course.description,
        ].join("\n");
        for (const row of edit.rows) {
          if (!row.target.trim() || !courseText.includes(row.target))
            throw new HttpError(
              422,
              `ข้อ ${row.id}: ข้อกำหนดต้องคัดจากรายวิชาต้นฉบับ`,
            );
          if (
            !safeSourceUrl(row.standardUrl) ||
            !safeSourceUrl(row.courseUrl) ||
            row.standardUrl !== payload.standard.sourceUrl ||
            row.courseUrl !== payload.course.pdfUrl
          )
            throw new HttpError(
              422,
              "ลิงก์หลักฐานต้องตรงกับแหล่งข้อมูลที่ตรึงในฉบับนี้",
            );
          if (row.criterion) {
            const unit = payload.standard.levels
              .find((l) => l.levelName === payload.levelName)
              ?.units.find((u) => u.uoc_code === row.uoc);
            const element = unit?.elements.find((e) => e.eoc_code === row.eoc);
            if (!element?.pc_items.includes(row.criterion))
              throw new HttpError(
                422,
                `ข้อ ${row.id}: เกณฑ์ไม่อยู่ใน UoC/EoC ที่เลือก`,
              );
          }
          if (
            row.standardQuote &&
            !available.includes(JSON.stringify(row.standardQuote).slice(1, -1))
          )
            throw new HttpError(
              422,
              `ข้อ ${row.id}: ข้อความหลักฐานไม่อยู่ในมาตรฐานฉบับนี้`,
            );
          if (row.courseQuote && !courseText.includes(row.courseQuote))
            throw new HttpError(
              422,
              `ข้อ ${row.id}: ข้อความหลักฐานไม่อยู่ในรายวิชาฉบับนี้`,
            );
        }
        const { revision: ignored, ...changes } = edit;
        void ignored;
        return json(
          await changeMapping(m, actor, "DRAFT", { ...payload, ...changes }),
        );
      }
      const version = z
        .object({ revision: z.number().int().positive() })
        .parse(input);
      if (version.revision !== m.revision)
        throw new HttpError(409, "ฉบับงานเปลี่ยนแล้ว กรุณาโหลดใหม่");
      if (method === "POST" && action === "embedding-analyze") {
        requireUser(actor, ["admin", "editor"]);
        if (
          m.owner !== actor.email ||
          !["DRAFT", "CHANGES_REQUESTED"].includes(m.status)
        )
          throw new HttpError(403, "วิเคราะห์ได้เฉพาะผู้จัดทำในฉบับร่าง");
        const submission = z
          .object({
            inputHash: z.string().length(64),
            planHash: z.string().length(64),
            vectors: z
              .array(z.string().length(2048))
              .min(1)
              .max(EMBEDDING.maxTexts),
          })
          .parse(input);
        if (submission.inputHash !== m.content_hash)
          throw new HttpError(409, "ข้อมูลต้นทางเปลี่ยนแล้ว กรุณาโหลดใหม่");
        let plan, result: AutoResult;
        try {
          plan = buildEmbeddingPlan(payload);
          if (submission.planHash !== (await sha(JSON.stringify(plan))))
            throw new Error("แผนข้อความหรือรุ่นโมเดลไม่ตรง กรุณาโหลดใหม่");
          result = matchEmbeddings(
            payload,
            plan,
            decodeVectors(submission.vectors, plan.texts.length),
          );
        } catch (error) {
          throw new HttpError(422, (error as Error).message);
        }
        const analysisId = uid(),
          createdAt = now();
        const selections = bestEmbeddingSelections(payload, result);
        const next = selections.length
          ? applyCandidates(payload, result, selections)
          : null;
        const nextPayload = next ? JSON.stringify(next) : m.payload;
        const nextHash = next ? await sha(nextPayload) : m.content_hash;
        const nextRevision = next ? m.revision + 1 : m.revision;
        const archiveKey = `embedding/${id}/${analysisId}.json`;
        const archive = JSON.stringify({
          plan,
          vectors: submission.vectors,
          encoding: "float32-little-endian-base64",
          inputHash: m.content_hash,
          revision: m.revision,
        });
        const bestScores = result.rows.flatMap((r) =>
          r.candidates[0]?.similarity === undefined
            ? []
            : [r.candidates[0].similarity],
        );
        result.embedding = {
          config: EMBEDDING,
          planHash: submission.planHash,
          vectorHash: await sha(archive),
          archiveKey,
          provenance: "browser-inference-server-cosine",
          meanSimilarity: bestScores.length
            ? Math.round(
                (bestScores.reduce((a, b) => a + b, 0) / bestScores.length) *
                  10,
              ) / 10
            : null,
          scoredTargets: bestScores.length,
          linkedCount: selections.length,
          ...(next
            ? { appliedRevision: nextRevision, appliedHash: nextHash }
            : {}),
        };
        const resultJson = JSON.stringify(result);
        if (new TextEncoder().encode(resultJson).byteLength > 1_000_000)
          throw new HttpError(
            422,
            "ผลวิเคราะห์เกิน 1 MB กรุณาแบ่งขอบเขตข้อกำหนด",
          );
        await runtime.DOCUMENTS.put(archiveKey, archive, {
          httpMetadata: { contentType: "application/json" },
        });
        try {
          const queries = [
            statement(
              "INSERT INTO mapping_analyses(id,mapping_id,revision,input_hash,engine,actor,result,created_at) SELECT ?,id,revision,content_hash,?,?,?,? FROM mappings WHERE id=? AND revision=? AND content_hash=? AND status=?",
              analysisId,
              EMBEDDING.engine,
              actor.email,
              resultJson,
              createdAt,
              id,
              m.revision,
              m.content_hash,
              m.status,
            ),
          ];
          if (next) {
            queries.push(
              statement(
                "UPDATE mappings SET payload=?,content_hash=?,revision=?,status='DRAFT',updated_at=? WHERE id=? AND revision=? AND content_hash=? AND status=? AND EXISTS(SELECT 1 FROM mapping_analyses WHERE id=?)",
                nextPayload,
                nextHash,
                nextRevision,
                createdAt,
                id,
                m.revision,
                m.content_hash,
                m.status,
                analysisId,
              ),
            );
            queries.push(
              statement(
                "INSERT INTO revisions(id,mapping_id,revision,payload,hash,actor,created_at) SELECT ?,id,revision,payload,content_hash,?,? FROM mappings WHERE id=? AND revision=? AND content_hash=? AND EXISTS(SELECT 1 FROM mapping_analyses WHERE id=?)",
                uid(),
                actor.email,
                createdAt,
                id,
                nextRevision,
                nextHash,
                analysisId,
              ),
            );
          }
          queries.push(
            statement(
              "INSERT INTO audit(id,actor,action,entity_id,detail,created_at) SELECT ?,?,'EMBEDDING_ANALYZE_LINK',?,?,? WHERE EXISTS(SELECT 1 FROM mapping_analyses WHERE id=?)",
              uid(),
              actor.email,
              id,
              JSON.stringify({
                analysisId,
                engine: EMBEDDING.engine,
                inputHash: m.content_hash,
                planHash: submission.planHash,
                selections,
                revision: nextRevision,
              }),
              createdAt,
              analysisId,
            ),
          );
          const saved = await runtime.DB.batch(queries);
          if (!saved[0].meta.changes)
            throw new HttpError(
              409,
              "ฉบับงานเปลี่ยนระหว่างคำนวณ กรุณาโหลดใหม่",
            );
        } catch (error) {
          // A transport error can hide a committed batch; retain its evidence.
          const persisted = await one<{ id: string }>(
            "SELECT id FROM mapping_analyses WHERE id=?",
            analysisId,
          ).catch(() => ({ id: analysisId }));
          if (!persisted) await runtime.DOCUMENTS.delete(archiveKey);
          throw error;
        }
        return json(
          {
            id: analysisId,
            linked: selections.length,
            revision: nextRevision,
            mismatch: result.reference.mismatch,
          },
          201,
        );
      }
      if (action === "analyze" || action === "apply-analysis") {
        requireUser(actor, ["admin", "editor"]);
        if (
          m.owner !== actor.email ||
          !["DRAFT", "CHANGES_REQUESTED"].includes(m.status)
        )
          throw new HttpError(
            403,
            "วิเคราะห์และใช้ข้อเสนอได้เฉพาะผู้จัดทำในฉบับร่าง",
          );
        if (action === "analyze") {
          const count =
            payload.standard.levels
              .find((l) => l.levelName === payload.levelName)
              ?.units.reduce(
                (n, u) =>
                  n + u.elements.reduce((sum, e) => sum + e.pc_items.length, 0),
                0,
              ) || 0;
          if (count > 3000)
            throw new HttpError(
              422,
              "ระดับนี้มีเกณฑ์มากกว่า 3,000 ข้อ ต้องแบ่งขอบเขตก่อนวิเคราะห์",
            );
          const result = analyzeMapping(payload);
          const resultJson = JSON.stringify(result);
          if (new TextEncoder().encode(resultJson).byteLength > 1_000_000)
            throw new HttpError(
              422,
              "ผลวิเคราะห์มีขนาดใหญ่เกิน 1 MB กรุณาแบ่งขอบเขตข้อกำหนดก่อนวิเคราะห์",
            );
          const analysisId = uid(),
            createdAt = now();
          const inserted = await runtime.DB.batch([
            statement(
              "INSERT INTO mapping_analyses(id,mapping_id,revision,input_hash,engine,actor,result,created_at) SELECT ?,id,revision,content_hash,?,?,?,? FROM mappings WHERE id=? AND revision=? AND content_hash=? AND status=?",
              analysisId,
              ENGINE_VERSION,
              actor.email,
              resultJson,
              createdAt,
              id,
              m.revision,
              m.content_hash,
              m.status,
            ),
            statement(
              "INSERT INTO audit(id,actor,action,entity_id,detail,created_at) SELECT ?,?,'AUTO_ANALYZE',?,?,? WHERE EXISTS(SELECT 1 FROM mapping_analyses WHERE id=?)",
              uid(),
              actor.email,
              id,
              JSON.stringify({
                analysisId,
                engine: ENGINE_VERSION,
                inputHash: m.content_hash,
                revision: m.revision,
              }),
              createdAt,
              analysisId,
            ),
          ]);
          if (!inserted[0].meta.changes)
            throw new HttpError(
              409,
              "ฉบับงานเปลี่ยนระหว่างวิเคราะห์ กรุณาโหลดใหม่",
            );
          return json({ id: analysisId, result }, 201);
        }
        const selection = z
          .object({
            analysisId: z.string().uuid(),
            selections: z
              .array(
                z.object({
                  rowId: z.string().max(100),
                  candidateId: z.string().max(100),
                }),
              )
              .min(1)
              .max(250),
          })
          .parse(input);
        const analysis = await one<AnalysisRecord>(
          "SELECT * FROM mapping_analyses WHERE id=? AND mapping_id=?",
          selection.analysisId,
          id,
        );
        if (!analysis) throw new HttpError(404, "ไม่พบผลวิเคราะห์ของงานนี้");
        if (
          analysis.revision !== m.revision ||
          analysis.input_hash !== m.content_hash
        )
          throw new HttpError(
            409,
            "ผลวิเคราะห์เป็นฉบับเก่า กรุณาวิเคราะห์ฉบับล่าสุด",
          );
        let next: MappingPayload;
        try {
          next = applyCandidates(
            payload,
            JSON.parse(analysis.result) as AutoResult,
            selection.selections,
          );
        } catch (e) {
          throw new HttpError(422, (e as Error).message);
        }
        return json(
          await changeMapping(m, actor, "DRAFT", next, {
            analysisId: analysis.id,
            selections: selection.selections,
            engine: analysis.engine,
          }),
        );
      }
      if (action === "submit") {
        if (
          m.owner !== actor.email ||
          !["DRAFT", "CHANGES_REQUESTED"].includes(m.status)
        )
          throw new HttpError(403, "ไม่สามารถส่งตรวจในสถานะนี้");
        const errors = evidenceProblems(payload);
        if (errors.length) throw new HttpError(422, "ยังส่งตรวจไม่ได้", errors);
        await assertReviewers(payload, m.owner);
        return json(await changeMapping(m, actor, "IN_REVIEW"));
      }
      if (action === "review") {
        if (
          m.status !== "IN_REVIEW" ||
          !canReview(actor, m.owner, payload.reviewers)
        )
          throw new HttpError(
            403,
            "ต้องเป็นผู้เชี่ยวชาญที่ได้รับมอบหมาย และไม่ใช่ผู้จัดทำงานนี้",
          );
        const { verdict, comment } = z
          .object({
            verdict: z.enum(["ACCEPT", "CHANGES", "REJECT"]),
            comment: z.string().min(15).max(6000),
          })
          .parse(input);
        const reviewId = uid();
        const queries = [
          statement(
            "INSERT INTO reviews(id,mapping_id,revision,reviewer,role,verdict,comment,content_hash,created_at) SELECT ?,id,revision,?,?,?,?,content_hash,? FROM mappings WHERE id=? AND revision=? AND content_hash=? AND status='IN_REVIEW'",
            reviewId,
            actor.email,
            actor.role,
            verdict,
            comment,
            now(),
            id,
            m.revision,
            m.content_hash,
          ),
        ];
        if (verdict !== "ACCEPT")
          queries.push(
            statement(
              "UPDATE mappings SET status=?,updated_at=? WHERE id=? AND EXISTS(SELECT 1 FROM reviews WHERE id=?)",
              verdict === "CHANGES" ? "CHANGES_REQUESTED" : "REJECTED",
              now(),
              id,
              reviewId,
            ),
          );
        queries.push(
          auditStatement(actor.email, "REVIEW", id, {
            verdict,
            revision: m.revision,
            hash: m.content_hash,
          }),
        );
        const result = await runtime.DB.batch(queries);
        if (!result[0].meta.changes)
          throw new HttpError(409, "งานเปลี่ยนสถานะแล้ว");
        return json({ ok: true });
      }
      if (action === "approve") {
        requireUser(actor, ["approver"]);
        if (actor.email === m.owner || payload.reviewers.includes(actor.email))
          throw new HttpError(
            403,
            "ผู้อนุมัติต้องเป็นอิสระจากผู้จัดทำและผู้ตรวจ",
          );
        if (m.status !== "IN_REVIEW")
          throw new HttpError(409, "งานไม่ได้อยู่ระหว่างตรวจ");
        await assertReviewers(payload, m.owner);
        const reviews = await all<Review>(
          "SELECT * FROM reviews WHERE mapping_id=? AND revision=?",
          id,
          m.revision,
        );
        const errors = approvalProblems(payload, reviews, m.content_hash);
        if (errors.length) throw new HttpError(422, "ยังรับรองไม่ได้", errors);
        return json(await changeMapping(m, actor, "APPROVED"));
      }
      if (action === "publish") {
        requireUser(actor, ["admin"]);
        if (m.status !== "APPROVED")
          throw new HttpError(422, "เผยแพร่ได้เฉพาะงานที่รับรองแล้ว");
        return json(await changeMapping(m, actor, "PUBLISHED"));
      }
      if (action === "withdraw") {
        requireUser(actor, ["admin", "approver"]);
        if (!["PUBLISHED", "APPROVED"].includes(m.status))
          throw new HttpError(422, "สถานะนี้ถอนไม่ได้");
        const reason = z.string().min(15).max(3000).parse(input.reason);
        await auditStatement(actor.email, "WITHDRAW_REASON", id, {
          reason,
        }).run();
        return json(await changeMapping(m, actor, "WITHDRAWN"));
      }
    }
    if (resource === "documents") {
      const actor = requireUser(user);
      const admin = actor.role === "admin";
      const ownDocuments =
        !admin || new URL(request.url).searchParams.get("mine") === "1";
      if (method === "GET" && !id)
        return json({
          items: await all<DocumentRecord>(
            `SELECT id,owner,title,kind,filename,mime,bytes,hash,status,created_at FROM documents ${ownDocuments ? "WHERE owner=?" : ""} ORDER BY created_at DESC`,
            ...(ownDocuments ? [actor.email] : []),
          ),
        });
      if (method === "GET" && id) {
        const doc = await one<DocumentRecord & { storage_key: string }>(
          "SELECT * FROM documents WHERE id=?",
          id,
        );
        if (!doc) throw new HttpError(404, "ไม่พบเอกสาร");
        const linked = ["registrar", "approver"].includes(actor.role)
          ? await one(
              "SELECT id FROM applications WHERE json_extract(payload, '$.documentId')=? OR EXISTS (SELECT 1 FROM json_each(applications.payload, '$.additionalDocumentIds') WHERE value=?) LIMIT 1",
              id,
              id,
            )
          : null;
        if (!admin && doc.owner !== actor.email && !linked)
          throw new HttpError(404, "ไม่พบเอกสาร");
        const object = await runtime.DOCUMENTS.get(doc.storage_key);
        if (!object) throw new HttpError(404, "ไม่พบไฟล์เอกสาร");
        return new Response(object.body, {
          headers: {
            "Content-Type": doc.mime,
            "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(doc.filename)}`,
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "sandbox",
          },
        });
      }
      if (method === "POST") {
        if (
          Number(request.headers.get("content-length") || 0) >
          16 * 1024 * 1024
        )
          throw new HttpError(413, "ไฟล์ต้องไม่เกิน 15 MB");
        const form = await request.formData();
        const file = form.get("file");
        if (
          !(file instanceof File) ||
          file.size > 15 * 1024 * 1024 ||
          file.size === 0
        )
          throw new HttpError(422, "เลือกไฟล์ PDF ขนาดไม่เกิน 15 MB");
        const buffer = await file.arrayBuffer();
        const signature = new TextDecoder().decode(buffer.slice(0, 5));
        if (signature !== "%PDF-")
          throw new HttpError(422, "รองรับเฉพาะไฟล์ PDF ที่มีรูปแบบถูกต้อง");
        const title = z
          .string()
          .min(1)
          .max(200)
          .parse(form.get("title") || file.name);
        const kind = z
          .enum(["STANDARD", "CURRICULUM", "CREDENTIAL", "EVIDENCE", "POLICY"])
          .parse(form.get("kind"));
        const id = uid(),
          hash = await sha(buffer),
          key = `documents/${id}.pdf`;
        await runtime.DOCUMENTS.put(key, buffer, {
          httpMetadata: { contentType: "application/pdf" },
        });
        try {
          await runtime.DB.batch([
            statement(
              "INSERT INTO documents(id,owner,title,kind,filename,mime,bytes,hash,storage_key,status,created_at) VALUES (?,?,?,?,?,'application/pdf',?,?,?,'UPLOADED',?)",
              id,
              actor.email,
              title,
              kind,
              file.name.slice(0, 200),
              file.size,
              hash,
              key,
              now(),
            ),
            auditStatement(actor.email, "DOCUMENT_UPLOAD", id, { hash, kind }),
          ]);
        } catch (error) {
          await runtime.DOCUMENTS.delete(key);
          throw error;
        }
        return json({ id }, 201);
      }
    }
    if (resource === "applications") {
      const actor = requireUser(user);
      const manager = ["admin", "registrar", "approver"].includes(actor.role);
      const ownApplications =
        !manager || new URL(request.url).searchParams.get("mine") === "1";
      if (method === "GET")
        return json({
          items: await all<Application>(
            `SELECT * FROM applications ${ownApplications ? "WHERE owner=?" : ""} ORDER BY updated_at DESC`,
            ...(ownApplications ? [actor.email] : []),
          ),
        });
      if (method === "POST" && !id) {
        const input = z
          .object({
            name: z.string().min(2).max(200),
            credentialNumber: z.string().min(1).max(200),
            issuer: z.string().min(2).max(200),
            courseCode: z.string().min(1).max(40),
            note: z.string().max(5000),
            documentId: z.string().uuid(),
            additionalDocumentIds: z
              .array(z.string().uuid())
              .max(10)
              .default([]),
          })
          .parse(await body(request));
        const doc = await one<DocumentRecord>(
          "SELECT * FROM documents WHERE id=? AND owner=?",
          input.documentId,
          actor.email,
        );
        if (!doc || doc.kind !== "CREDENTIAL")
          throw new HttpError(
            422,
            "แนบเอกสารประเภทคุณวุฒิจากคลังของคุณก่อนยื่นคำร้อง",
          );
        const allDocumentIds = [
          input.documentId,
          ...input.additionalDocumentIds,
        ];
        if (new Set(allDocumentIds).size !== allDocumentIds.length)
          throw new HttpError(422, "เลือกเอกสารแต่ละไฟล์เพียงครั้งเดียว");
        for (const extraId of input.additionalDocumentIds) {
          const extra = await one<{ id: string }>(
            "SELECT id FROM documents WHERE id=? AND owner=?",
            extraId,
            actor.email,
          );
          if (!extra)
            throw new HttpError(422, "เลือกเอกสารประกอบจากคลังของคุณเท่านั้น");
        }
        const id = uid();
        await runtime.DB.batch([
          statement(
            "INSERT INTO applications(id,owner,title,status,revision,payload,created_at,updated_at) VALUES (?,?,?,'SUBMITTED',1,?,?,?)",
            id,
            actor.email,
            `ขอเทียบโอน ${input.courseCode}`,
            JSON.stringify({
              ...input,
              credentialVerified: false,
              decision: null,
            }),
            now(),
            now(),
          ),
          auditStatement(actor.email, "APPLICATION_SUBMIT", id, {
            courseCode: input.courseCode,
          }),
        ]);
        return json({ id }, 201);
      }
      if (method === "POST" && id) {
        requireUser(actor, ["admin", "registrar"]);
        const input = z
          .object({
            status: z.enum([
              "EVIDENCE_CHECK",
              "NEEDS_INFORMATION",
              "ASSESSMENT",
            ]),
            note: z.string().min(10).max(5000),
            revision: z.number().int(),
          })
          .parse(await body(request));
        const application = await one<Application>(
          "SELECT * FROM applications WHERE id=?",
          id,
        );
        if (!application) throw new HttpError(404, "ไม่พบคำร้อง");
        const payload = {
          ...JSON.parse(application.payload),
          staffNote: input.note,
        };
        const results = await runtime.DB.batch([
          statement(
            "UPDATE applications SET status=?,payload=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?",
            input.status,
            JSON.stringify(payload),
            now(),
            id,
            input.revision,
          ),
          auditStatement(actor.email, "APPLICATION_UPDATE", id, input),
        ]);
        if (!results[0].meta.changes)
          throw new HttpError(409, "คำร้องเปลี่ยนแล้ว กรุณาโหลดใหม่");
        return json({ ok: true });
      }
    }
    if (resource === "members") {
      const actor = requireUser(user, [...staff]);
      if (method === "GET")
        return json({
          items: await all<User>(
            actor.role === "admin"
              ? "SELECT * FROM members ORDER BY created_at"
              : "SELECT * FROM members WHERE active=1 AND role IN ('expert_tpqi','expert_course') ORDER BY name",
          ),
        });
      requireUser(actor, ["admin"]);
      const input = z
        .object({
          email: z.email(),
          name: z.string().min(2).max(120),
          role: z.enum([
            "admin",
            "editor",
            "expert_tpqi",
            "expert_course",
            "approver",
            "registrar",
            "learner",
            "viewer",
          ]),
          scope: z.string().max(300),
          validUntil: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .or(z.literal("")),
          active: z.boolean(),
        })
        .parse(await body(request));
      const email = input.email.toLowerCase();
      if (email === actor.email && (input.role !== "admin" || !input.active))
        throw new HttpError(422, "ไม่สามารถถอดสิทธิ์ผู้ดูแลของตนเอง");
      if (
        input.role.startsWith("expert") &&
        (!input.scope || !input.validUntil)
      )
        throw new HttpError(
          422,
          "ผู้เชี่ยวชาญต้องมีขอบเขตและวันสิ้นสุดการแต่งตั้ง",
        );
      await runtime.DB.batch([
        statement(
          "INSERT INTO members(email,name,role,scope,valid_until,active,created_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET name=excluded.name,role=excluded.role,scope=excluded.scope,valid_until=excluded.valid_until,active=excluded.active",
          email,
          input.name,
          input.role,
          input.scope,
          input.validUntil || null,
          input.active ? 1 : 0,
          now(),
        ),
        auditStatement(actor.email, "MEMBER_APPOINT", email, input),
      ]);
      return json({ ok: true });
    }
    if (resource === "admin") {
      const actor = requireUser(user, ["admin"]);
      if (method === "GET")
        return json({
          settings: await all("SELECT * FROM settings"),
          audit: await all(
            "SELECT * FROM audit ORDER BY created_at DESC LIMIT 60",
          ),
          sync: await all(
            "SELECT * FROM sync_runs ORDER BY created_at DESC LIMIT 20",
          ),
        });
      const input = z
        .object({ organization: z.string().min(2).max(200) })
        .parse(await body(request));
      await runtime.DB.batch([
        statement(
          "INSERT INTO settings(key,value) VALUES ('organization',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
          input.organization,
        ),
        auditStatement(actor.email, "SETTINGS_UPDATE", "organization", input),
      ]);
      return json({ ok: true });
    }
    if (resource === "sync" && method === "POST") {
      const actor = requireUser(user, ["admin"]);
      const input = z
        .object({
          kind: z.enum(["course", "standard"]),
          page: z.number().int().min(1).max(1000),
        })
        .parse(await body(request));
      const result = await searchCatalog(input.kind, "", input.page, "");
      const id = uid();
      await statement(
        "INSERT INTO sync_runs(id,actor,kind,count,status,detail,created_at) VALUES (?,?,?,?,?,?,?)",
        id,
        actor.email,
        input.kind,
        result.items.length,
        result.source === "live" ? "SUCCEEDED" : "FAILED",
        JSON.stringify({ page: input.page, source: result.source }),
        now(),
      ).run();
      return json(result);
    }
    throw new HttpError(404, "ไม่พบรายการที่ร้องขอ");
  } catch (error) {
    if (error instanceof z.ZodError)
      return json(
        {
          message: "ข้อมูลไม่ครบหรือรูปแบบไม่ถูกต้อง",
          details: error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
        },
        422,
      );
    if (error instanceof HttpError)
      return json(
        { message: error.message, details: error.details },
        error.status,
      );
    if (error instanceof Error && error.message.includes("UNIQUE constraint"))
      return json(
        { message: "มีรายการนี้อยู่แล้ว กรุณาโหลดข้อมูลล่าสุด" },
        409,
      );
    console.error(
      "Request failed",
      error instanceof Error ? error.message : "unknown",
    );
    return json(
      { message: "ระบบไม่สามารถทำรายการได้ กรุณาลองใหม่อีกครั้ง" },
      500,
    );
  }
}
export { handle as GET, handle as POST, handle as PATCH };
