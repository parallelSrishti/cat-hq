import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const exec = promisify(execFile),
  root = path.resolve(import.meta.dirname, ".."),
  node = process.execPath;
// Commands use argument arrays; local configuration contains no credentials.
if (process.platform === "linux") {
  const dir = path.join(os.homedir(), ".config/systemd/user");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, "cat-hq-reminder.service"),
    `[Unit]\nDescription=CAT HQ daily preparation review\n[Service]\nType=oneshot\nWorkingDirectory=${root}\nExecStart="${node}" "${path.join(root, "scripts/check-day.mjs")}"\n`,
  );
  await fs.writeFile(
    path.join(dir, "cat-hq-reminder.timer"),
    "[Unit]\nDescription=CAT HQ hourly reminder check\n[Timer]\nOnCalendar=hourly\nPersistent=true\n[Install]\nWantedBy=timers.target\n",
  );
  try {
    await exec("systemctl", ["--user", "daemon-reload"]);
    await exec("systemctl", [
      "--user",
      "enable",
      "--now",
      "cat-hq-reminder.timer",
    ]);
    console.log(
      (
        await exec("systemctl", [
          "--user",
          "is-active",
          "cat-hq-reminder.timer",
        ])
      ).stdout.trim(),
    );
  } catch {
    console.error(
      "Service files were written, but this machine has no active user systemd session. Reminders remain available while the app runs. On a desktop run: systemctl --user enable --now cat-hq-reminder.timer",
    );
    process.exitCode = 1;
  }
} else if (process.platform === "darwin") {
  const xmlEscape = (s) =>
    s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const dir = path.join(os.homedir(), "Library/LaunchAgents");
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, "local.cat-hq.reminder.plist");
  await fs.writeFile(
    file,
    `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>Label</key><string>local.cat-hq.reminder</string><key>ProgramArguments</key><array><string>${xmlEscape(node)}</string><string>${xmlEscape(path.join(root, "scripts/check-day.mjs"))}</string></array><key>WorkingDirectory</key><string>${xmlEscape(root)}</string><key>StartInterval</key><integer>3600</integer><key>RunAtLoad</key><true/></dict></plist>`,
  );
  await exec("launchctl", ["load", file]);
  console.log("Hourly reminder checks enabled.");
} else if (process.platform === "win32") {
  await exec("schtasks", [
    "/Create",
    "/TN",
    "CAT HQ Reminder",
    "/TR",
    `"${node}" "${path.join(root, "scripts/check-day.mjs")}"`,
    "/SC",
    "HOURLY",
    "/F",
  ]);
  console.log("Hourly reminder checks enabled.");
} else {
  console.error("Use your OS scheduler to run npm run check-day hourly.");
  process.exitCode = 1;
}
