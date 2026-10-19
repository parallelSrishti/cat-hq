import { analytics, eligibleMocks } from "./analytics.mjs";
import { classify } from "./hierarchy.mjs";
import crypto from "node:crypto";
import { estimate, riskScenario, CURVES, interpolate } from "./percentile.mjs";
export const SECTIONS = ["VARC", "DILR", "QA"];
export function today(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Calcutta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function daysAfter(day, n) {
  return new Date(Date.parse(day + "T12:00:00Z") + n * 86400000)
    .toISOString()
    .slice(0, 10);
}
export function normalize(a) {
  return String(a ?? "")
    .trim()
    .toLowerCase()
    .replace(/,/g, "")
    .replace(/\s+/g, " ");
}
export function grade(a, b) {
  if (b == null || b === "") return null;
  const x = normalize(a),
    y = normalize(b);
  if (
    x !== "" &&
    y !== "" &&
    Number.isFinite(Number(x)) &&
    Number.isFinite(Number(y))
  )
    return Math.abs(Number(x) - Number(y)) < 1e-6;
  return x === y;
}
export function questionsOf(raw) {
  const map = new Map(
    raw.mocks.flatMap((m) => m.questions).map((q) => [q.id, q]),
  );
  for (const content of raw.content) {
    map.set(content.id, { ...map.get(content.id), ...content });
  }
  return [...map.values()];
}
export function topicStats(raw, questions) {
  const rows = new Map();
  const annotations = new Map(questions.map((q) => [q.id, q]));
  for (const original of eligibleMocks(raw.mocks).flatMap((m) => m.questions)) {
    const annotation = annotations.get(original.id);
    const q = {
      ...original,
      cat_family: annotation?.cat_family ?? original.cat_family,
      classification_source:
        annotation?.classification_source ?? original.classification_source,
    };
    const key = q.section + "|" + q.topic;
    let t = rows.get(key);
    if (!t) {
      t = {
        section: q.section,
        topic: q.topic,
        family: classify(q).name,
        practiceBucket: classify(q).practiceBucket,
        total: 0,
        correct: 0,
        wrong: 0,
        skipped: 0,
        marks: 0,
        seconds: 0,
        questionIds: [],
        byMock: {},
      };
      rows.set(key, t);
    }
    t.total++;
    t[
      q.outcome === "wrong"
        ? "wrong"
        : q.outcome === "correct"
          ? "correct"
          : "skipped"
    ]++;
    t.marks += q.marks || 0;
    t.seconds += q.time_seconds || 0;
    t.questionIds.push(q.id);
    t.byMock[q.mock_id] ??= { total: 0, correct: 0, wrong: 0, skipped: 0 };
    t.byMock[q.mock_id].total++;
    t.byMock[q.mock_id][
      q.outcome === "wrong"
        ? "wrong"
        : q.outcome === "correct"
          ? "correct"
          : "skipped"
    ]++;
  }
  for (const q of questions) {
    const key = q.section + "|" + q.topic;
    if (!rows.has(key))
      rows.set(key, {
        section: q.section,
        topic: q.topic,
        family: classify(q).name,
        practiceBucket: classify(q).practiceBucket,
        total: 0,
        correct: 0,
        wrong: 0,
        skipped: 0,
        marks: 0,
        seconds: 0,
        questionIds: [],
        byMock: {},
      });
  }
  const discovery = [
    { section: "QA", topic: "Algebra", family: "Algebra" },
    {
      section: "DILR",
      topic: "Games & tournaments",
      family: "Games & Tournaments",
      practiceBucket: "Games / tournaments",
    },
  ];
  for (const t of discovery) {
    if (
      ![...rows.values()].some(
        (r) => r.section === t.section && r.family === t.family,
      )
    )
      rows.set(t.section + "|" + t.topic, {
        ...t,
        total: 0,
        correct: 0,
        wrong: 0,
        skipped: 0,
        marks: 0,
        seconds: 0,
        questionIds: [],
        byMock: {},
        discovery: true,
      });
  }
  for (const t of rows.values()) {
    t.mockCount = Object.keys(t.byMock).length;
    t.totalMockCount = eligibleMocks(raw.mocks).length;
    t.attempted = t.correct + t.wrong;
    t.accuracy = t.attempted ? (100 * t.correct) / t.attempted : null;
    t.priority =
      (4 * t.wrong + 2 * t.skipped) * (1 + Math.min(t.mockCount, 3) / 10);
    const weight =
      raw.profile.qaAllocation[t.practiceBucket || t.family] ??
      raw.profile.dilrAllocation[t.practiceBucket || t.family] ??
      20;
    if (t.discovery) t.priority = weight;
    t.priority *= 1 + weight / 100;
    const topicIds = new Set(
      questions
        .filter((q) => q.section === t.section && q.topic === t.topic)
        .map((q) => q.id),
    );
    const practice = raw.sessions
      .filter(
        (s) =>
          s.completedAt &&
          (s.topic === t.topic ||
            s.answers?.some((a) => topicIds.has(a.questionId))) &&
          s.section === t.section &&
          ["fresh-transfer", "delayed-retest"].includes(s.stage),
      )
      .map((s) => ({
        ...s,
        answers: s.answers.filter((a) => topicIds.has(a.questionId)),
      }))
      .sort((a, b) => a.completedAt.localeCompare(b.completedAt));
    const recent = practice.at(-1);
    if (recent) {
      const n =
        recent.answers?.filter((a) => typeof a.correct === "boolean") || [];
      const acc = n.length
        ? n.filter((a) => a.correct).length / n.length
        : recent.external?.total
          ? recent.external.correct / recent.external.total
          : null;
      if (acc !== null) t.priority *= acc >= 0.8 ? 0.7 : 1.25;
    }
    const verified = practice.filter(
      (s) =>
        s.answers?.length &&
        s.answers.every(
          (a) =>
            a.verification === "key" &&
            !a.hintUsed &&
            questions.find((q) => q.id === a.questionId)?.fresh,
        ),
    );
    const good = (s) =>
      s.answers.filter((a) => a.correct).length / s.answers.length >= 0.8;
    const late = verified.filter(
      (s) => s.stage === "delayed-retest" || s.isRetest,
    );
    t.practiceCount = practice.length;
    t.freshAccuracy = verified.length
      ? (100 *
          verified.flatMap((s) => s.answers).filter((a) => a.correct).length) /
        verified.flatMap((s) => s.answers).length
      : null;
    t.repairState =
      t.attempted === 0
        ? "Untested"
        : t.wrong > 0 || t.accuracy < 80
          ? "Diagnose"
          : "Monitor";
    if (practice.length) t.repairState = "Transfer pending verification";
    if (verified.length)
      t.repairState = good(verified.at(-1)) ? "Retest due" : "Repair open";
    if (t.section === "DILR") {
      const goodSets = verified
        .flatMap((s) => s.setResults || [])
        .filter((s) => s.verified);
      if (
        goodSets.length >= 2 &&
        goodSets.slice(-2).every((s) => s.correct === s.total)
      )
        t.repairState = "Fresh sets reliable";
    }
    if (
      late.some(
        (s) =>
          good(s) &&
          verified.some(
            (v) =>
              Date.parse(s.completedAt) - Date.parse(v.completedAt) >=
                2 * 86400000 &&
              v.id !== s.id &&
              good(v),
          ),
      )
    )
      if (t.section !== "DILR" || t.repairState === "Fresh sets reliable")
        t.repairState = "Retained";
  }
  return [...rows.values()].sort((a, b) => b.priority - a.priority);
}
export function mockRepairTasks(mock) {
  if (!mock.attempt?.attempt_date) return [];
  const tasks = [];
  const date = mock.attempt.attempt_date;
  const rank = (q) =>
    q.outcome === "wrong"
      ? 4
      : q.outcome === "skipped"
        ? q.provider_difficulty_type === "A"
          ? 3
          : 1
        : q.time_seconds > 2 * (q.provider_benchmark?.time_seconds || 180)
          ? 2
          : 0;
  const qa = mock.questions
    .filter((q) => q.section === "QA" && rank(q) > 0)
    .sort((a, b) => rank(b) - rank(a))
    .slice(0, 5);
  const make = (section, questions, title, index, topic = null) => ({
    id: "auto-" + mock.mock_id + "-" + section.toLowerCase() + "-" + index,
    section,
    topic,
    type: "review",
    stage: "cold-reattempt",
    title,
    due: daysAfter(date, 1 + index),
    originalDue: daysAfter(date, 1 + index),
    minutes: section === "DILR" ? 40 : 30,
    xp: 35,
    questionIds: questions.map((q) => q.id),
    reason:
      "Generated from this mock’s wrong, skipped or slow responses. A cold reattempt tests recoverability before assigning a lesson.",
    steps: [
      "Attempt from a blank page before solutions.",
      "Record the first blocked step or incorrect inference.",
      "Then test the repair with unseen material.",
    ],
    completion: "Every assigned response and the first blocked step are saved.",
    source: "data/mocks/" + mock.mock_id + "/results.json",
  });
  if (qa.length)
    tasks.push(
      make(
        "QA",
        qa,
        mock.name +
          ": cold-redo QA " +
          qa.map((q) => "Q" + q.question_number).join("/"),
        0,
      ),
    );
  const sets = (mock.sets || [])
    .map((set) => ({
      ...set,
      qs: mock.questions.filter((q) => q.set_id === set.id),
    }))
    .map((set) => ({ ...set, loss: set.qs.reduce((n, q) => n + rank(q), 0) }))
    .filter((s) => s.loss > 0)
    .sort((a, b) => b.loss - a.loss)
    .slice(0, 2);
  sets.forEach((set, i) =>
    tasks.push(
      make(
        "DILR",
        set.qs,
        mock.name + ": rebuild DILR Q" + set.question_numbers.join("/"),
        i,
        set.topic,
      ),
    ),
  );
  const summaries = mock.questions.filter(
    (q) =>
      q.section === "VARC" &&
      /Summary/i.test(q.topic) &&
      q.outcome !== "correct",
  );
  if (summaries.length)
    tasks.push(
      make(
        "VARC",
        summaries,
        mock.name + ": Summary cold review",
        1,
        "Summary",
      ),
    );
  return tasks;
}
export function derive(raw, now = new Date()) {
  const date = today(now),
    questions = questionsOf(raw),
    topics = topicStats(raw, questions);
  const events = [...raw.events].sort(
    (a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id),
  );
  const taskMap = new Map(
    [...raw.baseTasks, ...raw.mocks.flatMap(mockRepairTasks), ...raw.tasks].map(
      (t) => [t.id, { ...t }],
    ),
  );
  for (const event of events) {
    const task = taskMap.get(event.taskId);
    if (!task) continue;
    if (event.action === "reschedule")
      Object.assign(task, { due: event.due, rescheduleReason: event.reason });
    if (event.action === "retire")
      Object.assign(task, { retired: true, retireReason: event.reason });
    if (event.action === "video-watched") task.videoWatchedAt = event.at;
    if (event.action === "assign-questions")
      task.questionIds = event.questionIds;
  }
  const completed = new Set(
    raw.sessions
      .filter((s) => s.completedAt && s.taskCompleted)
      .map((s) => s.taskId),
  );
  const tasks = [...taskMap.values()]
    .map((t) => {
      const topic = topics.find(
        (topic) =>
          topic.section === t.section &&
          (topic.topic === t.topic ||
            t.questionIds?.some((id) => topic.questionIds.includes(id))),
      );
      return {
        ...t,
        topic: t.topic || topic?.topic || null,
        priority:
          (topic?.priority || 0) + (t.stage === "delayed-retest" ? 50 : 0),
        status: t.retired
          ? "retired"
          : completed.has(t.id)
            ? "done"
            : t.due < date
              ? "missed"
              : t.due === date
                ? "today"
                : "upcoming",
        contentCount: (t.questionIds || []).filter(
          (id) =>
            questions.find((q) => q.id === id)?.question_text ||
            questions.find((q) => q.id === id)?.question_html,
        ).length,
        questionCount: t.questionIds?.length || 0,
        session:
          raw.sessions.find((s) => s.taskId === t.id && !s.completedAt)?.id ||
          null,
      };
    })
    .sort((a, b) => a.due.localeCompare(b.due) || b.priority - a.priority);
  for (const checkpoint of tasks.filter(
    (t) => t.prerequisiteGate && !["done", "retired"].includes(t.status),
  )) {
    const unfinished = tasks.filter(
      (t) =>
        t.id !== checkpoint.id &&
        t.due < checkpoint.due &&
        !["done", "retired"].includes(t.status) &&
        (checkpoint.section === "ALL" || t.section === checkpoint.section) &&
        (t.stage === "cold-reattempt" ||
          t.type === "review" ||
          t.type === "repair"),
    );
    checkpoint.blockedBy = unfinished.map((t) => t.id);
  }
  const latestCompleted = raw.sessions
    .filter((s) => s.completedAt && s.taskCompleted)
    .sort((a, b) => a.completedAt.localeCompare(b.completedAt));
  const xp = latestCompleted.reduce(
    (n, s) => n + (taskMap.get(s.taskId)?.xp || 35),
    0,
  );
  const dates = new Set(
    latestCompleted.map((s) => today(new Date(s.completedAt))),
  );
  let streak = 0,
    day = dates.has(date) ? date : daysAfter(date, -1);
  while (dates.has(day)) {
    streak++;
    day = daysAfter(day, -1);
  }
  const pending = tasks.filter((t) => !["done", "retired"].includes(t.status));
  const active = pending
    .filter((t) => t.due <= date)
    .sort((a, b) => a.due.localeCompare(b.due) || b.priority - a.priority);
  let available = raw.profile.dailyMinutes ?? Infinity;
  const recommended = [];
  for (const t of active) {
    if (t.minutes <= available || !recommended.length) {
      recommended.push(t.id);
      available -= t.minutes;
    }
  }
  const selected =
    raw.mocks.find((m) => m.mock_id === raw.profile.baselineMockId) ||
    raw.mocks.at(-1);
  const sectionalScenarios = Object.fromEntries(
    SECTIONS.map((section) => {
      const values = Object.values(CURVES).map((c) =>
        interpolate(c[section], selected?.sections[section]?.score),
      );
      return [
        section,
        {
          values,
          low: values.every((v) => v != null) ? Math.min(...values) : null,
          high: values.some((v) => v != null)
            ? Math.max(...values.filter((v) => v != null))
            : null,
          note: "Historical score scenario without slot/difficulty calibration; not a CAT forecast.",
        },
      ];
    }),
  );
  const consolidated = analytics(raw.mocks, questions);
  const cat = estimate(raw.mocks, raw.profile);
  for (const t of tasks.filter((t) => t.status === "missed"))
    t.risk = riskScenario([t], topics, cat, raw.profile);
  return {
    profile: raw.profile,
    analytics: consolidated,
    today: date,
    mocks: raw.mocks,
    questions,
    topics,
    tasks,
    sessions: raw.sessions,
    events,
    revisions: [...raw.revisions]
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 20),
    estimate: cat,
    risk: riskScenario(tasks, topics, cat, raw.profile),
    sectionalScenarios,
    sectionEstimates: Object.fromEntries(
      SECTIONS.map((s) => [s, estimate(raw.mocks, raw.profile, s)]),
    ),
    xp,
    level: 1 + Math.floor(xp / 250),
    streak,
    recommended,
    coverage: {
      rows: raw.mocks.reduce((n, m) => n + m.questions.length, 0),
      fullContent: questions.filter((q) => q.question_text || q.question_html)
        .length,
      datedMocks: raw.mocks.filter((m) => m.attempt?.attempt_date).length,
    },
    allocation: {
      completed: SECTIONS.map((section) => ({
        section,
        minutes: raw.sessions
          .filter((s) => s.section === section && s.completedAt)
          .reduce((n, s) => n + (s.elapsedSeconds || 0) / 60, 0),
      })),
    },
  };
}
export function publicData(data) {
  return {
    ...data,
    questions: data.questions.map(
      ({ answer, explanation, explanation_html, correct_answer, ...q }) => q,
    ),
    mocks: data.mocks.map((m) => ({
      ...m,
      questions: m.questions.map(({ correct_answer, ...q }) => q),
    })),
  };
}
export function followups(session, task, date) {
  if (task.type === "mock")
    return [
      {
        id: "review-" + session.id,
        title: "Cold-review " + (session.mockId || "the completed mock"),
        section: "ALL",
        type: "review",
        stage: "cold-reattempt",
        due: daysAfter(date, 1),
        minutes: 90,
        xp: 120,
        questionIds: [],
        reason:
          "Reattempt before solutions, then identify at most two QA topics and two DILR models.",
        steps: [
          "Rebuild failed DILR setups and cold-redo wrong or important skipped QA questions.",
          "Attach fresh transfer evidence before the next full mock.",
        ],
        parentTaskId: task.id,
      },
    ];
  const answered = session.answers.filter(
    (a) => typeof a.correct === "boolean",
  );
  const accuracy = answered.length
    ? answered.filter((a) => a.correct).length / answered.length
    : session.external?.total
      ? session.external.correct / session.external.total
      : null;
  const verified =
    answered.length > 0 && answered.every((a) => a.verification === "key");
  const type = accuracy !== null && accuracy < 0.8 ? "repair" : "questions";
  const high = accuracy !== null && accuracy >= 0.8;
  const stage =
    high && ["fresh-transfer", "delayed-retest"].includes(task.stage)
      ? "delayed-retest"
      : "fresh-transfer";
  if (task.stage === "delayed-retest" && verified && high) return [];
  const due = daysAfter(date, stage === "delayed-retest" ? 2 : 1);
  return [
    {
      id: "next-" + session.id,
      section: task.section,
      topic: task.topic,
      title:
        stage === "delayed-retest"
          ? "Retention check: " + (task.topic || task.section)
          : type === "repair"
            ? "Repair the blocked step: " + (task.topic || task.section)
            : "Fresh transfer: " + (task.topic || task.section),
      type,
      stage,
      isRetest: stage === "delayed-retest",
      due,
      minutes: task.section === "DILR" ? 40 : 25,
      xp: 35,
      questionIds: [],
      requiredFreshCount: task.section === "DILR" ? 2 : 5,
      requiresFresh: true,
      parentTaskId: task.id,
      reason:
        accuracy === null
          ? "Outcome is not graded. Confirm the obstacle and test an unseen variation."
          : `${Math.round(accuracy * 100)}% on ${answered.length || session.external?.total || 0} checked outcomes; ${verified ? "answer-key graded" : "self-reported, provisional"}. ${stage === "delayed-retest" ? "Verify retention after 48 hours." : "Use unseen questions; a familiar redo does not close the repair."}`,
      steps: [
        "Use unused IMS/PYQ material matched to the specific obstacle.",
        "Attempt before hints; compare routes only after submission.",
        "If a concept gap persists, assign a specific lesson followed by 5–10 assessment questions.",
      ],
    },
  ];
}
export function snapshot(state, reason) {
  return {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    reason,
    estimate: state.estimate,
    openTasks: state.tasks
      .filter((t) => !["done", "retired"].includes(t.status))
      .map((t) => ({ id: t.id, due: t.due, priority: t.priority })),
    topicStates: state.topics.map((t) => ({
      section: t.section,
      topic: t.topic,
      state: t.repairState,
    })),
    recommended: state.recommended,
  };
}
