# ReZolv server

FastAPI + YugabyteDB. One server for both the phone app and the staff dashboard, reachable from any device on the same Wi-Fi.

## Run
```
powershell -ExecutionPolicy Bypass -File server\start_lan.ps1
```
It starts YugabyteDB in Docker, applies the schema, seeds demo data if the database is empty, and serves on `0.0.0.0:8000`. It prints the Wi-Fi URL (for example `http://192.168.1.236:8000`). Use that URL in the phone app and the dashboard.

Windows blocks incoming connections until you allow the port once (run in an **administrator** PowerShell):
```
New-NetFirewallRule -DisplayName "ReZolv API 8000" -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow -Profile Private
```
Phones and laptops must be on the same Wi-Fi, and the Wi-Fi must not isolate clients (some campus or venue networks do).

Manual steps, from `server/` (set `DATABASE_URL` in `../.env`):
```
python -m venv .venv && .venv\Scripts\pip install -r requirements.txt
python -m scripts.migrate           # schema + vector indexes
python seed.py --reset              # demo data (wipes the database)
uvicorn main:app --host 0.0.0.0 --port 8000
python -m scripts.smoke_test        # end-to-end check (files one report, re-seed afterwards)
```

## Demo logins
See the root `README.md`: three students (`student123`) and three staff levels, Facilities Head, Warden and Dean (`staff123`).
`POST /auth/login` returns a bearer token. Send it as `Authorization: Bearer <token>`. Students call the student routes, staff call `/admin/*`. Interactive docs are at `/docs`.

## Demo data
Campus: Shaheed Sukhdev College of Business Studies, Rohini (12 spots, same coordinates as the apps). 3 student logins plus 47 reporter pseudonyms without accounts, 3 staff logins, 6 departments, and the stories: RZV-209 (water, with the Dean, linked to power cuts), RZV-226 (street lights, with the Warden), RZV-214 (Wi-Fi, 47 reports), RZV-219 (awaiting students), RZV-221 (mess), and older sensitive cases RZV-217 and RZV-231 that stay in the database (the apps have no Safe Voice screens).

