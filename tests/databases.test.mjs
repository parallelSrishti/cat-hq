import test from "node:test";
import assert from "node:assert/strict";
import { load } from "../app/lib/storage.mjs";
import { derive, publicData } from "../app/lib/engine.mjs";
test("uploaded SQLite enriches original IDs with formatted questions, diagrams and keys without duplicate attempts", async () => {
  const raw = await load();
  const state = derive(raw);
  assert.equal(state.coverage.rows, 204);
  assert.equal(state.coverage.fullContent, 204);
  const image = state.questions.find(
    (q) => q.id === "simcat-2-2026:original:qa:q03",
  );
  assert.match(image.question_html, /<img/);
  assert.equal(image.answer, "A");
  assert.equal(image.fresh, false);
  const numeric = state.questions.find(
    (q) => q.id === "simcat-2-2026:original:qa:q02",
  );
  assert.equal(String(numeric.answer), "20");
  const exposed = publicData(state).questions.find((q) => q.id === image.id);
  assert.ok(!("answer" in exposed));
  assert.ok(!("explanation_html" in exposed));
  assert.equal(
    raw.mocks
      .find((m) => m.mock_id === "simcat-2-2026")
      .questions.find((q) => q.question_number === 3 && q.section === "QA")
      .question_text,
    null,
  );
});
