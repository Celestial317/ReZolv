# ReZolv — Architecture

Goal: the simplest setup that runs the full demo. **One Next.js app, one FastAPI service, one YugabyteDB, on one Vultr VM**, plus three hosted services (Gemini, Meko, Vultr Object Storage) and optional Solana devnet.

## 1. The big picture

```mermaid
flowchart LR
  subgraph Phone["Student phone (Android, Chrome)"]
    PWA["ReZolv app<br/>Next.js /app/* (installable PWA)"]
  end
  subgraph Laptop["Staff laptop"]
    DASH["Dashboard<br/>Next.js /admin/*"]
  end

  subgraph VM["Vultr Cloud Compute VM (Docker Compose)"]
    WEB["web: Next.js"]
    API["api: FastAPI (Python)<br/>+ background tasks"]
    DB[("YugabyteDB<br/>YSQL :5433<br/>pgvector")]
  end

  OBJ[("Vultr Object Storage<br/>rezolv-voice · rezolv-photos")]
  GEM["Gemini API<br/>transcribe · classify · embed"]
  MEKO["Meko (MCP)<br/>mcp.mekodata.ai/mcp"]
  SOL["Solana devnet<br/>Memo program (optional)"]

  PWA --> WEB
  DASH --> WEB
  WEB -- "/api/* rewrite" --> API
  PWA -. "presigned PUT/GET" .-> OBJ
  API --> DB
  API --> OBJ
  API --> GEM
  API --> MEKO
  API -.-> SOL
```

**Why this shape**
- **One Next.js project for both UIs.** `/admin/*` is the dashboard; `/app/*` is the student app, built mobile-first and installable on Android as a PWA. One codebase, one deploy, shared components.
- **FastAPI owns everything sensitive.** API keys (Gemini, Meko, Vultr, Solana) live only in the API container. The browser only ever talks to `/api/*`.
- **No queue, no Redis.** Slow AI work runs as FastAPI `BackgroundTasks` after the report is saved. The escalation check is one async loop started with the app.
- **No websockets.** The dashboard polls every 10 seconds.

---

## 2. Components

| Component | Tech | Responsibility |
|---|---|---|
| `web` | Next.js (App Router), Tailwind, `react-leaflet` | Dashboard + student PWA. Calls FastAPI through a `next.config` rewrite (`/api/:path*` → `http://api:8000/:path*`), so there are no CORS issues. |
| `api` | Python 3.11+, FastAPI, `psycopg` (YugabyteDB YSQL is Postgres-wire compatible), `google-genai`, `boto3`, `mcp` (MCP Python SDK), `bcrypt`, `pyjwt`, `ffmpeg` binary | REST API, auth, report pipeline ("agents"), presigned URLs, escalation loop. |
| `yugabytedb` | `yugabytedb/yugabyte` Docker image, `yugabyted` single node | All relational data + vectors. YSQL on port 5433. |
| Vultr Object Storage | S3-compatible (`boto3` with `endpoint_url`) | Voice notes and photos (private buckets). |
| Gemini API | `google-genai` SDK | Audio transcription + translation + classification (structured JSON), embeddings (`gemini-embedding-001`, 768 dims), root-cause reasoning. |
| Meko | Remote MCP server `https://mcp.mekodata.ai/mcp`, API key from Meko Settings → API Keys | Decision traces, learned fixes, department track records. |
| Solana (optional) | `solana` + `solders` Python packages, SPL Memo program, devnet | Writes a SHA-256 hash of a report/promise in a memo. |

---

## 3. "Agents" = plain Python functions

No agent framework. Each agent is one function in `api/agents/`. Each one writes its decision to `issue_events` (for the UI) and to the issue's Meko conversation (for the trace and shared memory).

| Agent | Runs when | Uses |
|---|---|---|
| `intake` | New report | Gemini: transcript → `{lang, text_original, text_en, category, severity, is_sensitive}` as JSON |
| `clusterer` | After intake | Gemini embedding + YugabyteDB `ybhnsw` search → join an existing issue or create a new one |
| `privacy_guardian` | Report joins a sensitive issue | Counts distinct pseudonyms; flips `sealed` → `open` at the threshold |
| `router` | New issue | Category → department map, then `memory_search` in Meko for overrides ("Hostel Office forwards water issues to Estates") |
| `root_cause` | New issue | Sends last 30 days of issues/events for the same building to Gemini → writes `issue_links` |
| `memory` | New issue / issue resolved | `memory_search` for a past fix (→ `issues.suggested_fix`); `memory_add` a playbook when resolved |
| `promise_keeper` | Every 5 min loop | Overdue promises → raise `escalation_level`, add event |

---

## 4. Key flows

