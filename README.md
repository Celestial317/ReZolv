# ReZolv

Students report campus problems by voice or text. Agents merge duplicates, find root causes, route issues, and track every promise until the students confirm the fix. Demo campus: Shaheed Sukhdev College of Business Studies, Rohini, Delhi..

| Folder | What | Port |
|---|---|---|
| `server/` | FastAPI, agents, YugabyteDB access | 8000 |
| `dashboard/` | Staff dashboard (Next.js) | 3001 |
| `mobileApp/` | Student app (React Native, Expo) | none, installed on the phone |
| Docker | YugabyteDB | 5433 (SQL), 15433 (web console) |

## Start everything (Windows)
```
powershell -ExecutionPolicy Bypass -File server\start_lan.ps1     # database + API
cd dashboard && npm install && npm run dev                        # dashboard on http://localhost:3001
```
The server prints its Wi-Fi address (for example `http://192.168.1.236:8000`). Windows blocks incoming connections until the ports are allowed once. Run this in an **administrator** PowerShell:
```
New-NetFirewallRule -DisplayName "ReZolv" -Direction Inbound -Protocol TCP -LocalPort 8000,3001,5433,15433 -Action Allow -Profile Private
```
The dashboard talks to the API through its own `/api` proxy. Set `API_URL` if the API is not on the same machine.

## Logins
| Who | Email | Password |
|---|---|---|
| Student, Student #4F2A | `ananya.s@democampus.edu` | `student123` |
| Student | `rahul.k@democampus.edu` | `student123` |
| Student | `meera.p@democampus.edu` | `student123` |
| Facilities Head, escalation level 1 | `facilities@rezolv.demo` | `staff123` |
| Warden, level 2 | `warden@rezolv.demo` | `staff123` |
| Dean, level 3 | `dean@rezolv.demo` | `staff123` |

A promise starts with the department, moves to the Warden at its deadline, and to the Dean 24 hours later. It also moves up one level when a student answers "Still broken" after the deadline. RZV-209 is with the Dean, RZV-226 with the Warden, and RZV-219 waits for a student: log in as a student, answer "Still broken", then check the Warden's Escalations page.

## Student app (Expo)
```
cd mobileApp
npm install
npx expo start --lan        # quick test in Expo Go on the same Wi-Fi
```
Build an installable APK (needs a free Expo account):
```
npx eas-cli@latest login
npx eas-cli@latest build -p android --profile preview
```
`eas.json` bakes in the server address `http://192.168.1.236:8000`. If your laptop's address changes, edit `EXPO_PUBLIC_API_URL` there before building, or change the address inside the app (login screen or Profile). The phone and the laptop must be on the same Wi-Fi.

## Database access
YugabyteDB runs in Docker (`docker compose up -d yugabytedb`).

| | |
|---|---|
| Host | `192.168.1.236` (or `localhost` on this machine) |
| Port | `5433` (YSQL, PostgreSQL compatible) |
| Database | `yugabyte` |
| User / password | `yugabyte` / `yugabyte` |
| Connection string | `postgresql://yugabyte:yugabyte@192.168.1.236:5433/yugabyte` |
| Web console | `http://192.168.1.236:15433` |

Use any PostgreSQL client (DBeaver, pgAdmin, `psql`). Useful tables: `issues`, `reports`, `promises`, `issue_events`, `issue_links`, `confirmations`. Student reports store only a pseudonym, never a user id.

## More
`server/README.md` has the API, the agents and the measured-numbers rules. `PLAN.md` and `features.md` describe the product.
