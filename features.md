# ReZolv — Features

> **"Every campus has a complaint box. ReZolv listens in your language, never ignores you, lets you choose how visible you are, finds the real cause, and doesn't close until *you* say it's fixed."**

Legend: ⭐ = wow moment for the demo · 🟢 = core, build first · 🟡 = build after the core works
Where: **App** = student app (`/app`) · **Dash** = staff dashboard (`/admin`) · **API** = FastAPI / agents

---

## A. Speaking up

### 1. 🟢 Report by voice in Hindi, English or Hinglish
Speak or type a complaint. It is transcribed, translated to English and categorised automatically.
- **Where:** App · API
- **How:** browser `MediaRecorder` → Vultr bucket → ffmpeg to MP3 → Gemini returns JSON `{lang, text_original, text_en, category, severity}`. Languages limited to `hi`, `en`, Hinglish.
- **Tech:** Gemini audio

### 2. 🟢 Hinglish handled directly
Code-mixed lines like *"paani nahi aa raha 2nd floor pe"* are understood by matching on both the original text and the English translation.
- **Where:** API
- **How:** embed `text_original` and `text_en`, average the two vectors, store in `reports.embedding`.
- **Tech:** Gemini embeddings (`gemini-embedding-001`, 768 dims)

### 3. 🟢 Pin the exact spot
Drag the map under a fixed centre pin to mark the building, then pick the floor.
- **Where:** App
- **How:** `react-leaflet`, read `map.getCenter()` on `moveend`, show the nearest row from `locations`.
- **Tech:** OpenStreetMap

### 4. ⭐🟢 QR stickers on campus objects
Scan the sticker on a water cooler or WiFi router and the report opens with the location already filled in. At the venue, judges scan and report live.
- **Where:** App
- **How:** each QR encodes `/app/report?loc=<location_id>`; the report screen skips the map step when `loc` is present. Print 3–4 stickers for the venue.

---

## B. Safe Voice (sensitive reports)

### 5. ⭐🟢 Student chooses how visible they are
When a report is marked sensitive, Mitraa asks how to handle it:
- **Talk to someone now** (default): goes straight to one confidential officer.
- **Wait for others:** stays protected until similar reports come in.
- **Share my name:** visible to the committee only, never on staff dashboards.
- **Where:** App · Dash · API
- **How:** `issues.handling` = `now` / `wait` / `named`; officer role sees these in a Safe Voice inbox.

### 6. ⭐🟢 Nobody is ever ignored
Urgent reports (threats, assault, self-harm) go to the officer instantly, and the app shows a **"Call campus security"** button. Every report reaches a human within **7 days**, even when the student chose to wait.
- **Where:** App · Dash · API
- **How:** Gemini sets `urgent = true` (it can only raise urgency, never lower it); the escalation loop moves any `wait` issue older than 7 days to the officer with a redacted summary.

### 7. ⭐🟢 Check that the report doesn't give you away
Before a sensitive report is sent, Mitraa flags lines that could identify the student (*"only girl in CSE-B"*, *"room 214"*) and suggests vaguer wording.
- **Where:** App · API
- **How:** `POST /reports/check-anonymity` → Gemini structured output `{risk: low|medium|high, spans[], suggestion}` plus regex checks for room and roll numbers.
- **Tech:** Gemini

### 8. 🟢 Two-way anonymous chat
The officer can ask follow-up questions (*"Did this happen more than once?"*) without ever learning who the student is.
- **Where:** App (tracking screen) · Dash (Safe Voice inbox)
- **How:** `safe_messages` table `(issue_id, from_role, text, created_at)`; the student side uses the pseudonym only.

### 9. ⭐🟢 Your voice gets stronger with others
When more students report a similar pattern, the officer sees *"this is now 3 separate students"*, and the case goes to the full committee as a group concern. Watching the counter tick up on stage is a strong demo moment.
- **Where:** Dash · API
- **How:** count distinct pseudonyms on the issue; at `release_threshold` the issue moves to the committee.

