import {
  certificateResult,
  orderCertificateResults,
} from "./certificate-matcher";

// Presentation order only: evidence selection inside the matcher remains source-first.
export function orderLearnerCourses(
  a: ReturnType<typeof certificateResult>,
  b: ReturnType<typeof certificateResult>,
) {
  return (b.score ?? -1) - (a.score ?? -1) || orderCertificateResults(a, b);
}

export type CertificateSelection = { units: string[]; courses: string[] };
export type CertificateSelectionAction =
  | { type: "scope"; units: string[] }
  | { type: "courses"; ids: string[]; checked: boolean }
  | { type: "clear" };

export function certificateSelection(
  state: CertificateSelection,
  action: CertificateSelectionAction,
): CertificateSelection {
  if (action.type === "scope") {
    const units = [...new Set(action.units)];
    const unchanged =
      units.length === state.units.length &&
      units.every((unit) => state.units.includes(unit));
    return unchanged ? state : { units, courses: [] };
  }
  if (action.type === "clear") return { ...state, courses: [] };
  if (!state.units.length) return state;
  const ids = new Set(action.ids);
  return {
    ...state,
    courses: action.checked
      ? [...new Set([...state.courses, ...ids])]
      : state.courses.filter((id) => !ids.has(id)),
  };
}
