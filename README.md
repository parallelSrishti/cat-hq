# Srishti's CAT 2026 HQ

A local, Ubuntu-dark preparation dashboard built around **attempt → targeted repair → fresh transfer → delayed retest**. Plans, analyses and progress live in this Git repository. No cloud backend or AI API key is required.

## Run here or on another machine

Requirements: **Node.js 22.13+**, npm and Git. Use the Git authentication already configured on that machine.

```bash
git clone https://github.com/parallelSrishti/cat-hq.git
cd cat-hq
npm ci
npm run dev
```

Open **http://127.0.0.1:3000**. `npm run dev` builds the frontend and starts the local server; it remains running until stopped. After frontend source edits, restart this command. Use `PORT=3001 npm run dev` on POSIX systems or set `PORT` in your shell to choose another port. `npm run build` + `npm start` is the equivalent two-step workflow. The server binds loopback only.

## Start using the HQ

1. Overview shows the selected baseline and today's mission board. The imported reference plan contains 63 missions through 28 November; it is a provisional schedule, not an asserted CAT exam date.
2. Open a mission and start its timer. Question views, shared passages, options and embedded diagrams load from the supplied SQLite databases. Where content is missing, use the labelled IMS reference placeholder. Save a response or explicit skip for each question. Supplied answer keys grade the response; self-checks stay labelled when a key is unavailable.
3. Complete the required fresh transfer work and describe the first blocked step. Completion saves a session, grants learner XP once, creates the next repair/retest, and records why the plan changed.
4. QA/DILR/VARC pages, Repair Lab and History expose charts and the underlying evidence. Unknown ability is labelled untested; original attempts are never overwritten by practice.
5. Records & sources accepts full question-content packages or new mock packages. The analysis chat can also commit to `data/mocks/` directly, then run sync here.

## GitHub sync

Auto-sync is enabled in Settings. Preparation records save locally first, then the app attempts a preparation-only commit/push and verifies the remote SHA. The sidebar shows the actual status. `npm run sync` performs the same operation explicitly. A startup check imports clean fast-forward changes.

Application edits, staged unrelated changes or conflicting local/remote changes block automatic sync and stay preserved. Resolve them with normal Git before retrying; the app never force-pushes or resets. Work on one clone at a time when convenient, and sync before switching machines. Failed pushes do not lose local sessions. Passwords/tokens are not stored by this app.

## Daily warnings

The running app checks daily rollover, and its board always shows overdue tasks. Enable browser notifications in Settings if desired. For checks with the app/browser closed:

```bash
npm run install-reminders
```

This installs an hourly OS job (Linux systemd user, macOS LaunchAgent or Windows Task Scheduler). It checks for warnings at/after **20:00 Asia/Calcutta**. The computer must be awake, and a working user scheduler is required. `npm run check-day -- --now` runs a check immediately. Notifications are deduplicated on each machine. Runtime scheduler/sync logs live under ignored `.runtime/`.

A “percentile loss” warning is an explicit **if-unresolved scenario**, not observed decline. Historical score curves support approximate conversion; the one-point missed-full-mock penalty is the user's chosen rule. The performance estimate remains separate.

## Shared analysis-tab instructions

Read [AGENTS.md](AGENTS.md) and [docs/ANALYSIS-CONTRACT.md](docs/ANALYSIS-CONTRACT.md) before updates. Pull this branch, preserve source evidence, write structured records, validate, commit and push. Do not regenerate recovered originals to create the illusion of missing stems, keys or dates. Full content can be added under `data/question-bank/` without altering the immutable historical captures.

- [Final implementation plan](docs/PLAN.md)
- [Uploaded reference plan](docs/reference/remaining-plan-2026-10-16.md)
- [Recovered records and limitations](data/README.md)
- [Original source hashes](data/recovery-manifest.json)
- [Import and practice contract](docs/ANALYSIS-CONTRACT.md)

## Checks

```bash
npm test
npm run validate
python3 scripts/validate_records.py
npm run build
```

The Python validator checks the recovered batch and immutable source hashes. Node validation checks application records; tests use temporary directories and do not award real progress. Static assets, dependencies, credentials, locks and machine-local sync state are excluded from Git. The UI can export a full JSON backup.

## Fresh question enrichment

The user subsequently supplied updated [SQLite question databases](data/DATABASES.md). All 204 rows currently have question HTML/views, with passages, options, embedded media and keys. Extraction is still being updated; this count does not certify completeness. The app opens these databases read-only and refreshes its cache when their file timestamps/size change. Keep updated snapshots at `data/mocks/<mock-id>/<mock-id>.db`, validate, then commit/push. Prior five-question captures remain preserved separately. Run `python3 scripts/validate_mock_databases.py` to check the supplied snapshots. Node’s bundled SQLite currently emits an experimental-feature notice on some supported versions; no separate database installation is required.
