# CAT HQ preparation records

Recovered CAT mock analyses, original source evidence and structured performance records for Srishti.

Start with **[data/README.md](data/README.md)** for recovered files, counts, missing fields and source units. The historical import contains 204 question-performance records across PreSimCAT 1 2026, PreSimCAT 2 2026 and SimCAT 2 2026. [Three SQLite databases](data/DATABASES.md) now overlay five freshly viewed complete questions; 199 full question texts/option sets remain unavailable after the browser connection failed.

- [Immutable legacy records](data/legacy/CAT-Mock-Analysis/)
- [Structured mock records](data/mocks/)
- [Analysis contract](docs/ANALYSIS-CONTRACT.md)
- [Recovery manifest](data/recovery-manifest.json)
- [Validation report](data/validation-report.json)

This repository currently stores preparation data only. No dashboard, application, deployment configuration or CI deployment workflow is included.

## Validate

```bash
python3 scripts/validate_records.py
```

The validator checks JSON syntax, composite question IDs, source checksums, record counts, outcomes, marks, times, answer-evidence provenance and agreement with recovered reports. It uses the Python standard library.

## Future analyses

Follow [AGENTS.md](AGENTS.md) and the [analysis contract](docs/ANALYSIS-CONTRACT.md). Fetch/pull before editing, save source evidence, preserve originals and reattempts separately, update the index, validate, commit and push using existing authentication. Do not force-push. Updates happen when an analysis is performed; this repository does not itself schedule analysis or monitor the browser.
