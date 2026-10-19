export const safeId = (id) =>
  typeof id === "string" && /^[A-Za-z0-9:_-]{1,220}$/.test(id);
function validateClassification(q) {
  if (
    q.cat_family != null &&
    (typeof q.cat_family !== "string" ||
      !q.cat_family.trim() ||
      typeof q.classification_source !== "string" ||
      !q.classification_source.trim())
  )
    throw Error(
      "CAT family classification requires a family and source provenance.",
    );
}
export function validateContent(q) {
  validateClassification(q);
  if (
    !safeId(q.id) ||
    !["QA", "DILR", "VARC"].includes(q.section) ||
    !q.topic ||
    typeof q.question_text !== "string" ||
    !q.question_text.trim()
  )
    throw Error(
      "Question content needs id, section, topic and full question_text.",
    );
  if (q.options != null && !Array.isArray(q.options))
    throw Error("Options must be an array.");
  if (q.options?.some((o) => typeof o !== "string"))
    throw Error("Options must contain strings.");
  if (q.answer != null && !["string", "number"].includes(typeof q.answer))
    throw Error("Answer must be a string or number.");
  if (q.source_url && !/^https?:\/\//.test(q.source_url))
    throw Error("Source URL must be HTTP(S).");
  const keys = [
    "id",
    "section",
    "topic",
    "question_text",
    "options",
    "answer",
    "explanation",
    "fresh",
    "source_url",
    "question_content_status",
    "passage",
    "set_id",
    "question_number",
    "source",
    "cat_family",
    "classification_source",
  ];
  return Object.fromEntries(
    keys.filter((k) => q[k] !== undefined).map((k) => [k, q[k]]),
  );
}
export function validateMockPackage(pkg) {
  const { results, questions, analysis } = pkg;
  if (!results || !questions || typeof analysis !== "string")
    throw Error("Import requires results, questions and analysis.");
  const id = results.mock_id;
  if (!/^[a-z0-9-]{1,100}$/.test(id || "")) throw Error("Invalid mock_id.");
  if (questions.mock_id !== id || !Array.isArray(questions.questions))
    throw Error(
      "Mock IDs must agree and questions.questions must be an array.",
    );
  if (!results.name || !results.attempt?.id)
    throw Error("Results require name and attempt.id.");
  if (
    results.attempt.chronological_order != null &&
    (!Number.isInteger(results.attempt.chronological_order) ||
      results.attempt.chronological_order < 1)
  )
    throw Error(
      "chronological_order must be a positive integer backed by verified ordering evidence.",
    );
  const date = results.attempt.attempt_date;
  if (
    date != null &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)))
  )
    throw Error("Attempt date must be YYYY-MM-DD or null.");
  if (
    !Number.isFinite(results.overall?.provider_percentile) ||
    results.overall.provider_percentile < 0 ||
    results.overall.provider_percentile > 100
  )
    throw Error("Overall percentile must be 0–100.");
  if (
    results.provider_estimates?.predicted_cat_percentile != null &&
    (!Number.isFinite(results.provider_estimates.predicted_cat_percentile) ||
      results.provider_estimates.predicted_cat_percentile < 0 ||
      results.provider_estimates.predicted_cat_percentile > 100)
  )
    throw Error("CAT prediction must be 0–100 or null.");
  if (questions.question_count !== questions.questions.length)
    throw Error("question_count does not match the array.");
  const ids = new Set();
  let score = 0;
  for (const q of questions.questions) {
    validateClassification(q);
    if (!safeId(q.id) || ids.has(q.id))
      throw Error("Question IDs must be safe and unique.");
    ids.add(q.id);
    if (
      q.mock_id !== id ||
      !["QA", "DILR", "VARC"].includes(q.section) ||
      !["correct", "wrong", "skipped"].includes(q.outcome)
    )
      throw Error(
        "Each question needs mock_id, section and a supported outcome.",
      );
    if (
      !Number.isFinite(q.marks) ||
      !Number.isInteger(q.time_seconds) ||
      q.time_seconds < 0
    )
      throw Error(
        "Question marks and integer nonnegative timing are required.",
      );
    score += q.marks;
  }
  if (score !== results.overall?.score)
    throw Error("Question marks do not match overall score.");
  for (const s of ["QA", "DILR", "VARC"]) {
    const qs = questions.questions.filter((q) => q.section === s),
      r = results.sections?.[s];
    if (!r || qs.reduce((n, q) => n + q.marks, 0) !== r.score)
      throw Error("Section score mismatch: " + s);
    if (
      !Number.isFinite(r.provider_percentile) ||
      r.provider_percentile < 0 ||
      r.provider_percentile > 100
    )
      throw Error("Section percentiles must be 0–100.");
  }
  return pkg;
}
