/** Offline full-catalog inference. All inputs are public, versioned source snapshots. */
import { readFile, writeFile, mkdir, appendFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { pipeline } from "@huggingface/transformers";
import { EMBEDDING } from "../public/embedding-config.js";
import {
  bulkTargets,
  bulkReference,
  referenceTier,
  normalizedMean,
  dot,
  uniqueStandardCandidates,
} from "../lib/bulk-matcher";
import type {
  CourseDetail,
  StandardDetail,
  SourceCourse,
  SourceStandard,
} from "../lib/types";
import type {
  BulkPair,
  BulkMatch,
  BulkDetail,
  BulkManifest,
} from "../lib/bulk-types";
const RUN =
    process.argv.find((a: string) => a.startsWith("--run-id="))?.slice(9) ||
    "bulk-20260911-e5-01",
  root = "tmp/bulk-cache/",
  out = `public/bulk/${RUN}`;
const seedFile =
  process.argv.find((a: string) => a.startsWith("--seed-file="))?.slice(12) ||
  "drizzle/0003_bulk_embedding_snapshot.sql";
if (
  !/^bulk-[a-z0-9-]+$/.test(RUN) ||
  !/^drizzle\/\d{4}_[a-z0-9_]+\.sql$/.test(seedFile)
)
  throw new Error("Invalid run ID or migration path");
let completed = false;
try {
  await readFile(out + "/manifest.json");
  completed = true;
} catch {}
if (completed)
  throw new Error(
    "Completed snapshots are immutable. Supply a new --run-id and --seed-file.",
  );
const migrationBefore = await readFile(seedFile, "utf8");
if (migrationBefore.includes("INSERT INTO bulk_runs"))
  throw new Error("Use a fresh empty custom migration for a new snapshot");
await mkdir(out + "/courses", { recursive: true });
await mkdir(out + "/standards", { recursive: true });
const hash = (x: string) => createHash("sha256").update(x).digest("hex");
const index = JSON.parse(await readFile(root + "index.json", "utf8")) as {
  fetchedAt: string;
  courses: SourceCourse[];
  standards: SourceStandard[];
};
const provenance = JSON.parse(await readFile(root + "provenance.json", "utf8"));
const vectors = new Map<string, Float32Array>();
const vectorFile = root + "vectors-" + EMBEDDING.revision + ".jsonl";
try {
  for (const l of (await readFile(vectorFile, "utf8")).trim().split("\n")) {
    if (!l) continue;
    const [key, value] = JSON.parse(l);
    const bytes = Buffer.from(value, "base64");
    vectors.set(
      key,
      new Float32Array(
        bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ),
      ),
    );
  }
} catch {}
type Group = { keys: string[]; weights: number[] };
const inputs = new Map<string, string>();
function group(text: string): Group {
  const c = Array.from(text.trim()),
    keys: string[] = [],
    weights: number[] = [];
  for (let i = 0; i < c.length; i += 320) {
    const chunk = c.slice(i, i + 320).join(""),
      input = "query: " + chunk,
      key = hash(input);
    inputs.set(key, input);
    keys.push(key);
    weights.push(Array.from(chunk).length);
  }
  return { keys, weights };
}
function aggregate(g: Group) {
  return normalizedMean(
    g.keys.map((k) => {
      const v = vectors.get(k);
      if (!v) throw Error("Missing embedding");
      return v;
    }),
    g.weights,
  );
}
type Criterion = {
  uoc: string;
  uocTitle: string;
  eoc: string;
  eocTitle: string;
  criterion: string;
  locator: string;
  g: Group;
  vector?: Float32Array;
};
type Level = {
  standard: StandardDetail;
  level: StandardDetail["levels"][number];
  criteria: Criterion[];
  vector?: Float32Array;
  path: string;
  hash: string;
};
const levels: Level[] = [];
let totalCriteria = 0;
for (const item of index.standards) {
  const file = `standard-${item.id}.json`;
  const standard = JSON.parse(
    await readFile(root + file, "utf8"),
  ) as StandardDetail;
  const content = JSON.stringify({
      standard,
      provenance: provenance[file] || {},
    }),
    path = `/bulk/${RUN}/standards/${item.id}.json`;
  await writeFile("public" + path, content);
  for (const level of standard.levels) {
    const criteria: Criterion[] = [];
    for (const u of level.units)
      for (const e of u.elements)
        e.pc_items.forEach((pc, pi) => {
          if (pc.trim())
            criteria.push({
              uoc: u.uoc_code,
              uocTitle: u.uoc_desc,
              eoc: e.eoc_code,
              eocTitle: e.eoc_desc,
              criterion: pc,
              locator: `${level.levelName} / UoC ${u.uoc_code} / EoC ${e.eoc_code} / PC ลำดับ ${pi + 1}`,
              g: group([u.uoc_desc, e.eoc_desc, pc].filter(Boolean).join("\n")),
            });
        });
    if (criteria.length) {
      levels.push({ standard, level, criteria, path, hash: hash(content) });
      totalCriteria += criteria.length;
    }
  }
}
const courses = [];
for (const summary of index.courses) {
  const courseId = `${summary.deptCode}:${summary.code}`,
    file = `course-${courseId.replace(":", "_")}.json`;
  let course: CourseDetail | null = null;
  try {
    course = JSON.parse(await readFile(root + file, "utf8"));
  } catch {}
  const eligible = ["ปวช.", "ปวส."].includes(summary.level),
    targets = course ? bulkTargets(course) : [];
  const available =
    eligible && course?.success && targets.length && course.description?.trim();
  const targetGroups = available ? targets.map((t) => group(t.text)) : [];
  const fullGroup = available
    ? group(
        [
          course!.courseName,
          course!.learningOutcomes,
          course!.competencies,
          course!.objectives,
          course!.description,
        ].join("\n"),
      )
    : null;
  courses.push({
    summary,
    courseId,
    course,
    targets,
    targetGroups,
    fullGroup,
    provenance: provenance[file] || {},
    eligible,
    available: !!available,
  });
}
const missing = [...inputs].filter(([key]) => !vectors.has(key));
console.log(
  JSON.stringify({
    phase: "inference",
    courses: courses.length,
    eligible: courses.filter((c) => c.eligible).length,
    available: courses.filter((c) => c.available).length,
    levels: levels.length,
    criteria: totalCriteria,
    inputs: inputs.size,
    cached: vectors.size,
    pending: missing.length,
  }),
);
if (missing.length) {
  const extractor = await pipeline("feature-extraction", EMBEDDING.model, {
    revision: EMBEDDING.revision,
    dtype: "q8",
  });
  for (let i = 0; i < missing.length; i += 32) {
    const batch = missing.slice(i, i + 32);
    const tokenized = await extractor.tokenizer(
      batch.map((x) => x[1]),
      { padding: true, truncation: false },
    );
    if (tokenized.input_ids.dims.at(-1)! > 512)
      throw Error("Token overflow; no truncation allowed");
    const result = await extractor(
      batch.map((x) => x[1]),
      { pooling: "mean", normalize: true },
    );
    const matrix = result.tolist() as number[][];
    let lines = "";
    matrix.forEach((row, j) => {
      if (row.length !== 384 || !row.every(Number.isFinite))
        throw Error("Invalid actual model output");
      const vector = Float32Array.from(row),
        key = batch[j][0];
      vectors.set(key, vector);
      lines +=
        JSON.stringify([key, Buffer.from(vector.buffer).toString("base64")]) +
        "\n";
    });
    await appendFile(vectorFile, lines);
    if (i % 1024 === 0)
      console.log(
        `Embedded ${Math.min(i + 32, missing.length)}/${missing.length}`,
      );
  }
}
for (const l of levels) {
  for (const c of l.criteria) c.vector = aggregate(c.g);
  l.vector = normalizedMean(l.criteria.map((c) => c.vector!));
}
console.log("Ranking full catalog and calculating target-to-PC alignment");
const sqlValue = (v: unknown) =>
  v === null
    ? "NULL"
    : typeof v === "number"
      ? String(v)
      : "'" + String(v).replaceAll("'", "''") + "'";
