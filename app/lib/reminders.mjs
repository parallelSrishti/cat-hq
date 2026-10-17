import { execFile } from "node:child_process";
import { promisify } from "node:util";
import crypto from "node:crypto";
import { load, readJSON, writeJSON, transaction } from "./storage.mjs";
import { derive, snapshot } from "./engine.mjs";
const exec = promisify(execFile);
export async function checkDay({
  force = false,
  desktop = true,
  now = new Date(),
} = {}) {
  let output;
  await transaction(async () => {
    const state = derive(await load(), now);
    const last = await readJSON(".runtime/day-check.json", {});
    const hour = Number(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Calcutta",
        hour: "2-digit",
        hourCycle: "h23",
      }).format(now),
    );
    const overdue = state.tasks.filter((t) => t.status === "missed");
    const signature = crypto
      .createHash("sha256")
      .update(state.today + overdue.map((t) => t.id).join("|"))
      .digest("hex");
    if (last.date !== state.today) {
      const r = snapshot(state, "Daily rollover: " + state.today);
      await writeJSON("data/plan-revisions/" + r.id + ".json", r);
    }
    const message = `${overdue.length} overdue missions. ${state.risk.marks} marks exposed in the unresolved-topic scenario${state.risk.penalty ? `; ${state.risk.penalty} percentile-point accountability penalty` : ""}. This is an assumption, not measured decline.`;
    const notify =
      overdue.length > 0 &&
      (force || hour >= state.profile.reminderHour) &&
      last.signature !== signature;
    if (notify && desktop) {
      try {
        if (process.platform === "linux")
          await exec("notify-send", ["CAT HQ · your repair loop", message], {
            timeout: 5000,
          });
        else if (process.platform === "darwin")
          await exec(
            "osascript",
            [
              "-e",
              "display notification " +
                JSON.stringify(message) +
                ' with title "CAT HQ"',
            ],
            { timeout: 5000 },
          );
        else if (process.platform === "win32")
          await exec(
            "powershell",
            [
              "-NoProfile",
              "-Command",
              "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('" +
                message.replace(/'/g, "''") +
                "','CAT HQ')",
            ],
            { timeout: 5000 },
          );
      } catch {
        /* The dashboard still carries the warning when desktop services are absent. */
      }
    }
    output = {
      date: state.today,
      overdue: overdue.length,
      message,
      notificationAttempted: notify && desktop,
      planUpdated: last.date !== state.today,
    };
    await writeJSON(".runtime/day-check.json", {
      date: state.today,
      signature: notify ? signature : last.signature,
      lastCheckedAt: now.toISOString(),
      message,
    });
  });
  return output;
}
