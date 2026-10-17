import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
const temp = await fs.mkdtemp(path.join(os.tmpdir(), "cat-sync-"));
const root = path.join(temp, "work"),
  remote = path.join(temp, "remote.git");
const git = (cwd, ...args) =>
  execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
git(temp, "init", "--bare", remote);
git(temp, "clone", remote, root);
git(root, "config", "user.name", "CAT HQ test");
git(root, "config", "user.email", "test@example.invalid");
await fs.mkdir(path.join(root, "data"), { recursive: true });
await fs.writeFile(
  path.join(root, "data/profile.json"),
  '{"name":"original"}\n',
);
await fs.writeFile(path.join(root, ".gitignore"), ".runtime/\n");
git(root, "add", ".");
git(root, "commit", "-m", "Initial");
const branch = git(root, "branch", "--show-current");
git(root, "push", "-u", "origin", branch);
process.env.CAT_HQ_ROOT = root;
const { syncRecords } = await import("../app/lib/sync.mjs");
test.after(async () => fs.rm(temp, { recursive: true, force: true }));
test("sync commits tracked data edits and verifies remote; preserves unrelated changes", async () => {
  await fs.writeFile(
    path.join(root, "data/profile.json"),
    '{"name":"updated"}\n',
  );
  const r = await syncRecords();
  assert.equal(r.state, "synced", r.message);
  assert.equal(
    git(root, "rev-parse", "HEAD"),
    git(remote, "rev-parse", branch),
  );
  await fs.writeFile(
    path.join(root, "application.txt"),
    "unfinished app change",
  );
  const blocked = await syncRecords();
  assert.equal(blocked.state, "attention");
  assert.match(blocked.message, /unrelated/);
  assert.equal(
    await fs.readFile(path.join(root, "application.txt"), "utf8"),
    "unfinished app change",
  );
});
test("remote concurrent edit is preserved and blocks unsafe automatic integration", async () => {
  await fs.rm(path.join(root, "application.txt"));
  const other = path.join(temp, "other");
  git(temp, "clone", remote, other);
  git(other, "config", "user.name", "Other");
  git(other, "config", "user.email", "other@example.invalid");
  await fs.writeFile(
    path.join(other, "data/profile.json"),
    '{"name":"remote"}\n',
  );
  git(other, "commit", "-am", "Remote edit");
  git(other, "push");
  await fs.writeFile(
    path.join(root, "data/profile.json"),
    '{"name":"local"}\n',
  );
  const r = await syncRecords();
  assert.equal(r.state, "attention");
  assert.match(r.message, /Remote updates and local/);
  assert.match(
    await fs.readFile(path.join(root, "data/profile.json"), "utf8"),
    /local/,
  );
});
