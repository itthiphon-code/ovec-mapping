import type { BulkDetail } from "./bulk-types";
import type { CertificateCourse } from "./certificate-matcher";

/** Use the existing certificate-scoped endpoint, which verifies stored artifact hashes. */
export async function loadReportSources(
  courses: CertificateCourse[],
  fetchCourse: (id: string) => Promise<BulkDetail>,
): Promise<Record<string, BulkDetail>> {
  const sources: Record<string, BulkDetail> = {};
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(4, courses.length) }, async () => {
      while (next < courses.length) {
        const course = courses[next++];
        const source = await fetchCourse(course.id);
        if (
          source.courseId !== course.id ||
          source.summary.code !== course.summary.code ||
          source.summary.deptCode !== course.summary.deptCode
        ) {
          throw new Error(
            `ข้อมูลต้นฉบับไม่ตรงกับรายวิชา ${course.summary.code} กรุณาลองใหม่`,
          );
        }
        sources[course.id] = source;
      }
    }),
  );
  return sources;
}
