import fs from "node:fs";
import crypto from "node:crypto";
const source = "docs/reference/remaining-plan-2026-10-16.md";
const md = fs.readFileSync(source, "utf8");
const tasks = [
  ...md.matchAll(
    /^### (\d{4}-\d{2}-\d{2}) — (.+)\n([\s\S]*?)(?=^### |$(?![\s\S]))/gm,
  ),
].map((m, index) => {
  const [, due, title, body] = m;
  const section = /VARC|Summary/.test(title)
    ? "VARC"
    : /QA|Arithmetic|Algebra|SI\/CI/.test(title)
      ? "QA"
      : /DILR/.test(title)
        ? "DILR"
        : "ALL";
  const type = /Full IMS mock/.test(title)
    ? "mock"
    : /checkpoint/.test(title)
      ? "sectional"
      : /review|Cold-review/.test(title)
        ? "review"
        : /Final |Light activation|Review the final/.test(title)
          ? "retrieval"
          : "questions";
  const xp = Number(body.match(/(\d+) XP/)?.[1] || 35);
  let questionIds = [];
  const map = {
    "2026-10-16:QA": [11, 15, 17, 9],
    "2026-10-16:DILR": [1, 2, 3, 4, 5],
    "2026-10-17:DILR": [19, 20, 21, 22],
    "2026-10-17:QA": [3, 2],
    "2026-10-18:DILR": [6, 7, 8, 9],
    "2026-10-18:VARC": [13, 17],
  };
  const nums = map[due + ":" + section] || [];
  if (nums.length)
    questionIds = nums.map(
      (n) =>
        `simcat-2-2026:original:${section.toLowerCase()}:q${String(n).padStart(2, "0")}`,
    );
  const steps = [...body.matchAll(/^\d+\. (.+)$/gm)]
    .map((x) => x[1])
    .filter((x) => !x.includes("maintains all logs"));
  return {
    id:
      "mission-" +
      crypto
        .createHash("sha256")
        .update(due + title)
        .digest("hex")
        .slice(0, 12),
    section,
    type,
    title,
    due,
    originalDue: due,
    xp,
    minutes:
      type === "mock"
        ? 120
        : type === "sectional"
          ? 40
          : section === "DILR"
            ? 50
            : 40,
    questionIds,
    reason:
      body.match(/^Why: (.+)$/m)?.[1] ||
      "Preserve recall and independent transfer.",
    steps,
    completion:
      body.match(/^Done: (.+)$/m)?.[1] ||
      "Outcomes and specific obstacles recorded.",
    source,
    index,
    stage: questionIds.length ? "cold-reattempt" : "fresh-transfer",
    topic: questionIds.length
      ? null
      : /SI\/CI/.test(title)
        ? "Simple & Compound Interest"
        : /Algebra/.test(title)
          ? "Algebra"
          : section === "DILR"
            ? "Groupings & Arrangements"
            : null,
    requiresFresh: /fresh|transfer/.test(body),
    requiredFreshCount:
      section === "DILR"
        ? /two fresh|two new|2 DILR/.test(body)
          ? 2
          : 1
        : Number(
            body.match(/(?:six|6) fresh/)
              ? 6
              : body.match(/15 (?:fresh )?(?:questions|outcomes)/)
                ? 15
                : body.match(/10 (?:fresh )?(?:questions|outcomes)/)
                  ? 10
                  : body.match(/four fresh/)
                    ? 4
                    : 0,
          ),
    prerequisiteGate: type === "mock" || type === "sectional",
    status: "pending",
  };
});
fs.writeFileSync(
  "data/planning/reference-tasks.json",
  JSON.stringify(
    {
      schema_version: "1.1",
      source,
      sourceSha256: crypto.createHash("sha256").update(md).digest("hex"),
      tasks,
    },
    null,
    2,
  ) + "\n",
);
console.log("Imported", tasks.length, "reference missions");
