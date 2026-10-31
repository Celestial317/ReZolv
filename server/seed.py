"""Seed the demo story from PLAN.md section 3.

    python seed.py            # refuses to run if data exists
    python seed.py --reset    # wipe everything, then seed
    python seed.py --no-meko  # skip pushing the demo traces / playbooks to Meko

Run it AFTER setting GEMINI_API_KEY: issue embeddings come from the same model
the live clusterer uses, otherwise new reports will not match the seeded issues.

Demo logins (password for all: rezolv123):
  phone     ananya.s@democampus.edu   (Student #4F2A, the app's default login)
  students  student02@campus.demo .. student50@campus.demo
  staff     dean@rezolv.demo  warden@rezolv.demo  it@rezolv.demo
            estates@rezolv.demo  committee@rezolv.demo
"""
import random
import sys
from datetime import datetime, timedelta, timezone

import auth
import db
import gemini
import meko
from agents import trace

PASSWORD = "rezolv123"
NOW = datetime.now(timezone.utc)
rng = random.Random(7)
_receipt = iter(range(1, 10**6))


def ago(days=0, hours=0) -> datetime:
    return NOW - timedelta(days=days, hours=hours)


def receipt() -> str:
    n = next(_receipt)
    return f"RZV-R-{n:04X}-{rng.randrange(65536):04X}"


DEPARTMENTS = {
    "IT Services": ["internet"],
    "Estates · Plumbing": ["water"],
    "Estates · Electrical": ["electricity"],
    "Hostel Office": ["safety", "other"],
    "Mess & Catering": ["food"],
    "Student Welfare Committee": ["sensitive"],
}

# name: (lat, lng). Shaheed Sukhdev College of Business Studies, Rohini, Delhi.
# Same spots as mobileApp/lib/campus.ts (the demo labels are pinned on the real building and grounds).
LOCATIONS = {
    "Main Gate": (28.732195, 77.118893), "Hostel A": (28.733147, 77.118783),
    "Hostel B": (28.732783, 77.118477), "Hostel C": (28.732516, 77.118881),
    "Girls Hostel": (28.732633, 77.118587), "Library": (28.732804, 77.119199),
    "Admin Block": (28.733114, 77.118722), "Lab Block": (28.733018, 77.119003),
    "Academic Block 1": (28.732708, 77.119064), "Mess": (28.732441, 77.119309),
    "Canteen": (28.732387, 77.118661), "Sports Ground": (28.732259, 77.119456),
}

STAFF = [  # email, role, name, department
    ("dean@rezolv.demo", "dean", "Dean of Students", None),
    ("warden@rezolv.demo", "warden", "Chief Warden", None),
    ("it@rezolv.demo", "dept_head", "Head, IT Services", "IT Services"),
    ("estates@rezolv.demo", "dept_head", "Head, Estates", "Estates · Plumbing"),
    ("committee@rezolv.demo", "committee", "Welfare Committee", "Student Welfare Committee"),
]

N_STUDENTS = 50


def wipe() -> None:
    db.execute(
        "TRUNCATE anchors, issue_links, issue_events, confirmations, promises, reports, issues, "
        "locations, student_profiles, users, departments CASCADE"
    )
    db.execute("ALTER SEQUENCE issue_code_seq RESTART WITH 300")


def seed_people() -> tuple[dict, dict, dict, list]:
    pw = auth.hash_password(PASSWORD)  # one hash reused: bcrypt is slow
    depts = {n: db.fetchone("INSERT INTO departments (name, categories) VALUES (%s,%s) RETURNING id",
                            (n, c))["id"] for n, c in DEPARTMENTS.items()}
    locs = {n: db.fetchone("INSERT INTO locations (name, lat, lng) VALUES (%s,%s,%s) RETURNING id",
                           (n, *ll))["id"] for n, ll in LOCATIONS.items()}
    staff = {}
    for email, role, name, dept in STAFF:
        staff[role if role != "dept_head" else email] = db.fetchone(
            "INSERT INTO users (email, password_hash, role, name, department_id) VALUES (%s,%s,%s,%s,%s) RETURNING id",
            (email, pw, role, name, depts[dept] if dept else None))["id"]
    students = []
    for i in range(1, N_STUDENTS + 1):
        # student #1 is the demo phone user: matches the app's login screen and profile ("Student #4F2A")
        email = "ananya.s@democampus.edu" if i == 1 else f"student{i:02d}@campus.demo"
        uid = db.fetchone("INSERT INTO users (email, password_hash, role) VALUES (%s,%s,'student') RETURNING id",
                          (email, pw))["id"]
        pseudo = "Student #4F2A"
        while i > 1 and (pseudo in students or pseudo == "Student #4F2A"):
            pseudo = f"Student #{rng.randrange(16**4):04X}"
        db.execute("INSERT INTO student_profiles (user_id, pseudonym) VALUES (%s,%s)", (uid, pseudo))
        students.append(pseudo)
    return depts, locs, staff, students


