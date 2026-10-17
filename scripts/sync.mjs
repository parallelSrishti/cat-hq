import { syncRecords } from "../app/lib/sync.mjs";
const result = await syncRecords();
console.log(JSON.stringify(result, null, 2));
if (result.state !== "synced") process.exitCode = 1;
