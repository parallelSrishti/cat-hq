import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM, VirtualConsole } from "jsdom";
import { build } from "esbuild";
import { load } from "../app/lib/storage.mjs";
import { derive, publicData } from "../app/lib/engine.mjs";
const state = {
  ...publicData(derive(await load())),
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
    ["history", "Every attempt tells a story"],
    ["import", "Bring the evidence in"],
    ["settings", "Your setup"],
  ]) {
    w.location.hash = "/" + route;
    await wait();
    assert.match(w.document.body.textContent, new RegExp(expected));
  }
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
