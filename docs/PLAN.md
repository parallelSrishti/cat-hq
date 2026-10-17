# CAT 2026 HQ — finalized implementation plan

Authorized by Srishti on 17 October 2026. Runs locally; no Sites/Render/Convex deployment is required. Target: overall 99+ with >90 in each section. Asia/Calcutta is the planning timezone.

## Evidence and reference

The shared repository contains three original mock attempts, 204 performance rows and 15 DILR blocks. Recovery validation confirms the rows, scores and preserved source checksums. Full stems/options and exact attempt dates were not recovered. A short excerpt is never promoted to a complete question. Original responses/keys are missing except one narrative-only label pair. There are no completed learner reattempts in the recovered dataset.

The user-supplied [remaining plan](reference/remaining-plan-2026-10-16.md) is preserved as reference data. Its 63 missions were converted to `data/planning/reference-tasks.json`, including cold SimCAT reattempts, fresh batches, six provisional full mocks and a late-November taper. Dates are provisional, not evidence of the official exam date or completed work. No full mock is assumed unused solely from its name.

Where the reference differs from the user's explicit requirements, the requirements win: every assigned video requires 5–10 fresh assessment questions (rather than two); the actual CAT exam date stays unset until verified; all data remains local/GitHub-backed. The initial 55% DILR / 45% QA non-mock focus is a preference, not a daily time ceiling. VARC maintenance lives mainly inside mock review and specific Summary repair. The earlier QA and DILR within-section allocations remain visible and adjustable through new evidence.

## Product

- Ubuntu-inspired charcoal/grey interface, muted white text and restrained orange accents; responsive navigation and accessible form labels.
- Home: evidence-labelled provisional percentile, section check-in, Today/Missed/Upcoming/Completed task board, XP/streaks and unresolved-work scenarios.
- QA, DILR, VARC: sectional data, topic performance, marks/time plots, urgent repair evidence, explicit next missions and preparation allocation.
- Repair lab: topic heatmap, cold-attempt → targeted repair → fresh transfer → delayed retest gates.
- Mock history: full original analyses, question-level drill-downs, outcome charts, dated trends only when dates exist, plan revision and session history.
- Records: JSON import of complete question content or future mock packages, plus portable backup export.
- Settings: baseline selection, optional capacity, verified exam date, sync and notification controls.

Every chart has source context, sample counts in its drill-down and a written interpretation. Missing values remain unknown. Cohort mock percentiles are separated from IMS CAT predictions and historical score scenarios.

## Adaptive loop

A timed task persists versioned active time, question focus, answers, pause/resume state, correctness provenance and the first blocked step. Content-complete questions can be graded from their key. Metadata-only questions open the original IMS analytics source; the learner can use Review Test and save a self-checked response. Self-checks stay provisional.

Completion saves the learner report, external fresh outcomes when required, XP once, an immutable completion event and a plan snapshot. It adds a topic-specific repair or fresh-transfer task, or a delayed retest after successful fresh work. Retests are due about 48 hours later, with a subsequent weekly check. Original tasks remain in history; rescheduling and retirement require an explanation and do not award completion XP. Topic priorities respond to checked practice evidence. Tests are gated by prior reviews/repairs, and full-mock progression also checks fresh QA and DILR work after the prior mock.

Fresh QA target: ≥80% before speed pressure. DILR reliability: two fully correct fresh sets, with verification shown. Familiar redo success is retrieval evidence rather than mastery. Full-model confidence cannot be inferred from metadata or a single answer. Delayed, independently graded evidence is needed to display retained skill.

## Percentile and accountability model

The initial overall number is IMS's 94.83 CAT prediction for the explicitly selected SimCAT 2 baseline, not a fresh independently fitted estimate. The mock cohort result is 78.94. Unknown dates prevent a recency average. New dated provider CAT estimates feed a recency-weighted mean of the latest five dated estimates. If the latest dated mock has no CAT prediction, the app labels a mock-cohort proxy rather than manufacturing a CAT prediction.

Historical IMS 2023–25 overall and sectional anchor curves support scenario interpolation only within their published 80–99 percentile range. They do not establish the effect of a missed study session. No extrapolated precision is supplied outside that range. Baseline equivalent scores are obtained by inverting each year's curve separately. Lost marks are subtracted on that same curve; years are not mixed into a single score scale. This still assumes comparable-scale marks and is labelled a stress scenario.

User-chosen fallback: a missed topic task assumes all 3 marks per topic question are unavailable; a missed sectional uses its currently highest-priority unresolved topic; a missed full mock carries a one-percentile-point accountability penalty. Topic exposure uses the selected paper's question counts, with observed-average counts only when absent. Broad area weights are not assigned to a single subtopic. Shared topic exposure is counted once and reminders do not repeat-charge the same task. The performance estimate is not overwritten with these penalties.

Sources and limitations: [IMS historical score tables](https://www.imsindia.com/blog/cat/cat-score-vs-percentile/). Source tables and method are in `app/lib/percentile.mjs`. Historical spread is not a confidence interval. Same-mock cohort distributions can replace this fallback if later imported.

## Persistence and synchronization

Tracked JSON/Markdown files are authoritative. Session, task, event and revision IDs are stable. File replacement is atomic, writes are serialized with a cross-process lock, and session versions reject stale concurrent changes. Immutable legacy files remain untouched. Import validation occurs before writing the batch.

Preparation records are saved locally before sync. With auto-sync enabled, completion/import/preferences trigger a preparation-only commit and push, verified against the remote SHA. Startup checks the remote when the tree is clean. Unrelated/staged edits, divergent branches or remote updates alongside local edits produce “Needs attention”; no force-push, destructive reset or silent conflict resolution occurs. Offline work remains saved. Credentials are provided by Git, never the app or tracked files.

## Local operation and reminders

Node ≥22.13, npm, Git. `npm ci`, then `npm run dev`; localhost 127.0.0.1:3000. Production static assets are built before startup. No API key, cloud database or hosted service is needed. Another clone receives the same preparation state after Git sync.

The app checks daily rollover while running. Browser notifications require the browser's notification grant. `npm run install-reminders` installs an hourly local OS job that checks for due warnings at/after 20:00 India time and deduplicates repeated alerts. It requires an awake machine and functioning user scheduler/desktop session. Scheduler installation status must be reported honestly. Linux systemd-user, macOS LaunchAgents and Windows Task Scheduler are supported; this environment may not have a desktop service manager.

## Verification

Run application tests (adaptive rules, timers, session concurrency, video gates, imports, Git safety and rendered routes), app data validation, the legacy source validator and production build. Verify installation/build/server health from a fresh clone. Browser visual QA depends on an available connected browser; DOM-based route checks do not replace visual inspection. Leave the authorized local server running and provide its address, repository commit and any remaining evidence/scheduler limitations.

## Updated user-supplied question tables

After implementation began, the user supplied three newer SQLite snapshots. All 204 existing IDs now have question views and answer values; some mathematical content is image-based, so plain-text counts are smaller. The app reads the tables directly with Node SQLite in read-only mode, caches by file timestamp and size, sanitizes rich HTML/math, and shows only embedded images. Original JSON facts and legacy sources remain unchanged. Missing content still uses explicit placeholders; the user has not certified extraction complete. Source gzip/media hashes and agreement with original performance rows are checked by the database validator. These snapshots supersede the earlier five-question enrichment coverage.
