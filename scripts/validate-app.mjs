import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { load, ROOT } from "../app/lib/storage.mjs";
import { derive } from "../app/lib/engine.mjs";
import { validateMockPackage, validateContent } from "../app/lib/validate.mjs";
const raw = await load();
const state = derive(raw);
const ids = new Set();
for (const m of raw.mocks) {
  assert.ok(m.mock_id);
  for (const q of m.questions) {
    assert.ok(!ids.has(q.id), "Duplicate original question: " + q.id);
    ids.add(q.id);
  }
}
for (const q of raw.content) {
  if (q.databaseFile)
    assert.ok(q.id && q.section && (q.question_text || q.question_html));
  else validateContent(q);
}
for (const t of state.tasks) {
  assert.ok(
    t.id && t.title && /^\d{4}-\d{2}-\d{2}$/.test(t.due),
    "Invalid task",
  );
  assert.ok(
    t.questionIds?.every((id) => state.questions.some((q) => q.id === id)),
    "Missing task question ID: " + t.id,
  );
}
for (const s of raw.sessions) {
  assert.ok(s.id && s.taskId);
  assert.ok(s.version > 0);
}
console.log(
  JSON.stringify(
    {
      status: "passed",
      mocks: raw.mocks.length,
      originalQuestions: ids.size,
      missions: state.tasks.length,
      questionContent: raw.content.length,
      sessions: raw.sessions.length,
      legacyUnmodified:
        "Run python3 scripts/validate_records.py to check source hashes",
    },
    null,
    2,
  ),
);
