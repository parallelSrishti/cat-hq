import { DatabaseSync } from "node:sqlite";
import fs from "node:fs/promises";
import path from "node:path";
const cache = new Map();
export async function databaseContent(directory) {
  const names = (await fs.readdir(directory)).filter((name) =>
    name.endsWith(".db"),
  );
  const content = [];
  for (const name of names) {
    const file = path.join(directory, name);
    const stat = await fs.stat(file);
    const signature = stat.mtimeMs + ":" + stat.size;
    if (cache.get(file)?.signature === signature) {
      content.push(...cache.get(file).content);
      continue;
    }
    const db = new DatabaseSync(file, { readOnly: true });
    let rows;
    try {
      db.exec("PRAGMA query_only=ON");
      rows = db
        .prepare(
          "SELECT * FROM question_details ORDER BY section,question_number",
        )
        .all();
    } finally {
      db.close();
    }
    const data = rows
      .filter((r) => r.question_text || r.display_html || r.question_html)
      .map((r) => {
        const opts = JSON.parse(r.options_json || "[]");
        const answer =
          r.correct_response_option_label ?? r.correct_response ?? null;
        return {
          id: r.question_id,
          section: r.section,
          topic: r.sectional_topic,
          question_number: r.question_number,
          question_text: r.question_text,
          question_html: r.display_html || r.question_html,
          passage: r.stimulus_text,
          passage_html: r.stimulus_html,
          options: opts.map((o) => o.text || "Image / formatted option"),
          options_html: opts.map((o) => o.html || null),
          optionLabels: opts.map((o) => o.label),
          answer,
          explanation: r.solution_text,
          explanation_html: r.solution_display_html || r.solution_html,
          original_response:
            r.original_response_option_label || r.original_response
              ? {
                  option_label: r.original_response_option_label,
                  value: r.original_response_text ?? r.original_response,
                  evidence: "User-supplied SQLite question table",
                }
              : null,
          fresh: false,
          question_type: r.question_type,
          question_content_status: "database_content_available",
          contentNote:
            "User-supplied evolving question database; completeness is not inferred from row count.",
          databaseFile: name,
        };
      });
    cache.set(file, { signature, content: data });
    content.push(...data);
  }
  return content;
}
