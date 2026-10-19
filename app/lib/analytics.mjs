import { buildHierarchy } from "./hierarchy.mjs";
export const mean = (values) => {
  const v = values.filter(Number.isFinite);
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
};
export const deviation = (values) => {
  const v = values.filter(Number.isFinite),
    m = mean(v);
  return v.length >= 2 ? Math.sqrt(mean(v.map((x) => (x - m) ** 2))) : null;
};
export function eligibleMocks(mocks) {
  return mocks.filter(
    (m) =>
      m.attempt?.kind !== "reattempt" &&
      ["QA", "DILR", "VARC"].every((s) => m.sections?.[s]),
  );
}
export function summarize(mocks, section = "ALL") {
  const rows = eligibleMocks(mocks);
  const metrics = rows
    .map((m) => (section === "ALL" ? m.overall : m.sections[section]))
    .filter(Boolean);
  const p = metrics.map((v) => v.provider_percentile).filter(Number.isFinite);
  const sums = {
    attempted: 0,
    correct: 0,
    incorrect: 0,
    skipped: 0,
    question_count: 0,
  };
  for (const r of metrics)
    for (const k of Object.keys(sums)) sums[k] += r.statistics?.[k] || 0;
  return {
    count: metrics.length,
    percentileCount: p.length,
    percentile: mean(p),
    score: mean(metrics.map((v) => v.score)),
    range: p.length ? [Math.min(...p), Math.max(...p)] : null,
    dispersion: deviation(p),
    ...sums,
    accuracy: sums.attempted ? (100 * sums.correct) / sums.attempted : null,
  };
}
const validDate = (s) =>
  typeof s === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  !Number.isNaN(Date.parse(s)) &&
  new Date(s + "T12:00:00Z").toISOString().slice(0, 10) === s;
function point(mocks, key, index) {
  const all = summarize(mocks);
  return {
    index,
    label: key,
    date: mocks[0].attempt.attempt_date || null,
    count: mocks.length,
    mockIds: mocks.map((m) => m.mock_id),
    cohort: all.percentile,
    score: all.score,
    projection: mean(
      mocks.map((m) => m.provider_estimates?.predicted_cat_percentile),
    ),
    ...Object.fromEntries(
      ["QA", "DILR", "VARC"].flatMap((s) => {
        const r = summarize(mocks, s);
        return [
          [s, r.percentile],
          [s + "_score", r.score],
          [s + "_accuracy", r.accuracy],
        ];
      }),
    ),
  };
}
export function timeline(mocks) {
  const rows = eligibleMocks(mocks);
  const ordered =
    rows.length > 0 &&
    rows.every(
      (m) =>
        Number.isInteger(m.attempt.chronological_order) &&
        m.attempt.chronological_order > 0,
    ) &&
    new Set(rows.map((m) => m.attempt.chronological_order)).size ===
      rows.length;
  let points, mode;
  if (ordered) {
    mode = "verified-order";
    points = [...rows]
      .sort(
        (a, b) => a.attempt.chronological_order - b.attempt.chronological_order,
      )
      .map((m, i) =>
        point([m], "Attempt " + m.attempt.chronological_order, i + 1),
      );
  } else {
    mode = "date";
    const groups = new Map();
    for (const m of rows.filter((m) => validDate(m.attempt.attempt_date))) {
      const date = m.attempt.attempt_date;
      if (!groups.has(date)) groups.set(date, []);
      groups.get(date).push(m);
    }
    points = [...groups]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, ms], i) => point(ms, date, i + 1));
  }
  const included = points.reduce((n, p) => n + p.count, 0);
  const keys = ["cohort", "projection", "QA", "DILR", "VARC"];
  points = points.map((p, i) => ({
    ...p,
    ...Object.fromEntries(
      keys.map((k) => [
        k + "_rolling",
        mean(points.slice(Math.max(0, i - 4), i + 1).map((v) => v[k])),
      ]),
    ),
  }));
  return {
    points,
    mode,
    included,
    excluded: rows.length - included,
    total: rows.length,
    groupedDays: points.some((p) => p.count > 1),
    note: ordered
      ? "Chronological order explicitly recorded by the analyst."
      : "Only verified dates are used. Multiple mocks on the same date share one daily mean; unknown-date mocks remain in all-mock summaries.",
  };
}
export function analyzeTrend(points, key = "cohort") {
  const rows = points.filter((p) => Number.isFinite(p[key]));
  const recent = rows.slice(-5),
    prior = rows.slice(-10, -5);
  const recentMean = mean(recent.map((p) => p[key])),
    priorMean = mean(prior.map((p) => p[key]));
  const change =
    recent.length === 5 && prior.length === 5 ? recentMean - priorMean : null;
  const dips = [];
  for (let i = 3; i < rows.length; i++) {
    const previous = rows.slice(Math.max(0, i - 5), i).map((p) => p[key]);
    const baseline = mean(previous);
    const threshold = Math.max(5, 2 * (deviation(previous) || 0));
    const drop = baseline - rows[i][key];
    if (drop >= threshold) dips.push({ ...rows[i], drop, baseline, threshold });
  }
  const last = rows.at(-1),
    before = rows.slice(Math.max(0, rows.length - 6), -1);
  const drivers =
    last && key === "cohort"
      ? ["QA", "DILR", "VARC"]
          .map((s) => ({
            section: s,
            marksChange:
              Number.isFinite(last[s + "_score"]) &&
              mean(before.map((p) => p[s + "_score"])) !== null
                ? last[s + "_score"] - mean(before.map((p) => p[s + "_score"]))
                : null,
            percentileChange:
              Number.isFinite(last[s]) && mean(before.map((p) => p[s])) !== null
                ? last[s] - mean(before.map((p) => p[s]))
                : null,
          }))
          .filter((d) => Number.isFinite(d.marksChange))
          .sort((a, b) => a.marksChange - b.marksChange)
      : [];
  return {
    observations: rows.length,
    recentMean,
    priorMean,
    change,
    direction:
      change === null
        ? "More history needed"
        : change > 2
          ? "Rising"
          : change < -2
            ? "Declining"
            : "Stable",
    dispersion: deviation(recent.map((p) => p[key])),
    dips,
    latest: last || null,
    drivers,
    note: "Direction compares the latest five observations with the preceding five (±2 percentile-point band). A dip is at least 5 points and 2 prior-window standard deviations below the preceding 3–5 observations. These are descriptive flags, not calibrated predictions. Never add sectional percentile changes to explain an overall change.",
  };
}
export function analytics(mocks, annotations = []) {
  const byId = new Map(
    annotations
      .filter((q) => q.cat_family && q.classification_source)
      .map((q) => [q.id, q]),
  );
  const rows = eligibleMocks(mocks).map((m) => ({
      ...m,
      questions: (m.questions || []).map((q) => {
        const a = byId.get(q.id);
        return a
          ? {
              ...q,
              cat_family: a.cat_family,
              classification_source: a.classification_source,
            }
          : q;
      }),
    })),
    series = timeline(rows);
  return {
    total: rows.length,
    summary: summarize(rows),
    sections: Object.fromEntries(
      ["QA", "DILR", "VARC"].map((s) => [s, summarize(rows, s)]),
    ),
    timeline: series,
    trends: Object.fromEntries(
      ["cohort", "projection", "QA", "DILR", "VARC"].map((k) => [
        k,
        analyzeTrend(series.points, k),
      ]),
    ),
    hierarchy: buildHierarchy(rows),
  };
}
