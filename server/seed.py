"""Seed the demo story from PLAN.md section 3.

    python seed.py            # refuses to run if data exists
    python seed.py --reset    # wipe everything, then seed
    python seed.py --no-meko  # skip pushing the demo traces / playbooks to Meko

Run it AFTER setting GEMINI_API_KEY: issue embeddings come from the same model the live clusterer uses,
otherwise new reports will not match the seeded issues. Embeddings are cached in .cache/, so re-seeding is free.

Logins (see README):
  students  ananya.s@democampus.edu (Student #4F2A), rahul.k@democampus.edu, meera.p@democampus.edu   password student123
  staff     facilities@rezolv.demo (level 0), warden@rezolv.demo (level 1), dean@rezolv.demo (level 2)   password staff123
The other 47 reporters in the stories are account-less pseudonyms, so the stories keep their real counts.

The root cause on RZV-209 is not hard-coded: the seed creates six Hostel B power cuts, each followed by a water
outage, and the real lag test (agents/root_cause.py) measures it.
"""
import json
import random
import sys
from datetime import datetime, timedelta, timezone

import auth
import db
import gemini
import meko
import rules
from agents import root_cause, router, trace, verifier

STUDENT_PASSWORD = "student123"
STAFF_PASSWORD = "staff123"
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

STAFF = [  # email, role, name, department. Level 0 answers first, level 1 at the deadline, level 2 24 h later.
    ("facilities@rezolv.demo", "dept_head", "Facilities Head", None),
    ("warden@rezolv.demo", "warden", "Chief Warden", None),
    ("dean@rezolv.demo", "dean", "Dean of Students", None),
]

STUDENT_LOGINS = ["ananya.s@democampus.edu", "rahul.k@democampus.edu", "meera.p@democampus.edu"]

N_STUDENTS = 50


def wipe() -> None:
    db.execute(
        "TRUNCATE assets, anchors, safe_messages, routing_corrections, campus_calendar, issue_links, issue_events, "
        "confirmations, promises, reports, issues, locations, student_profiles, users, departments CASCADE"
    )
    db.execute("ALTER SEQUENCE issue_code_seq RESTART WITH 300")


def seed_people() -> tuple[dict, dict, dict, list]:
    staff_pw, student_pw = auth.hash_password(STAFF_PASSWORD), auth.hash_password(STUDENT_PASSWORD)  # bcrypt is slow
    depts = {n: db.fetchone("INSERT INTO departments (name, categories) VALUES (%s,%s) RETURNING id",
                            (n, c))["id"] for n, c in DEPARTMENTS.items()}
    locs = {n: db.fetchone("INSERT INTO locations (name, lat, lng) VALUES (%s,%s,%s) RETURNING id",
                           (n, *ll))["id"] for n, ll in LOCATIONS.items()}
    staff = {}
    for email, role, name, dept in STAFF:
        staff[email] = db.fetchone(
            "INSERT INTO users (email, password_hash, role, name, department_id) VALUES (%s,%s,%s,%s,%s) RETURNING id",
            (email, staff_pw, role, name, depts[dept] if dept else None))["id"]
    students = []
    for i in range(N_STUDENTS):
        pseudo = "Student #4F2A" if i == 0 else f"Student #{rng.randrange(16**4):04X}"
        while i > 0 and (pseudo in students or pseudo == "Student #4F2A"):
            pseudo = f"Student #{rng.randrange(16**4):04X}"
        students.append(pseudo)
        if i < len(STUDENT_LOGINS):  # only three students can log in; the rest are pseudonyms in the stories
            uid = db.fetchone("INSERT INTO users (email, password_hash, role) VALUES (%s,%s,'student') RETURNING id",
                              (STUDENT_LOGINS[i], student_pw))["id"]
            db.execute("INSERT INTO student_profiles (user_id, pseudonym) VALUES (%s,%s)", (uid, pseudo))
    return depts, locs, staff, students


