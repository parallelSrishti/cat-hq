import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  ROOT,
  load,
  readJSON,
  writeJSON,
  appendEvent,
  transaction,
} from "./lib/storage.mjs";
import {
  derive,
  publicData,
  grade,
  followups,
  snapshot,
  today,
  daysAfter,
} from "./lib/engine.mjs";
import {
  safeId,
  validateContent,
  validateMockPackage,
} from "./lib/validate.mjs";
import { scheduleSync, syncStatus, syncRecords } from "./lib/sync.mjs";
const text = async (p) => fs.readFile(path.join(ROOT, p), "utf8");
const json = (res, status, obj) => {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(JSON.stringify(obj));
};
async function body(req) {
  let bytes = 0;
  const chunks = [];
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 5e6) throw Error("Request exceeds 5 MB.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString() || "{}");
}
async function recordRevision(reason) {
  const state = derive(await load());
  const revision = snapshot(state, reason);
  await writeJSON("data/plan-revisions/" + revision.id + ".json", revision);
  return revision;
}
async function sessionView(session, state) {
  const t = state.tasks.find((t) => t.id === session.taskId);
  return {
    ...session,
    task: t,
    review: Object.fromEntries(
      session.answers.map((a) => {
        const q = state.questions.find((q) => q.id === a.questionId);
        return [
          a.questionId,
          {
            answer: q?.answer ?? null,
            explanation: q?.explanation ?? null,
            explanation_html: q?.explanation_html ?? null,
            originalResponse: q?.original_response ?? null,
            originalSeconds: q?.time_seconds,
          },
        ];
      }),
    ),
    questions: (t?.questionIds || [])
      .map((id) => state.questions.find((q) => q.id === id))
      .filter(Boolean)
      .map(
        ({ answer, explanation, explanation_html, correct_answer, ...q }) => q,
      ),
  };
}
function accrueFocus(s) {
  const elapsed = currentElapsed(s);
  if (s.focusedId)
    s.questionSeconds = {
      ...(s.questionSeconds || {}),
      [s.focusedId]:
        (s.questionSeconds?.[s.focusedId] || 0) +
        Math.max(0, elapsed - (s.focusElapsed || 0)),
    };
  s.focusElapsed = elapsed;
}
function currentElapsed(s) {
  return Math.round(
    (s.accumulatedMs +
      (s.runningSince ? Date.now() - Date.parse(s.runningSince) : 0)) /
      1000,
  );
}
async function API(req, res, url) {
  const route = url.pathname,
    method = req.method;
  if (method === "GET" && route === "/api/state") {
    const state = publicData(derive(await load()));
    return json(res, 200, { ...state, sync: await syncStatus() });
  }
  if (method === "GET" && route === "/api/export") {
    const raw = await load();
    return json(res, 200, { exportedAt: new Date().toISOString(), ...raw });
  }
  if (method === "POST" && route === "/api/sync")
    return json(res, 200, await syncRecords());
  if (method === "GET" && route.startsWith("/api/session/")) {
    const id = route.split("/").at(-1);
    if (!safeId(id)) throw Error("Invalid session ID.");
    const s = await readJSON("data/sessions/" + id + ".json");
    if (!s) return json(res, 404, { error: "Session not found." });
    return json(res, 200, await sessionView(s, derive(await load())));
  }
  if (method === "POST" && route === "/api/session/start") {
    const { taskId } = await body(req);
    let view;
    await transaction(async () => {
      const state = derive(await load());
      const task = state.tasks.find((t) => t.id === taskId);
      if (!task) throw Error("Task not found.");
      if (["done", "retired"].includes(task.status))
        throw Error("Task is already completed or retired.");
      if (task.blockedBy?.length)
        throw Error(
          "Complete the prior cold reviews/repairs first, or move this checkpoint forward. The plan preserves the repair sequence.",
        );
      let s = state.sessions.find((s) => s.taskId === taskId && !s.completedAt);
      if (!s) {
        s = {
          id: crypto.randomUUID(),
          taskId,
          section: task.section,
          topic: task.topic,
          stage: task.stage || "fresh-transfer",
          isRetest: task.isRetest || false,
          startedAt: new Date().toISOString(),
          runningSince: new Date().toISOString(),
          accumulatedMs: 0,
          lastAnswerElapsed: 0,
          focusedId: task.questionIds?.[0] || null,
          focusElapsed: 0,
          questionSeconds: {},
          answers: [],
          version: 1,
        };
        await writeJSON("data/sessions/" + s.id + ".json", s);
      }
      view = await sessionView(s, state);
    });
    return json(res, 200, view);
  }
  if (method === "POST" && route.startsWith("/api/session/")) {
    const [, , , id, action] = route.split("/");
    if (!safeId(id)) throw Error("Invalid session ID.");
    const input = await body(req);
    let result;
    await transaction(async () => {
      const s = await readJSON("data/sessions/" + id + ".json");
      if (!s) throw Error("Session not found.");
      if (s.completedAt) throw Error("Session is already complete.");
      if (input.version !== s.version) {
        const e = Error(
          "Session changed in another tab. Reload before continuing.",
        );
        e.status = 409;
        throw e;
      }
      const state = derive(await load()),
        task = state.tasks.find((t) => t.id === s.taskId);
      if (!task) throw Error("Task not found.");
      if (action === "timer") {
        if (input.running && !s.runningSince)
          s.runningSince = new Date().toISOString();
        if (!input.running && s.runningSince) {
          s.accumulatedMs += Date.now() - Date.parse(s.runningSince);
          s.runningSince = null;
        }
      } else if (action === "focus") {
        if (!task.questionIds?.includes(input.questionId))
          throw Error("Question is not in this task.");
        accrueFocus(s);
        s.focusedId = input.questionId;
      } else if (action === "answer") {
        if (!task.questionIds?.includes(input.questionId))
          throw Error("Question is not in this task.");
        if (s.answers.some((a) => a.questionId === input.questionId))
          throw Error("Response is already saved.");
        const q = state.questions.find((q) => q.id === input.questionId);
        const key =
          q.answer ??
          (q.question_content_status === "complete"
            ? (q.correct_answer?.value ?? q.correct_answer?.option_label)
            : null);
        let correct = grade(input.response, key);
        let verification = correct === null ? "ungraded" : "key";
        if (correct === null && typeof input.selfCorrect === "boolean") {
          if (!input.reason?.trim())
            throw Error("Explain the checked result or blocking step.");
          correct = input.selfCorrect;
          verification = "self-report";
        }
        accrueFocus(s);
        const elapsed = currentElapsed(s);
        const answer = {
          questionId: q.id,
          response: String(input.response || ""),
          correct,
          verification,
          seconds:
            s.questionSeconds?.[q.id] ??
            Math.max(0, elapsed - s.lastAnswerElapsed),
          at: new Date().toISOString(),
          reason: input.reason || "",
          hintUsed: !!input.hintUsed,
        };
        s.answers.push(answer);
        s.lastAnswerElapsed = elapsed;
        result = {
          feedback: {
            ...answer,
            answer: key,
            explanation: q.explanation || null,
            explanation_html: q.explanation_html || null,
            originalResponse: q.original_response,
            originalSeconds: q.time_seconds,
          },
        };
      } else if (action === "finish") {
        const required = task.questionIds?.length || 0;
        if (s.answers.length < required)
          throw Error(
            "Save a response or explicit skip for every assigned question.",
          );
        const external = input.external || {};
        if (!input.report?.trim())
          throw Error("Add a short outcome or first blocked step.");
        if (
          task.type !== "mock" &&
          required === 0 &&
          (!external.total || !external.source?.trim())
        )
          throw Error(
            "Record the external question/set count and source before completing this task.",
          );
        const freshAssigned =
          task.section === "DILR"
            ? new Set(
                (task.questionIds || [])
                  .map((id) => state.questions.find((q) => q.id === id))
                  .filter((q) => q?.fresh && q.set_id)
                  .map((q) => q.set_id),
              ).size
            : (task.questionIds || []).filter(
                (id) => state.questions.find((q) => q.id === id)?.fresh,
              ).length;
        const freshNeeded = task.requiresFresh
          ? Math.max(0, (task.requiredFreshCount || 1) - freshAssigned)
          : 0;
        if (
          freshNeeded &&
          (!Number.isInteger(external.total) ||
            external.total < freshNeeded ||
            !external.source?.trim())
        )
          throw Error(
            `This task also needs ${freshNeeded} fresh ${task.section === "DILR" ? "sets" : "questions"} and a source reference. Use the external-work fields.`,
          );
        if (
          external.total != null &&
          (!Number.isInteger(external.correct) ||
            external.correct < 0 ||
            external.correct > external.total ||
            external.total > 500)
        )
          throw Error(
            "External correct count must be between 0 and total (maximum 500).",
          );
        if (
          task.type === "video" &&
          (!task.videoWatchedAt || required < 5 || required > 10)
        )
          throw Error(
            "Mark the lesson watched, then complete its 5–10 assessment questions.",
          );
        if (task.prerequisiteGate && task.type === "sectional") {
          const unresolved = state.tasks.filter(
            (t) =>
              t.section === task.section &&
              t.due < task.due &&
              ["review", "repair"].includes(t.type) &&
              !["done", "retired"].includes(t.status),
          );
          if (unresolved.length)
            throw Error(
              "Review the previous sectional and complete its repair cycle first. Move this checkpoint forward instead of stacking tests.",
            );
        }
        if (task.type === "mock") {
          const m = state.mocks.find(
            (m) =>
              m.mock_id === input.mockId &&
              m.attempt.attempt_date &&
              m.attempt.attempt_date >= task.due,
          );
          if (!m)
            throw Error(
              "Import the newly completed dated mock and select it before completing this mission.",
            );
          const previous = state.tasks
            .filter(
              (t) =>
                t.type === "mock" && t.status === "done" && t.due < task.due,
            )
            .at(-1);
          if (previous) {
            const review = state.sessions.some(
              (v) =>
                v.completedAt &&
                v.stage === "cold-reattempt" &&
                v.startedAt >
                  (state.sessions.find((v) => v.taskId === previous.id)
                    ?.completedAt || ""),
            );
            const freshQA = state.sessions.some(
              (v) =>
                v.completedAt &&
                v.section === "QA" &&
                v.stage === "fresh-transfer" &&
                v.completedAt >
                  (state.sessions.find((v) => v.taskId === previous.id)
                    ?.completedAt || ""),
            );
            const freshDILR = state.sessions.some(
              (v) =>
                v.completedAt &&
                v.section === "DILR" &&
                v.stage === "fresh-transfer" &&
                v.completedAt >
                  (state.sessions.find((v) => v.taskId === previous.id)
                    ?.completedAt || ""),
            );
            if (!(review && freshQA && freshDILR))
              throw Error(
                "Complete the prior mock review plus a fresh QA and DILR transfer cycle before this checkpoint.",
              );
          }
          if (
            state.sessions.some((v) => v.completedAt && v.mockId === m.mock_id)
          )
            throw Error(
              "This mock was already used for a completed checkpoint. Use the next unused paper.",
            );
          s.mockId = m.mock_id;
        }
        accrueFocus(s);
        s.elapsedSeconds = currentElapsed(s);
        s.accumulatedMs = s.elapsedSeconds * 1000;
        s.runningSince = null;
        s.completedAt = new Date().toISOString();
        s.taskCompleted = true;
        s.report = input.report;
        s.external = external;
        if (external.total && s.section === "DILR")
          s.setResults = Array.from({ length: external.total }, (_, i) => ({
            total: 1,
            correct: i < external.correct ? 1 : 0,
            verified: false,
            source: external.source,
          }));
        if (external.total) {
          s.external.accuracy = (100 * external.correct) / external.total;
          s.external.verification = "self-report";
        }
        const groups = new Map();
        for (const a of s.answers) {
          const q = state.questions.find((q) => q.id === a.questionId);
          if (!q) continue;
          const key = q.section + "|" + q.topic;
          if (!groups.has(key))
            groups.set(key, {
              section: q.section,
              topic: q.topic,
              answers: [],
            });
          groups.get(key).answers.push(a);
        }
        if (s.section === "DILR" && s.answers.length) {
          const sets = new Map();
          for (const a of s.answers) {
            const q = state.questions.find((q) => q.id === a.questionId);
            if (q?.set_id) {
              const set = sets.get(q.set_id) || [];
              set.push(a);
              sets.set(q.set_id, set);
            }
          }
          s.setResults = [
            ...(s.setResults || []),
            ...[...sets].map(([id, answers]) => ({
              id,
              total: state.questions.filter((q) => q.set_id === id).length,
              correct: answers.filter((a) => a.correct).length,
              verified:
                answers.every((a) => a.verification === "key" && !a.hintUsed) &&
                answers.length ===
                  state.questions.filter((q) => q.set_id === id).length,
            })),
          ];
        }
        s.topicResults = [...groups.values()].map((g) => ({
          section: g.section,
          topic: g.topic,
          total: g.answers.length,
          correct: g.answers.filter((a) => a.correct).length,
          seconds: g.answers.reduce((n, a) => n + a.seconds, 0),
        }));
        const next = task.secondRetest
          ? []
          : groups.size > 1
            ? [...groups.values()]
                .sort(
                  (a, b) =>
                    a.answers.filter((v) => v.correct).length /
                      a.answers.length -
                    b.answers.filter((v) => v.correct).length /
                      b.answers.length,
                )
                .slice(0, 2)
                .flatMap((g, i) =>
                  followups(
                    { ...s, id: s.id + "-" + i, answers: g.answers },
                    { ...task, section: g.section, topic: g.topic },
                    today(),
                  ),
                )
            : followups(s, task, today());
        for (const t of next)
          await writeJSON("data/tasks/" + t.id + ".json", t);
        if (
          task.stage === "delayed-retest" &&
          s.answers.length &&
          s.answers.filter((a) => a.correct).length / s.answers.length >= 0.8 &&
          !task.secondRetest
        ) {
          await writeJSON("data/tasks/week-" + s.id + ".json", {
            ...task,
            id: "week-" + s.id,
            title: "Weekly retention: " + (task.topic || task.section),
            due: daysAfter(today(), 5),
            secondRetest: true,
            questionIds: [],
            requiredFreshCount: task.section === "DILR" ? 2 : 5,
            parentTaskId: task.id,
          });
        }
        await appendEvent("completed", {
          taskId: task.id,
          sessionId: s.id,
          summary: input.report,
        });
      } else throw Error("Unknown session action.");
      s.version++;
      await writeJSON("data/sessions/" + s.id + ".json", s);
      if (action === "finish") await recordRevision("Completed " + task.title);
      result = { ...result, ...(await sessionView(s, derive(await load()))) };
    });
    if (action === "finish" && (await readJSON("data/profile.json")).autoSync)
      scheduleSync();
    return json(res, 200, result);
  }
  if (method === "POST" && route === "/api/task") {
    const t = await body(req);
    await transaction(async () => {
      if (
        !t.title?.trim() ||
        !["QA", "DILR", "VARC", "ALL"].includes(t.section) ||
        ![
          "questions",
          "repair",
          "video",
          "sectional",
          "mock",
          "review",
        ].includes(t.type) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(t.due || "")
      )
        throw Error("Task needs title, section, type and due date.");
      if (
        t.type === "video" &&
        (!/^https?:\/\//.test(t.videoUrl || "") ||
          !Array.isArray(t.questionIds) ||
          t.questionIds.length < 5 ||
          t.questionIds.length > 10)
      )
        throw Error(
          "Video tasks require a lesson URL and 5–10 assessment question IDs.",
        );
      const state = derive(await load());
      if (new Set(t.questionIds || []).size !== (t.questionIds?.length || 0))
        throw Error("Assessment question IDs must be unique.");
      if (
        t.type === "video" &&
        t.questionIds.some(
          (id) => !state.questions.find((q) => q.id === id)?.fresh,
        )
      )
        throw Error(
          "Video assessments require 5–10 fresh questions; original mock reattempts do not qualify.",
        );
      if (
        t.questionIds?.some((id) => !state.questions.some((q) => q.id === id))
      )
        throw Error("An assigned question ID does not exist.");
      const task = {
        ...t,
        id: crypto.randomUUID(),
        minutes: Number(t.minutes) || 30,
        xp: 35,
        stage: t.questionIds?.some(
          (id) => !state.questions.find((q) => q.id === id)?.fresh,
        )
          ? "cold-reattempt"
          : t.stage || "fresh-transfer",
        questionIds: t.questionIds || [],
        requiresFresh: !t.questionIds?.length,
        requiredFreshCount: Number(t.requiredFreshCount) || 0,
      };
      await writeJSON("data/tasks/" + task.id + ".json", task);
      await recordRevision("Assigned " + t.title);
    });
    if ((await readJSON("data/profile.json")).autoSync) scheduleSync();
    return json(res, 201, { ok: true });
  }
  if (method === "POST" && route === "/api/task/action") {
    const input = await body(req);
    await transaction(async () => {
      const state = derive(await load());
      const t = state.tasks.find((t) => t.id === input.taskId);
      if (!t) throw Error("Task not found.");
      if (
        !["reschedule", "retire", "video-watched", "assign-questions"].includes(
          input.action,
        )
      )
        throw Error("Unsupported task action.");
      if (input.action !== "video-watched" && !input.reason?.trim())
        throw Error("A reason is required.");
      if (
        input.action === "reschedule" &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(input.due || "") ||
          Number.isNaN(Date.parse(input.due)))
      )
        throw Error("Use a valid due date.");
      if (input.action === "assign-questions") {
        if (state.sessions.some((s) => s.taskId === t.id && !s.completedAt))
          throw Error(
            "Resume or complete the active session before changing its questions.",
          );
        if (
          !Array.isArray(input.questionIds) ||
          !input.questionIds.length ||
          new Set(input.questionIds).size !== input.questionIds.length
        )
          throw Error("Supply unique question IDs.");
        if (
          input.questionIds.some(
            (id) =>
              !state.questions.some(
                (q) =>
                  q.id === id &&
                  (t.section === "ALL" || q.section === t.section),
              ),
          )
        )
          throw Error("Question IDs must exist and match the section.");
        if (
          ["fresh-transfer", "delayed-retest"].includes(t.stage) &&
          input.questionIds.some(
            (id) => !state.questions.find((q) => q.id === id)?.fresh,
          )
        )
          throw Error(
            "Fresh transfer and retention assessment require unseen question-bank items.",
          );
        if (
          t.type === "video" &&
          (input.questionIds.length < 5 || input.questionIds.length > 10)
        )
          throw Error("Video assessment requires 5–10 questions.");
      }
      await appendEvent(input.action, {
        taskId: t.id,
        due: input.due,
        reason: input.reason,
        ...(input.questionIds ? { questionIds: input.questionIds } : {}),
      });
      await recordRevision("Task " + input.action);
    });
    if ((await readJSON("data/profile.json")).autoSync) scheduleSync();
    return json(res, 200, { ok: true });
  }
  if (method === "POST" && route === "/api/profile") {
    const input = await body(req);
    await transaction(async () => {
      const p = await readJSON("data/profile.json");
      for (const k of ["name", "baselineMockId", "autoSync"])
        if (input[k] !== undefined) p[k] = input[k];
      if (input.dailyMinutes !== undefined) {
        if (
          input.dailyMinutes !== null &&
          (!Number.isFinite(input.dailyMinutes) ||
            input.dailyMinutes < 30 ||
            input.dailyMinutes > 1440)
        )
          throw Error("Daily capacity must be 30–1440 minutes or null.");
        p.dailyMinutes = input.dailyMinutes;
      }
      if (input.examDate !== undefined) {
        if (
          input.examDate !== null &&
          !/^\d{4}-\d{2}-\d{2}$/.test(input.examDate)
        )
          throw Error("Use YYYY-MM-DD for exam date.");
        p.examDate = input.examDate;
      }
      await writeJSON("data/profile.json", p);
      await recordRevision("Updated planning preferences");
    });
    if ((await readJSON("data/profile.json")).autoSync) scheduleSync();
    return json(res, 200, { ok: true });
  }
  if (method === "POST" && route === "/api/import") {
    const pkg = await body(req);
    let count = 0;
    await transaction(async () => {
      if (pkg.kind === "questions") {
        if (!Array.isArray(pkg.questions))
          throw Error("Expected a questions array.");
        const checked = pkg.questions.map(validateContent);
        if (new Set(checked.map((q) => q.id)).size !== checked.length)
          throw Error("Duplicate imported question IDs.");
        const originalIds = new Set(
          (await load()).mocks.flatMap((m) => m.questions.map((q) => q.id)),
        );
        for (const q of checked) {
          if (originalIds.has(q.id)) q.fresh = false;
          await writeJSON(
            "data/question-bank/" +
              crypto.createHash("sha256").update(q.id).digest("hex") +
              ".json",
            q,
          );
          count++;
        }
      } else if (pkg.kind === "mock") {
        validateMockPackage(pkg);
        const dir = "data/mocks/" + pkg.results.mock_id;
        if (await readJSON(dir + "/results.json"))
          throw Error(
            "This original mock already exists. Use a new attempt ID and separate reattempt records.",
          );
        await writeJSON(dir + "/results.json", pkg.results);
        await writeJSON(dir + "/questions.json", pkg.questions);
        await fs.writeFile(path.join(ROOT, dir, "analysis.md"), pkg.analysis);
        await appendEvent("mock-imported", { mockId: pkg.results.mock_id });
        if (pkg.results.attempt.attempt_date) {
          const p = await readJSON("data/profile.json");
          p.baselineMockId = pkg.results.mock_id;
          await writeJSON("data/profile.json", p);
        }
        count = pkg.questions.questions.length;
      } else throw Error("Import kind must be questions or mock.");
      await recordRevision("Imported " + count + " question records");
    });
    if ((await readJSON("data/profile.json")).autoSync) scheduleSync();
    return json(res, 201, { ok: true, count });
  }
  return json(res, 404, { error: "Endpoint not found." });
}
export function createServer() {
  return http.createServer(async (req, res) => {
    try {
      const host = req.headers.host || "";
      if (!/^(127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/.test(host))
        return json(res, 403, { error: "Use localhost to access CAT HQ." });
      const url = new URL(req.url, "http://" + host);
      if (req.headers.origin && req.headers.origin !== url.origin)
        return json(res, 403, { error: "Cross-origin access is not allowed." });
      if (url.pathname.startsWith("/api/")) {
        if (req.method !== "GET" && req.headers["x-hq-request"] !== "1")
          return json(res, 403, { error: "Missing local request header." });
        return await API(req, res, url);
      }
      const rel = decodeURIComponent(url.pathname).replace(/^\//, "");
      const dest = path.resolve(ROOT, "dist", rel || "index.html");
      if (
        !dest.startsWith(path.join(ROOT, "dist") + path.sep) &&
        dest !== path.join(ROOT, "dist")
      )
        return json(res, 403, { error: "Invalid path." });
      let file = dest;
      try {
        if ((await fs.stat(file)).isDirectory())
          file = path.join(file, "index.html");
        await fs.access(file);
      } catch {
        file = path.join(ROOT, "dist/index.html");
      }
      const types = {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".svg": "image/svg+xml",
        ".png": "image/png",
      };
      res.writeHead(200, {
        "Content-Type": types[path.extname(file)] || "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": file.endsWith("index.html")
          ? "no-cache"
          : "public, max-age=3600",
        "Content-Security-Policy":
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; frame-ancestors 'self'",
      });
      res.end(await fs.readFile(file));
    } catch (e) {
      json(res, e.status || 400, { error: e.message });
    }
  });
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const port = Number(process.env.PORT || 3000);
  const server = createServer();
  server.on("error", (e) => {
    console.error(
      e.code === "EADDRINUSE"
        ? "CAT HQ is already running on this port. Open http://127.0.0.1:" +
            port
        : e.message,
    );
    process.exit(1);
  });
  server.listen(port, "127.0.0.1", async () => {
    console.log("CAT HQ: http://127.0.0.1:" + port);
    try {
      await transaction(async () => {
        const raw = await load();
        if (!raw.revisions.length)
          await recordRevision(
            "Initial plan from recovered records and uploaded schedule",
          );
      });
    } catch (e) {
      console.error(e.message);
    }
    if ((await readJSON("data/profile.json")).autoSync) scheduleSync();
  });
  const check = setInterval(async () => {
    try {
      const { checkDay } = await import("./lib/reminders.mjs");
      const result = await checkDay();
      if (result.planUpdated && (await readJSON("data/profile.json")).autoSync)
        scheduleSync();
    } catch (e) {
      console.error(e.message);
    }
  }, 60000);
  check.unref();
}
