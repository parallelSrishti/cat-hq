# Analysis contract, version 1.0

## SQLite enrichment extension (17 October 2026)

The historical recovery layout and JSON below remain unchanged. New browser question captures are preserved separately under `data/mocks/<mock-id>/sources/full-review/<SECTION>-qNN.json`. Each mock additionally has `<mock-id>.db`, a standalone SQLite export built by `scripts/build_mock_databases.py`; it overlays verified captures on the historical 68 rows without duplicating original attempts. These exports are currently partial. See [data/DATABASES.md](../data/DATABASES.md) for schema, actual coverage and the browser transport blocker.

Retain full question HTML alongside text to preserve math/content, complete ordered options, independently observed selection/key indicators, shared stimuli, solutions and source bytes. Do not infer MCQ/TITA format from difficulty or marks. `question_type` is response format; `provider_difficulty_type` remains IMS A/B/C. Keep provider `sectional_area` and `sectional_topic` separate; unavailable additional `subtopic` stays null. Additional classifications require explicit analyst provenance.

Run the historical validator and `python3 scripts/validate_mock_databases.py`. The latter checks database integrity, foreign keys, IDs/counts, original score/time/outcome agreement, each newly captured question/option/answer/passage and embedded source hashes. Update the coverage index and `data/database-validation-report.json`. Do not overwrite the old recovery manifest or claim that full-content gaps are closed until fresh evidence supports that.

Established during the recovery import on 17 October 2026 (Asia/Kolkata). The repository was empty: this is a new import contract, not a recovered pre-existing one.

## Layout

```text
data/
  README.md
  recovery-manifest.json
  validation-report.json
  legacy/
    CAT-Mock-Analysis/       # opened original Markdown, byte-for-byte
    supporting/             # opened original saved IMS extraction JSON
  mocks/
    <mock-id>/
      analysis.md
      results.json
      questions.json
      sources/
      reattempts/
        <reattempt-id>/      # create only when an actual reattempt is available
          analysis.md
          results.json
          questions.json
          sources/
```

The current import has original attempts only and no reattempt directories. New mock IDs are lowercase hyphenated identifiers. Never use a review date as an attempt date.

## Results

`results.json` contains `schema_version`, `mock_id`, name, provider, `attempt`, `overall`, `sections`, provider estimates, source URLs and missing-field notes. `sections` is keyed by VARC, DILR and QA. Preserve the provider's score and mock percentile; record predicted CAT percentile separately.

`attempt.id` is stable, `attempt.kind` distinguishes original from reattempt, and `attempt_date`, timestamps and timezone are null when unavailable. Each unavailable attempt field has an entry in `attempt.null_explanations`. A recovered review date is provenance, not chronology. Subsequent reattempts reference the original attempt ID without overwriting it.

Statistics include total/attempted/correct/incorrect/skipped and accuracy percent where available. Provider Area-Wise metrics are retained separately from per-question sums. `attributed_question_time_seconds` is the sum of recorded row times, not asserted wall-clock elapsed time. The source Area-Wise time field uses HH:MM; the source question/benchmark fields use MM:SS. Do not normalize small timing differences away.

## Questions and sets

`questions.json` is an object with `schema_version`, `mock_id`, `attempt_id`, `question_count`, `field_notes`, `questions` and `sets`.

Each question has:

- A globally unique local `id`: `<mock-id>:<attempt-kind-or-id>:<section>:qNN`.
- `question_number`, section, original provider area/topic and retrospective IMS A/B/C difficulty label.
- `provider_question_id` only when actually recovered; otherwise null.
- `set_id` referencing a local set when a block grouping is supported by the source. Existing DILR block IDs are analyst groupings, not provider set IDs. No RC passage/QA grouping IDs have been recovered.
- Exact `question_text` and complete `options` only when recovered. They are null throughout this legacy import. A `recovered_stem_excerpt` is a literal UI snippet and must not be promoted to full content.
- `original_response`, `correct_answer`, `outcome`, `attempted`, marks and integer `time_seconds`.
- Provider benchmark time in seconds, attempt/accuracy percentages and the provider's percentage-style p-value. This p-value is not a statistical significance p-value.
- Source paths and a Markdown line reference where available.

Outcomes are `correct`, `wrong` or `skipped`. Attempted means correct or wrong. A wrong zero-mark response stays zero; do not infer a penalty or original option from its outcome. A response/answer object may contain only an option label if that is all the evidence supports; missing option text/value remain null with the evidence note. The one legacy label pair (SimCAT 2 QA Q3, B/A) comes from the opened analyst narrative reporting a visual observation; no screenshot independently corroborating it was recovered.

Shared `field_notes` apply to every null of that field, so each of 204 rows need not repeat the same explanation. An exception needs its own source/evidence note. Zero time means zero platform-recorded time, not proof of no inspection.

## Sources and historical integrity

Retain the byte-identical legacy Markdown and saved extraction JSON. Their hashes and sizes are in `data/recovery-manifest.json`. A per-mock `sources/source-extracts.json` is a lossless partition of the original saved capture; readable text views and question-row JSON are derived views. They are not screenshots, original provider downloads, a fresh portal read or independent extra attempts.

