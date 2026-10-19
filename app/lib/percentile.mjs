// Published IMS historical benchmarks, captured during planning. These are approximate
// reference curves, not CAT 2026 cohort data or a raw-IMS-mock score conversion.
export const CURVES = {
  2025: {
    ALL: [
      [38, 80],
      [43, 85],
      [51, 90],
      [62, 95],
      [76, 98],
      [85, 99],
    ],
    VARC: [
      [19, 80],
      [23, 85],
      [26, 90],
      [32, 95],
      [39, 98],
      [44, 99],
    ],
    DILR: [
      [12, 80],
      [14, 85],
      [17, 90],
      [21, 95],
      [26, 98],
      [30, 99],
    ],
    QA: [
      [10, 80],
      [12, 85],
      [15, 90],
      [18, 95],
      [23, 98],
      [27, 99],
    ],
  },
  2024: {
    ALL: [
      [43, 80],
      [49, 85],
      [57, 90],
      [70, 95],
      [85, 98],
      [96, 99],
    ],
    VARC: [
      [18, 80],
      [20, 85],
      [24, 90],
      [30, 95],
      [36, 98],
      [41, 99],
    ],
    DILR: [
      [17, 80],
      [19, 85],
      [22, 90],
      [27, 95],
      [34, 98],
      [38, 99],
    ],
    QA: [
      [11, 80],
      [14, 85],
      [17, 90],
      [22, 95],
      [29, 98],
      [33, 99],
    ],
  },
  2023: {
    ALL: [
      [34, 80],
      [38, 85],
      [45, 90],
      [55, 95],
      [68, 98],
      [77, 99],
    ],
    VARC: [
      [17, 80],
      [20, 85],
      [23, 90],
      [30, 95],
      [33, 98],
      [39, 99],
    ],
    DILR: [
      [13, 80],
      [14, 85],
      [17, 90],
      [19, 95],
      [23, 98],
      [27, 99],
    ],
    QA: [
      [10, 80],
      [11, 85],
      [13, 90],
      [17, 95],
      [22, 98],
      [25, 99],
    ],
  },
};
export const curveSource =
  "https://www.imsindia.com/blog/cat/cat-score-vs-percentile/";
export function interpolate(points, x) {
  if (!Number.isFinite(x)) return null;
  if (x < points[0][0] || x > points.at(-1)[0]) return null;
  for (let i = 1; i < points.length; i++) {
    const [a, b] = points[i - 1],
      [c, d] = points[i];
    if (x <= c) return b + ((x - a) / (c - a)) * (d - b);
  }
  return points.at(-1)[1];
}
export const inverse = (points, p) =>
  interpolate(
    points.map(([s, p]) => [p, s]),
    p,
  );
export function estimate(mocks, profile, section = "ALL") {
  const rows = mocks.filter(
    (m) =>
      m.attempt?.kind !== "reattempt" &&
      ["QA", "DILR", "VARC"].every((s) => m.sections?.[s]),
  );
  const provider =
    section === "ALL"
      ? rows
          .map((m) => m.provider_estimates?.predicted_cat_percentile)
          .filter(Number.isFinite)
      : [];
  const values = provider.length
    ? provider
    : rows
        .map((m) =>
          section === "ALL"
            ? m.overall?.provider_percentile
            : m.sections[section]?.provider_percentile,
        )
        .filter(Number.isFinite);
  const value = values.length
    ? values.reduce((n, p) => n + p, 0) / values.length
    : null;
  return {
    value,
    label: provider.length
      ? "All-mock CAT estimate"
      : section === "ALL"
        ? "All-mock cohort proxy"
        : "All-mock sectional cohort mean",
    kind: provider.length ? "provider" : "mock-proxy",
    count: values.length,
    mockCount: rows.length,
    range: values.length ? [Math.min(...values), Math.max(...values)] : null,
    anchor: null,
    note: provider.length
      ? `Equal-weight mean of ${provider.length} provider CAT predictions across ${rows.length} full mocks, including undated attempts. No five-mock cutoff or selected baseline. Provisional, not an independently calibrated forecast; the observed range is not a confidence interval.`
      : `Mean of ${values.length} reported cohort percentiles across all ${rows.length} full mocks. A cohort summary is not a CAT prediction. Missing values are excluded and their coverage is shown.`,
  };
}
export function riskScenario(
  tasks,
  topics,
  baseline,
  profile,
  section = "ALL",
) {
  const relevant = tasks.filter(
    (t) =>
      t.status === "missed" &&
      (section === "ALL" || t.section === section || t.section === "ALL"),
  );
  const topicMap = new Map();
  const warnings = [];
  let penalty = 0;
  for (const task of relevant) {
    if (task.type === "mock") {
      penalty += profile.mockPenaltyPoints;
      warnings.push({
        taskId: task.id,
        kind: "chosen-rule",
        topic: "Full mock",
        penalty: profile.mockPenaltyPoints,
        note: "User-chosen accountability penalty, not a measured learning effect.",
      });
      continue;
    }
    const candidates = topics.filter((t) => t.section === task.section);
    const names =
      task.type === "sectional"
        ? [...candidates].sort((a, b) => b.priority - a.priority).slice(0, 1)
        : candidates.filter(
            (t) =>
              t.topic === task.topic ||
              task.questionIds?.some((id) => t.questionIds.includes(id)),
          );
    for (const topic of names) {
      const key = topic.section + "|" + topic.topic;
      const questions =
        topic.total / Math.max(1, topic.totalMockCount || topic.mockCount);
      if (questions > 0)
        topicMap.set(key, {
          section: topic.section,
          topic: topic.topic,
          questions,
          marks: 3 * questions,
        });
    }
    if (names.length)
      warnings.push({
        taskId: task.id,
        kind: "topic-zero",
        topic: names.map((t) => t.topic).join(", "),
        note: "Assume all marks from this topic are unavailable; shared exposure counted once.",
      });
  }
  const exposure = [...topicMap.values()];
  const marks = exposure.reduce((s, t) => s + t.marks, 0);
  const scenarios = [];
  if (
    section === "ALL" &&
    baseline.value != null &&
    baseline.kind !== "mock-proxy"
  ) {
    for (const [year, curves] of Object.entries(CURVES)) {
      const score = inverse(curves.ALL, baseline.value);
      if (score == null) continue;
      const post = score - marks;
      const p = interpolate(curves.ALL, post);
      scenarios.push({
        year,
        baselineScore: score,
        afterScore: post,
        value: p === null ? null : Math.max(0, p - penalty),
        below:
          p === null && post < curves.ALL[0][0]
            ? Math.max(0, 80 - penalty)
            : null,
      });
    }
  }
  return {
    marks,
    exposure,
    penalty,
    warnings,
    scenarios,
    range:
      scenarios.every((s) => s.value != null) && scenarios.length
        ? [
            Math.min(...scenarios.map((s) => s.value)),
            Math.max(...scenarios.map((s) => s.value)),
          ]
        : null,
    note: "Stress scenario: 3 marks per exposed question, using average topic-question exposure across all full mocks. Percentile anchors are inverted separately on each historical curve before subtracting marks. This assumes comparable-scale marks and can overstate loss already reflected in baseline. Historical variation is not a confidence interval. No extrapolation beyond published 80–99 anchors.",
    source: curveSource,
  };
}
