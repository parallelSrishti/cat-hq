# Recovered CAT mock records

**Current question content:** The user supplied newer evolving SQLite snapshots after the first five-question export. The local HQ currently reads question views, keys and solutions for all 204 original IDs. Some questions are image-based; extraction remains marked in progress. This supplements, and does not rewrite, the historical metadata recovery below. See [current database coverage](DATABASES.md).

**Latest addition:** [Three SQLite databases and coverage details](DATABASES.md), one per mock, with 68 records each. All 204 include section, IMS area/topic and A/B/C type. Fresh analytics previews supplied full text/options, answers and solutions for PreSimCAT 1 VARC Q1–Q5, plus two shared passages. The other 199 full texts/options remain missing after BrowserOS became unreachable. MCQ/TITA format is confirmed only for those five. [Database validation](database-validation-report.json) is separate from the historical recovery validation below; historical JSON/legacy sources remain unchanged.

Recovered on **17 October 2026, Asia/Kolkata**, by opening the existing local files. No mock records were reconstructed from memory, and the IMS portal was not revisited for this import.

## Recovery inventory

Eight Markdown files were found and opened in the existing `CAT-Mock-Analysis` folder. The earlier report of seven referred to the initial seven; `06-Weighted-Priority-Framework.md` was added afterward. All eight are preserved byte-for-byte under `data/legacy/CAT-Mock-Analysis/`.

| Opened original | Preserved location / contents |
| --- | --- |
| `README.md` | [Legacy index](legacy/CAT-Mock-Analysis/README.md) |
| `00-Diagnosis-and-Next-Actions.md` | [Cross-mock diagnosis](legacy/CAT-Mock-Analysis/00-Diagnosis-and-Next-Actions.md) |
| `01-PreSimCAT-1.md` | [PreSimCAT 1 analysis and 68 question rows](legacy/CAT-Mock-Analysis/01-PreSimCAT-1.md) |
| `02-PreSimCAT-2.md` | [PreSimCAT 2 analysis and 68 question rows](legacy/CAT-Mock-Analysis/02-PreSimCAT-2.md) |
| `03-SimCAT-2.md` | [SimCAT 2 analysis and 68 question rows](legacy/CAT-Mock-Analysis/03-SimCAT-2.md) |
| `04-Working-Log.md` | [Issue register and diagnostic reattempt queue](legacy/CAT-Mock-Analysis/04-Working-Log.md) |
| `05-Question-First-Strategy.md` | [Question-first strategy](legacy/CAT-Mock-Analysis/05-Question-First-Strategy.md) |
| `06-Weighted-Priority-Framework.md` | [Topic-frequency reference and practice weighting](legacy/CAT-Mock-Analysis/06-Weighted-Priority-Framework.md) |

An additional saved IMS extraction JSON was opened and retained byte-for-byte at [legacy/supporting/cat-mock-source.json](legacy/supporting/cat-mock-source.json). It contains question-wise UI rows, AI narrative/evidence captures for all three tests and detailed-analytics captures for the latter two. It predates this recovery; it is not a new provider export. [The recovery manifest](recovery-manifest.json) records source hashes, sizes, counts and deliberately omitted transport/generation metadata.

The newly cloned GitHub repository was empty. There was no existing AGENTS.md, README or `docs/ANALYSIS-CONTRACT.md`; the root instructions and contract were established for this data import. No dashboard or deployment was built.

## Original-attempt counts and totals

| Mock | VARC | DILR | QA | Total question records | Marks VARC / DILR / QA | Overall marks | Provider mock percentile |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [PreSimCAT 1 2026](mocks/presimcat-1-2026/) | 24 | 22 | 22 | **68** | 57 / 35 / 27 | **119** | 95.74 |
| [PreSimCAT 2 2026](mocks/presimcat-2-2026/) | 24 | 22 | 22 | **68** | 41 / 27 / 30 | **98** | 90.71 |
| [SimCAT 2 2026](mocks/simcat-2-2026/) | 24 | 22 | 22 | **68** | 42 / 15 / 14 | **71** | 78.94 |
| Total | 72 | 66 | 66 | **204** | | | |

**The reported 204 records are confirmed, with no difference.** They are 204 question-performance rows, not 204 full question texts. There are 15 local DILR block/set references (five per mock), not another 15 questions. Repeated AI snapshots are evidence views of the same attempts, not extra records. No later reattempt records were recovered; a recommended reattempt queue is not evidence of completion.

Each mock directory has `analysis.md`, `results.json`, `questions.json` and `sources/`. `analysis.md` carries the previously written detailed findings and recommended actions with a recovery-provenance preface. The immutable original remains in the legacy folder. Recommendations are historical; this import does not claim new learning progress.

