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