## Keys (all in `../.env`, all optional to start)
| Key | Needed for | Without it |
|---|---|---|
| `GEMINI_API_KEY` (model `gemini-3.5-flash-lite`) | Voice transcription, translation, classification, real embeddings | Typed reports only, keyword classification, mock embeddings |
| `VULTR_S3_ACCESS_KEY`, `VULTR_S3_SECRET_KEY` (+ `VULTR_S3_ENDPOINT`) | Voice and photo uploads | `/uploads/presign` returns 503 |
| `MEKO_API_KEY`, `MEKO_DATAPACK_ID` (the datapack's UUID) | Agent traces, playbooks, routing memory | Traces stay in the `issue_events` table, which the UI already uses |
| `SOLANA_KEYPAIR_PATH` | Anchoring hashes on devnet (optional) | Hashes only recorded in the `anchors` table |

After adding the Gemini key, run `python seed.py --reset` again so the seeded issues use the same embedding model as live reports.

## Gemini rate limits
A new report costs 2 calls (one to analyse, one to embed); "me too", merged duplicates, seeding and repeated text cost none because results are cached (`.cache/embeddings.json`). Text and voice calls are spaced to `GEMINI_RPM` per minute, embeddings to `GEMINI_EMBED_RPM`. A 429 backs off and retries, repeated 429s pause that call type for a minute, and after `GEMINI_DAILY_BUDGET` calls the server falls back to keyword classification. The root-cause and suggested-fix agents only call Gemini when SQL or Meko finds something worth explaining. `GET /health` shows today's call count.

## Features (see `features.md`) and where they live
| # | Feature | Server |
|---|---|---|
| 1, 2 | Voice and Hinglish reports; original + English embeddings averaged in one request | `agents/intake.py`, `gemini.embed_many` |
| 3, 4 | Pin the spot, QR stickers | `GET /locations`, `POST /reports` accepts `location_id`, `GET /admin/qr`, `GET /admin/qr/{id}.svg` |
| 5 | Student chooses visibility: `handling` = `now` / `wait` / `named` | `POST /reports`, `agents/privacy.py` |
| 6 | Urgent skips the wait, "Call campus security", every report reaches a human in 7 days | `agents/intake.py`, `agents/safe_review.py`, `GET /help/security` |
| 7 | Does the report give you away? | `POST /reports/check-anonymity`, `agents/anonymity.py` |
| 8 | Anonymous two-way chat | `GET/POST /issues/{id}/safe-messages` (student), `POST /safe/issues/{id}/messages` (officer) |
| 9 | "This is now N separate students", release to the committee at the threshold | `agents/privacy.py` |
| 10 | Fake-report burst flag | `agents/fraud.py`, `GET /admin/flagged` |
| 11 | Duplicates merge across languages (vector search) | `agents/clusterer.py` |
| 12 | Root causes found by a time-lag test, explained by Gemini | `agents/root_cause.py` |
| 13 | Fix the cause, close them all | `POST /admin/causes/{id}/fixed`, `GET /issues/awaiting` |
| 14 | Forecasts from planned events | `POST /admin/calendar`, `GET /admin/forecasts` |
| 15 | Campus graph in one query | `GET /admin/campus-graph` |
| 16, 17 | "Why?" with a verification label on every claim | `agents/trace.py`, `agents/verifier.py` |
| 18 | Agents remember what worked (Meko playbooks) | `agents/memory.py` |
| 19 | Router learns from corrections, accuracy over time | `POST /admin/issues/{id}/reassign`, `GET /admin/routing-accuracy` |
| 20 | Escalations quote the college rules from the Meko knowledge base (the three PDFs in `data_knowledge/`) | `rules.py` |
| 21 | Tokens per issue, first-time vs repeat | `GET /admin/token-savings` |
| 22-25 | Promises, escalation, students close issues, scorecard | existing routes |
| 27 | Receipts, searchable by the student | `GET /reports/by-receipt/{code}` |

Safe Voice access: the confidential officer reads every sensitive case through `/safe/*`; the committee reads only cases released to it (group concerns without pseudonyms, named complaints with the chosen name). All other staff get counts only (`/admin/sealed`), and sensitive issues never appear in any other `/admin` view or in Meko.

### Measured numbers only
- `python -m scripts.eval` runs the 20-report labelled test set (`eval/testset.json`) and writes `eval/results.json`, served by `GET /admin/eval`.
- The root-cause numbers (hits, trials, chance rate, p-value) are computed from the data in `issue_links`.
- `GET /admin/verification-stats` counts how many "Why?" claims were checked, contradicted or left unverified.
- `GET /admin/token-savings` and `GET /admin/routing-accuracy` stay empty until there is real traffic to measure.

### Judgement calls
- The verifier is plain SQL (no Gemini calls). `VERIFIER_USE_LLM=true` also lets Gemini judge free-text suggested fixes; it can only upgrade a claim to verified, never mark one contradicted.
- A student's "still broken" answers reopen an issue when a majority of reporters say so (not on a single answer), so one person cannot reopen everything.
- Rule quotes come from the Meko knowledge base, and a passage is only quoted when Meko ranks it as relevant.

## Escalation by students
A student who answers "Still broken" on an issue awaiting confirmation, after the promise deadline, reopens it and moves the promise up one level (`agents/promise_keeper.escalate_after_dispute`). `GET /admin/escalations` returns the queue for the signed-in level (Facilities Head 0, Warden 1, Dean 2). Marking the issue fixed again clears the old answers so the students are asked again.

## Voice and photos
`POST /uploads/media?kind=voice|photo` takes the raw file. It goes to the Vultr bucket when `VULTR_S3_*` is set, otherwise to `server/media/`. Audio is converted with the system ffmpeg or the bundled `imageio-ffmpeg`.

## Equipment with QR stickers
Students register an object (photo, type, name, map pin, floor); staff approve it; an approved item gets a printable QR label; scanning the sticker opens the report screen with the item and place filled in.
- Student: `GET /assets/types`, `GET /assets`, `POST /assets/check` (same type within 8 m on the same floor), `POST /assets/suggest-type` (Gemini looks at the photo), `POST /assets`, `GET /assets/by-code/{code}`, `GET /assets/{id}/photo`. Upload the photo with `POST /uploads/media?kind=asset`. `POST /reports` accepts `asset_code`.
- Staff: `GET /admin/assets?status=proposed`, `GET /admin/assets/{id}` (history: complaints, fixes, average hours to fix), `POST /admin/assets/{id}/approve`, `POST /admin/assets/{id}/reject`, `GET /admin/assets/{id}/qr.svg`, `GET /admin/assets/{id}/label.pdf` (both only for approved items).
- The QR holds `rezolv://a/RZV-A-014` (`QR_LINK_PREFIX`). Reports on the same item with the same kind of problem merge into one issue (`issues.asset_id`).
- Photos go to a third bucket, `rezolv-assets`, or to `server/media/assets/` when no object storage is configured.