### 4.1 Student submits a report
```mermaid
sequenceDiagram
  participant App as Student app
  participant API as FastAPI
  participant S3 as Vultr Object Storage
  participant DB as YugabyteDB
  participant G as Gemini
  participant M as Meko

  App->>API: POST /uploads/presign {type: voice}
  API-->>App: presigned PUT URL + key
  App->>S3: PUT voice.webm
  App->>API: POST /reports {voice_key, lat, lng, floor, is_sensitive}
  API->>DB: insert report (pseudonym, receipt_code)
  API-->>App: 201 {receipt_code}
  Note over API: BackgroundTask starts
  API->>S3: GET audio
  API->>API: ffmpeg webm → mp3
  API->>G: transcribe + translate + classify (JSON)
  API->>G: embed text_en (768)
  API->>DB: vector search → join or create issue
  API->>M: conversation_add_message (reasoning)
  API->>M: memory_search (past fix)
  API->>DB: issue_events rows
```

Browser recording uses the standard `MediaRecorder` API (Chrome produces WebM/Opus). The API converts it to MP3 with `ffmpeg` before sending it to Gemini, so we never depend on which audio containers Gemini accepts.

### 4.2 Staff sets a promise
`POST /admin/issues/{id}/promises {text, due_at}` → insert promise → event `promise_made` → Meko message. (The form is plain fields. No AI extraction in the prototype.)

### 4.3 Escalation loop (every 5 minutes)
Overdue open promises → `escalation_level + 1` (1 = warden/HOD, 2 = dean) → event `escalated` → Meko message with the reason ("72 h overdue, policy escalates after 48 h").

### 4.4 Student confirms a fix
`POST /issues/{id}/confirm {answer}` → if `yes` count > half of the issue's distinct reporters → `resolved`, promise `kept`, `memory_add` playbook. If `no` → status back to `open`, event `reopened`.

### 4.5 Sealed (sensitive) report
New sensitive issue is created with `status = 'sealed'`. Staff endpoints exclude sealed issues' text. When distinct reporters ≥ `release_threshold`, status → `open`, routed to the committee department.

---

## 5. API (FastAPI)

All routes need a JWT (`Authorization: Bearer`) except login. The role comes from the token.

**Auth**
| Method | Path | Who |
|---|---|---|
| POST | `/auth/login` `{email, password}` → `{token, role}` | all |

**Student** (`role = student`)
| Method | Path | Purpose |
|---|---|---|
| POST | `/uploads/presign` `{type: voice\|photo}` | Presigned PUT URL |
| POST | `/reports` | Create report |
| GET | `/reports/mine` | My reports + issue status |
| GET | `/issues/nearby` | Open issues for the map/list (no sealed ones) |
| POST | `/issues/{id}/metoo` | Adds a `me_too` report |
| GET | `/issues/{id}` | Timeline, promise, "why" summary |
| POST | `/issues/{id}/confirm` `{answer, note}` | Confirm fix |

**Staff** (`role in dean, warden, dept_head, committee`; dept_head sees only own department)
| Method | Path | Purpose |
|---|---|---|
| GET | `/admin/overview` | Tiles, top issues, root-cause alert |
| GET | `/admin/issues?status=&dept=` | Issue list |
| GET | `/admin/issues/{id}` | Detail, reports (pseudonyms only), events, Meko trace |
| GET | `/admin/media/{report_id}` | Presigned GET for voice/photo |
| POST | `/admin/issues/{id}/promises` | New promise |
| GET | `/admin/sealed` | Sealed issues (counts only, no text) |
| GET | `/admin/promises` | Promise board |
| GET | `/admin/scorecard` | From `department_scorecard` view |
| GET | `/admin/map` | Issues with lat/lng for Leaflet |
| GET | `/admin/agents/activity` | Latest `issue_events` grouped by actor |

---

## 6. Auth (kept minimal)

- Email + password (bcrypt). Accounts are **seeded**; no sign-up, no OTP, no password reset in the prototype.
- FastAPI returns a JWT `{sub, role, department_id, pseudonym?}`. Next.js stores it in `localStorage` and sends it on each call.
- For students the token carries the **pseudonym**; the API writes reports with that pseudonym and never stores `user_id` on a report.

---

## 7. Maps

- `react-leaflet` with OpenStreetMap tiles `https://tile.openstreetmap.org/{z}/{x}/{y}.png` and the required attribution "© OpenStreetMap contributors". Leaflet needs the browser, so load the map component with `next/dynamic` and `ssr: false`.
- **Pin-in-the-middle picker:** a fixed CSS pin over the map; on Leaflet's `moveend` event read `map.getCenter()` and show the nearest `locations` row.
- Fine for a demo. The OSM tile servers have a usage policy, so don't use them for heavy production traffic.

---

## 8. Campus Mitraa in the UI

