# ReZolv — Data Model

Prototype scope only. One YugabyteDB database (YSQL, PostgreSQL-compatible), two Vultr Object Storage buckets, and one Meko datapack.

## 1. Where each kind of data lives

| Data | Stored in | Why |
|---|---|---|
| Users, reports, issues, promises, confirmations, timeline | **YugabyteDB** (YSQL, port 5433) | The facts. Relational + vector search in one database. |
| Embeddings for clustering ("is this the same problem?") | **YugabyteDB** `vector(768)` columns + `ybhnsw` index | pgvector is built into YugabyteDB. |
| Voice notes and photos | **Vultr Object Storage** buckets | Files don't belong in the DB. The DB stores only the object key. |
| Agent decision traces, learned fixes (playbooks), department track records | **Meko** datapack, via its MCP tools | Shared memory across agents; powers the "Why?" view. |
| Tamper-proof proof of reports/promises (optional, day 2) | **Solana devnet** (Memo program) + `anchors` table | Only a SHA-256 hash goes on-chain. Never text or identities. |

> YugabyteDB has no "storage buckets". Buckets are on Vultr Object Storage, which is S3-compatible. YugabyteDB stores the bucket name + object key in `reports.voice_key` / `reports.photo_key`.

---

## 2. Storage buckets (Vultr Object Storage)

| Bucket | Contents | Object key format | Access |
|---|---|---|---|
| `rezolv-voice` | Student voice notes (`.webm` from the browser recorder, or `.m4a`/`.mp3`) | `reports/{report_id}.webm` | **Private.** Upload via presigned PUT; play via presigned GET (15 min expiry). |
| `rezolv-photos` | Report photos (`.jpg`/`.png`) | `reports/{report_id}.jpg` | **Private.** Same presigned flow. |

Rules:
- Both buckets are private (Vultr objects are private by default).
- The browser never receives storage keys/secrets. FastAPI generates presigned URLs with `boto3` (endpoint e.g. `https://del1.vultrobjects.com` or `https://blr1.vultrobjects.com`, Signature V4).
- File names never contain the student's name or email. Only the report UUID.

---

## 3. Entity overview

```
users ──1:1── student_profiles (pseudonym)            departments ──< users (staff)
                     │                                      │
                     │ (pseudonym only, never user_id)      │
reports >──────────── issues ──────────────────────────────┘ (routed to)
                        │  ├──< promises
                        │  ├──< issue_events      (timeline + link to Meko trace)
                        │  ├──< confirmations     (students: fixed / partly / not fixed)
                        │  └──< issue_links       (root cause → effect)
locations ──< issues / reports                     anchors (optional, Solana)
```

**Privacy rule:** `reports` and `confirmations` store the **pseudonym**, never `user_id`. Only `student_profiles` maps a pseudonym to a user. Staff API endpoints never join to `student_profiles` or `users` for students.

---

## 4. Schema (run once)

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS vector;     -- pgvector (built into YugabyteDB)