def make_issue(*, code, title, category, loc, dept, status, created, locs, depts, students,
               n_reports, texts, sensitive=False, threshold=5, resolved=None, embed_text=None,
               suggested_fix=None, first=0, handling=None, officer=None, urgent=False, asset=None) -> dict:
    emb = db.vec(gemini.embed(embed_text or title))
    issue = db.fetchone(
        """INSERT INTO issues (code, title, category, location_id, department_id, status, is_sensitive,
                               release_threshold, report_count, impact_score, embedding, suggested_fix,
                               created_at, resolved_at, handling, officer_id, urgent, asset_id)
           VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s::vector,%s,%s,%s,%s,%s,%s,%s) RETURNING id, code""",
        (code, title, category, locs[loc], depts[dept] if dept else None, status, sensitive, threshold,
         n_reports, min(100, n_reports * 3 + 3 * 8), emb, suggested_fix, created, resolved, handling,
         officer, urgent, asset),
    )
    lat, lng = LOCATIONS[loc]
    for i in range(n_reports):
        first_few = i < len(texts)
        db.execute(
            """INSERT INTO reports (issue_id, pseudonym, kind, text_original, text_en, lang, category, severity,
                                    is_sensitive, location_id, lat, lng, embedding, receipt_code, created_at, handling)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s::vector,%s,%s,%s)""",
            (issue["id"], students[(first + i) % len(students)], "report" if first_few else "me_too",
             texts[i][0] if first_few else None, texts[i][1] if first_few else None,
             texts[i][2] if first_few else None, category, 3, sensitive, locs[loc],
             lat + rng.uniform(-0.00005, 0.00005), lng + rng.uniform(-0.00005, 0.00005),
             emb if first_few else None, receipt(),
             created + timedelta(minutes=rng.randint(0, 60 * 24 * 2) if i else 0), handling),
        )
    return issue


def event(issue, type, actor, summary, reasoning, at, log: list, evidence=None) -> None:
    row = db.fetchone(
        """INSERT INTO issue_events (issue_id, type, actor, summary, reasoning, created_at, evidence)
           VALUES (%s,%s,%s,%s,%s,%s,%s::jsonb) RETURNING id""",
        (issue["id"], type, actor, summary, reasoning, at, json.dumps(evidence) if evidence else None),
    )
    if evidence:
        verifier.verify_event(row["id"])
    log.append((issue["id"], type, actor, summary, reasoning))


def first_report(issue) -> dict:
    return {"type": "report", "id": str(db.fetchone(
        "SELECT id FROM reports WHERE issue_id=%s ORDER BY created_at LIMIT 1", (issue["id"],))["id"])}