## Sources and units

- Primary normalization: the full question tables in the opened Markdown reports, cross-checked row-by-row against the saved IMS topic evidence and question-wise UI rows.
- Scores/percentiles: Markdown summaries and saved AI report headline results for all three; saved detailed Scorecard/Area-Wise text additionally supports PreSimCAT 2 and SimCAT 2. The original PreSimCAT 1 standalone Scorecard/Area-Wise text was not retained; its Markdown and AI evidence are available.
- Each `sources/` includes its lossless `source-extracts.json`, the 68 original UI rows, three AI section narratives, nine evidence-table text views and, where retained, the detailed-analytics views. These are derived readable copies of saved captures, not independent reports.
- `time_seconds` and benchmark times are integer seconds converted from question **MM:SS**. Shared passage reading/set setup can be concentrated in the first question. Zero time is preserved without assuming the question was never seen.
- Retained Area-Wise `time_spent_hh_mm` fields use **HH:MM** and are rounded/truncated provider displays. They are kept separate from attributed row sums. Attributed section sums range from 2,383 to 2,422 seconds; do not treat them as precise wall-clock durations or force them to 2,400.
- Marks are provider net marks. Wrong zero-mark responses remain zero. Percentiles, accuracy and benchmark attempt rates use a 0-100 scale. Benchmark p-values retain the provider's percentage-style scale; they are not statistical significance p-values.
- IMS predicted CAT percentiles (98.98, 97.81, 94.83) are retained separately from mock percentiles and are not promises or actual CAT outcomes.

## Missing fields and evidence limits

| Field/evidence | Recovery status |
| --- | --- |
| Exact attempt dates, start/end timestamps and attempt timezone | **Missing for all three**; null with explanations. The review date 16 October 2026 is not substituted. |
| Complete exact question stems, RC passages, shared DILR stimuli and options | **None recovered**. All 204 `question_text` and `options` fields are null. |
| Short question wording | Literal truncated UI snippets were recovered for all 204 rows and retained as `recovered_stem_excerpt`; these cannot reproduce the questions. |
| Original responses and correct-answer keys | **203 label pairs unavailable**. One pair, SimCAT 2 QA Q3 (selected B, correct A), appears in the opened prior analyst narrative as a reported visual observation; the underlying screenshot was not recovered. It is explicitly marked as narrative-only evidence. No answer is inferred from a correct/wrong outcome. |
| Provider question/set/attempt identifiers | No reliable identifiers recovered. Local composite IDs and analyst DILR block references are used. Assessment/asset IDs in source URLs identify tests, not verified attempt IDs. |
| Original downloaded report PDFs, HTML exports or screenshots | Not found among the recovered preparation records. Saved text/DOM-data captures exist instead. The separate CAT 2025 scorecard is outside this three-mock import. |
| Handwritten reasoning, answer changes, navigation order and confidence | Not recovered. No causes are invented from outcome/timing alone. |
| PreSimCAT 1 standalone Scorecard/Area-Wise capture | Not recovered in the saved JSON; its opened Markdown summary and saved AI evidence support totals. |
| PreSimCAT 2 Question Selection aggregate capture | Recovered text has headers but empty aggregate counts. The complete per-question evidence supplies counts. |
| Completed reattempts | None recovered; originals remain separate from any future reattempts. |

AI prose has documented arithmetic/history inconsistencies. Examples include SimCAT 2 QA Type B being described as -1 although per-question marks sum to +2. Original narratives remain unedited; normalized arithmetic follows the rows and score reports. The [cross-mock analysis](legacy/CAT-Mock-Analysis/00-Diagnosis-and-Next-Actions.md) documents further examples.

## Validation and future updates

Run `python3 scripts/validate_records.py` from the repository root. See [validation-report.json](validation-report.json) for the resulting checks and caveats. Source checksums are in [recovery-manifest.json](recovery-manifest.json). The importer is reproducible from preserved files with `python3 scripts/import_legacy_records.py --from-recovered-legacy`; it is only for this historical recovery and must not overwrite later work.

Future analyses use this same repository/layout and [contract](../docs/ANALYSIS-CONTRACT.md): preserve sources first, keep original attempts and reattempts separate, update this index and validation, commit and push using existing authentication. No unattended analysis, application build or deployment is configured.

## Local HQ application (17 October 2026)

The user subsequently authorized a local dashboard and adaptive planner. See [the finalized plan](../docs/PLAN.md) and [root run instructions](../README.md). The 63 imported reference missions are pending learner work, not completed sessions; no logging XP is awarded. Application records and imports follow contract extension 1.1. Existing legacy captures and the recovered original-attempt batch remain unchanged.
