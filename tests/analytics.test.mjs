import test from "node:test";
import assert from "node:assert/strict";
import { analytics, timeline, analyzeTrend } from "../app/lib/analytics.mjs";
import { classify, buildHierarchy } from "../app/lib/hierarchy.mjs";
import { estimate } from "../app/lib/percentile.mjs";
import { validateContent, validateMockPackage } from "../app/lib/validate.mjs";
const mock = (i, percentile = 70 + i) => ({
  mock_id: `mock-${i}`,
  name: `Mock ${i}`,
  attempt: {
    kind: "original",
    sequence: 1,
    attempt_date: `2026-09-${String(i).padStart(2, "0")}`,
  },
  overall: {
    score: i * 3,
    provider_percentile: percentile,
    statistics: {
      attempted: 3,
      correct: 2,
      incorrect: 1,
      skipped: 0,
      question_count: 3,
    },
  },
  provider_estimates: { predicted_cat_percentile: 80 + i / 2 },
  sections: Object.fromEntries(
    ["QA", "DILR", "VARC"].map((section) => [
      section,
      {
        score: i,
        provider_percentile: percentile,
        statistics: {
          attempted: 1,
          correct: section === "QA" ? 0 : 1,
          incorrect: section === "QA" ? 1 : 0,
          skipped: 0,
          question_count: 1,
        },
      },
    ]),
  ),
  questions: ["QA", "DILR", "VARC"].map((section, n) => ({
    id: `mock-${i}:${section}:q1`,
    mock_id: `mock-${i}`,
    section,
    topic: ["Interest", "Games & Tournaments", "Inference"][n],
    area: n === 2 ? "Reading Comprehension" : null,
    outcome: n ? "correct" : "wrong",
    marks: n ? 3 : -1,
    time_seconds: 60,
    set_id: n === 1 ? "set1" : null,
  })),
});
test("30 originals all contribute; recent-five trend is separate from consolidated estimate", () => {
  const mocks = Array.from({ length: 30 }, (_, i) => mock(i + 1));
  const a = analytics([...mocks].reverse()),
    e = estimate(mocks, {});
  assert.equal(a.total, 30);
  assert.equal(a.timeline.points.length, 30);
  assert.equal(e.count, 30);
  assert.equal(e.value, 87.75);
  assert.equal(a.timeline.points[0].label, "2026-09-01");
  assert.equal(a.timeline.points.at(-1).cohort_rolling, 98);
  assert.equal(a.summary.percentile, 85.5);
  assert.equal(a.summary.accuracy, 200 / 3);
  assert.equal(a.trends.cohort.direction, "Rising");
  assert.equal(a.trends.cohort.change, 5);
  assert.equal(a.hierarchy.QA.find((f) => f.id === "arithmetic").total, 30);
  assert.equal(a.hierarchy.DILR.find((f) => f.id === "games").sets, 30);
  const repeat = {
    ...mock(1, 0),
    mock_id: "repeat",
    attempt: { kind: "reattempt", attempt_date: "2026-09-30" },
  };
  assert.equal(analytics([...mocks, repeat]).total, 30);
  assert.equal(estimate([...mocks, repeat], {}).value, e.value);
});
test("unknown chronology contributes to summaries without creating a spurious trend", () => {
  const mocks = [mock(1), mock(2), mock(3)].map((m) => ({
    ...m,
    attempt: { kind: "original", sequence: 1, attempt_date: null },
  }));
  const a = analytics(mocks);
  assert.equal(a.timeline.points.length, 0);
  assert.equal(a.timeline.excluded, 3);
  assert.equal(estimate(mocks, {}).count, 3);
  assert.equal(a.trends.cohort.change, null);
  mocks[0].attempt.attempt_date = "2026-09-02";
  mocks[1].attempt.attempt_date = "2026-09-02";
  mocks[2].attempt.attempt_date = "2026-02-30";
  const t = timeline(mocks);
  assert.equal(t.points.length, 1);
  assert.equal(t.included, 2);
  assert.equal(t.points[0].cohort, 71.5);
  assert.equal(t.groupedDays, true);
  mocks.forEach((m, i) => (m.attempt.chronological_order = 3 - i));
  assert.equal(timeline(mocks).mode, "verified-order");
  assert.deepEqual(
    timeline(mocks).points.flatMap((p) => p.mockIds),
    ["mock-3", "mock-2", "mock-1"],
  );
  mocks[1].attempt.chronological_order = 3;
  assert.equal(timeline(mocks).mode, "date");
});
test("descriptive dips and section-score drivers need measured history", () => {
  const points = [90, 91, 90, 89, 90, 60].map((cohort, i) => ({
    index: i + 1,
    label: `Attempt ${i + 1}`,
    cohort,
    QA: 70,
    QA_score: i === 5 ? 5 : 20,
    DILR_score: null,
    VARC_score: 30,
  }));
  const a = analyzeTrend(points);
  assert.equal(a.dips.length, 1);
  assert.equal(a.dips[0].drop, 30);
  assert.equal(a.direction, "More history needed");
  assert.equal(a.drivers.find((d) => d.section === "QA").marksChange, -15);
  assert.ok(!a.drivers.some((d) => d.section === "DILR"));
  assert.equal(
    analyzeTrend([90, 90, 40].map((cohort) => ({ cohort }))).dips.length,
    0,
  );
  assert.equal(
    analyzeTrend(
      Array.from({ length: 10 }, (_, i) => ({ cohort: i < 5 ? 90 : 70 })),
    ).direction,
    "Declining",
  );
});
test("missing CAT predictions are not filled with cohort percentiles", () => {
  const a = mock(1),
    b = mock(2);
  b.provider_estimates = null;
  a.overall.provider_percentile = 0;
  assert.equal(estimate([a, b], {}).value, 80.5);
  assert.equal(estimate([a, b], {}).count, 1);
  a.provider_estimates = null;
  assert.equal(estimate([a, b], {}).kind, "mock-proxy");
  assert.equal(estimate([a, b], {}).value, 36);
  assert.equal(estimate([], {}).value, null);
});
test("hierarchy preserves supplied tiers and ambiguous labels without inventing mastery", () => {
  assert.equal(classify({ section: "QA", topic: "SICI" }).id, "arithmetic");
  assert.equal(
    classify({ section: "QA", topic: "Unrecognized topic" }).id,
    "unclassified",
  );
  assert.equal(
    classify({ section: "DILR", topic: "Groupings & Arrangements" }).id,
    "unclassified",
  );
  assert.equal(
    classify({ section: "DILR", topic: "Table" }).id,
    "unclassified",
  );
  assert.equal(
    classify({ section: "DILR", topic: "Seating Arrangement" }).tier,
    2,
  );
  assert.equal(
    classify({ section: "DILR", topic: "Table", cat_family: "hybrid" }).id,
    "unclassified",
  );
  const m = mock(1);
  m.questions[1].topic = "Table";
  const a = analytics(
    [m],
    [
      {
        id: m.questions[1].id,
        cat_family: "hybrid",
        classification_source: "sources/verified-set.json",
        marks: 999,
      },
    ],
  );
  assert.equal(a.hierarchy.DILR.find((f) => f.id === "hybrid").marks, 3);
  const h = buildHierarchy([m]);
  assert.equal(h.QA.find((f) => f.id === "algebra").total, 0);
  assert.equal(h.QA.find((f) => f.id === "algebra").accuracy, null);
  assert.equal(
    h.QA.reduce((n, f) => n + f.total, 0),
    1,
  );
  assert.equal(h.VARC[0].tier, null);
});
test("classification overlays require provenance and verified order requires a positive integer", () => {
  const q = {
    id: "q1",
    section: "DILR",
    topic: "Table",
    question_text: "Full text",
    cat_family: "hybrid",
    classification_source: "sources/set-review.md",
  };
  assert.equal(validateContent(q).cat_family, "hybrid");
  assert.throws(
    () => validateContent({ ...q, classification_source: null }),
    /provenance/,
  );
  const m = mock(1);
  const pkg = {
    results: {
      ...m,
      attempt: { ...m.attempt, chronological_order: 0, id: "new-attempt" },
    },
    questions: {
      mock_id: m.mock_id,
      questions: m.questions,
      question_count: 3,
    },
    analysis: "Evidence",
  };
  assert.throws(() => validateMockPackage(pkg), /chronological_order/);
});