- **One component:** `web/components/Mitraa.tsx`. Inline SVG ported from the design file's `Mitraa` artboard. Props: `pose` (wave, listen, think, cheer, thumbsup, heart, hips, point, phone, idle), `mood` (happy, cheerful, listening, thinking, concerned, determined, proud, sympathetic, surprised, grateful, wink, starstruck), `fx` (sparkles, confetti, stars, hearts, …), `crop` (`full` or `head` for avatars).
- **No backend work.** Her mood is chosen in the browser from data the API already returns:

| State in the API response | Mitraa |
|---|---|
| Recorder is recording | `listening` |
| Report submitted, waiting for the background task | `thinking` |
| Report saved (receipt) | `cheerful` + confetti |
| `is_sensitive = true` on the report form | `sympathetic`, heart pose |
| Promise `due_at` passed, `escalation_level = 0` | `concerned` |
| `escalation_level >= 1` | `determined`, hands on hips |
| Issue `status = resolved` | `proud`, thumbs up |
| Empty list / no reports yet | `happy`, wave |

- **Accessibility:** the SVG has `role="img"` and an `aria-label` ("Campus Mitraa, cheerful"). Her speech-bubble text is real text, not inside the SVG.

## 9. Repository layout

```
rezolv/
├── docker-compose.yml
├── .env.example
├── web/                      # Next.js
│   ├── app/
│   │   ├── admin/            # login, overview, issues, issues/[id], safe-voice,
│   │   │                     # root-causes, promises, scorecard, map, agents
│   │   ├── app/              # login, home, nearby, report (3 steps), receipt,
│   │   │                     # reports, reports/[id], confirm/[id], profile
│   │   └── manifest.ts       # PWA manifest
│   ├── components/           # Mitraa (mascot SVG), Sidebar, Topbar, TabBar, CampusMap, PinPicker
│   └── next.config.js        # /api rewrite
├── api/                      # FastAPI
│   ├── main.py               # routes + startup (escalation loop)
│   ├── db.py                 # psycopg pool → YugabyteDB :5433
│   ├── auth.py
│   ├── storage.py            # boto3 → Vultr, presign
│   ├── gemini.py             # transcribe/classify, embed, root cause
│   ├── meko.py               # call_tool(name, args) via MCP Python SDK
│   ├── solana_anchor.py      # optional
│   ├── agents/               # intake, clusterer, privacy, router, root_cause, memory, promise_keeper
│   ├── schema.sql
│   ├── seed.py
│   └── Dockerfile            # python + ffmpeg
└── docs/ (PLAN.md, data_model.md, architecture.md)
```

---

## 10. Docker Compose (one VM)

```yaml
services:
  yugabytedb:
    image: yugabytedb/yugabyte:latest   # pin a version tag before the demo
    command: ["bin/yugabyted", "start", "--background=false"]
    ports: ["5433:5433", "15433:15433"] # YSQL, web UI
    volumes: ["ybdata:/root/var"]

  api:
    build: ./api
    env_file: .env
    depends_on: [yugabytedb]
    ports: ["8000:8000"]

  web:
    build: ./web
    environment:
      - API_URL=http://api:8000
    depends_on: [api]
    ports: ["3000:3000"]

volumes:
  ybdata:
```
Alternative if the VM is too small: use a free YugabyteDB Aeon cluster and drop the `yugabytedb` service.

Put Caddy or nginx in front for HTTPS if time allows. Microphone access (`getUserMedia`) in Chrome **requires HTTPS** except on `localhost`, so the phone demo needs an HTTPS URL.

---

## 11. Environment variables (`.env`)

```
DATABASE_URL=postgresql://yugabyte:yugabyte@yugabytedb:5433/yugabyte
JWT_SECRET=change-me

GEMINI_API_KEY=...
GEMINI_MODEL=<a current Flash model listed by client.models.list()>
GEMINI_EMBED_MODEL=gemini-embedding-001

VULTR_S3_ENDPOINT=https://del1.vultrobjects.com     # your bucket's region
VULTR_S3_ACCESS_KEY=...
VULTR_S3_SECRET_KEY=...
BUCKET_VOICE=rezolv-voice
BUCKET_PHOTOS=rezolv-photos

MEKO_MCP_URL=https://mcp.mekodata.ai/mcp
MEKO_API_KEY=...
MEKO_DATAPACK_ID=...

SOLANA_RPC_URL=https://api.devnet.solana.com          # optional
SOLANA_KEYPAIR_PATH=/run/secrets/devnet.json          # optional
```

---

## 12. Sponsor tech map

| Tech | Where it is used |
|---|---|
| YugabyteDB | All data, vector clustering (`ybhnsw`), scorecard view |
| Meko | Per-issue decision traces ("Why?"), learned fixes, routing memory |
| Gemini | Voice → text → English, category, severity, embeddings, root cause |
| Vultr | VM running Docker Compose + Object Storage buckets |
| Docker | Compose file for web, api, db |
| Solana | Optional: hash of each report/promise in a devnet memo, receipt link |
| Next.js | Dashboard + student PWA |
| Python / FastAPI | API + agents |
