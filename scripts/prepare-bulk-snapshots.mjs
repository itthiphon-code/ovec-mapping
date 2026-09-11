import { readFile, writeFile, access } from "node:fs/promises";
const root = new URL("../tmp/bulk-cache/", import.meta.url);
const index = JSON.parse(await readFile(new URL("index.json", root), "utf8"));
const courses = new Map(
  index.courses.map((c) => [`${c.deptCode}:${c.code}`, c]),
);
const standards = new Map(index.standards.map((s) => [String(s.id), s]));
let provenance = {};
try {
  provenance = JSON.parse(
    await readFile(new URL("provenance.json", root), "utf8"),
  );
} catch {}
let copiedCourses = 0,
  copiedStandards = 0;
for (const line of (
  await readFile(new URL("verified-snapshots.jsonl", root), "utf8")
)
  .trim()
  .split("\n")) {
  const s = JSON.parse(line),
    d = s.data;
  let file, data, id;
  if (s.entity === "subject") {
    id = `${d.departmentCode}:${d.code}`;
    const c = courses.get(id);
    if (!c || c.level !== d.level) continue;
    data = {
      success: d.detailStatus === "complete",
      courseCode: d.code,
      courseName: d.nameTh,
      courseNameEn: d.nameEn,
      credit: d.credit,
      standardRef: d.standardReference || "",
      learningOutcomes: d.learningOutcomes || "",
      objectives: d.objectives || "",
      competencies: d.competencies || "",
      description: d.description || "",
      pdfUrl: d.pdfUrl || c.pdfUrl || "",
      pdfPage: d.pdfPage || c.pdfPage || 0,
      level: d.level,
    };
    file = `course-${id.replace(":", "_")}.json`;
    copiedCourses++;
  } else {
    id = String(d.externalId);
    const c = standards.get(id);
    if (!c || c.title.trim() !== d.title.trim()) continue;
    data = {
      id: Number(id),
      title: d.title,
      category: d.category,
      sourceUrl: d.sourceUrl,
      publicDate: d.publicDate,
      levels: d.levels.map((l) => ({
        levelId: l.id,
        levelName: l.name,
        qualificationId: Number(l.qualificationId) || l.id,
        units: l.units.map((u) => ({
          uoc_code: u.code,
          uoc_desc: u.title,
          elements: u.elements.map((e) => ({
            eoc_code: e.code,
            eoc_desc: e.title,
            pc_items: e.performanceCriteria,
            assess_items: e.assessmentMethods,
          })),
        })),
      })),
    };
    file = `standard-${id}.json`;
    copiedStandards++;
  }
  try {
    await access(new URL(file, root));
    provenance[file] ||= { method: "live-dles", fetchedAt: index.fetchedAt };
  } catch {
    await writeFile(new URL(file, root), JSON.stringify(data));
    provenance[file] = {
      method: "preserved-public-source-snapshot",
      requestUrl: s.requestUrl,
      fetchedAt: s.fetchedAt,
      upstreamUpdatedAt: s.upstreamUpdatedAt,
      checksum: s.checksum,
      snapshotTitle: d.nameTh || d.title,
      currentTitle:
        s.entity === "subject"
          ? courses.get(id)?.nameTh
          : standards.get(id)?.title,
    };
  }
}
await writeFile(new URL("provenance.json", root), JSON.stringify(provenance));
console.log({ copiedCourses, copiedStandards });
