/** Certificate-first retrieval across every available course; reuse pinned, real E5 vectors. */
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { EMBEDDING } from "../public/embedding-config.js";
import {
  bulkReference,
  dot,
  normalizedMean,
  referenceTier,
  candidateOrder,
} from "../lib/bulk-matcher";
import {
  certificateCriteria,
  type CertificateFile,
  type CertificateIndex,
  type CertificateCourse,
} from "../lib/certificate-matcher";
import type {
  BulkDetail,
  BulkStandardFile,
  BulkManifest,
} from "../lib/bulk-types";
const RUN = "certificate-20260911-e5-01",
  SOURCE = "bulk-20260911-e5-01";
const root = `public/bulk/${SOURCE}`,
  out = `public/certificates/${RUN}`;
try {
  await readFile(`${out}/index.json.gz`);
  throw Error("Completed certificate snapshot is immutable");
} catch (e) {
  if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
}
await mkdir(out, { recursive: true });
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const vectors = new Map<string, Float32Array>();
for (const line of (
  await readFile(`tmp/bulk-cache/vectors-${EMBEDDING.revision}.jsonl`, "utf8")
)
  .trim()
  .split("\n")) {
  const [key, value] = JSON.parse(line),
    bytes = Buffer.from(value, "base64");
  vectors.set(
    key,
    new Float32Array(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    ),
  );
}
function vector(text: string) {
  const chars = Array.from(text.trim()),
    chunks: Float32Array[] = [],
    weights: number[] = [];
  for (let i = 0; i < chars.length; i += 320) {
    const slice = chars.slice(i, i + 320),
      v = vectors.get(hash("query: " + slice.join("")));
    if (!v)
      throw Error("Missing cached vector; never substitute a synthetic score");
    chunks.push(v);
    weights.push(slice.length);
  }
  return normalizedMean(chunks, weights);
}
const courses: {
  data: BulkDetail;
  hash: string;
  path: string;
  vector: Float32Array;
  targets: Float32Array[];
  ref: ReturnType<typeof bulkReference>;
}[] = [];
for (const file of (await readdir(`${root}/courses`)).sort()) {
  const text = await readFile(`${root}/courses/${file}`, "utf8"),
    data = JSON.parse(text) as BulkDetail;
  if (
    !["PENDING_REVIEW", "LEVEL_MISMATCH"].includes(data.status) ||
    !data.course
  )
    continue;
  const c = data.course;
  courses.push({
    data,
    hash: hash(text),
    path: `/bulk/${SOURCE}/courses/${file}`,
    vector: vector(
      [
        c.courseName,
        c.learningOutcomes,
        c.competencies,
        c.objectives,
        c.description,
      ].join("\n"),
    ),
    targets: data.targets.map((t) => vector(t.text)),
    ref: bulkReference(c),
  });
}
const sourceManifest = JSON.parse(
  await readFile(`${root}/manifest.json`, "utf8"),
) as BulkManifest;
const index: CertificateIndex = {
  id: RUN,
  createdAt: new Date().toISOString(),
  courses: courses.length,
  levels: 0,
  pairs: 0,
  sourceRunId: SOURCE,
  model: EMBEDDING.model,
  modelRevision: EMBEDDING.revision,
  snapshotDates: sourceManifest.snapshotDates,
  method:
    "คัดกรองทุกวิชาด้วย E5 โดยให้อ้างอิงเอกสารก่อน เก็บ 20 วิชาต่อระดับและทุกวิชาที่มีรหัสหรือชื่ออ้างอิงตรง แล้วเทียบผลลัพธ์กับ PC แยกทุก UoC; เปอร์เซ็นต์เป็นค่าเฉลี่ย cosine ของข้อที่ใกล้ที่สุดใน UoC ที่เลือก",
  scope:
    "คัดกรองครบ 6,277 วิชาที่มีข้อมูล ปวช./ปวส. คำนวณละเอียดเฉพาะรายวิชาที่คัดไว้ต่อระดับ การเลือก UoC จะจัดอันดับใหม่ภายในชุดนี้ อาจมีวิชาอื่นที่เกี่ยวข้องซึ่งยังไม่อยู่ในผล; อีก 11 วิชามีข้อมูลไม่พอ คะแนนยังไม่ผ่านการสอบเทียบกับคำตัดสินผู้เชี่ยวชาญ",
  items: [],
};
let n = 0;
for (const file of (await readdir(`${root}/standards`)).sort()) {
  const text = await readFile(`${root}/standards/${file}`, "utf8"),
    source = JSON.parse(text) as BulkStandardFile;
  const artifact: CertificateFile = {
    ...source,
    runId: RUN,
    sourceRunId: SOURCE,
    sourceHash: hash(text),
    results: [],
  };
  for (const level of source.standard.levels) {
    const criteria = certificateCriteria(level);
    if (!criteria.length) {
      artifact.results.push({
        levelId: level.levelId,
        levelName: level.levelName,
        criteria: [],
        courses: [],
      });
      continue;
    }
    const pcVectors = level.units.flatMap((u) =>
      u.elements.flatMap((e) =>
        e.pc_items
          .filter((pc) => pc.trim())
          .map((pc) =>
            vector([u.uoc_desc, e.eoc_desc, pc].filter(Boolean).join("\n")),
          ),
      ),
    );
    const centroid = normalizedMean(pcVectors);
    const ranked = courses
      .map((c, i) => ({
        ...referenceTier(c.ref, source.standard, level),
        score: dot(c.vector, centroid),
        key: c.data.courseId,
        i,
      }))
      .sort(candidateOrder);
    const selected = ranked.filter((r, i) => i < 20 || r.tier < 2);
    const results: CertificateCourse[] = selected.map((r) => {
      const c = courses[r.i];
      return {
        id: c.data.courseId,
        summary: c.data.summary,
        targets: c.data.targets,
        reference: c.ref,
        basis: r.basis,
        mismatch: r.mismatch,
        retrievalScore: Math.round(r.score * 1000) / 10,
        sourcePath: c.path,
        sourceHash: c.hash,
        matches: c.targets.map((target) => {
          const best = new Map<string, [number, number]>();
          pcVectors.forEach((pc, i) => {
            const score = dot(target, pc),
              prev = best.get(criteria[i].unit);
            if (!prev || score > prev[1])
              best.set(criteria[i].unit, [i, score]);
          });
          return [...best.values()];
        }),
      };
    });
    artifact.results.push({
      levelId: level.levelId,
      levelName: level.levelName,
      criteria,
      courses: results,
    });
    index.levels++;
    index.pairs += results.length;
  }
  const content = JSON.stringify(artifact),
    path = `/certificates/${RUN}/${file}.gz`;
  await writeFile("public" + path, gzipSync(content, { level: 9 }));
  index.items.push({
    id: source.standard.id,
    title: source.standard.title,
    category: source.standard.category,
    levels: source.standard.levels.map((l) => l.levelName),
    path,
    hash: hash(content),
  });
  if (++n % 100 === 0)
    console.log(
      JSON.stringify({
        standards: n,
        levels: index.levels,
        pairs: index.pairs,
      }),
    );
}
const content = JSON.stringify(index);
await writeFile(`${out}/index.json.gz`, gzipSync(content, { level: 9 }));
await writeFile(
  "lib/certificate-registry.json",
  JSON.stringify(
    { path: `/certificates/${RUN}/index.json.gz`, hash: hash(content) },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify({
    complete: true,
    courses: courses.length,
    standards: n,
    levels: index.levels,
    pairs: index.pairs,
  }),
);
