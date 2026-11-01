# ReZolv demo guide

A 6 to 8 minute walkthrough for judges, with setup, the exact data to enter, what to point at, and what to say. Everything here uses features that exist today.

## 1. Before the judges arrive (10 minutes)

### Start the stack
Laptop and phone must be on the same Wi-Fi. Laptop address in this guide: `192.168.1.236` (check with `ipconfig` and change it everywhere if different).

| Step | Command | Check |
|---|---|---|
| 1. Docker Desktop | open it and wait until it says running | `docker ps` works |
| 2. Database and API | `powershell -ExecutionPolicy Bypass -File server\start_lan.ps1` | prints `API for the phone app and the dashboard: http://192.168.1.236:8000` |
| 3. Dashboard | `cd dashboard`, `npm install` (first time), `npm run dev` | open `http://localhost:3001` |
| 4. Fresh data | `cd server`, `.venv\Scripts\python seed.py --reset --no-meko` | prints the stories and `Measured root cause: 6 of 6 ...` |
| 5. YugabyteDB console | open `http://localhost:15433` | cluster page loads |
| 6. Health | open `http://localhost:8000/health` | `"db":true,"gemini":true,"meko":true` |

First time on this laptop, allow the ports once in an administrator PowerShell:
`New-NetFirewallRule -DisplayName "ReZolv" -Direction Inbound -Protocol TCP -LocalPort 8000,3001,5433,15433 -Action Allow -Profile Private`

### Phone
Install the APK (`mobileApp/android/app/build/outputs/apk/release/app-release.apk`, or `adb install -r` that file). Open the app. If the login screen shows a different server, tap the "Server:" line, type `http://192.168.1.236:8000`, and log in.

