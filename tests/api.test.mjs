import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
const temp = await fs.mkdtemp(path.join(os.tmpdir(), "cat-hq-test-"));
await fs.cp(new URL("../data", import.meta.url), path.join(temp, "data"), {
  recursive: true,
});
for (const folder of [
  "sessions",
  "events",
  "tasks",
  "plan-revisions",
  "question-bank",
]) {
  await fs.rm(path.join(temp, "data", folder), {
    recursive: true,
    force: true,
  });
  await fs.mkdir(path.join(temp, "data", folder));
}
for (const id of await fs.readdir(path.join(temp, "data/mocks"))) {
  if (!["presimcat-1-2026", "presimcat-2-2026", "simcat-2-2026"].includes(id))
    await fs.rm(path.join(temp, "data/mocks", id), {
      recursive: true,
      force: true,
    });
}
for (const dir of await fs.readdir(path.join(temp, "data/mocks"))) {
  for (const file of await fs.readdir(path.join(temp, "data/mocks", dir))) {
    if (file.endsWith(".db"))
      await fs.rm(path.join(temp, "data/mocks", dir, file));
  }
}
const profilePath = path.join(temp, "data/profile.json");
const profile = JSON.parse(await fs.readFile(profilePath, "utf8"));
profile.autoSync = false;
profile.baselineMockId = "simcat-2-2026";
await fs.writeFile(profilePath, JSON.stringify(profile));
process.env.CAT_HQ_ROOT = temp;
const { createServer } = await import("../app/server.mjs");
const { writeJSON, readJSON } = await import("../app/lib/storage.mjs");
const server = createServer();
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = "http://127.0.0.1:" + server.address().port;
const call = async (route, body, extra = {}) => {
  const response = await fetch(origin + route, {
    ...(body === undefined
      ? {}
      : {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-HQ-Request": "1",
            ...extra,
          },
          body: JSON.stringify(body),
        }),
  });
  return { status: response.status, data: await response.json() };
};
test.after(async () => {
  await new Promise((r) => server.close(r));
  await fs.rm(temp, { recursive: true, force: true });
});
test("rejects browser cross-origin writes", async () => {
  const r = await call(
    "/api/profile",
    { name: "bad" },
    { Origin: "https://unrelated.example" },
  );
  assert.equal(r.status, 403);
});
test("resume, response timing, conflict protection and adaptive completion persist", async () => {
  const state = (await call("/api/state")).data;
  const task = state.tasks.find((t) =>
    t.title.startsWith("Cold-attempt SimCAT 2 QA"),
  );
  let s = (await call("/api/session/start", { taskId: task.id })).data;
  assert.equal(s.questions.length, 4);
  const resumed = (await call("/api/session/start", { taskId: task.id })).data;
  assert.equal(resumed.id, s.id);
  const file = "data/sessions/" + s.id + ".json";
  const saved = await readJSON(file);
  saved.runningSince = new Date(Date.now() - 125000).toISOString();
  await writeJSON(file, saved);
  for (const q of s.questions) {
    const r = await call("/api/session/" + s.id + "/answer", {
      version: s.version,
      questionId: q.id,
      response: "my route",
      selfCorrect: true,
      reason: "Checked against the IMS solution",
    });
    assert.equal(r.status, 200, r.data.error);
    assert.equal(r.data.feedback.verification, "self-report");
    s = r.data;
  }
  const conflict = await call("/api/session/" + s.id + "/timer", {
    version: 1,
    running: false,
  });
  assert.equal(conflict.status, 409);
  const finished = await call("/api/session/" + s.id + "/finish", {
    version: s.version,
    report: "Rebuilt the setup. Need fresh transfer to verify.",
  });
  assert.equal(finished.status, 200, finished.data.error);
  assert.ok(finished.data.elapsedSeconds >= 125);
  const after = (await call("/api/state")).data;
  assert.equal(after.tasks.find((t) => t.id === task.id).status, "done");
  assert.ok(after.tasks.some((t) => t.parentTaskId === task.id));
  assert.equal(after.xp, 35);
  assert.equal(after.estimate.value, state.estimate.value);
  assert.ok(after.revisions.length > 0);
});
test("video cannot close before watching and completing five fresh assessment responses", async () => {
  const qs = Array.from({ length: 5 }, (_, i) => ({
    id: "test-bank-" + i,
    section: "QA",
    topic: "Interest",
    question_text: "2 + 2 = ?",
    options: ["3", "4"],
    answer: "B",
    explanation: "Four.",
    fresh: true,
  }));
  assert.equal(
    (await call("/api/import", { kind: "questions", questions: qs })).status,
    201,
  );
  const bad = await call("/api/task", {
    title: "Bad video",
    section: "QA",
    type: "video",
    due: "2026-10-17",
    videoUrl: "https://example.com/video",
    questionIds: ["test-bank-0"],
  });
  assert.equal(bad.status, 400);
  const created = await call("/api/task", {
    title: "Verified video assessment",
    section: "QA",
    topic: "Interest",
    type: "video",
    due: "2026-10-17",
    videoUrl: "https://example.com/video",
    questionIds: qs.map((q) => q.id),
  });
  assert.equal(created.status, 201, created.data.error);
  const state = (await call("/api/state")).data;
  const task = state.tasks.find((t) => t.title === "Verified video assessment");
  let s = (await call("/api/session/start", { taskId: task.id })).data;
  assert.ok(!("answer" in s.questions[0]));
  for (const q of s.questions) {
    const r = await call("/api/session/" + s.id + "/answer", {
      version: s.version,
      questionId: q.id,
      response: "B",
    });
    assert.equal(r.status, 200, r.data.error);
    assert.equal(r.data.feedback.correct, true);
    s = r.data;
  }
  const blocked = await call("/api/session/" + s.id + "/finish", {
    version: s.version,
    report: "Completed assessment",
  });
  assert.equal(blocked.status, 400);
  await call("/api/task/action", { taskId: task.id, action: "video-watched" });
  const finish = await call("/api/session/" + s.id + "/finish", {
    version: s.version,
    report: "Completed lesson and fresh assessment",
  });
  assert.equal(finish.status, 200, finish.data.error);
  const after = (await call("/api/state")).data;
  assert.ok(
    after.tasks.some(
      (t) => t.parentTaskId === task.id && t.stage === "delayed-retest",
    ),
  );
});
test("malformed imports and path traversal IDs fail without writing records", async () => {
  assert.equal(
    (
      await call("/api/import", {
        kind: "questions",
        questions: [
          { id: "../../bad", section: "QA", topic: "x", question_text: "x" },
        ],
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call("/api/import", {
        kind: "mock",
        results: { mock_id: "invalid" },
        questions: {},
        analysis: "",
      })
    ).status,
    400,
  );
});
