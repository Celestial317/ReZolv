# ReZolv — Build Plan (HackCBS 9 prototype)

**One line:** Students report campus problems by voice in any language. AI agents merge them into issues, find the root cause, protect sensitive reports (every one reaches a human, and the student chooses how visible they are), and track every promise the administration makes until students confirm the fix.

**Mascot:** Campus Mitraa, a cheerful, supportive student buddy in a royal-blue hoodie who guides students through every report and reacts to what happens to it.

**Track:** YugabyteDB Track B (Campus Grievance Swarm). Meko is the shared memory of the swarm.

**Stack:** Next.js · FastAPI (Python) · YugabyteDB · Meko · Gemini API · Vultr (VM + Object Storage) · Docker · Solana (optional).

> Assumptions: ~24 hours of build time and a team of 4. Adjust the hour blocks if yours differ.

---

## 1. Scope

### Build (must work in the demo)
**Student app** (Next.js `/app`, installable on Android as a PWA)
1. Log in (email + password, seeded accounts)
2. Home (open reports, "needs your OK" card, nearby issues)
3. Report: record voice or type → pin the place on an OpenStreetMap map → choose normal or sensitive (sensitive expands into 3 handling choices, see section 2a) → send
4. Receipt (receipt code)
5. My reports + tracking (timeline, promise countdown, "Why?", anonymous chat thread with the confidential officer on sensitive reports)
6. Nearby issues with "Me too"
7. Confirm the fix (yes / partly / no)
8. Profile (pseudonym, log out)

**Dashboard** (Next.js `/admin`)
1. Log in (role from account: dean, warden, dept head, committee)
2. Overview (tiles, top issues, root-cause alert, map)
3. Issues list + Issue detail (reports by pseudonym, timeline, "Why?" trace, set promise)
4. Safe Voice: an inbox for the confidential officer (urgent first, then "talk now", then "waiting, due in X days"). The dean and other staff see counts only.
5. Promises board (overdue, due soon, waiting for students, kept)
6. Scorecard (promises kept per department)
7. Campus map
8. Agent activity (latest decisions per agent)
9. Root causes (links found by the swarm)

**Backend**
- Report pipeline: transcribe → classify → embed → cluster → route → trace to Meko
- Safe Voice handling (3 paths, urgent override, 7-day review, pattern detection, anonymous chat), see section 2a
- Escalation loop for overdue promises
- Fix confirmation → resolve → save a playbook to Meko

### Optional (day 2, only if everything above works)
- Solana devnet memo with the SHA-256 of each report and promise, link on the receipt
- Forecast panel on Root causes

### Not building (say "roadmap" in the pitch)
OTP / SSO, push notifications, sign-up, rights chatbot, multi-campus, IoT sensors, native Android build.

---

## 2. Campus Mitraa (the mascot)

**Who she is:** a final-year student volunteer. Cute, cheerful, supportive, keeps secrets, never gives up. Royal-blue hoodie, high ponytail with a royal-blue scrunchie, gold lanyard with a plain student ID. **No logo anywhere: she *is* the brand.**

**Voice:** warm, one or two short lines, a little Hinglish. Catchphrase: *"Bol do. Main hoon na."* Never blames staff or students. Never asks for names.

**Where she appears (and her mood):**

| Screen | Mood | Line |
|---|---|---|
| Log in (app + dashboard) | happy / cheerful, waving | "Hi! I'm Campus Mitraa. Bol do, main hoon na." |
| Home | happy | "Tell Mitraa in any language." |
| Recording a voice note | listening | "Mitraa is listening…" |
| Sensitive report option | sympathetic | "Thank you for trusting me. How do you want me to handle this?" |
| Urgent sensitive report | concerned | "I have told the officer right now. If you are in danger, call campus security." |
| Receipt | cheerful + confetti | "You joined 31 others…" |
| Tracking, escalated | determined | "Deadline missed, so I pushed it to the Dean." |
| Confirm fix → yes / partly / no | proud / concerned / determined | |

**How we build her:** one React component `Mitraa` (inline SVG, ported from the design file) with `pose`, `mood`, `fx` and `crop` props. No images, no AI generation, no animation library. The mood is picked on the client from data we already have (see `architecture.md` §8).

**Rule for the demo:** she reacts, she doesn't block. Never a pop-up you have to close.

## 2a. Safe Voice: sealed means protected, not ignored

