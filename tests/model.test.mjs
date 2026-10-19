import test from "node:test";
import assert from "node:assert/strict";
import { load } from "../app/lib/storage.mjs";
import {
  derive,
  grade,
  today,
  followups,
  topicStats,
} from "../app/lib/engine.mjs";
import {
  interpolate,
  inverse,
  CURVES,
  riskScenario,
} from "../app/lib/percentile.mjs";
const original = await load();
const raw = {
  ...original,
  mocks: original.mocks.filter((m) =>
    ["presimcat-1-2026", "presimcat-2-2026", "simcat-2-2026"].includes(
      m.mock_id,
    ),
  ),
  profile: { ...original.profile, baselineMockId: "simcat-2-2026" },
  sessions: [],
  tasks: [],
  events: [],
  content: [],
  revisions: [],
};
test("recovered originals remain 204 metadata rows with unknown dates", () => {
  const d = derive(raw, new Date("2026-10-17T12:00:00Z"));
  assert.equal(d.coverage.rows, 204);
  assert.equal(d.coverage.fullContent, 0);
  assert.equal(d.coverage.datedMocks, 0);
  assert.equal(d.tasks.length, 63);
  assert.equal(d.xp, 0);
  assert.ok(Math.abs(d.estimate.value - (98.98 + 97.81 + 94.83) / 3) < 1e-10);
  assert.ok(d.estimate.note.includes("undated"));
});
test("India day boundaries and explicit rescheduling preserve original due date", () => {
  assert.equal(today(new Date("2026-10-16T20:00:00Z")), "2026-10-17");
  const task = raw.baseTasks[0];
  const d = derive(
    {
      ...raw,
      events: [
        {
          id: "reschedule",
          at: "2026-10-17T00:00:00Z",
          action: "reschedule",
          taskId: task.id,
          due: "2026-10-19",
          reason: "Repair sequence shifted",
        },
      ],
    },
    new Date("2026-10-17T12:00:00Z"),
  );
  const t = d.tasks.find((t) => t.id === task.id);
  assert.equal(t.status, "upcoming");
  assert.equal(t.originalDue, "2026-10-16");
});
test("numeric grading does not assign correctness to missing keys", () => {
  assert.equal(grade("1,200", "1200"), true);
  assert.equal(grade("B", "a"), false);
  assert.equal(grade("A", null), null);
  assert.equal(grade("", 0), false);
});
test("historical curves interpolate only within supported range", () => {
  assert.equal(interpolate(CURVES[2025].ALL, 85), 99);
  assert.equal(interpolate(CURVES[2025].ALL, 76), 98);
  assert.equal(inverse(CURVES[2025].ALL, 99), 85);
  assert.equal(interpolate(CURVES[2025].ALL, 10), null);
});
test("overlapping overdue topic tasks do not double-charge marks or reminders", () => {
  const topic = derive(raw).topics.find((t) => t.section === "QA");
  const t = {
    id: "a",
    section: "QA",
    topic: topic.topic,
    type: "questions",
    status: "missed",
  };
  const profile = raw.profile;
  const a = riskScenario([t], [topic], { value: 94.83 }, profile);
  const b = riskScenario(
    [t, { ...t, id: "b" }],
    [topic],
    { value: 94.83 },
    profile,
  );
  assert.equal(a.marks, b.marks);
  const mock = riskScenario(
    [{ id: "m", type: "mock", status: "missed" }],
    [],
    { value: 94.83 },
    profile,
  );
  assert.equal(mock.penalty, 1);
});
test("successful fresh assessment schedules retention, familiar redo cannot declare mastery", () => {
  const answers = Array.from({ length: 5 }, (_, i) => ({
    questionId: String(i),
    correct: true,
    verification: "key",
  }));
  const s = { id: "example", answers };
  const next = followups(
    s,
    { id: "task", section: "QA", topic: "Interest", stage: "fresh-transfer" },
    "2026-10-17",
  );
  assert.equal(next[0].stage, "delayed-retest");
  assert.equal(next[0].due, "2026-10-19");
  const familiar = followups(
    s,
    { id: "task", section: "QA", topic: "Interest", stage: "cold-reattempt" },
    "2026-10-17",
  );
  assert.equal(familiar[0].stage, "fresh-transfer");
});

test("a new dated mock adds question-specific cold review missions and updates the estimate", () => {
  const template = raw.mocks.find((m) => m.mock_id === "simcat-2-2026");
  const id = "new-mock";
  const mock = {
    ...template,
    mock_id: id,
    name: "New test",
    attempt: { ...template.attempt, attempt_date: "2026-10-20" },
    provider_estimates: { predicted_cat_percentile: 96 },
    questions: template.questions.map((q) => ({
      ...q,
      id: q.id.replace(template.mock_id, id),
      mock_id: id,
      set_id: q.set_id?.replace(template.mock_id, id),
    })),
    sets: template.sets.map((s) => ({
      ...s,
      id: s.id.replace(template.mock_id, id),
    })),
  };
  const state = derive(
    { ...raw, mocks: [...raw.mocks, mock] },
    new Date("2026-10-21T12:00:00Z"),
  );
  assert.equal(state.estimate.value, (98.98 + 97.81 + 94.83 + 96) / 4);
  assert.ok(
    state.tasks.some(
      (t) => t.id.startsWith("auto-new-mock-qa") && t.questionIds.length > 0,
    ),
  );
  assert.equal(state.coverage.rows, 272);
});