def make_issue(*, code, title, category, loc, dept, status, created, locs, depts, students,
               n_reports, texts, sensitive=False, threshold=5, resolved=None, embed_text=None,
               suggested_fix=None, first=0) -> dict:
    emb = db.vec(gemini.embed(embed_text or title))
    issue = db.fetchone(
        """INSERT INTO issues (code, title, category, location_id, department_id, status, is_sensitive,
                               release_threshold, report_count, impact_score, embedding, suggested_fix,
                               created_at, resolved_at)
           VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s::vector,%s,%s,%s) RETURNING id, code""",
        (code, title, category, locs[loc], depts[dept] if dept else None, status, sensitive, threshold,
         n_reports, min(100, n_reports * 3 + 3 * 8), emb, suggested_fix, created, resolved),
    )
    lat, lng = LOCATIONS[loc]
    for i in range(n_reports):
        first_few = i < len(texts)
        db.execute(
            """INSERT INTO reports (issue_id, pseudonym, kind, text_original, text_en, lang, category, severity,
                                    is_sensitive, location_id, lat, lng, embedding, receipt_code, created_at)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s::vector,%s,%s)""",
            (issue["id"], students[(first + i) % len(students)], "report" if first_few else "me_too",
             texts[i][0] if first_few else None, texts[i][1] if first_few else None,
             texts[i][2] if first_few else None, category, 3, sensitive, locs[loc],
             lat + rng.uniform(-0.00005, 0.00005), lng + rng.uniform(-0.00005, 0.00005),
             emb if first_few else None, receipt(),
             created + timedelta(minutes=rng.randint(0, 60 * 24 * 2) if i else 0)),
        )
    return issue


def event(issue, type, actor, summary, reasoning, at, log: list) -> None:
    db.execute(
        "INSERT INTO issue_events (issue_id, type, actor, summary, reasoning, created_at) VALUES (%s,%s,%s,%s,%s,%s)",
        (issue["id"], type, actor, summary, reasoning, at),
    )
    log.append((issue["id"], type, actor, summary, reasoning))


def promise(issue, dept, user, text, due, status="open", level=0, created=None, closed=None, depts=None):
    return db.fetchone(
        """INSERT INTO promises (issue_id, department_id, made_by, text, due_at, status, escalation_level,
                                 created_at, closed_at) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id""",
        (issue["id"], depts[dept], user, text, due, status, level, created or ago(7), closed),
    )