A pure "wait for 5" rule would ignore the rarest and often most serious case: one student harassed by one person. So we separate two questions:
- **Who acts on the report?** The confidential officer, immediately, for every report.
- **When do details reach the wider administration?** That is what the threshold controls, because in a small class one detailed report can identify who filed it.

When a student marks a report sensitive, Mitraa asks: *"How do you want me to handle this?"*

| Option | What happens | Identity |
|---|---|---|
| **1. Talk to someone now** (default) | Goes immediately to one trained confidential officer (a counsellor or one committee member), not the dean's dashboard. They can reply through the app. | Pseudonym only |
| **2. Wait for others** | Stays protected until enough students report a similar pattern (threshold, default 5), then goes to the full committee as a group concern. | Pseudonym, lost among a group |
| **3. Share my name with the committee** | For students who want a formal complaint. | Visible to the committee only, never on staff dashboards |

**Safety nets so nothing gets buried**
- **Urgent reports skip the wait.** If Gemini flags danger (threats, assault, self-harm), the report goes to the confidential officer at once and the app shows a **"Call campus security"** button. AI only escalates here. It never downgrades or closes a report.
- **A deadline even when waiting.** If option 2 has not reached the threshold in 7 days, the officer still reviews a summary with identifying details removed. Every report gets a human within a week.
- **Two-way anonymous chat.** The officer can ask "Did this happen more than once?" without learning who the student is. This is what makes a single report actionable.
- **Patterns are spotted automatically.** When a 2nd or 3rd student reports something similar, the officer sees "this is now 3 separate students".

**Pitch line:** "You are never ignored. You choose how visible you are. And when others report the same thing, your voice gets stronger."

**Changes this needs (to be applied in `data_model.md` and `architecture.md`)**
- `issues`: add `handling` (`now` / `wait` / `named`), `urgent` (bool), `reviewed_at`, `officer_id`.
- New table `safe_messages` (issue_id, from_role, text, created_at) for the anonymous chat.
- Student app: the "Sensitive" option expands into the 3 choices; the tracking screen gets a chat thread with the officer.
- Dashboard: Safe Voice becomes the officer inbox described in section 1.
- Backend: urgent flag from the intake agent, 7-day review job in the escalation loop, pattern count shown to the officer, chat endpoints.

## 3. Demo script (4 minutes)

1. **Student phone:** Campus Mitraa waves on log in. Record a Hindi voice note (she switches to *listening*) "no water on 2nd floor", pin Hostel B, send → receipt.
2. **Dashboard:** the report has already joined RZV-209 (31 reports). Open it → "Why?" shows Intake → Clusterer → Router with reasoning (from Meko).
3. **Root cause:** the alert says "Hostel B water outages follow power cuts". Show the link.
4. **Promise:** RZV-209's promise is 3 days late → already escalated to the Dean. Set a new promise live.
5. **Safe Voice:** Submit one urgent sensitive report from the phone → it reaches the confidential officer instantly, and the student sees "Call campus security". Then RZV-217 sits at 4 of 5 "wait for others" reports. Submit one more → the 5th report turns 5 individual voices into one case for the full committee, no names.
6. **Close the loop:** on the phone, confirm RZV-219 is fixed → issue resolves → a playbook is saved to Meko → a new similar issue shows "suggested fix" instantly.
7. **Scorecard:** Estates 58% kept vs IT 92%.

---

## 4. Team split (4 people)

| Person | Owns |
|---|---|
| **A · Backend** | FastAPI skeleton, auth, schema, seed script, Docker Compose, Vultr deploy |
| **B · AI + Meko** | `gemini.py`, `meko.py`, agents (intake, clusterer, router, root cause, memory, promise keeper) |
| **C · Student app** | Next.js `/app` screens, voice recorder, Leaflet pin picker, PWA manifest, `Mitraa` component |
| **D · Dashboard** | Next.js `/admin` screens, tables, map, "Why?" trace view, scorecard |

Shared contract: the API list in `architecture.md` §5. Agree on JSON shapes in hour 1 and mock them so the frontend never waits.

---

## 5. Timeline

### Hours 0–2 · Setup (everyone)
- [ ] Create repo with `web/`, `api/`, `docker-compose.yml`
- [ ] **Sponsor desk:** get Meko access (account, API key, datapack ID); confirm Vultr credits; confirm Gemini key works
- [ ] Vultr: create the VM and Object Storage; create buckets `rezolv-voice`, `rezolv-photos`
- [ ] YugabyteDB running in Docker (local + VM); run `schema.sql`
- [ ] Agree on API JSON shapes; frontend uses mocks