Existing AI prose contains contradictions; preserve it as evidence and validate arithmetic against the question tables and score reports. Do not rewrite legacy analyses to disguise such discrepancies. New analysis must distinguish facts, derived metrics, hypotheses and recommendations. Recommendations to reattempt are not completed reattempt records.

No exact attempt date, full stem/option set, navigation sequence or handwritten working has been recovered in the current import. State those gaps visibly. No attached report PDFs/screenshots were found in the source folder; a separate CAT 2025 scorecard is outside this three-mock import.

## Validation and updates

Run `python3 scripts/validate_records.py` before committing. It checks all JSON files; immutable-source hashes; unique question and set IDs; section numbering; counts/outcomes/marks/times; source row agreement; totals against opened Markdown, AI headline results and retained Scorecard/Area-Wise reports; and the explicit answer-evidence exception. It writes `data/validation-report.json`. Check and document differences; do not fill gaps to make a test pass.

The legacy importer is reproducible with `python3 scripts/import_legacy_records.py --from-recovered-legacy`. It regenerates this recovery dataset from preserved evidence only. Do not use it to overwrite later analyses or import future attempts. Future analyses follow this contract directly and extend validation as needed.

Fetch/pull before editing. Commit and push preparation data after each analysis using existing authentication and ordinary fast-forward behavior. If the remote moves, integrate its changes and revalidate; do not force-push. Verify the pushed SHA. No dashboard deployment is part of this workflow.

## Application extension 1.1 — authorized 17 October 2026

The local HQ is now authorized; references above saying application work was outside the earlier recovery task describe that earlier scope. The original schema 1.0 recovery files remain unchanged.

### Shared records

- `data/profile.json`: targets, selected baseline, optional workload capacity, timezone and auto-sync preference. `examDate` stays null until verified.
- `data/planning/reference-tasks.json`: tasks derived from the preserved uploaded plan. Original due dates and the source hash remain recorded.
- `data/tasks/<id>.json`: assigned/adaptive tasks. Required fields: id, title, section (`QA`, `DILR`, `VARC`, `ALL`), type (`questions`, `repair`, `review`, `video`, `sectional`, `mock`), due date, minutes, xp, stage and questionIds. An external task has requiresFresh/requiredFreshCount and is completed using source-referenced outcomes. Video tasks require a specific videoUrl and 5–10 unique fresh content-bank question IDs.
- `data/question-bank/<hash-or-id>.json`: content overlays or new unseen questions. Use the exact original composite ID to add full text to a recovered question. Original questions remain familiar regardless of an overlay's fresh flag. New questions need stable, non-path IDs, section, topic, question_text, optional passage, options (string array), answer (string/number), explanation, fresh and source_url. MCQ keys use A/B/C/D; numeric keys use the number. Do not expose a reconstructed answer as a recovered key.
- `data/sessions/<uuid>.json`: versioned learner sessions with original task reference, active timing, question focus, responses, grading provenance (`key`, `self-report`, `ungraded`), external outcomes, learner report and completion state. Do not hand-edit active sessions while the app is running. Self-reports are not independently verified mastery.
- `data/events/<uuid>.json`: immutable completion, reschedule, retirement, video-step and import events.
- `data/plan-revisions/<uuid>.json`: immutable snapshots with reasons, priorities, topic states and recommended IDs.

### HTTP import

The localhost server accepts JSON with the `X-HQ-Request: 1` header. Cross-origin writes are rejected. Use the Records UI or:

- `POST /api/import` with `{ "kind": "questions", "questions": [ ...content objects... ] }`.
- `POST /api/import` with `{ "kind": "mock", "results": {...schema 1.0 results...}, "questions": {...schema 1.0 question collection...}, "analysis": "Markdown analysis" }`.

A new mock ID is required; existing originals cannot be overwritten through import. The collection's question_count, question IDs, section marks, total score, dates and percentiles are validated. Preserve full source reports in the mock sources directory using the repository workflow. Reattempts remain in their separate original contract directory, not another copy of the original.

For direct repository updates, preserve the same field semantics and run both validators. On a clean local startup/sync, new tracked records are read automatically without rebuilding the application. Add a dated new mock with provider CAT prediction when available; exact dates are required for recency weighting. Practice never changes original mock percentiles.

### Auto-sync boundaries

Only preparation paths are staged automatically. Application changes, unrelated staged files, diverged history and remote updates alongside uncommitted local edits stop sync. Resolve with ordinary Git; never force-push. The app verifies the remote branch SHA before displaying Synced. `.runtime/`, credentials, dependencies and build output are not shared.

### Evolving uploaded SQLite snapshots

The user supplied updated databases after the first extraction. `question_details` now exposes `display_html`, `solution_display_html`, ordered option JSON and embedded media; `source_captures` stores gzip content with original byte lengths/hashes. The app reads these files directly, never rewrites them at runtime, and overlays content on the same original IDs. It uses `correct_response_option_label` or the numeric `correct_response` for grading. Images/math are rendered from sanitized display HTML. Keys and explanations are withheld from practice until an answer is saved.

Keep updated snapshots at `data/mocks/<mock-id>/<mock-id>.db`, use an atomic replacement or stop the app while copying, validate with `scripts/validate_mock_databases.py`, then commit/push. Do not run the guarded legacy builder to replace newer tables. The 204 available views are not a declaration that extraction is complete; the user will confirm completion. Node SQLite is bundled with the documented runtime.