const seedRows: string[] = [];
let computed = 0,
  pairs = 0,
  direct = 0,
  blocked = 0;
for (const [ci, c] of courses.entries()) {
  const pairResults: BulkPair[] = [];
  const ref = c.course ? bulkReference(c.course) : null;
  if (c.available) {
    const cv = aggregate(c.fullGroup!);
    const targetVectors = c.targetGroups.map(aggregate);
    const shortlist = uniqueStandardCandidates(
      levels.map((l, i) => {
        const r = referenceTier(ref!, l.standard, l.level);
        return {
          ...r,
          standardId: l.standard.id,
          score: dot(cv, l.vector!),
          key: `${l.standard.id}:${l.level.levelName}`,
          i,
        };
      }),
    );
    for (const chosen of shortlist) {
      const l = levels[chosen.i];
      const matches: BulkMatch[] = c.targets.map((target, ti) => {
        let best: Criterion | undefined,
          bestScore = -Infinity,
          bestTier = 9;
        for (const pc of l.criteria) {
          const tier = ref!.codes.includes(pc.uoc.trim().toUpperCase()) ? 0 : 1,
            score = dot(targetVectors[ti], pc.vector!);
          if (tier < bestTier || (tier === bestTier && score > bestScore)) {
            best = pc;
            bestScore = score;
            bestTier = tier;
          }
        }
        const pc = best!;
        return {
          targetId: target.id,
          uoc: pc.uoc,
          uocTitle: pc.uocTitle,
          eoc: pc.eoc,
          eocTitle: pc.eocTitle,
          criterion: pc.criterion,
          locator: pc.locator,
          similarity: Math.round(Math.max(0, bestScore) * 1000) / 10,
          cosine: bestScore,
          critical: /ปลอดภัย|อันตราย|ป้องกัน|ฉุกเฉิน/.test(
            target.text + pc.criterion,
          ),
          negation: /ห้าม|ไม่(?:ต้อง|ให้|สามารถ)|ยกเว้น/.test(
            target.text + pc.criterion,
          ),
          theoryGap:
            /ความรู้|เข้าใจ|อธิบาย/.test(target.text) &&
            /ปฏิบัติ|ติดตั้ง|ทดสอบ|ซ่อม|ตรวจสอบ/.test(pc.criterion),
        };
      });
      const score =
        Math.round(
          (matches.reduce((sum, m) => sum + Math.max(0, m.cosine) * 100, 0) /
            matches.length) *
            10,
        ) / 10;
      pairResults.push({
        id: chosen.key,
        standardId: l.standard.id,
        title: l.standard.title,
        level: l.level.levelName,
        sourceUrl: l.standard.sourceUrl,
        standardPath: l.path,
        standardHash: l.hash,
        basis: chosen.basis,
        referenceNote: chosen.note,
        mismatch: chosen.mismatch,
        score,
        retrievalScore: Math.round(chosen.score * 1000) / 10,
        criteria: l.criteria.length,
        matches,
      });
    }
    pairResults.sort(
      (a, b) =>
        ({ DIRECT_CODE: 0, DOCUMENT_TITLE: 1, EMBEDDING: 2 })[
          a.basis as "DIRECT_CODE"
        ] -
          { DIRECT_CODE: 0, DOCUMENT_TITLE: 1, EMBEDDING: 2 }[
            b.basis as "DIRECT_CODE"
          ] ||
        Number(a.mismatch) - Number(b.mismatch) ||
        b.score - a.score,
    );
    computed++;
    pairs += pairResults.length;
    if (pairResults[0]?.basis === "DIRECT_CODE") direct++;
    if (pairResults[0]?.mismatch) blocked++;
  }
  const status = !c.eligible
    ? "OUT_OF_SCOPE"
    : !c.available
      ? "INSUFFICIENT_DATA"
      : pairResults[0]?.mismatch
        ? "LEVEL_MISMATCH"
        : "PENDING_REVIEW";
  const detail: BulkDetail = {
    runId: RUN,
    courseId: c.courseId,
    summary: c.summary,
    course: c.course,
    provenance: c.provenance,
    courseHash: hash(JSON.stringify(c.course)),
    targets: c.targets,
    pairs: pairResults,
    status,
    note: !c.eligible
      ? "ยังอยู่นอกขอบเขต ปวช./ปวส. ที่คำนวณในรอบนี้"
      : !c.available
        ? "ต้นทางยังไม่มีข้อความผลลัพธ์/สมรรถนะและคำอธิบายพอคำนวณ จึงไม่แสดงคะแนนแทนข้อมูลที่ขาด"
        : "ผลคำนวณพร้อมเปิดดูและพิมพ์ เป็นข้อเสนออัตโนมัติที่ยังไม่ผ่านผู้เชี่ยวชาญ",
  };
  const content = JSON.stringify(detail),
    path = `/bulk/${RUN}/courses/${c.courseId.replace(":", "_")}.json`;
  await writeFile("public" + path, content);
  seedRows.push(
    [
      RUN + ":" + c.courseId,
      RUN,
      c.courseId,
      c.summary.code,
      c.summary.nameTh,
      c.summary.deptName,
      c.summary.category,
      c.summary.level,
      status,
      pairResults[0]?.basis || "",
      pairResults.length ? Math.round(pairResults[0].score * 10) : null,
      pairResults[0]?.title || "",
      pairResults.length,
      path,
      hash(content),
    ]
      .map(sqlValue)
      .join(","),
  );
  if (ci % 500 === 0) console.log(`Matched ${ci}/${courses.length}`);
}
const manifest: BulkManifest = {
  id: RUN,
  createdAt: new Date().toISOString(),
  engine: "catalog-embedding/1.0.0",
  model: EMBEDDING.model,
  modelRevision: EMBEDDING.revision,
  courses: courses.length,
  eligible: courses.filter((c) => c.eligible).length,
  computed,
  missing: courses.filter((c) => c.eligible && !c.available).length,
  excluded: courses.filter((c) => !c.eligible).length,
  standards: index.standards.length,
  levels: levels.length,
  criteria: totalCriteria,
  pairs,
  direct,
  blocked,
  inputs: inputs.size,
  sourceIndexHash: hash(JSON.stringify(index)),
  vectorHash: hash(await readFile(vectorFile, "utf8")),
  snapshotDates: [
    ...new Set(
      Object.values(provenance as Record<string, { fetchedAt?: string }>).map(
        (x) => String(x.fetchedAt).slice(0, 10),
      ),
    ),
  ].sort(),
  method:
    "Multilingual E5 q8; query prefix; mean pooling; 320-codepoint chunks; length-weighted L2 aggregate. Rank all level centroids, retain 3 distinct standards with document references first, then score every target against every PC in each shortlisted level. Pair percent is mean best-target cosine ×100; never competency coverage.",
  scope:
    "ข้อมูลหลักสูตร ปวช./ปวส. ในรายการต้นทางครบทั้งคลัง เปิดผลที่คำนวณไว้ทันที; รายการขาดข้อมูลและระดับอื่นแสดงแยก; ข้อความที่เก็บไว้เป็น snapshot พร้อมวันที่และแหล่งอ้างอิง",
};
await writeFile(out + "/manifest.json", JSON.stringify(manifest, null, 2));
let sql =
  "-- Immutable precomputed public-source embedding snapshot. No expert approvals are seeded.\n";
for (let i = 0; i < seedRows.length; i += 50)
  sql += `INSERT INTO bulk_courses(id,run_id,course_id,code,title,department,category,level,status,basis,score,standard_title,pair_count,result_path,result_hash) VALUES ${seedRows
    .slice(i, i + 50)
    .map((s) => "(" + s + ")")
    .join(",")} ON CONFLICT(id) DO NOTHING;\n--> statement-breakpoint\n`;
sql += `INSERT INTO bulk_runs(id,created_at,manifest) VALUES (${[RUN, manifest.createdAt, JSON.stringify(manifest)].map(sqlValue).join(",")}) ON CONFLICT(id) DO NOTHING;\n`;
await writeFile(seedFile, sql);
console.log(JSON.stringify(manifest));