### Logins
| Who | Email | Password |
|---|---|---|
| Student (Student #4F2A) | `ananya.s@democampus.edu` | `student123` |
| Facilities Head, level 1 | `facilities@rezolv.demo` | `staff123` |
| Warden, level 2 | `warden@rezolv.demo` | `staff123` |
| Dean, level 3 | `dean@rezolv.demo` | `staff123` |

Open three browser windows side by side so you never log in and out on stage: **Dean** (normal window), **Warden** (incognito), **Facilities Head** (a second incognito or another browser). The student is the phone.

### Rehearsal checks
- Phone: Home shows "No water on upper floors in Hostel B was escalated, now with the Dean" and one "Needs your OK" card.
- Dashboard (Dean): Overview shows 5 open issues and "Waiting on you: 1".
- Say the Hinglish sentence out loud once so you know the microphone permission is granted.

## 2. The story (say this first, 30 seconds)

"Every campus has a complaint box. Students do not use it because nothing visibly happens. Two things go wrong: the same problem is reported fifty times and nobody sees it is one problem, and an administration promises a fix and nobody checks. ReZolv fixes both. You report in your own language, agents merge and route it, we find the real cause with statistics, every promise has an owner and a deadline, it escalates by itself, and an issue only closes when the students say it is fixed."

## 3. The demo, step by step

### Step 1: Report in Hindi by voice (phone) , 1 minute
1. On the phone, tap **Voice** on the home card (or the microphone button).
2. Tap the big microphone and say: **"Hostel B mein dusri manzil par paani nahi aa raha, pump band lagta hai."** Tap stop.
3. Tap **Next, pin the place**. The map is OpenStreetMap locked to the college boundary. Drag it until the pin sits on **Hostel B**, choose floor **2nd**, tap **Confirm place**.
4. Tap **Send report**.
5. The receipt screen shows Mitraa thinking, then cheering: **"You joined 31 others on No water on upper floors in Hostel B."**

Say: "That was Hindi speech. It was transcribed, translated, classified as water, and matched to the existing Hostel B water issue by meaning, not by keywords. No student had to know the issue existed."

Optional second proof: type the same complaint in English and show it also joins the same issue.

### Step 2: Dean's dashboard sees one issue, not thirty-one (dashboard) , 1 minute
1. Dean window: **Issues**. Point at the colored category tags and **RZV-209, 32 reports**.
2. Open **RZV-209**. In **Reports** the newest line is your Hindi sentence, translated to English, with the original underneath and only a pseudonym.
3. Point at the **Promise** card: "Fix pump wiring, 3 days late", and the ladder **Facilities Head, Warden, Dean** with the Dean highlighted.

Say: "Staff only ever see the pseudonym, never the student."

### Step 3: Root cause found by statistics (dashboard) , 1 minute
1. Same issue page, **Root cause** card: "Measured: 6 of 6 cases followed within 48 hours."
2. Open **Root causes** from the sidebar: "6 of 6 cases followed within 48 hours. Chance alone gives 15% (p = 0.002)."
3. Scroll to **Forecasts**: "Planned transformer maintenance at Hostel B, likely issue water, 100%, 6 of 6 past cases."

Say: "The AI did not guess this. A time-lag test in SQL compared the real data against 500 shuffled timelines. Only after the pattern passed did Gemini explain it in one sentence. A planned power cut on Tuesday now predicts a water outage before anyone complains."

### Step 4: Every decision has a "Why?" that is checked (dashboard) , 1 minute
1. On RZV-209, click the **Why** tab.
2. Point at the green **Verified** tags and the grey **Unverified** ones.
3. Open **Scorecard**: **Checked claims** shows how many were verified against the database and how many were not.

Say: "Every agent must cite evidence. A verifier recomputes the numbers from the database before a human sees them. Anything it cannot confirm is labelled unverified instead of being shown as fact."

### Step 5: The student says "still broken" after the deadline, and it escalates (phone then dashboard) , 2 minutes
This is the main accountability moment.
1. Warden window: **Escalations** shows **RZV-226 Street lights** only. Note that RZV-219 is not there.
2. Phone: Home, **Needs your OK**, card **Flickering lights on Library third floor**. Tap **Still broken**, then **Send answer**.
3. Mitraa: **"The deadline had passed, so I moved it up to the Warden / Dept Head."**
4. Warden window: refresh **Escalations**. **RZV-219** is now there, tagged Warden.
5. Open RZV-219 and the **Why** tab. The newest event reads "Still not fixed after the deadline, escalated to the Warden / Dept Head", with the college rule quoted: *"Electrical, civil maintenance and housekeeping problems: report in writing to the Matron or Manager."*

Say: "That quote is not written by us. It comes from the college's own Code of Conduct and Hostel Bulletin, which we loaded into Meko's knowledge base. Staff cannot mark an issue closed. They can only say it is fixed. The students decide."

### Step 6: Staff make a promise, and the loop closes (dashboard + phone) , 1.5 minutes
1. Facilities Head window: **Issues**, open **RZV-221 Hygiene problems in the main mess**.
2. In **Promise**, type **"Deep clean the kitchen and inspect"**, choose a deadline for tomorrow, **Save promise**. The issue moves to In progress.
3. Open **Promises**: the new promise appears under **Due within 48 hours**. RZV-209 is under **Overdue**.
4. Warden window: open RZV-219, click **Mark as fixed**. The issue shows "Awaiting students".
5. Phone: **Needs your OK** shows RZV-219 again. Tap **Yes, it works**. The progress bar fills. (One yes of eight does not close it: it closes when most reporters agree.)

Say: "A promise starts with the department, moves to the Warden at its deadline, and to the Dean 24 hours later, or immediately when a student disputes the fix after the deadline. Nobody has to chase it."

### Step 6b: Equipment with a QR sticker, built live (phone + dashboard) , 2 minutes
This is the closing moment. The college has no map of its own taps and coolers, so the students build it.
1. Phone: Home, **Equipment**, **Add equipment**. Take a photo of a real object in the room (a water bottle, a fan, a router). Mitraa's server suggests the type from the photo. Confirm it, type a name such as **"Cooler near the library entrance"**, tap **Next, pin the place**, drag the pin, choose the floor, **Send for approval**. If a similar item is within 8 m on the same floor, the app warns first.
2. Dashboard (Facilities Head): the sidebar **Equipment** shows a count. Open it: the proposal is under **Waiting for approval** with its photo. Click **Approve**.
3. Open the item: the **QR label** appears. Click **Open printable label (PDF)** to show the sticker with Mitraa, the name and the code (for example RZV-A-001).
4. Put the QR on the projector. A judge opens the app, **Equipment**, **Scan a sticker**, and scans it. The screen shows the photo and **"Is this the one in front of you?"**. They tap **Yes, report a problem**, speak, and send. The place and the item are already filled in, there is no map step.
5. Dashboard: open the item again. Its history shows the new complaint. A second report on the same item merges into the same issue.

Say: "The sticker holds only a short code, never who scans it. Only approved items get a QR. The photo on the scan screen protects against a swapped sticker. Every item builds a history of complaints and time to fix."

### Step 7: Fix the cause, close them all (dashboard) , 30 seconds
1. Dean window: **Root causes**, **Fix the cause, close them all**, **Confirm**.
2. Phone: the linked water issue appears under **Needs your OK**.

Say: "One click on the real cause updates every linked issue and asks every student who reported it to confirm."

(Do this last in the product story: it changes the data. Re-seed afterwards.)

### Step 8: YugabyteDB, the one database behind all of it , 1.5 minutes
1. Browser: `http://localhost:15433`. Show the cluster, the database `yugabyte`, and the tables list.
2. Terminal: open the SQL shell
   `docker exec -it rezolv-yugabytedb-1 bash -c 'bin/ysqlsh -h $(hostname)'` (single quotes)
   (or connect DBeaver to `192.168.1.236:5433`, database `yugabyte`, user and password `yugabyte`).
3. Run these, one at a time:

```sql
-- relational: the issues and how many students stand behind each
SELECT code, title, status, report_count FROM issues WHERE NOT is_sensitive ORDER BY report_count DESC LIMIT 6;

-- vector search: issues closest in meaning to RZV-209 (this is how Hindi and English reports merge)
SELECT code, title, round((embedding <=> (SELECT embedding FROM issues WHERE code='RZV-209'))::numeric, 3) AS distance
FROM issues WHERE embedding IS NOT NULL ORDER BY embedding <=> (SELECT embedding FROM issues WHERE code='RZV-209') LIMIT 5;

-- the vector indexes
SELECT indexname FROM pg_indexes WHERE indexdef ILIKE '%ybhnsw%';

-- time series: the measured cause pattern
SELECT hits, trials, round((baseline_rate*100)::numeric) AS chance_pct, p_value FROM issue_links WHERE hits IS NOT NULL;

-- privacy by design: reports carry a pseudonym, there is no user id column
SELECT column_name FROM information_schema.columns WHERE table_name = 'reports' ORDER BY ordinal_position;
```

Say: "Relational data, vector search and time-series analysis in a single YugabyteDB. No second vector database. The privacy rule is in the schema: reports store a pseudonym, and only the profile table can map it to an account."

### Step 9: Measured, not claimed (dashboard) , 30 seconds
Open **Scorecard**. Under **Measured on the labelled test set**: category accuracy, routing accuracy, merge precision and recall on 20 labelled reports in Hindi, English and Hinglish. Under **Promises kept**: the department scorecard, with IT Services at 92%.

Say: "We only show numbers we measured. This is our own 20-report test set, not a claim about every campus."

## 4. If something goes wrong

| Problem | Do this |
|---|---|
| Phone cannot reach the server | Same Wi-Fi? Firewall rule added? Venue Wi-Fi often blocks device-to-device traffic: turn on the phone's hotspot, connect the laptop to it, run `ipconfig`, and type the new address in the app (login screen, "Server:" line). |
| Voice does not record | Allow the microphone in Android settings, or tap **Type** and enter the same sentence. |
| Map is blank | The phone needs internet for the map tiles. Everything else still works. |
| Report stays on "Finding who can fix this" | Gemini is rate limited. Wait 30 seconds. The report is saved and will appear. |
| Judge's phone cannot scan | Use the in-app **Scan a sticker** (the system camera may not open a `rezolv://` link). They need the app installed. |
| Data looks wrong after rehearsal | `cd server`, `.venv\Scripts\python seed.py --reset --no-meko` |
| Dashboard shows a blank page | Restart `npm run dev` in `dashboard`. |

## 5. Likely questions

**"Can someone spam it?"** Each student has one pseudonymous account. A burst of near-identical reports from brand-new accounts is flagged for review (Agent activity page). A flag never hides anything, it asks a human to look.

**"How do you know the AI is right?"** Three layers: statistics find patterns, the LLM only explains them, and a verifier checks every claim against the database. Accuracy figures are measured on a labelled test set.

**"What about sensitive complaints like harassment?"** The server already has a full Safe Voice design (student chooses how visible they are, a confidential officer, urgent override, anonymous chat). We left it out of the prototype screens to keep the demo simple. It is the first item on the roadmap.

**"Does it work offline or in other languages?"** Voice and text in Hindi, English and Hinglish today. No offline mode in this version.

**"What does it need from a college?"** A list of locations, departments and escalation contacts, plus the college's own rules uploaded as PDFs.
