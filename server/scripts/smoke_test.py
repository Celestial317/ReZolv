"""End-to-end check of the running API as the three students and the three staff levels.

    python -m scripts.smoke_test [http://localhost:8000]

It files a report, moves RZV-219 up an escalation level and changes one password back and forth, so run it on
demo data and re-seed afterwards (python seed.py --reset --no-meko). A new report costs about 2 Gemini calls.
"""
import json
import struct
import sys
import time
import urllib.error
import urllib.request
import wave
from io import BytesIO

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000").rstrip("/")
failed = 0


def call(method: str, path: str, body=None, token: str | None = None, raw: bytes | None = None, ctype: str | None = None):
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    req = urllib.request.Request(
        BASE + path, method=method, data=data,
        headers={"content-type": ctype or "application/json", **({"authorization": f"Bearer {token}"} if token else {})},
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            blob = r.read()
            try:
                return r.status, json.loads(blob or "null")
            except ValueError:
                return r.status, blob
    except urllib.error.HTTPError as e:
        blob = e.read()
        try:
            return e.code, json.loads(blob or "null")
        except ValueError:
            return e.code, blob


def check(name: str, ok: bool, detail: str = "") -> None:
    global failed
    failed += not ok
    print(f"{'PASS' if ok else 'FAIL'}  {name}  {detail}")


def login(email: str, password: str) -> dict:
    code, data = call("POST", "/auth/login", {"email": email, "password": password})
    check(f"login {email}", code == 200, data.get("role", "") if code == 200 else str(data))
    return data


# ---------- students ----------
ananya = login("ananya.s@democampus.edu", "student123")
tok = ananya["token"]
check("pseudonym is Student #4F2A", ananya["pseudonym"] == "Student #4F2A")
login("rahul.k@democampus.edu", "student123")
login("meera.p@democampus.edu", "student123")
code, _ = call("POST", "/auth/login", {"email": "student02@campus.demo", "password": "rezolv123"})
check("old seed accounts are gone", code == 401, str(code))

code, me = call("GET", "/me", token=tok)
check("profile counts", code == 200 and me["reports"] > 0, f"{me.get('reports')} reports, {me.get('fixed')} fixed")
code, sc = call("GET", "/scorecard", token=tok)
check("scorecard for students", code == 200 and len(sc) >= 2, ", ".join(f"{d['name']} {d['kept_pct']}%" for d in sc[:3]))
code, near = call("GET", "/issues/nearby?lat=28.7326&lng=77.1189&radius_m=500", token=tok)
check("nearby issues", code == 200 and len(near) > 0, f"{len(near)} issues")
code, places = call("GET", "/locations", token=tok)
hostel_b = next(p for p in places if p["name"] == "Hostel B")

code, rep = call("POST", "/reports", {"text": "Hostel B mein dusri manzil par paani nahi aa raha, pump band lagta hai",
                                      "location_id": hostel_b["id"], "floor": "2nd"}, tok)
check("report from a location id", code == 201, rep.get("receipt_code", str(rep)))
r = {}
for _ in range(40):
    code, r = call("GET", f"/reports/{rep['report_id']}", token=tok)
    if code == 200 and not r["processing"]:
        break
    time.sleep(1.5)
check("Hinglish report joined the water issue", r.get("code") == "RZV-209", f"{r.get('code')} ({r.get('report_count')} reports)")

# voice upload without object storage (a second of silence is enough to test the plumbing)
buf = BytesIO()
with wave.open(buf, "wb") as w:
    w.setnchannels(1), w.setsampwidth(2), w.setframerate(16000)
    w.writeframes(struct.pack("<h", 0) * 16000)
code, up = call("POST", "/uploads/media?kind=voice", token=tok, raw=buf.getvalue(), ctype="audio/wav")
check("voice upload", code == 200 and up["key"].startswith(("local/", "rezolv-voice/")), up.get("key", str(up)) if code == 200 else str(up))

code, detail = call("GET", f"/issues/{r['issue_id']}", token=tok)
check("'Why?' carries a verification label", code == 200 and all("verification" in e for e in detail["events"]),
      ", ".join(sorted({e["verification"] for e in detail["events"]})))

# ---------- escalation: a student says "still not fixed" after the deadline ----------
code, awaiting = call("GET", "/issues/awaiting", token=tok)
i219 = next((i for i in awaiting if i["code"] == "RZV-219"), None)
check("RZV-219 waits for my answer", i219 is not None, f"{len(awaiting)} issue(s)")

warden = login("warden@rezolv.demo", "staff123")["token"]
dean = login("dean@rezolv.demo", "staff123")["token"]
facilities = login("facilities@rezolv.demo", "staff123")["token"]
code, w0 = call("GET", "/admin/escalations", token=warden)
code, d0 = call("GET", "/admin/escalations", token=dean)
check("Warden queue (level 1) has RZV-226", any(i["code"] == "RZV-226" for i in w0["issues"]), str([i["code"] for i in w0["issues"]]))
check("Dean queue (level 2) has RZV-209", any(i["code"] == "RZV-209" for i in d0["issues"]), str([i["code"] for i in d0["issues"]]))
check("RZV-219 is not escalated yet", not any(i["code"] == "RZV-219" for i in w0["issues"]))

if i219:
    code, res = call("POST", f"/issues/{i219['id']}/confirm", {"answer": "no", "note": "Still flickering"}, tok)
    check("'Still broken' after the deadline escalates", code == 200 and res["outcome"] == "escalated", str(res))
    code, w1 = call("GET", "/admin/escalations", token=warden)
    check("RZV-219 now sits in the Warden's queue", any(i["code"] == "RZV-219" for i in w1["issues"]))
    code, ev = call("GET", f"/admin/issues/{i219['id']}", token=warden)
    last = [e for e in ev["events"] if e["type"] == "escalated"][-1]
    check("escalation event quotes the college rules", "College rule" in (last["reasoning"] or ""), last["summary"])
    code, _ = call("POST", f"/issues/{i219['id']}/confirm", {"answer": "no"}, tok)
    check("cannot answer again until staff claim a new fix", code == 409, str(code))

# ---------- staff ----------
for path in ("/admin/overview", "/admin/issues", "/admin/promises", "/admin/scorecard", "/admin/map", "/admin/root-causes",
             "/admin/agents/activity", "/admin/forecasts", "/admin/campus-graph", "/admin/verification-stats",
             "/admin/routing-accuracy", "/admin/departments", "/admin/escalations"):
    code, data = call("GET", path, token=facilities)
    check(f"GET {path}", code == 200, f"{len(data)} items" if isinstance(data, list) else "")
code, ov = call("GET", "/admin/overview", token=dean)
check("overview shows the dean's queue size", ov["tiles"]["escalated_to_me"] >= 1, str(ov["tiles"]["escalated_to_me"]))
code, issues = call("GET", "/admin/issues", token=warden)
check("no sensitive issue in the staff list", all("Sensitive" not in i["title"] for i in issues))
code, _ = call("GET", "/admin/overview", token=tok)
check("student blocked from staff API", code == 403, str(code))

code, rc = call("GET", "/admin/root-causes", token=dean)
stat = next((x for x in rc if x.get("trials")), None)
check("root cause has measured numbers", bool(stat), f"{stat['hits']} of {stat['trials']} vs {stat['baseline_rate']:.0%} chance" if stat else "")
code, vs = call("GET", "/admin/verification-stats", token=dean)
check("claims were checked against the data", vs["verified"] > 0, f"{vs['verified']} verified, {vs['contradicted']} contradicted, {vs['unverified']} unverified")

# staff mark the escalated issue fixed again: students get a fresh round of confirmations
if i219:
    code, _ = call("POST", f"/admin/issues/{i219['id']}/fixed", token=warden)
    check("Warden marks RZV-219 fixed again", code == 200, str(code))
    code, awaiting = call("GET", "/issues/awaiting", token=tok)
    check("students are asked again", any(i["code"] == "RZV-219" for i in awaiting))

# profile + password
code, prof = call("GET", "/auth/me", token=warden)
check("staff profile", code == 200 and prof["role"] == "warden", prof.get("name", ""))
code, _ = call("POST", "/auth/password", {"current": "staff123", "new": "staff12345"}, warden)
check("change password", code == 200)
code, _ = call("POST", "/auth/login", {"email": "warden@rezolv.demo", "password": "staff12345"})
check("new password works", code == 200)
code, _ = call("POST", "/auth/password", {"current": "staff12345", "new": "staff123"}, call("POST", "/auth/login", {"email": "warden@rezolv.demo", "password": "staff12345"})[1]["token"])
check("password restored", code == 200)

print(f"\n{'ALL PASSED' if not failed else f'{failed} FAILED'}")
sys.exit(1 if failed else 0)
