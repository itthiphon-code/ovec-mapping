import test from "node:test";
import assert from "node:assert/strict";
import {
  certificateSelection,
  orderLearnerCourses,
} from "../lib/certificate-selection";
import type { certificateResult } from "../lib/certificate-matcher";

type Result = ReturnType<typeof certificateResult>;
const result = (id: string, score: number | null, basis = "EMBEDDING") =>
  ({
    course: { id },
    score,
    basis,
    mismatch: false,
    missingUnits: [],
  }) as unknown as Result;

test("learner ranking prioritizes score across evidence types and puts missing scores last", () => {
  const rows = [
    result("direct", 60, "DIRECT_CODE"),
    result("missing", null, "DIRECT_CODE"),
    result("semantic", 95),
    result("zero", 0),
  ];
  assert.deepEqual(
    rows.sort(orderLearnerCourses).map((r) => r.course.id),
    ["semantic", "direct", "zero", "missing"],
  );
  assert.ok(
    orderLearnerCourses(
      result("direct", 60, "DIRECT_CODE"),
      result("semantic", 60),
    ) < 0,
  );
});

test("course selection preserves picks outside a filter and separates identical codes in different departments", () => {
  let state = { units: ["U1"], courses: ["D1:C1"] };
  state = certificateSelection(state, {
    type: "courses",
    ids: ["D2:C1", "D2:C1"],
    checked: true,
  });
  assert.deepEqual(state.courses, ["D1:C1", "D2:C1"]);
  state = certificateSelection(state, {
    type: "courses",
    ids: ["D1:C1"],
    checked: false,
  });
  assert.deepEqual(state.courses, ["D2:C1"]);
  assert.deepEqual(certificateSelection(state, { type: "clear" }), {
    units: ["U1"],
    courses: [],
  });
});

test("changing certificate units invalidates all course choices but repeated scope does not", () => {
  const state = { units: ["U1", "U2"], courses: ["D:C"] };
  assert.equal(
    certificateSelection(state, { type: "scope", units: ["U2", "U1"] }),
    state,
  );
  assert.deepEqual(
    certificateSelection(state, { type: "scope", units: ["U1"] }),
    { units: ["U1"], courses: [] },
  );
  assert.deepEqual(certificateSelection(state, { type: "scope", units: [] }), {
    units: [],
    courses: [],
  });
  assert.deepEqual(
    certificateSelection(
      { units: [], courses: [] },
      { type: "courses", ids: ["D:C"], checked: true },
    ),
    { units: [], courses: [] },
  );
});
