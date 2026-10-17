# CAT HQ: preparation-record instructions

Scope includes CAT preparation records, source evidence and the local HQ application explicitly authorized by the user on 17 October 2026. Keep the app local unless the user separately requests hosting. Preserve original evidence and source hashes. Read docs/PLAN.md for the agreed product behavior.

1. Read `README.md`, `data/README.md` and `docs/ANALYSIS-CONTRACT.md` before importing or updating records. Check for more specific AGENTS.md files.
2. Before writing, inspect the working tree, fetch and pull the latest branch with fast-forward-only behavior. An unborn empty repository has no branch to pull. Never discard unrelated local/remote changes or force-push.
3. Preserve files under `data/legacy/` byte-for-byte. Their existing inaccuracies and uncertainty belong to the historical record; document corrections elsewhere.
4. Put each original attempt in `data/mocks/<mock-id>/` with `analysis.md`, `results.json`, `questions.json` and `sources/`. Store later reattempts separately as required by the contract. Preserve raw source evidence before normalizing it.
5. Recover only from files/reports actually opened. Do not reconstruct unavailable question text, selected answers, keys, dates or working from memory, outcomes or the prior narrative alone. Where a narrative is itself the only recovered evidence, label that limitation explicitly.
6. Use null with an explanation for unavailable values. Distinguish mock percentile from provider predicted CAT percentile. Keep question times in integer seconds; preserve source timing discrepancies and zero-mark wrong responses.
7. Maintain section-scoped stable IDs and source references. Avoid double counting snapshots, repeated AI narratives and reattempts as new original questions.
8. Update `data/README.md`, source/recovery manifests and validation output when new data is added. Run `python3 scripts/validate_records.py` and inspect every failure. Record unresolved disagreements rather than silently changing source values.
9. After each authorized mock analysis, commit the preparation-record changes and push this repository using existing Git authentication. Do not stage unrelated changes. If blocked, state the exact blocker, preserve local records and provide a ZIP of the same structure; never report a successful sync without checking the remote commit.
10. The user's learning style is question-first, then targeted repair. Use the preserved topic-weightage reference as a prioritization signal together with actual performance evidence, not as an official CAT distribution. These instructions do not authorize unattended monitoring or deployment.

11. Application checks: npm test, npm run validate, npm run build. Preserve missing-data labels, distinguish self-reports from key-graded work, and never treat accountability scenarios as measured percentile changes. Do not create real learner completions during testing.
