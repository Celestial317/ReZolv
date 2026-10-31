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

## Demo logins (password `rezolv123`)
| Who | Email |
|---|---|
| Phone user, "Student #4F2A" | `ananya.s@democampus.edu` |
| Other students | `student02@campus.demo` ... `student50@campus.demo` |
| Staff | `dean@rezolv.demo`, `warden@rezolv.demo`, `it@rezolv.demo`, `estates@rezolv.demo`, `committee@rezolv.demo` |

`POST /auth/login` returns a bearer token. Send it as `Authorization: Bearer <token>`. Students call the student routes, staff call `/admin/*`. Interactive docs are at `/docs`.

## Demo data
Campus: Shaheed Sukhdev College of Business Studies, Rohini (12 spots, same coordinates as `mobileApp/lib/campus.ts`). 50 students, 5 staff, 6 departments, and the demo story: RZV-209 (water, escalated to the Dean, linked to power cuts), RZV-214 (Wi-Fi, 47 reports), RZV-217 (sealed, 4 of 5), RZV-219 (awaiting confirmation, 3 of 8), RZV-221 (mess), plus past issues for the scorecard.

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
