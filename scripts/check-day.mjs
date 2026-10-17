import { checkDay } from "../app/lib/reminders.mjs";
import { readJSON } from "../app/lib/storage.mjs";
import { syncRecords } from "../app/lib/sync.mjs";
console.log(
  JSON.stringify(
    await checkDay({ force: process.argv.includes("--now") }),
    null,
    2,
  ),
);
if ((await readJSON("data/profile.json")).autoSync)
  console.log(JSON.stringify(await syncRecords(), null, 2));