### 10. 🟡 Fake-report detection
A burst of near-identical reports from new accounts in a short time is flagged for review. Answers *"can't people abuse anonymity?"*
- **Where:** Dash · API
- **How:** on each new report, count reports in the last hour with vector distance < 0.10 from accounts created in the last 24 h; above a threshold, set `issues.flagged = true`.

---

## C. Understanding the problem

### 11. ⭐🟢 Duplicate complaints merge automatically, across languages
47 complaints in Hindi, English and Hinglish become **one issue**.
- **Where:** API · Dash
- **How:** `ybhnsw` cosine search on `issues.embedding`; join if distance < 0.20 and same location, otherwise create a new issue.
- **Tech:** YugabyteDB vector search

### 12. ⭐🟢 Root causes found by statistics, explained by AI
A time-lag test in SQL proves that, for example, water outages follow power cuts. Only then does Gemini explain it in plain words. **The AI explains causes; it doesn't guess them.**
- **Where:** API · Dash (Root causes page, issue detail)
- **How:** for each pair of event streams in the same building, count how often B starts within 48 h after A, and compare with a shuffled-time baseline. Pairs that clearly beat the baseline go to Gemini for a one-line explanation and are stored in `issue_links` with the measured numbers.
- **Tech:** YugabyteDB + Gemini

### 13. ⭐🟢 "Fix the cause, close them all"
One click on a root cause updates every linked issue and notifies every student who reported one.
- **Where:** Dash · App
- **How:** `POST /admin/causes/{id}/fixed` → all issues in `issue_links` with that cause move to `awaiting_confirm`; an `issue_events` row is added for each; reporters see "Check the fix" in the app.

### 14. 🟡 Forecasts before anyone complains
*"Power cut on Tuesday → 82% chance Hostel B loses water"*, so it can be fixed before students suffer.
- **Where:** Dash · API
- **How:** for each confirmed cause link, take the share of past triggers that led to the effect; apply it to upcoming triggers from a small `campus_calendar` table. Show only percentages computed from your data.

### 15. 🟡 Campus map of causes (one query)
Buildings, equipment, issues and causes connected and queried together: relational joins, vector similarity and time windows in **one YugabyteDB query**.
- **Where:** Dash (Root causes page)
- **Tech:** YugabyteDB

---

## D. Agents that learn and explain themselves

### 16. ⭐🟢 A "Why?" button on every decision
For students and staff. *"Routed to Estates because 9 of 11 similar issues were fixed there."*
- **Where:** App (tracking) · Dash (issue detail)
- **How:** each agent writes its decision and reasoning to `issue_events` and to the issue's Meko conversation (`conversation_add_message`).
- **Tech:** Meko

### 17. ⭐🟢 Every "Why?" is checked against the data
A verifier agent checks each claim against the database before it is shown. Anything it can't confirm is labelled **"unverified"** instead of being shown as fact.
- **Where:** API · App · Dash
- **How:** agents must attach evidence IDs (report, event, memory IDs) to each claim; the verifier looks them up in YugabyteDB and asks Gemini whether the evidence supports the claim; result stored as `issue_events.verified`.

### 18. ⭐🟢 Agents remember what worked
When an issue is resolved, its fix is saved. A similar new issue arrives with *"Suggested fix: worked in Hostel A in 2 days"* already attached.
- **Where:** API · Dash
- **How:** on resolve → Meko `memory_add` (playbook); on new issue → `memory_search` → `issues.suggested_fix`.
- **Tech:** Meko

### 19. 🟢 The router learns from corrections
When staff reassign an issue, the next similar one is routed correctly. A chart shows routing accuracy improving. **Only show numbers you actually measured.**
- **Where:** Dash · API
- **How:** `POST /admin/issues/{id}/reassign` → Meko `memory_add` ("issues like X belong to Y"); Router runs `memory_search` before its default rule. Accuracy = share of issues not reassigned, per day, on a labelled 20-report test set.
- **Tech:** Meko

