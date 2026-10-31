-- ReZolv schema (YugabyteDB YSQL). Idempotent. Statements are split on ";" + newline by scripts/migrate.py,
-- so keep every statement terminated at the end of a line and avoid semicolons inside comments.
-- Vector indexes (ybhnsw) are created by scripts/migrate.py, not here.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS departments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  categories  TEXT[] NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('student','dean','warden','dept_head','committee')),
  name          TEXT,
  department_id UUID REFERENCES departments(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS student_profiles (
  user_id   UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  pseudonym TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS locations (
  id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name  TEXT NOT NULL UNIQUE,
  lat   DOUBLE PRECISION NOT NULL,
  lng   DOUBLE PRECISION NOT NULL
);

CREATE SEQUENCE IF NOT EXISTS issue_code_seq START 300;

CREATE TABLE IF NOT EXISTS issues (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                 TEXT NOT NULL UNIQUE,
  title                TEXT NOT NULL,
  category             TEXT NOT NULL,
  location_id          UUID REFERENCES locations(id),
  department_id        UUID REFERENCES departments(id),
  status               TEXT NOT NULL DEFAULT 'open'
                       CHECK (status IN ('sealed','open','in_progress','awaiting_confirm','resolved')),
  is_sensitive         BOOLEAN NOT NULL DEFAULT false,
  release_threshold    INT NOT NULL DEFAULT 5,
  report_count         INT NOT NULL DEFAULT 0,
  impact_score         INT NOT NULL DEFAULT 0,
  embedding            VECTOR(768),
  meko_conversation_id TEXT,
  suggested_fix        TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at          TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS reports (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id       UUID REFERENCES issues(id),
  pseudonym      TEXT NOT NULL,
  kind           TEXT NOT NULL DEFAULT 'report' CHECK (kind IN ('report','me_too')),
  text_original  TEXT,
  lang           TEXT,
  text_en        TEXT,
  category       TEXT,
  severity       INT CHECK (severity BETWEEN 1 AND 5),
  is_sensitive   BOOLEAN NOT NULL DEFAULT false,
  location_id    UUID REFERENCES locations(id),
  lat            DOUBLE PRECISION,
  lng            DOUBLE PRECISION,
  floor          TEXT,
  voice_key      TEXT,
  photo_key      TEXT,
  embedding      VECTOR(768),
  receipt_code   TEXT NOT NULL UNIQUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS promises (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id         UUID NOT NULL REFERENCES issues(id),
  department_id    UUID NOT NULL REFERENCES departments(id),
  made_by          UUID REFERENCES users(id),
  text             TEXT NOT NULL,
  due_at           TIMESTAMPTZ NOT NULL,
  status           TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','kept','broken')),
  escalation_level INT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at        TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS confirmations (
  issue_id   UUID NOT NULL REFERENCES issues(id),
  pseudonym  TEXT NOT NULL,
  answer     TEXT NOT NULL CHECK (answer IN ('yes','partly','no')),
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (issue_id, pseudonym)
);

CREATE TABLE IF NOT EXISTS issue_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id    UUID NOT NULL REFERENCES issues(id),
  type        TEXT NOT NULL,
  actor       TEXT NOT NULL,
  summary     TEXT NOT NULL,
  reasoning   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS issue_links (
  cause_issue_id  UUID NOT NULL REFERENCES issues(id),
  effect_issue_id UUID NOT NULL REFERENCES issues(id),
  reason          TEXT NOT NULL,
  confidence      REAL NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (cause_issue_id, effect_issue_id)
);

CREATE TABLE IF NOT EXISTS anchors (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type  TEXT NOT NULL CHECK (entity_type IN ('report','promise','event')),
  entity_id    UUID NOT NULL,
  sha256       TEXT NOT NULL,
  solana_sig   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reports_issue_idx  ON reports (issue_id);
CREATE INDEX IF NOT EXISTS reports_pseudo_idx ON reports (pseudonym);
CREATE INDEX IF NOT EXISTS issues_status_idx  ON issues (status);
CREATE INDEX IF NOT EXISTS promises_due_idx   ON promises (status, due_at);
CREATE INDEX IF NOT EXISTS events_issue_idx   ON issue_events (issue_id, created_at);

-- Counted with two subqueries so promises x issues do not multiply each other.
CREATE OR REPLACE VIEW department_scorecard AS
SELECT d.id, d.name,
       COALESCE(p.kept, 0)   AS kept,
       COALESCE(p.closed, 0) AS closed,
       ROUND(100.0 * COALESCE(p.kept, 0) / NULLIF(p.closed, 0)) AS kept_pct,
       COALESCE(i.open_issues, 0) AS open_issues
FROM departments d
LEFT JOIN (
  SELECT department_id,
         COUNT(*) FILTER (WHERE status = 'kept') AS kept,
         COUNT(*) FILTER (WHERE status IN ('kept','broken')) AS closed
  FROM promises GROUP BY department_id
) p ON p.department_id = d.id
LEFT JOIN (
  SELECT department_id, COUNT(*) AS open_issues
  FROM issues WHERE status <> 'resolved' GROUP BY department_id
) i ON i.department_id = d.id
