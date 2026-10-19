import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM, VirtualConsole } from "jsdom";
import { build } from "esbuild";
import { load } from "../app/lib/storage.mjs";
import { derive, publicData } from "../app/lib/engine.mjs";
const source = await load();
const state = {
  ...publicData(derive(source)),
  sync: { state: "pending", message: "Not checked" },
};
const compiled = await build({
  entryPoints: ["app/client/main.jsx"],
  bundle: true,
  write: false,
  format: "iife",
  loader: { ".css": "empty" },
  define: { "process.env.NODE_ENV": '"production"' },
});
const errors = [];
const vc = new VirtualConsole();
vc.on("jsdomError", (e) => errors.push(e.message));
vc.on("error", (e) => errors.push(String(e)));
const dom = new JSDOM('<!doctype html><div id="root"></div>', {
  url: "http://127.0.0.1:3000/#/home",
  runScripts: "outside-only",
  pretendToBeVisual: true,
  virtualConsole: vc,
});
const w = dom.window;
w.scrollTo = () => {};
w.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
w.fetch = async (route) => ({ ok: true, json: async () => state });
w.eval(compiled.outputFiles[0].text);
const wait = () => new Promise((r) => setTimeout(r, 150));
test.after(() => dom.window.close());
test("all dashboard routes render their content and mission details open", async () => {
  await wait();
  assert.match(w.document.body.textContent, /Make the next question count/);
  assert.ok(
    w.document.body.textContent.includes(
      Number(state.estimate.value).toFixed(2),
    ),
  );
  for (const [route, expected] of [
    ["board", "Your next right step"],
    ["QA", "Build reliable routes"],
    ["DILR", "Build the model"],
    ["VARC", "Read the claim"],
    ["repairs", "Turn an error into a skill"],
    ["history", "Follow the trend. Inspect the dip"],
    ["import", "Bring the evidence in"],
    ["settings", "Your setup"],
  ]) {
    w.location.hash = "/" + route;
    await wait();
    assert.match(w.document.body.textContent, new RegExp(expected));
  }
  w.location.hash = "/QA";
  await wait();
  assert.equal(w.document.querySelector('[aria-label="Selected mock"]'), null);
  assert.match(w.document.body.textContent, /QA topic hierarchy/);
  const inspector = w.document.querySelector(".attempt-inspector");
  inspector.open = true;
  await wait();
  assert.ok(w.document.querySelector('[aria-label="Selected mock"]'));
  inspector.open = false;
  await wait();
  w.location.hash = "/history";
  await wait();
  assert.equal(
    w.document.querySelector('[aria-label="Find an attempt"]'),
    null,
  );
  const archive = w.document.querySelector(".attempt-inspector");
  archive.open = true;
  await wait();
  assert.ok(w.document.querySelector('[aria-label="Find an attempt"]'));
  assert.match(archive.textContent, /PreSimCAT/);
  w.location.hash = "/board";
  await wait();
  w.document.querySelector(".task-card").click();
  await wait();
  assert.ok(w.document.querySelector("[role=dialog]"));
  assert.match(
    w.document.querySelector("[role=dialog]").textContent,
    /Start timed session/,
  );
  assert.equal(errors.length, 0, errors.join("\n"));
});

test("30-mock history keeps a paginated archive and synchronizes analysis with the selected measure", async () => {
  const template = source.mocks[0];
  const mocks = Array.from({ length: 30 }, (_, i) => ({
    ...template,
    mock_id: `scale-${i}`,
    name: `Scale mock ${i + 1}`,
    attempt: {
      ...template.attempt,
      attempt_date: `2026-09-${String(i + 1).padStart(2, "0")}`,
    },
    overall: { ...template.overall, provider_percentile: 80 + i / 3 },
    provider_estimates: { predicted_cat_percentile: 90 + i / 4 },
    questions: template.questions.map((q) => ({
      ...q,
      id: `scale-${i}:${q.section}:q${q.question_number}`,
      mock_id: `scale-${i}`,
    })),
  }));
  const fixture = {
    ...publicData(
      derive({
        ...source,
        mocks,
        baseTasks: [],
        tasks: [],
        sessions: [],
        events: [],
        content: [],
      }),
    ),
    sync: { state: "pending", message: "Test fixture" },
  };
  const localErrors = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e) => localErrors.push(e.message));
  vc.on("error", (e) => localErrors.push(String(e)));
  const page = new JSDOM('<!doctype html><div id="root"></div>', {
    url: "http://127.0.0.1:3000/#/history",
    runScripts: "outside-only",
    pretendToBeVisual: true,
    virtualConsole: vc,
  });
  try {
    const win = page.window;
    win.scrollTo = () => {};
    win.ResizeObserver = w.ResizeObserver;
    win.fetch = async () => ({ ok: true, json: async () => fixture });
    win.eval(compiled.outputFiles[0].text);
    await wait();
    assert.match(win.document.body.textContent, /93.63/);
    assert.equal(win.document.querySelector("tbody"), null);
    const measure = win.document.querySelector('[aria-label="Trend measure"]');
    measure.value = "projection";
    measure.dispatchEvent(new win.Event("change", { bubbles: true }));
    await wait();
    assert.match(
      win.document.body.textContent,
      /provider CAT prediction percentile/,
    );
    const archive = win.document.querySelector(".attempt-inspector");
    archive.open = true;
    await wait();
    assert.equal(archive.querySelectorAll("tbody tr").length, 10);
    assert.match(archive.textContent, /Page 1 of 3/);
    [...archive.querySelectorAll("button")]
      .find((b) => b.textContent === "Next")
      .click();
    await wait();
    assert.match(archive.textContent, /Page 2 of 3/);
    assert.equal(archive.querySelectorAll("tbody tr").length, 10);
    assert.equal(localErrors.length, 0, localErrors.join("\n"));
  } finally {
    page.window.close();
  }
});
