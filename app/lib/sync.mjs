import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import { ROOT, writeJSON, readJSON, transaction } from "./storage.mjs";
const exec = promisify(execFile);
const git = async (...args) =>
  (
    await exec("git", args, {
      cwd: ROOT,
      timeout: 25000,
      maxBuffer: 2e6,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    })
  ).stdout.trimEnd();
const allowed = [
  "data/profile.json",
  "data/sessions",
  "data/events",
  "data/tasks",
  "data/plan-revisions",
  "data/question-bank",
  "data/mocks",
  "data/README.md",
  "data/validation-report.json",
  "data/recovery-manifest.json",
  "data/planning",
  "data/database-validation-report.json",
  "data/database-source-manifest.json",
  "data/uploaded-databases-manifest.json",
  "data/DATABASES.md",
];
const safe = (s) =>
  String(s)
    .replace(/https:\/\/[^\s@]+@/g, "https://[redacted]@")
    .slice(-1000);
export async function syncRecords() {
  return transaction(async () => {
    let result = { state: "pending", at: new Date().toISOString() };
    try {
      const staged = await git("diff", "--cached", "--name-only");
      if (staged)
        throw Error(
          "The Git index contains staged changes. Finish that commit before automatic sync.",
        );
      const dirty = await git("status", "--porcelain");
      const lines = dirty ? dirty.split("\n") : [];
      const unrelated = lines.filter(
        (l) =>
          !allowed.some(
            (p) => l.slice(3) === p || l.slice(3).startsWith(p + "/"),
          ),
      );
      if (unrelated.length)
        throw Error(
          "Uncommitted application or unrelated files are present. Automatic sync only commits preparation records.",
        );
      const branch = await git("branch", "--show-current");
      if (!branch)
        throw Error("Detached checkout: select a branch before syncing.");
      await git("fetch", "origin", branch);
      const counts = (
        await git("rev-list", "--left-right", "--count", "HEAD...FETCH_HEAD")
      )
        .split(/\s+/)
        .map(Number);
      if (counts[0] && counts[1])
        throw Error(
          "Local and remote branches have diverged. Both versions are preserved; reconcile them manually.",
        );
      if (counts[1]) {
        if (dirty)
          throw Error(
            "Remote updates and local preparation edits both exist. Commit and reconcile them before syncing.",
          );
        await git("merge", "--ff-only", "FETCH_HEAD");
      }
      if (dirty) {
        const paths = [];
        for (const p of allowed) {
          try {
            await fs.access(path.join(ROOT, p));
            paths.push(p);
          } catch {}
        }
        await git("add", "--", ...paths);
        if (await git("diff", "--cached", "--name-only"))
          await git(
            "commit",
            "-m",
            "Update CAT practice records and adaptive plan",
          );
      }
      await git("push", "origin", `HEAD:refs/heads/${branch}`);
      const sha = await git("rev-parse", "HEAD");
      const remote = (
        await git("ls-remote", "origin", `refs/heads/${branch}`)
      ).split(/\s+/)[0];
      if (sha !== remote)
        throw Error("Remote verification did not match the local commit.");
      result = {
        state: "synced",
        at: new Date().toISOString(),
        sha,
        branch,
        message: "Preparation records match the remote branch.",
      };
    } catch (e) {
      result = {
        ...result,
        state: "attention",
        message: safe(e.stderr || e.message),
      };
    }
    await writeJSON(".runtime/sync.json", result);
    return result;
  });
}
export const syncStatus = () =>
  readJSON(".runtime/sync.json", {
    state: "pending",
    message: "Not checked on this machine yet.",
  });
let pending;
export function scheduleSync() {
  clearTimeout(pending);
  pending = setTimeout(() => syncRecords().catch(() => {}), 1200);
  pending.unref();
}
