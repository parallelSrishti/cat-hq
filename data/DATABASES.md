# Evolving SQLite question databases

The latest three files were uploaded by the user on 17 October 2026. All 204 original IDs have renderable question views; 194 have nonempty plain text (some mathematics is embedded as images), and all 204 contain answer values and solution views. The user says extraction is still being updated. Availability is not an independent completeness certification. See [the uploaded snapshot manifest](uploaded-databases-manifest.json) and [current validation](database-validation-report.json).

The app uses the `question_details` view read-only, overlays content on the original IDs, preserves embedded math/media, and does not duplicate original attempts. Source captures are gzip-compressed inside the databases; validation checks their decompressed hashes and embedded media hashes. Replace a snapshot with an updated one at the same path, validate, and sync Git to update another clone. Stop the app while replacing a database manually, or atomically rename the completed file.

The legacy partial-database builder is now guarded to prevent overwriting these newer uploads. Original recovery JSON and legacy source files remain unchanged.

## Earlier first extraction (historical, superseded coverage)

# Mock SQLite databases — partial full-content extraction

Each file contains **68 original-attempt question records**. These are resumable exports, not completed full question banks. Browser access failed during extraction on 17 October 2026 (Asia/Kolkata).

| File | Performance records | Full questions / option sets | Options | Shared RC passages | Answer label pairs |
| --- | ---: | ---: | ---: | ---: | ---: |
| [presimcat-1-2026.db](mocks/presimcat-1-2026/presimcat-1-2026.db) | 68 | 5 | 20 | 2 | 5, freshly observed |
| [presimcat-2-2026.db](mocks/presimcat-2-2026/presimcat-2-2026.db) | 68 | 0 | 0 | 0 | 0 |
| [simcat-2-2026.db](mocks/simcat-2-2026/simcat-2-2026.db) | 68 | 0 | 0 | 0 | 1, prior narrative only |

All 204 rows include section, IMS area/topic, A/B/C difficulty type, original outcome, marks, time in seconds and topper benchmarks. The exact available IMS topic is in `sectional_topic`; `sectional_area` holds its broader area. `subtopic` is null because no distinct additional provider field was recovered. No analyst classifications have been added.

`question_type` means **MCQ/TITA response format**, separately from `provider_difficulty_type` (A/B/C). Five directly viewed questions are confirmed MCQ. The other 199 formats are null; they are not inferred from topic, marks or outcome. The five complete questions are **PreSimCAT 1 VARC Q1–Q5**. Q1–Q4 share the first passage; Q5 links to a second passage. Their question text, HTML, options, original selected answers, correct answers and provider text solutions are embedded.

The remaining **199 full texts/option sets** were not recovered. Their short UI snippets remain in `stem_excerpt`, never relabelled as full questions. Selected and correct answer text/labels are null unless evidence exists. The one older SimCAT 2 QA Q3 B/A pair remains explicitly narrative-only. Exact attempt dates are unavailable for all three; the extraction date is not substituted. All records describe original attempts, not reattempts.

## Tables and queries

- `questions`: one row per original question, all performance fields, content status, per-field missing explanations and original historical JSON.
- `options`: ordered labelled options and independent selection/key flags for actually viewed questions.
- `stimuli`: deduplicated shared passage/instruction text and HTML.
- `sections`, `mocks`, `sets`: scores, original-attempt details and the five historical DILR groupings per mock. Those set IDs remain analyst groupings.
- `source_captures`: original source bytes embedded as BLOBs, provenance paths/URLs, available capture timestamps and SHA-256 hashes. First two new captures have no exact capture timestamp; the session review date is in metadata.
- `metadata`, `notes`: units, interpretation, evidence limits, blocker and resume instructions.
- `question_details`: joined view with stimulus text/HTML and JSON options, convenient for querying one complete record.

```sql
SELECT section, question_number, question_type, sectional_area,
       sectional_topic, provider_difficulty_type, question_text,
       original_response_option_label, correct_response_option_label,
       outcome, time_seconds, content_status
FROM question_details
ORDER BY CASE section WHEN 'VARC' THEN 1 WHEN 'DILR' THEN 2 ELSE 3 END,
         question_number;
```

Files are standalone SQLite 3 databases and do not need the source directory to read their embedded records. The first five complete questions/passages/options contain no external question-image elements; text and rendered HTML are retained. This does not claim recovery of the other mocks' diagrams or equations.

## Evidence, blocker and resumption

Fresh sources are under `mocks/presimcat-1-2026/sources/full-review/`, listed with checksums in [database-source-manifest.json](database-source-manifest.json). The existing historical `questions.json` files remain unchanged, preserving their original recovery limitations. SQLite overlays the new captures without creating extra attempt rows.

The full Review Player showed **Dev-Tools Detected**, including after its normal Try again action. The regular View my analytics → Question - Wise viewer exposed complete question previews; the popup could not be closed/switched reliably, so each next question was opened after an ordinary reload. Five questions were saved. AI Insights → Data Explorer was also opened; its current visible view offered aggregate filters rather than full stems/options.

Then BrowserOS `run` failed with `http/request failed: error sending request for url (http://127.0.0.1:9000/mcp)`. A fresh `tabs` listing failed with the same transport error. No further question content could be accessed. Restore the connected BrowserOS server/session, resume at **PreSimCAT 1 VARC Q6**, and then extract its remaining sections and both other mocks. Verify each section/question ID and actual content before inserting; never copy a stale popup as a new question.

## Rebuild and validate

```bash
python3 scripts/build_mock_databases.py
python3 scripts/validate_mock_databases.py
python3 scripts/validate_records.py
```

[database-validation-report.json](database-validation-report.json) records counts, database checksums, SQLite integrity/foreign-key checks, source-byte agreement and sectional/overall reconciliation. The separate historical validator retains its original 204-record scope.
