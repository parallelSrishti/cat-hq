import { spawn } from "node:child_process";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
const build = spawn(
  process.execPath,
  [path.join(root, "node_modules/vite/bin/vite.js"), "build"],
  { cwd: root, stdio: "inherit" },
);
build.on("exit", (code) => {
  if (code !== 0) process.exit(code || 1);
  const server = spawn(process.execPath, [path.join(root, "app/server.mjs")], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => server.kill(signal));
  server.on("exit", (code) => process.exit(code || 0));
});