def main() -> None:
    reset = "--reset" in sys.argv
    push_meko = "--no-meko" not in sys.argv and meko.enabled()
    db.init(wait_seconds=60)
    if db.fetchone("SELECT 1 AS x FROM users LIMIT 1") and not reset:
        raise SystemExit("Database already has data. Use --reset to wipe and re-seed.")
    if reset:
        wipe()
    if not gemini.enabled():
        print("WARNING: no GEMINI_API_KEY, using mock embeddings. Re-seed with --reset after setting it.")

    depts, locs, staff, students = seed_people()
    estates, it_head = staff["estates@rezolv.demo"], staff["it@rezolv.demo"]
    k = dict(locs=locs, depts=depts, students=students)
    log: list = []  # events pushed to Meko for the demo issues

    # --- Past power cuts in Hostel B (so the root cause can be found) ---
    cuts = []
    for n, d in enumerate((28, 23, 17, 12, 7, 3), start=1):
        c = make_issue(code=f"RZV-20{n}", title="Power cut in Hostel B", category="electricity", loc="Hostel B",
                       dept="Estates · Electrical", status="resolved", created=ago(d), resolved=ago(d) + timedelta(hours=7),
                       n_reports=rng.randint(4, 9), first=rng.randrange(10, 40), texts=[("Bijli chali gayi hai", "Power has gone out", "hi")],
                       embed_text="Power cut in Hostel B, electricity is out", **k)
        event(c, "created", "clusterer", f"Created {c['code']}: Power cut in Hostel B", "Seeded history.", ago(d), [])
        promise(c, "Estates · Electrical", estates, "Restore power and check the transformer",
                ago(d) + timedelta(hours=12), "broken" if n == 4 else "kept", created=ago(d),
                closed=ago(d) + timedelta(hours=7), depts=depts)
        cuts.append(c)

    # --- Past resolved issues so the scorecard has a track record ---
    filler = [("IT Services", "internet", 11, 1, "Wi-Fi down in Academic Block {n}"),
              ("Estates · Plumbing", "water", 7, 5, "Water leak in Hostel {n}")]
    for dept, cat, kept, broken, title in filler:
        for i in range(kept + broken):
            loc = list(LOCATIONS)[i % 12]
            iss = make_issue(code=f"RZV-1{0 if cat == 'internet' else 5}{i:02d}", title=title.format(n=i + 1),
                             category=cat, loc=loc, dept=dept, status="resolved", created=ago(60 + i * 3),
                             resolved=ago(55 + i * 3), n_reports=1, first=rng.randrange(2, 50), texts=[("past issue", "past issue", "en")], **k)
            promise(iss, dept, estates if cat == "water" else it_head, "Fix the fault", ago(58 + i * 3),
                    "kept" if i < kept else "broken", created=ago(60 + i * 3), closed=ago(55 + i * 3), depts=depts)

    # --- RZV-209: Hostel B water, overdue promise, escalated to the Dean ---
    water_texts = [("Hostel B ki dusri manzil par subah se paani nahi aa raha", "No water on the second floor of Hostel B since morning", "hi"),
                   ("No water on 2nd floor, pump seems off", "No water on 2nd floor, pump seems off", "en"),
                   ("Paani nahi hai, bijli ke baad se", "There is no water, it started after the power cut", "hi")]
    i209 = make_issue(code="RZV-209", title="No water on upper floors in Hostel B", category="water", loc="Hostel B",
                      dept="Estates · Plumbing", status="in_progress", created=ago(5), n_reports=31, texts=water_texts,
                      embed_text="No water on the second floor of Hostel B", **k)
    event(i209, "classified", "intake", "Classified as water, severity 4/5", "Heard (hi): No water on the second floor of Hostel B since morning", ago(5), log)
    event(i209, "created", "clusterer", "Created RZV-209: No water on upper floors in Hostel B",
          "No open issue with the same category and location within the distance limit (none exist yet).", ago(5) + timedelta(seconds=2), log)
    event(i209, "routed", "router", "Routed to Estates · Plumbing",
          "Default routing for category 'water'. Meko memory: Hostel Office forwarded all water issues to Estates.", ago(5) + timedelta(seconds=4), log)
    event(i209, "root_cause", "root_cause", "Likely caused by RZV-206: Power cut in Hostel B",
          "Hostel B water outages began within hours of each of the last 6 power cuts (confidence 86%)", ago(5) + timedelta(seconds=6), log)
    p209 = promise(i209, "Estates · Plumbing", estates, "Fix pump wiring", ago(3), level=2, created=ago(4), depts=depts)
    event(i209, "promise_made", "Estates · Plumbing", "Estates · Plumbing promised: Fix pump wiring", None, ago(4), log)
    event(i209, "escalated", "promise_keeper", "Deadline missed, escalated to the Warden / Dept Head",
          "0 h overdue. Policy: level 1 at the deadline, level 2 after 24 more hours.", ago(3), log)
    event(i209, "escalated", "promise_keeper", "Deadline missed, escalated to the Dean",
          "24 h overdue. Policy: level 1 at the deadline, level 2 after 24 more hours.", ago(2), log)
    db.execute("INSERT INTO issue_links (cause_issue_id, effect_issue_id, reason, confidence) VALUES (%s,%s,%s,%s)",
               (cuts[-1]["id"], i209["id"],
                "Hostel B water outages began within hours of each of the last 6 power cuts, as the pump has no backup.", 0.86))

    # --- RZV-214: Hostel C WiFi, 47 reports, promise on track ---
    i214 = make_issue(code="RZV-214", title="Wi-Fi down in Hostel C", category="internet", loc="Hostel C",
                      dept="IT Services", status="in_progress", created=ago(4), n_reports=47,
                      texts=[("Hostel C mein WiFi kaam nahi kar raha", "Wi-Fi is not working in Hostel C", "hi"),
                             ("No internet since yesterday in Hostel C", "No internet since yesterday in Hostel C", "en")],
                      embed_text="Wi-Fi is not working in Hostel C", **k)
    event(i214, "created", "clusterer", "Created RZV-214: Wi-Fi down in Hostel C", "Seeded.", ago(4), log)
    event(i214, "routed", "router", "Routed to IT Services", "Default routing for category 'internet'.", ago(4), log)
    promise(i214, "IT Services", it_head, "Replace the faulty access-point switch", NOW + timedelta(days=2),
            created=ago(3), depts=depts)
    event(i214, "promise_made", "IT Services", "IT Services promised: Replace the faulty access-point switch", None, ago(3), log)

    # --- RZV-217: sealed, 4 of 5 ---
    i217 = make_issue(code="RZV-217", title="Sensitive concern at Girls Hostel", category="sensitive", loc="Girls Hostel",
                      dept=None, status="sealed", sensitive=True, threshold=5, created=ago(3), n_reports=4,
                      texts=[("Gate ke paas raat ko log pareshan karte hain", "People bother us near the gate at night", "hi")] * 4,
                      embed_text="People bother students near the hostel gate at night", **k)
    event(i217, "created", "clusterer", "Created RZV-217: Sensitive concern at Girls Hostel", "Seeded.", ago(3), log)
    event(i217, "sealed", "privacy_guardian", "Still sealed: 4 of 5 students",
          "Identity protection: staff see only a count until the threshold is reached.", ago(1), log)

    # --- RZV-219: awaiting confirmation, 3 of 8 yes ---
    i219 = make_issue(code="RZV-219", title="Flickering lights on Library third floor", category="electricity", loc="Library",
                      dept="Estates · Electrical", status="awaiting_confirm", created=ago(6), n_reports=8,
                      texts=[("Library ki teesri manzil ki lights jhilmil kar rahi hain", "Third floor library lights are flickering", "hi")],
                      embed_text="Library third floor lights are flickering", **k)
    event(i219, "created", "clusterer", "Created RZV-219: Flickering lights on Library third floor", "Seeded.", ago(6), log)
    event(i219, "routed", "router", "Routed to Estates · Electrical", "Default routing for category 'electricity'.", ago(6), log)
    promise(i219, "Estates · Electrical", estates, "Replace faulty tube lights", ago(1), created=ago(5), depts=depts)
    event(i219, "promise_made", "Estates · Electrical", "Estates · Electrical promised: Replace faulty tube lights", None, ago(5), log)
    event(i219, "fixed", "Estates · Electrical", "Estates · Electrical says it is fixed, waiting for students to confirm", None, ago(1), log)
    for pseudo in students[1:4]:
        db.execute("INSERT INTO confirmations (issue_id, pseudonym, answer) VALUES (%s,%s,'yes')", (i219["id"], pseudo))

    # --- RZV-221: mess hygiene ---
    i221 = make_issue(code="RZV-221", title="Hygiene problems in the main mess", category="food", loc="Mess",
                      dept="Mess & Catering", status="open", created=ago(2), n_reports=12,
                      texts=[("Mess mein safai ki bahut samasya hai", "The mess has serious hygiene problems", "hi"),
                             ("Found insects in the dal today", "Found insects in the dal today", "en")],
                      embed_text="The main mess has serious hygiene problems", **k)
    event(i221, "created", "clusterer", "Created RZV-221: Hygiene problems in the main mess", "Seeded.", ago(2), log)
    event(i221, "routed", "router", "Routed to Mess & Catering", "Default routing for category 'food'.", ago(2), log)

    print(f"Seeded {N_STUDENTS} students, {len(STAFF)} staff, {len(DEPARTMENTS)} departments, {len(LOCATIONS)} locations.")
    print("Demo issues: RZV-209 (water, escalated), 214 (wifi), 217 (sealed 4/5), 219 (awaiting confirm 3/8), 221 (mess).")

    if push_meko:
        print("Pushing demo traces and playbooks to Meko ...")
        for iid, type_, actor, summary, reasoning in log:
            trace.to_meko(iid, type_, actor, summary, reasoning)
        meko.memory_add("memory", "Water outage in Hostel A after a power cut was fixed by Estates · Plumbing: "
                                   "switch the water pump to the diesel generator backup.")
        meko.memory_add("router", "Hostel Office forwarded all water issues to Estates · Plumbing.")
    db.close()


if __name__ == "__main__":
    main()