def routed(issue, category: str, dept: str, depts: dict, at, log: list) -> None:
    """A routed event whose track record is computed from the database, so the verifier can check it."""
    fixed, total = router.dept_stats(category, depts[dept], issue["id"])
    why = f"Default routing for category '{category}'."
    evidence = []
    if total:
        why += f" Track record: {fixed} of {total} past {category} issues sent to {dept} were fixed."
        evidence.append({"type": "routing_stat", "department": dept, "category": category,
                         "fixed": fixed, "total": total})
    event(issue, "routed", "router", f"Routed to {dept}", why, at, log, evidence or None)


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
    estates = it_head = staff["facilities@rezolv.demo"]
    k = dict(locs=locs, depts=depts, students=students)
    log: list = []  # events pushed to Meko for the demo issues

    # --- Hostel B: six power cuts, each followed by a water outage a few hours later ---
    # (the sixth is RZV-209 itself). The lag test measures this; nothing here says "cause".
    cut_days = (28, 23, 17, 12, 8, 5.3)
    for n, d in enumerate(cut_days, start=1):
        c = make_issue(code=f"RZV-20{n}", title="Power cut in Hostel B", category="electricity", loc="Hostel B",
                       dept="Estates · Electrical", status="resolved", created=ago(d), resolved=ago(d) + timedelta(hours=7),
                       n_reports=rng.randint(4, 9), first=rng.randrange(10, 40),
                       texts=[("Bijli chali gayi hai", "Power has gone out", "hi")],
                       embed_text="Power cut in Hostel B, electricity is out", **k)
        event(c, "created", "clusterer", f"Created {c['code']}: Power cut in Hostel B", "Seeded history.", ago(d), [])
        promise(c, "Estates · Electrical", estates, "Restore power and check the transformer",
                ago(d) + timedelta(hours=12), "broken" if n == 4 else "kept", created=ago(d),
                closed=ago(d) + timedelta(hours=7), depts=depts)
        if n < len(cut_days):  # the outage that followed (the last one is RZV-209, created below)
            made = ago(d) + timedelta(hours=6)
            w = make_issue(code=f"RZV-24{n}", title="No water in Hostel B", category="water", loc="Hostel B",
                           dept="Estates · Plumbing", status="resolved", created=made,
                           resolved=made + timedelta(hours=24), n_reports=rng.randint(3, 8),
                           first=rng.randrange(10, 40),
                           texts=[("Paani nahi aa raha", "No water is coming", "hi")],
                           embed_text="No water on the upper floors of Hostel B", **k)
            promise(w, "Estates · Plumbing", estates, "Restart the pump", made + timedelta(hours=18),
                    "kept", created=made, closed=made + timedelta(hours=24), depts=depts)

    # --- Past resolved issues so the scorecard has a track record ---
    filler = [("IT Services", "internet", 11, 1, "Wi-Fi down in Academic Block {n}"),
              ("Estates · Plumbing", "water", 7, 5, "Water leak in Hostel {n}")]
    for dept, cat, kept, broken, title in filler:
        for i in range(kept + broken):
            loc = list(LOCATIONS)[i % 12]
            iss = make_issue(code=f"RZV-1{0 if cat == 'internet' else 5}{i:02d}", title=title.format(n=i + 1),
                             category=cat, loc=loc, dept=dept, status="resolved", created=ago(60 + i * 3),
                             resolved=ago(55 + i * 3), n_reports=1, first=rng.randrange(2, 50),
                             texts=[("past issue", "past issue", "en")], **k)
            promise(iss, dept, estates if cat == "water" else it_head, "Fix the fault", ago(58 + i * 3),
                    "kept" if i < kept else "broken", created=ago(60 + i * 3), closed=ago(55 + i * 3), depts=depts)

    # --- RZV-209: Hostel B water, overdue promise, escalated to the Dean ---
    water_texts = [("Hostel B ki dusri manzil par subah se paani nahi aa raha", "No water on the second floor of Hostel B since morning", "hi"),
                   ("No water on 2nd floor, pump seems off", "No water on 2nd floor, pump seems off", "en"),
                   ("Paani nahi hai, bijli ke baad se", "There is no water, it started after the power cut", "hi")]
    i209 = make_issue(code="RZV-209", title="No water on upper floors in Hostel B", category="water", loc="Hostel B",
                      dept="Estates · Plumbing", status="in_progress", created=ago(5), n_reports=31, texts=water_texts,
                      embed_text="No water on the second floor of Hostel B", **k)
    r209 = first_report(i209)
    event(i209, "classified", "intake", "Classified as water, severity 4/5",
          "Heard (hi): No water on the second floor of Hostel B since morning", ago(5), log, [r209])
    event(i209, "created", "clusterer", "Created RZV-209: No water on upper floors in Hostel B",
          "No open issue with the same category and location within the distance limit (none exist yet).",
          ago(5) + timedelta(seconds=2), log, [r209])
    routed(i209, "water", "Estates · Plumbing", depts, ago(5) + timedelta(seconds=4), log)
    p209 = promise(i209, "Estates · Plumbing", estates, "Fix pump wiring", ago(3), level=2, created=ago(4), depts=depts)
    event(i209, "promise_made", "Estates · Plumbing", "Estates · Plumbing promised: Fix pump wiring", None, ago(4), log)
    quotes = [q for q in (rules.for_category("water"), rules.escalation_rule()) if q]
    for hrs, who, at in ((0, "the Warden / Dept Head", ago(3)), (24, "the Dean", ago(2))):
        event(i209, "escalated", "promise_keeper", f"Deadline missed, escalated to {who}",
              f"{hrs} h overdue. Policy: level 1 at the deadline, level 2 after 24 more hours."
              + "".join(f" College rule: {q['text']}" for q in quotes),
              at, log, [{"type": "promise", "id": str(p209["id"]), "hours_late": hrs}]
              + [{"type": "kb", "chunk_id": q["chunk_id"], "query": q["query"]} for q in quotes])

    # --- RZV-214: Hostel C WiFi, 47 reports, promise on track ---
    i214 = make_issue(code="RZV-214", title="Wi-Fi down in Hostel C", category="internet", loc="Hostel C",
                      dept="IT Services", status="in_progress", created=ago(4), n_reports=47,
                      texts=[("Hostel C mein WiFi kaam nahi kar raha", "Wi-Fi is not working in Hostel C", "hi"),
                             ("No internet since yesterday in Hostel C", "No internet since yesterday in Hostel C", "en")],
                      embed_text="Wi-Fi is not working in Hostel C", **k)
    event(i214, "created", "clusterer", "Created RZV-214: Wi-Fi down in Hostel C", "Seeded.", ago(4), log, [first_report(i214)])
    routed(i214, "internet", "IT Services", depts, ago(4), log)
    promise(i214, "IT Services", it_head, "Replace the faulty access-point switch", NOW + timedelta(days=2),
            created=ago(3), depts=depts)
    event(i214, "promise_made", "IT Services", "IT Services promised: Replace the faulty access-point switch", None, ago(3), log)

    # --- RZV-217: Safe Voice, "wait for others", 4 of 5 students so far ---
    make_issue(code="RZV-217", title="Sensitive concern at Girls Hostel", category="sensitive", loc="Girls Hostel",
               dept=None, status="sealed", sensitive=True, threshold=5, created=ago(3), n_reports=4,
               handling="wait", texts=[("Gate ke paas raat ko log pareshan karte hain", "People bother us near the gate at night", "hi")] * 4,
               embed_text="People bother students near the hostel gate at night", **k)

    # --- RZV-231: Safe Voice, "talk to someone now", with the officer already in conversation ---
    officer = None  # no officer account in the prototype: Safe Voice has no screens
    i231 = make_issue(code="RZV-231", title="Sensitive concern at Library", category="sensitive", loc="Library",
                      dept=None, status="sealed", sensitive=True, created=ago(1), n_reports=2, first=5,
                      handling="now", officer=officer,
                      texts=[("Library mein ek senior baar baar peecha karta hai", "A senior keeps following me in the library", "hi")] * 2,
                      embed_text="A senior keeps following students in the library", **k)
    who = students[5]
    for from_role, text, at in (
        ("officer", "Thank you for telling me. You are not in trouble. Did this happen more than once?", ago(0, 20)),
        ("student", "Yes, three times this week, always after 6 pm.", ago(0, 18)),
        ("officer", "I understand. I will talk to the library staff about the evening hours. You do not need to say who you are.", ago(0, 17)),
    ):
        db.execute("INSERT INTO safe_messages (issue_id, pseudonym, from_role, text, created_at) VALUES (%s,%s,%s,%s,%s)",
                   (i231["id"], who, from_role, text, at))
    event(i231, "officer_assigned", "privacy_guardian", "Sent to the confidential officer",
          "The student chose to talk to someone now.", ago(1), [], [first_report(i231)])

    # --- RZV-219: awaiting confirmation, 3 of 8 yes ---
    i219 = make_issue(code="RZV-219", title="Flickering lights on Library third floor", category="electricity", loc="Library",
                      dept="Estates · Electrical", status="awaiting_confirm", created=ago(6), n_reports=8,
                      texts=[("Library ki teesri manzil ki lights jhilmil kar rahi hain", "Third floor library lights are flickering", "hi")],
                      embed_text="Library third floor lights are flickering", **k)
    event(i219, "created", "clusterer", "Created RZV-219: Flickering lights on Library third floor", "Seeded.", ago(6), log, [first_report(i219)])
    routed(i219, "electricity", "Estates · Electrical", depts, ago(6), log)
    promise(i219, "Estates · Electrical", estates, "Replace faulty tube lights", ago(1), created=ago(5), depts=depts)
    event(i219, "promise_made", "Estates · Electrical", "Estates · Electrical promised: Replace faulty tube lights", None, ago(5), log)
    event(i219, "fixed", "Estates · Electrical", "Estates · Electrical says it is fixed, waiting for students to confirm", None, ago(1), log)
    for pseudo in students[3:6]:  # the three demo students have not answered yet
        db.execute("INSERT INTO confirmations (issue_id, pseudonym, answer) VALUES (%s,%s,'yes')", (i219["id"], pseudo))

    # --- RZV-226: street lights, promise missed yesterday, now with the Warden (level 1) ---
    i226 = make_issue(code="RZV-226", title="Street lights out on the sports ground path", category="electricity",
                      loc="Sports Ground", dept="Estates · Electrical", status="in_progress", created=ago(3), n_reports=12,
                      first=2, texts=[("Sports ground ke raste ki lights band hain", "The lights on the sports ground path are off", "hi"),
                                      ("Street lights are out near the sports ground, it is dark at night", "Street lights are out near the sports ground, it is dark at night", "en")],
                      embed_text="Street lights are out on the sports ground path", **k)
    event(i226, "created", "clusterer", "Created RZV-226: Street lights out on the sports ground path", "Seeded.", ago(3), log, [first_report(i226)])
    routed(i226, "electricity", "Estates · Electrical", depts, ago(3), log)
    p226 = promise(i226, "Estates · Electrical", estates, "Replace the street lamps", ago(0, 3), level=1, created=ago(2.5), depts=depts)
    event(i226, "promise_made", "Estates · Electrical", "Estates · Electrical promised: Replace the street lamps", None, ago(2.5), log)
    q = rules.for_category("electricity")
    event(i226, "escalated", "promise_keeper", "Deadline missed, escalated to the Warden / Dept Head",
          "3 h overdue. Policy: level 1 at the deadline, level 2 after 24 more hours."
          + (f" College rule: {q['text']}" if q else ""),
          ago(0, 3), log, [{"type": "promise", "id": str(p226["id"]), "hours_late": 3}]
          + ([{"type": "kb", "chunk_id": q["chunk_id"], "query": q["query"]}] if q else []))

    # --- RZV-221: mess hygiene ---
    i221 = make_issue(code="RZV-221", title="Hygiene problems in the main mess", category="food", loc="Mess",
                      dept="Mess & Catering", status="open", created=ago(2), n_reports=12,
                      texts=[("Mess mein safai ki bahut samasya hai", "The mess has serious hygiene problems", "hi"),
                             ("Found insects in the dal today", "Found insects in the dal today", "en")],
                      embed_text="The main mess has serious hygiene problems", **k)
    event(i221, "created", "clusterer", "Created RZV-221: Hygiene problems in the main mess", "Seeded.", ago(2), log, [first_report(i221)])
    routed(i221, "food", "Mess & Catering", depts, ago(2), log)

    # --- the real lag test over the seeded history (this is what produces the root-cause alert) ---
    root_cause.run(i209["id"])
    db.execute("UPDATE issue_events SET created_at=%s WHERE issue_id=%s AND type='root_cause'",
               (ago(5) + timedelta(seconds=6), i209["id"]))

    # --- a planned power cut: the forecast reads this against the measured pattern ---
    db.execute("INSERT INTO campus_calendar (location_id, kind, note, starts_at) VALUES (%s,'electricity',%s,%s)",
               (locs["Hostel B"], "Planned transformer maintenance", NOW + timedelta(days=2, hours=4)))

    link = db.fetchone("SELECT hits, trials, ROUND(100 * baseline_rate) AS base FROM issue_links WHERE hits IS NOT NULL LIMIT 1")
    print(f"Seeded {len(STUDENT_LOGINS)} student logins ({N_STUDENTS} reporters), {len(STAFF)} staff logins, "
          f"{len(DEPARTMENTS)} departments, {len(LOCATIONS)} locations.")
    print("Stories: RZV-209 (with the Dean), 226 (with the Warden), 214 (wifi), 219 (waiting for students), 221 (mess); "
          "217 and 231 are older sensitive cases kept in the database.")
    if link:
        print(f"Measured root cause: {link['hits']} of {link['trials']} Hostel B power cuts were followed by a water outage "
              f"within 48 h (chance: about {link['base']}%).")
    else:
        print("Root-cause test did not find a pattern in the seed data.")

    if push_meko:
        print("Pushing demo traces and playbooks to Meko ...")
        for iid, type_, actor, summary, reasoning in log:
            trace.to_meko(iid, type_, actor, summary, reasoning)
        meko.memory_add("memory", "Water outage in Hostel A after a power cut was fixed by Estates · Plumbing in 2 days: "
                                   "switch the water pump to the diesel generator backup.")
        meko.memory_add("router", "Hostel Office forwarded all water issues to Estates · Plumbing.")
    db.close()


if __name__ == "__main__":
    main()
