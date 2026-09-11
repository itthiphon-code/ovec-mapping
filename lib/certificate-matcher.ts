import type { BulkTarget, BulkStandardFile } from "./bulk-types";
import type { SourceCourse, StandardDetail } from "./types";

export type CertificateCriterion = {
  unit: string;
  eoc: string;
  text: string;
  locator: string;
};
export type CertificateCourse = {
  id: string;
  summary: SourceCourse;
  targets: BulkTarget[];
  reference: { text: string; codes: string[]; level: string | null };
  basis: string;
  mismatch: boolean;
  retrievalScore: number;
  // One best PC per UoC per target. A tuple is [criterion index, cosine].
  matches: [number, number][][];
  sourcePath: string;
  sourceHash: string;
};
export type CertificateLevel = {
  levelId: number;
  levelName: string;
  criteria: CertificateCriterion[];
  courses: CertificateCourse[];
};
export type CertificateFile = BulkStandardFile & {
  runId: string;
  sourceRunId: string;
  sourceHash: string;
  results: CertificateLevel[];
};
export type CertificateIndex = {
  id: string;
  createdAt: string;
  courses: number;
  levels: number;
  pairs: number;
  sourceRunId: string;
  model: string;
  modelRevision: string;
  snapshotDates: string[];
  method: string;
  scope: string;
  items: {
    id: number;
    title: string;
    category: string;
    levels: string[];
    path: string;
    hash: string;
  }[];
};
export function certificateCriteria(
  level: StandardDetail["levels"][number],
): CertificateCriterion[] {
  return level.units.flatMap((u) =>
    u.elements.flatMap((e) =>
      e.pc_items.flatMap((text, i) =>
        text.trim()
          ? [
              {
                unit: u.uoc_code,
                eoc: e.eoc_code,
                text,
                locator: `${level.levelName} / UoC ${u.uoc_code} / EoC ${e.eoc_code} / PC ลำดับ ${i + 1}`,
              },
            ]
          : [],
      ),
    ),
  );
}
export function certificateResult(
  course: CertificateCourse,
  level: CertificateLevel,
  units: string[],
) {
  const selected = new Set(units);
  const referenceCodes = new Set(course.reference.codes);
  const matches = course.targets.map((target, i) => {
    const candidates = course.matches[i].filter(([pc]) =>
      selected.has(level.criteria[pc].unit),
    );
    candidates.sort(
      (a, b) =>
        Number(
          referenceCodes.has(level.criteria[b[0]].unit.trim().toUpperCase()),
        ) -
          Number(
            referenceCodes.has(level.criteria[a[0]].unit.trim().toUpperCase()),
          ) ||
        b[1] - a[1] ||
        a[0] - b[0],
    );
    const best = candidates[0];
    return {
      target,
      criterion: best ? level.criteria[best[0]] : null,
      cosine: best ? best[1] : null,
      score: best ? Math.round(Math.max(0, best[1]) * 1000) / 10 : null,
    };
  });
  const missingUnits = course.reference.codes.filter(
    (code) =>
      level.criteria.some((pc) => pc.unit.trim().toUpperCase() === code) &&
      ![...selected].some((unit) => unit.trim().toUpperCase() === code),
  );
  const referencedUnits = course.reference.codes.filter((code) =>
    [...selected].some((unit) => unit.trim().toUpperCase() === code),
  );
  const score =
    matches.length && matches.every((m) => m.cosine !== null)
      ? Math.round(
          (matches.reduce((sum, m) => sum + Math.max(0, m.cosine!), 0) /
            matches.length) *
            1000,
        ) / 10
      : null;
  const basis = referencedUnits.length
    ? "DIRECT_CODE"
    : course.basis === "DOCUMENT_TITLE"
      ? "DOCUMENT_TITLE"
      : "EMBEDDING";
  return {
    course,
    matches,
    score,
    missingUnits,
    basis,
    mismatch: course.mismatch,
  };
}
export function orderCertificateResults(
  a: ReturnType<typeof certificateResult>,
  b: ReturnType<typeof certificateResult>,
) {
  const tiers: Record<string, number> = {
    DIRECT_CODE: 0,
    DOCUMENT_TITLE: 1,
    EMBEDDING: 2,
  };
  return (
    tiers[a.basis] - tiers[b.basis] ||
    Number(a.mismatch) - Number(b.mismatch) ||
    Number(!!a.missingUnits.length) - Number(!!b.missingUnits.length) ||
    (b.score ?? -1) - (a.score ?? -1) ||
    a.course.id.localeCompare(b.course.id)
  );
}