### Hours 2–8 · Core path
- [ ] A: `/auth/login`, JWT, seeded users; `/uploads/presign`; `POST /reports`; `GET /reports/mine`
- [ ] B: Gemini transcribe + classify (JSON) and embed (768); clusterer with `ybhnsw` search
- [ ] B: `meko.py` wrapper; write one `conversation_add_message` per decision
- [ ] C: `Mitraa` SVG component (port from the design file); log in, home, report step 1 (MediaRecorder), step 2 (Leaflet pin), step 3, receipt
- [ ] D: log in, overview, issues list, issue detail with timeline

**Checkpoint (hour 8):** a voice note from the phone shows up as a merged issue on the dashboard.

### Hours 8–14 · The novel parts
- [ ] B: router with Meko `memory_search`; root-cause agent → `issue_links`; Safe Voice handling logic (urgent override, 7-day review, pattern count, chat)
- [ ] A: promises endpoints; escalation loop; confirm endpoint; resolve → `memory_add` playbook
- [ ] C: my reports, tracking with "Why?", nearby + me too, confirm fix
- [ ] D: promises board, Safe Voice, "Why?" trace panel, map

**Checkpoint (hour 14):** full demo script runs end to end on localhost.

### Hours 14–18 · Deploy + seed
- [ ] A: deploy Compose to the Vultr VM; HTTPS (needed for the microphone on the phone)
- [ ] B: `seed.py` with the demo story (RZV-209, 214, 217, 219, 221, past power cuts)
- [ ] C + D: scorecard, agent activity, root causes page; polish to match the designs
- [ ] Install the PWA on 2 Android phones and test

### Hours 18–22 · Optional + hardening
- [ ] Solana memo anchoring (only if everything above is green)
- [ ] Fallbacks ready (see §6); rehearse the demo 3 times

### Hours 22–24 · Pitch
- [ ] Slides: problem, demo, architecture, sponsor tech map, roadmap
- [ ] Record a backup demo video

---

## 6. Risks and fallbacks

| Risk | Fallback |
|---|---|
| Meko access delayed or tool calls fail | Keep writing traces to `issue_events` (already shown in the UI); turn Meko calls back on when access works. Ask the Yugabyte mentors early. |
| Gemini rate limits / slow responses | Seeded data covers the demo; cache results; keep one live voice report only |
| Microphone blocked on phone | Needs HTTPS. Use the deployed URL, or fall back to typing |
| VM too small for YugabyteDB | Use a free YugabyteDB Aeon cluster; change `DATABASE_URL` only |
| OSM tiles slow on venue Wi-Fi | Pre-load the campus area once; keep a screenshot of the map ready |
| Clustering merges the wrong reports | Require same location **and** distance < 0.20; tune on seed data |

---

## 7. Check with sponsors / docs before coding (don't guess)

- **Meko:** exact auth header your MCP client must send (the Meko + Strands sample uses `Authorization: Bearer <API key>`), and your datapack ID. Tool names used here are from the Meko MCP Server reference: `conversation_create`, `conversation_add_message`, `memory_add`, `memory_search`, `context_search`, `memory_promote`.
- **Gemini:** which Flash model names your key can use (`client.models.list()`); set it in `GEMINI_MODEL`.
- **Vultr:** which Object Storage region/endpoint your account gets (for India, `del1` and `blr1` exist).
- **YugabyteDB:** use a version that includes pgvector with `ybhnsw` (the current docs list pgvector 0.8.0 on PG15-compatible YSQL).

---

## 8. Definition of done

- [ ] Phone → voice report → appears on the dashboard, merged, routed, with a "Why?" trace
- [ ] Every sensitive report reaches the confidential officer (immediately, or within 7 days with details removed); urgent ones instantly
- [ ] "Wait for others" reports release to the full committee at the threshold with no identity anywhere in staff views
- [ ] Officer and student can chat without the officer learning who the student is
- [ ] Overdue promise escalates automatically
- [ ] Student confirmation resolves an issue and a playbook appears in Meko
- [ ] Runs on Vultr via `docker compose up`
- [ ] Every sponsor tech in `architecture.md` §12 is actually called in the demo
