"""End-to-end check of the running API, as a student and as staff.

    python -m scripts.smoke_test [http://localhost:8000]

It files one typed report, so run it against demo data only.
"""
import json
import sys
import time
import urllib.error
import urllib.request

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000").rstrip("/")
PASSWORD = "rezolv123"
failed = 0


def call(method: str, path: str, body=None, token: str | None = None):
    req = urllib.request.Request(
        BASE + path,
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"content-type": "application/json", **({"authorization": f"Bearer {token}"} if token else {})},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, json.loads(r.read() or "null")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or "null")


def check(name: str, ok: bool, detail: str = "") -> None:
    global failed
    failed += not ok
    print(f"{'PASS' if ok else 'FAIL'}  {name}  {detail}")


def login(email: str) -> dict:
    code, data = call("POST", "/auth/login", {"email": email, "password": PASSWORD})
    check(f"login {email}", code == 200, data.get("role", "") if code == 200 else str(data))
    return data


# ---------- student ----------
phone = login("ananya.s@democampus.edu")
tok = phone["token"]
check("pseudonym is Student #4F2A", phone["pseudonym"] == "Student #4F2A")

code, mine = call("GET", "/reports/mine", token=tok)
check("my reports", code == 200 and len(mine) > 0, f"{len(mine)} reports")

code, near = call("GET", "/issues/nearby?lat=28.7326&lng=77.1189&radius_m=500", token=tok)
check("nearby issues", code == 200 and len(near) > 0, f"{len(near)} issues")
check("no sealed issue in nearby", all(i["status"] != "sealed" for i in near))

code, rep = call("POST", "/reports", {
    "text": "No water on the second floor of Hostel B since last night",
    "lat": 28.732783, "lng": 77.118477, "floor": "2nd", "is_sensitive": False,
}, tok)
check("create report", code == 201, rep.get("receipt_code", str(rep)))
if code == 201:
    for _ in range(30):  # pipeline runs in the background
        code, r = call("GET", f"/reports/{rep['report_id']}", token=tok)
        if code == 200 and not r["processing"]:
            break
        time.sleep(1)
    check("report joined an issue", code == 200 and not r["processing"], f"{r.get('code')} ({r.get('report_count')} reports)")

# ---------- staff ----------
dean = login("dean@rezolv.demo")["token"]
for path in ("/admin/overview", "/admin/issues", "/admin/sealed", "/admin/promises", "/admin/scorecard",
             "/admin/map", "/admin/root-causes", "/admin/agents/activity"):
    code, data = call("GET", path, token=dean)
    check(f"GET {path}", code == 200, f"{len(data)} items" if isinstance(data, list) else "")

code, _ = call("GET", "/admin/overview", token=tok)
check("student blocked from staff API", code == 403, str(code))

code, issues = call("GET", "/admin/issues", token=dean)
if code == 200 and issues:
    code, detail = call("GET", f"/admin/issues/{issues[0]['id']}", token=dean)
    check("issue detail", code == 200)
    check("staff view has no identity", "email" not in json.dumps(detail).lower())

print(f"\n{'ALL PASSED' if not failed else f'{failed} FAILED'}")
sys.exit(1 if failed else 0)