-- ---------- People ----------
CREATE TABLE departments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,          -- 'IT Services', 'Estates · Plumbing', ...
  categories  TEXT[] NOT NULL DEFAULT '{}'   -- default routing: {'water'} etc.
);

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,               -- bcrypt
  role          TEXT NOT NULL CHECK (role IN ('student','dean','warden','dept_head','committee')),
  name          TEXT,                        -- staff only; NULL for students
  department_id UUID REFERENCES departments(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE student_profiles (
  user_id   UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  pseudonym TEXT NOT NULL UNIQUE             -- 'Student #4F2A'
);

-- ---------- Campus ----------
CREATE TABLE locations (
  id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name  TEXT NOT NULL,                        -- 'Hostel B', 'Library'
  lat   DOUBLE PRECISION NOT NULL,
  lng   DOUBLE PRECISION NOT NULL
);

-- ---------- Issues (clusters of reports) ----------
CREATE TABLE issues (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code               TEXT NOT NULL UNIQUE,    -- 'RZV-209'
  title              TEXT NOT NULL,
  category           TEXT NOT NULL,           -- water|electricity|internet|food|safety|sensitive|other
  location_id        UUID REFERENCES locations(id),
  department_id      UUID REFERENCES departments(id),
  status             TEXT NOT NULL DEFAULT 'open'
                     CHECK (status IN ('sealed','open','in_progress','awaiting_confirm','resolved')),
  is_sensitive       BOOLEAN NOT NULL DEFAULT false,
  release_threshold  INT NOT NULL DEFAULT 5,  -- distinct reporters needed to unseal
  report_count       INT NOT NULL DEFAULT 0,
  impact_score       INT NOT NULL DEFAULT 0,  -- 0..100, computed by API
  embedding          VECTOR(768),             -- embedding of the first report
  meko_conversation_id TEXT,                  -- Meko conversation holding this issue's traces
  suggested_fix      TEXT,                    -- from Meko memory_search
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at        TIMESTAMPTZ
);

-- ---------- Reports (one per student submission) ----------
CREATE TABLE reports (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id       UUID REFERENCES issues(id),
  pseudonym      TEXT NOT NULL,               -- NEVER user_id
  kind           TEXT NOT NULL DEFAULT 'report' CHECK (kind IN ('report','me_too')),
  text_original  TEXT,                        -- typed text or transcript
  lang           TEXT,                        -- 'hi', 'en', ...
  text_en        TEXT,                        -- English translation
  category       TEXT,
  severity       INT CHECK (severity BETWEEN 1 AND 5),
  is_sensitive   BOOLEAN NOT NULL DEFAULT false,
  location_id    UUID REFERENCES locations(id),
  lat            DOUBLE PRECISION,            -- pin from the map
  lng            DOUBLE PRECISION,
  floor          TEXT,
  voice_key      TEXT,                        -- 'rezolv-voice/reports/<id>.webm'
  photo_key      TEXT,                        -- 'rezolv-photos/reports/<id>.jpg'
  embedding      VECTOR(768),
  receipt_code   TEXT NOT NULL UNIQUE,        -- 'RZV-R-7F3A-91C2'
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Promises (accountability) ----------
CREATE TABLE promises (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id         UUID NOT NULL REFERENCES issues(id),
  department_id    UUID NOT NULL REFERENCES departments(id),
  made_by          UUID REFERENCES users(id),  -- staff user
  text             TEXT NOT NULL,              -- 'Fix pump wiring'
  due_at           TIMESTAMPTZ NOT NULL,
  status           TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','kept','broken')),
  escalation_level INT NOT NULL DEFAULT 0,     -- 0 none, 1 warden/HOD, 2 dean
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at        TIMESTAMPTZ
);

-- ---------- Student confirmation of fixes ----------
CREATE TABLE confirmations (
  issue_id   UUID NOT NULL REFERENCES issues(id),
  pseudonym  TEXT NOT NULL,
  answer     TEXT NOT NULL CHECK (answer IN ('yes','partly','no')),
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (issue_id, pseudonym)
);

-- ---------- Timeline (what the app & dashboard show) ----------
CREATE TABLE issue_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id    UUID NOT NULL REFERENCES issues(id),
  type        TEXT NOT NULL,      -- created|merged|routed|released|promise_made|escalated|root_cause|fixed|confirmed|reopened
  actor       TEXT NOT NULL,      -- agent name ('router') or staff name
  summary     TEXT NOT NULL,      -- one human-readable line
  reasoning   TEXT,               -- short "why" (full trace is in Meko)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Root cause links ----------
CREATE TABLE issue_links (
  cause_issue_id  UUID NOT NULL REFERENCES issues(id),
  effect_issue_id UUID NOT NULL REFERENCES issues(id),
  reason          TEXT NOT NULL,
  confidence      REAL NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (cause_issue_id, effect_issue_id)
);

-- ---------- Optional: Solana anchors (day 2) ----------
CREATE TABLE anchors (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type  TEXT NOT NULL CHECK (entity_type IN ('report','promise','event')),
  entity_id    UUID NOT NULL,
  sha256       TEXT NOT NULL,
  solana_sig   TEXT,              -- NULL until sent
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Indexes ----------
CREATE INDEX NONCONCURRENTLY reports_embedding_idx ON reports USING ybhnsw (embedding vector_cosine_ops);
CREATE INDEX NONCONCURRENTLY issues_embedding_idx  ON issues  USING ybhnsw (embedding vector_cosine_ops);
CREATE INDEX reports_issue_idx   ON reports (issue_id);
CREATE INDEX reports_pseudo_idx  ON reports (pseudonym);
CREATE INDEX issues_status_idx   ON issues (status);
CREATE INDEX promises_due_idx    ON promises (status, due_at);
CREATE INDEX events_issue_idx    ON issue_events (issue_id, created_at);
```

### Scorecard (a view, no extra table)

```sql
CREATE VIEW department_scorecard AS
SELECT d.id, d.name,
       COUNT(p.*) FILTER (WHERE p.status = 'kept')                          AS kept,
       COUNT(p.*) FILTER (WHERE p.status IN ('kept','broken'))              AS closed,
       ROUND(100.0 * COUNT(p.*) FILTER (WHERE p.status = 'kept')
             / NULLIF(COUNT(p.*) FILTER (WHERE p.status IN ('kept','broken')), 0)) AS kept_pct,
       COUNT(i.*) FILTER (WHERE i.status <> 'resolved')                     AS open_issues
FROM departments d
LEFT JOIN promises p ON p.department_id = d.id
LEFT JOIN issues   i ON i.department_id = d.id
GROUP BY d.id, d.name;
```
(Counts are approximate when a department has both many promises and many issues because of the double join. Fine for the demo; split into two subqueries if needed.)

---

## 5. Key queries

**Find a matching open issue for a new report (clustering):**
```sql
SELECT id, code, location_id, embedding <=> $1 AS distance
FROM issues
WHERE status <> 'resolved' AND category = $2
ORDER BY embedding <=> $1
LIMIT 5;
-- In Python: take the first row with distance < 0.20 AND same location_id. Otherwise create a new issue.
```
Note from YugabyteDB docs: with `ybhnsw`, the `WHERE` filter is applied **after** the index scan, so keep `LIMIT` a bit larger than 1 and filter in code.

**Sealed issue: count distinct reporters:**
```sql
SELECT COUNT(DISTINCT pseudonym) FROM reports WHERE issue_id = $1;
```

**Overdue promises (escalation loop, every 5 minutes):**
```sql
SELECT id, issue_id, escalation_level FROM promises
WHERE status = 'open' AND due_at < now() - (escalation_level * INTERVAL '24 hours');
```

**Fix confirmation (close when majority says yes):**
```sql
SELECT COUNT(*) FILTER (WHERE answer = 'yes') AS yes,
       (SELECT COUNT(DISTINCT pseudonym) FROM reports WHERE issue_id = $1) AS reporters
FROM confirmations WHERE issue_id = $1;
```

---

## 6. Embeddings

- Model: Gemini `gemini-embedding-001`, `output_dimensionality = 768` → matches `VECTOR(768)`.
- Embed `text_en` (the English translation), so Hindi and English reports about the same problem cluster together.
- Use cosine distance (`<=>`, `vector_cosine_ops`). Cosine ignores vector length, so the reduced-dimension vectors don't need extra normalization for this query.

---

## 7. Meko datapack layout (one datapack: `rezolv-demo`)

Meko is used only through its MCP tools at `https://mcp.mekodata.ai/mcp`. Each agent writes with its own `agent_id`.

| What | Meko tool | `agent_id` | Example content |
|---|---|---|---|
| One conversation per issue (holds its decision trace) | `conversation_create` (title = issue code) | `rezolv` | `RZV-209` → id saved in `issues.meko_conversation_id` |
| Each decision with its reasoning | `conversation_add_message` (`input`, `output`, `reasoning`, `metadata`) | `intake`, `clusterer`, `router`, `root_cause`, `promise_keeper`, `privacy_guardian` | output: "Routed to Estates · Plumbing", reasoning: "9 of 11 past water issues fixed by Estates" |
| Learned fix (playbook) after an issue is resolved | `memory_add` | `memory` | "Hostel water outage after power cut: fixed by pump changeover to DG backup" |
| Department track record | `memory_add` | `router` | "Hostel Office forwarded all water issues to Estates" |
| Suggested fix for a new issue / routing hints | `memory_search` or `context_search` | any | query: "water outage hostel" |
| Make a learning visible to all agents | `memory_promote` (owners/maintainers only, one-way) | — | optional |

**Never send to Meko:** emails, names, or the pseudonym→user mapping. Only issue codes, categories, locations, and reasoning.

---

## 8. Seed data (for the demo)

- 6 departments, 12 locations (match the campus map), 5 staff users (dean, warden, IT head, Estates head, committee), 30 student users with pseudonyms.
- ~200 reports generating the demo issues: RZV-209 (Hostel B water, overdue promise), RZV-214 (Hostel C WiFi, 47 reports), RZV-221 (mess hygiene), RZV-217 (sealed, 4 of 5), RZV-219 (awaiting confirmation 3 of 8).
- 6 past "power cut" events so the root-cause link for RZV-209 can be found live.

---

## 9. Campus Mitraa (mascot) needs no storage

The mascot is a front-end SVG component. Her mood is derived from columns that already exist:

| Column(s) | Mood |
|---|---|
| `reports.is_sensitive = true` | sympathetic |
| `promises.due_at < now()` and `escalation_level = 0` | concerned |
| `promises.escalation_level >= 1` | determined |
| `issues.status = 'resolved'` | proud |
| `confirmations.answer = 'yes' / 'partly' / 'no'` | proud / concerned / determined |

No new tables, columns or buckets.
