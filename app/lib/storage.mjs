import { databaseContent } from "./databases.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
export const ROOT =
  process.env.CAT_HQ_ROOT || path.resolve(import.meta.dirname, "../..");
export const readJSON = async (file, fallback = null) => {
  try {
    return JSON.parse(await fs.readFile(path.join(ROOT, file), "utf8"));
  } catch (e) {
    if (e.code === "ENOENT") return fallback;
    throw e;
  }
};
export async function writeJSON(file, data) {
  const dest = path.join(ROOT, file);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  const temp = dest + "." + crypto.randomUUID() + ".tmp";
  await fs.writeFile(temp, JSON.stringify(data, null, 2) + "\n");
  await fs.rename(temp, dest);
}
export async function files(dir) {
  try {
    return (await fs.readdir(path.join(ROOT, dir)))
      .filter((n) => n.endsWith(".json"))
      .sort();
  } catch (e) {
    if (e.code === "ENOENT") return [];
    throw e;
  }
}
export async function listJSON(dir) {
  return Promise.all((await files(dir)).map((f) => readJSON(dir + "/" + f)));
}
export async function load() {
  const dirs = await fs.readdir(path.join(ROOT, "data/mocks"), {
    withFileTypes: true,
  });
  const mocks = [];
  for (const d of dirs.filter((d) => d.isDirectory())) {
    const result = await readJSON(`data/mocks/${d.name}/results.json`);
    if (!result) continue;
    const q = await readJSON(`data/mocks/${d.name}/questions.json`, {
      questions: [],
      sets: [],
    });
    let analysis = "";
    try {
      analysis = await fs.readFile(
        path.join(ROOT, `data/mocks/${d.name}/analysis.md`),
        "utf8",
      );
    } catch {}
    mocks.push({
      ...result,
      questions: q.questions,
      sets: q.sets || [],
      analysis,
    });
  }
  return {
    profile: await readJSON("data/profile.json"),
    mocks,
    baseTasks: (
      await readJSON("data/planning/reference-tasks.json", { tasks: [] })
    ).tasks,
    tasks: await listJSON("data/tasks"),
    sessions: await listJSON("data/sessions"),
    events: await listJSON("data/events"),
    content: [
      ...(
        await Promise.all(
          dirs
            .filter((d) => d.isDirectory())
            .map((d) => databaseContent(path.join(ROOT, "data/mocks", d.name))),
        )
      ).flat(),
      ...(await listJSON("data/question-bank")),
    ],
    revisions: await listJSON("data/plan-revisions"),
  };
}
let tail = Promise.resolve();
export function transaction(fn) {
  const job = tail.then(async () => {
    const lock = path.join(ROOT, ".runtime/write.lock");
    await fs.mkdir(path.dirname(lock), { recursive: true });
    let acquired = false;
    for (let i = 0; i < 200; i++) {
      try {
        await fs.mkdir(lock);
        acquired = true;
        await fs.writeFile(path.join(lock, "owner"), String(process.pid));
        break;
      } catch (e) {
        if (e.code !== "EEXIST") throw e;
        const stat = await fs.stat(lock).catch(() => null);
        if (stat && Date.now() - stat.mtimeMs > 120000)
          await fs.rm(lock, { recursive: true, force: true });
        await new Promise((r) => setTimeout(r, 50));
      }
    }
    if (!acquired)
      throw Error("Records are busy in another process. Please retry.");
    try {
      return await fn();
    } finally {
      await fs.rm(lock, { recursive: true, force: true });
    }
  });
  tail = job.catch(() => {});
  return job;
}
export async function appendEvent(action, data = {}) {
  const event = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    action,
    ...data,
  };
  await writeJSON("data/events/" + event.id + ".json", event);
  return event;
}
