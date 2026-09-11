import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const root = new URL("../tmp/bulk-cache/", import.meta.url);
await mkdir(root, { recursive: true });
let nextSlot = 0;
async function fetchCached(name, url) {
  const file = new URL(name, root);
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {}
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const slot = Math.max(Date.now(), nextSlot);
      nextSlot = slot + 1100;
      await new Promise((r) => setTimeout(r, Math.max(0, slot - Date.now())));
      const r = await fetch(url, { signal: AbortSignal.timeout(25000) });
      if (r.status === 429) {
        nextSlot = Math.max(
          nextSlot,
          Date.now() +
            (Number(r.headers.get("retry-after")) || 60) * 1000 +
            1000,
        );
        throw new Error("Rate limited; honoring retry-after");
      }
      if (!r.ok) throw new Error("HTTP " + r.status);
      const data = await r.json();
      await writeFile(file, JSON.stringify(data));
      return data;
    } catch (e) {
      if (attempt === 2) throw e;
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
}
const courses = [];
let expected = 0;
for (let offset = 0; ;) {
  const p = await fetchCached(
    `courses-${offset}.json`,
    `https://dles.vec.go.th/subject/api/search?limit=200&offset=${offset}`,
  );
  expected = p.totalSubjects;
  if (!Array.isArray(p.subjects) || (!p.subjects.length && p.hasMore))
    throw Error("Invalid course pagination");
  courses.push(...p.subjects);
  offset += p.subjects.length;
  if (!p.hasMore) break;
}
if (courses.length !== expected)
  throw Error(`Course count mismatch ${courses.length}/${expected}`);
const standards = [];
let standardExpected = 0;
for (let page = 1; ; page++) {
  const p = await fetchCached(
    `standards-${page}.json`,
    `https://dles.vec.go.th/api/standards/tpqi/search?limit=500&page=${page}`,
  );
  standardExpected = p.total;
  standards.push(...p.results);
  if (page >= p.totalPages) break;
}
if (standards.length !== standardExpected)
  throw Error("Standard count mismatch");
const uniqueCourses = [
  ...new Map(courses.map((c) => [`${c.deptCode}:${c.code}`, c])).values(),
];
const uniqueStandards = [...new Map(standards.map((s) => [s.id, s])).values()];
if (
  uniqueCourses.length !== courses.length ||
  uniqueStandards.length !== standards.length
)
  throw Error("Pagination contains duplicate identities");
console.log(
  JSON.stringify({ courses: courses.length, standards: standards.length }),
);
await writeFile(
  new URL("index.json", root),
  JSON.stringify({ fetchedAt: new Date().toISOString(), courses, standards }),
);
const tasks = [
  ...courses.map((c) => ({
    kind: "course",
    id: `${c.deptCode}:${c.code}`,
    url: `https://dles.vec.go.th/subject/api/subject-detail?code=${encodeURIComponent(c.code)}&dept=${encodeURIComponent(c.deptCode)}`,
  })),
  ...standards.map((s) => ({
    kind: "standard",
    id: String(s.id),
    url: `https://dles.vec.go.th/api/standards/tpqi/${s.id}`,
  })),
];
let pos = 0,
  done = 0;
const failures = [];
await Promise.all(
  Array.from({ length: 4 }, async () => {
    while (pos < tasks.length) {
      const task = tasks[pos++];
      try {
        await fetchCached(
          `${task.kind}-${task.id.replace(":", "_")}.json`,
          task.url,
        );
      } catch (e) {
        failures.push({ ...task, error: e.message });
      }
      done++;
      if (done % 200 === 0)
        console.log(
          `Fetched ${done}/${tasks.length} (${failures.length} failed)`,
        );
    }
  }),
);
await writeFile(
  new URL("fetch-report.json", root),
  JSON.stringify({
    completedAt: new Date().toISOString(),
    attempted: tasks.length,
    failures,
    indexSha256: createHash("sha256")
      .update(JSON.stringify({ courses, standards }))
      .digest("hex"),
  }),
);
console.log(JSON.stringify({ done, failed: failures.length }));