### 20. 🟡 Answers grounded in the rulebook
Escalations quote the actual college rule (*"Hostel rules, section 4: water within 24 h"*).
- **Where:** API · App · Dash
- **How:** upload the rulebook PDF to the Meko datapack knowledge base; Promise Keeper calls `knowledgebase_search` and quotes the matching section.
- **Tech:** Meko knowledge base

### 21. 🟡 Token savings, measured
*"The first issue cost X tokens; the repeat cost Y."*
- **Where:** Dash (Agent swarm page)
- **How:** log Gemini usage per issue with Meko `track_token_usage`; compare a first-time issue with a repeat that used a playbook. Show only measured values.
- **Tech:** Meko

---

## E. Accountability

### 22. 🟢 Promise tracking
Every promise from staff has an owner and a deadline.
- **Where:** Dash · App
- **How:** `promises` table; set from the issue detail page.

### 23. 🟢 Automatic escalation
Overdue promises go up the chain: Warden → Dean.
- **Where:** API · Dash · App
- **How:** async loop every 5 minutes raises `promises.escalation_level` and adds an event.

### 24. ⭐🟢 Students close issues, not the administration
Staff can only mark "fixed". The issue closes only when most of the students who reported it confirm it's fixed.
- **Where:** App · API
- **How:** `confirmations` table; resolve when `yes` > half of distinct reporters; `no` reopens it.

### 25. 🟢 Public promise scorecard
*"Estates kept 58%, IT kept 92%."* Visible on the dashboard and in the student app.
- **Where:** Dash · App
- **How:** `department_scorecard` SQL view.

---

## F. Experience

### 26. ⭐🟢 Campus Mitraa, a mascot whose feelings follow your issue
She waves on log-in, listens while you speak, turns sympathetic on sensitive reports, concerned when a promise is late, determined when it's escalated, and proud when it's fixed.
- **Where:** App · Dash (log-in, sidebar)
- **How:** one `Mitraa` SVG component with `pose` and `mood` props, mood chosen in the browser from data the API already returns (see `architecture.md` §8).

### 27. 🟢 Receipts for anonymous reports
A code that proves you reported something without revealing who you are.
- **Where:** App
- **How:** `reports.receipt_code` (e.g. `RZV-R-7F3A-91C2`), shown on the receipt screen and searchable by the student.

---

## Build order

| Order | Features | Why first |
|---|---|---|
| 1 | 1, 2, 3, 11, 16, 22, 23, 24, 26, 27 | The core loop: report → merge → why → promise → escalate → confirm |
| 2 | 4, 5, 6, 8, 9, 13, 18 | The demo wow moments |
| 3 | 7, 12, 17, 19, 25 | AI depth that judges can question |
| 4 | 10, 14, 15, 20, 21 | Polish, if time allows |

## Demo order (most wow last)
11 (three languages, one issue) → 12 + 13 (root cause, fix them all) → 18 + 17 (memory, verified Why?) → 5 + 9 (Safe Voice, counter ticks up) → 4 (judges scan a QR and report live).

## Schema additions needed (vs `data_model.md`)
- `issues`: `handling TEXT CHECK (handling IN ('now','wait','named'))`, `urgent BOOLEAN DEFAULT false`, `officer_id UUID`, `reviewed_at TIMESTAMPTZ`, `flagged BOOLEAN DEFAULT false`
- `issue_events`: `evidence JSONB` (cited IDs), `verified BOOLEAN`
- `issue_links`: `hits INT`, `trials INT`, `baseline_rate REAL` (the measured numbers behind each cause)
- New `safe_messages (id, issue_id, from_role, text, created_at)`
- New `campus_calendar (id, location_id, kind, starts_at)` for forecasts
- New role `officer` in `users.role`
