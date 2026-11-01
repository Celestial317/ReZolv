# ReZolv: pitch content

One line: **students report campus problems in their own language, agents merge them and find the real cause, every promise has an owner and a deadline and escalates by itself, and an issue closes only when the students say it is fixed.**

Pilot campus: Shaheed Sukhdev College of Business Studies (SSCBS), Rohini, Delhi.

## 1. How big is the problem

### The scale of the audience
- India's All India Survey on Higher Education 2021-22 registered **1,168 universities, 45,473 colleges and 12,002 stand-alone institutions**.
- Total enrolment was about **4.33 crore students**, up from 4.14 crore a year earlier and 3.42 crore in 2014-15 (about 26.5% growth).
- More than **70% of students are enrolled in colleges**, not universities. These are exactly the institutions with a warden, a mess, a hostel and a single grievance box.

### Grievance channels already exist on paper, and are not trusted or used well
- The UGC (Redress of Grievances of Students) Regulations, 2023, notified on 11 April 2023, require **every higher education institution to set up a Students' Grievance Redressal Committee**, and every university to appoint an **ombudsperson** for appeals.
- Four months after UGC directed universities to appoint an ombudsperson, a Hindustan Times report found **72.7% had not complied**. UGC later set a 31 December 2023 deadline and said it would publish the names of defaulters. One Tribune report counted 159 state-run universities still without one.
- So the legal duty exists, the tooling to meet it is missing, and colleges need a way to show they act.

### Students do report, and the numbers are rising
- UGC's anti-ragging helpline received **582 complaints in 2021-22** and about **858 in 2022-23**, reported as a 47% rise. Another report counts **1,240 complaints between 1 January 2023 and 28 April 2024** (about 16 months).
- A Lok Sabha reply counted **2,790 ragging complaints since 2018**.
- The helpline only forwards a complaint to the concerned authority. After that, the student cannot see whether anything happens.

### The human cost
- The National Crime Records Bureau recorded **13,044 student suicides in 2022, 7.6% of all suicides in India**, after 13,089 in 2021.
- This figure is not caused by grievance handling, and we do not claim it is. We use it to show how much is at stake when students feel unheard, and why a channel that visibly responds matters.

### What the data does not show
There is **no national dataset of everyday campus facility complaints** (water, Wi-Fi, mess, lights). The figures above measure the audience, the legal duty and the most serious cases, not the daily volume. We do not invent that number. Our own pilot is how we measure it: reports per student per month, share merged as duplicates, promises kept, time to fix.

### Why now
- A statutory obligation (UGC 2023 regulations) with low compliance.
- Hindi-English code-mixed speech can now be understood by models such as Gemini, so "report in your own language" works without forms.
- Vector search inside a normal database (YugabyteDB with pgvector) makes duplicate detection cheap to run.

## 2. Novelty

1. **Root causes are measured, not guessed.** A time-lag test in SQL compares real issue timelines against 500 shuffled ones. In our demo data, 6 of 6 Hostel B power cuts were followed by a water outage within 48 hours, against about 15% by chance (p = 0.002). Only a pattern that passes goes to Gemini, which explains it in one sentence. The same pattern then drives forecasts from planned events.
2. **Every "Why?" is checked before it is shown.** Each agent decision cites evidence. A verifier recomputes the numbers from YugabyteDB. Claims it cannot confirm are labelled "unverified", never presented as fact.
3. **Students close issues, staff cannot.** Staff can only say "fixed". It closes when most reporters confirm. If a student says "still broken" after the deadline, the issue reopens and moves up one level (department, Warden, Dean) automatically.
4. **Duplicates merge across languages.** Hindi, English and Hinglish reports of the same problem become one issue, using embeddings of both the original text and its translation. On our 20-report labelled test set: 100% merge precision and recall.
5. **Escalations quote the college's own rules.** The three college PDFs (Code of Conduct, Hostel Bulletin, college knowledge base) sit in Meko's knowledge base. A passage is quoted only when Meko ranks it as relevant.
6. **The router learns from staff corrections**, saved to the database and to Meko memory, and the dashboard shows routing accuracy over time.
7. **Only measured numbers are shown.** Accuracy comes from a labelled test set we built, not from a general claim.

## 3. Features (what works today)

**Student app (Android, React Native)**
- Report by voice or text in Hindi, English or Hinglish, with an optional photo.
- Pin the exact spot on an OpenStreetMap map locked to the campus, and pick the floor.
- Receipt code, and a live note of how many others reported the same thing.
- Campus map of open issues, colored by category, with "Me too".
- My reports with a four-step progress bar (sent, routed, promised, fixed).
- Issue page: promise, lateness, who it is with now, the measured root cause, a timeline, and "Why?".
- Confirm the fix: yes, partly, still broken.
- Campus scorecard of promises kept per department.

**Staff dashboard (Next.js)**
- Three staff levels with their own queues: Facilities Head, Warden, Dean.
- Overview, issues with filters, promises board (overdue, due soon, waiting for students, on track, kept), campus map, scorecard.
- Issue page: set a promise, mark fixed, move to another department, timeline and "Why?" with verified / unverified tags.
- Root causes with the measured numbers, forecasts, and "Fix the cause, close them all".
- Agent activity and a flagged-reports list for suspected coordinated reports.
- Profile with password change.

**Agents (server)**
Intake (transcribe, translate, classify), clusterer, router, root-cause, memory (saves a playbook when an issue is fixed, suggests it for similar issues), promise keeper, fraud check, verifier.

**Built in the server, not on screen in the prototype**
Safe Voice for sensitive complaints (the student chooses how visible they are, a confidential officer, urgent override, anonymous chat), QR stickers on campus objects, and a Solana anchoring module that is switched off. We left these out of the screens on purpose, to keep the prototype simple.

## 4. Technology used

| Technology | What it does here |
|---|---|
| **YugabyteDB** | One database for everything: relational tables (issues, reports, promises), vector search (pgvector with the `ybhnsw` index) to merge duplicates by meaning, and time-series analysis for the root-cause test. A single query also joins places, issues, causes and nearest-meaning issues. |
| **Meko** | Shared memory for the agents: each issue's decisions are stored as a conversation (the "Why?" trail), playbooks and routing corrections go to memory, token use is tracked, and the three college PDFs are the knowledge base that escalations quote. |
| **Gemini** | Speech transcription, translation and classification (`gemini-3.5-flash-lite`), 768-dimension embeddings, one-sentence explanation of a measured cause. Calls are rate limited, cached and budgeted so the shared key never stops the demo. |
| **FastAPI (Python)** | The API and the background agents. |
| **Next.js** | Staff dashboard. |
| **React Native with Expo** | The Android student app. |
| **OpenStreetMap and Leaflet** | The campus map, locked to the college boundary. |
| **Docker** | Runs YugabyteDB. |
| Vultr | Object storage for voice and photos is supported; the demo stores files on the server disk. |

## 5. Impact

Honest framing: these are the outcomes ReZolv is built to move. We have not measured them yet. The pilot measures them.

- **Students:** a report that visibly goes somewhere. A receipt, a named owner, a deadline, and the right to say "still broken".
- **Administration:** thirty-one complaints become one issue with a cause and an owner, instead of thirty-one messages. Wardens and deans see only what has reached their level.
- **Accountability:** a public scorecard of promises kept per department. In our seed data IT Services keeps 92% of its promises, and the Estates departments less. That gap is the conversation the college needs to have.
- **Compliance:** every report, promise, escalation and student confirmation is a time-stamped record. That is the evidence trail a college needs to show it handles grievances under the UGC 2023 regulations.
- **Prevention:** forecasts turn a planned power cut into a warning before students lose water.

Pilot metrics we will report: reports per student per month, share of reports merged as duplicates, median time from report to first promise, share of promises kept, share of issues closed by student confirmation, escalations per month.

## 6. Target customers

1. **Primary: colleges and universities.** Buyer: the Dean of Students or Registrar. Users: students (reporters) and wardens, estates, IT and mess heads (resolvers). Start with a Delhi University college (SSCBS) and expand to other affiliated colleges.
2. **Secondary: institution groups and residential campuses** such as private universities and hostel operators, where facility complaints are daily.
3. **Later: regulators and state education departments** who want a view of grievance handling across many institutions.

The wedge is simple: a college that must run a grievance committee under the UGC regulations and has no tool beyond a paper box.

## 7. Revenue model

Assumptions, not facts. Prices are placeholders to test in the pilot.

- **Pilot (free, one semester):** one college, to measure the metrics in section 5.
- **Institution subscription, per enrolled student per year.** Illustrative: Rs 25 to Rs 40 per student per year. A college of 2,000 students pays Rs 50,000 to Rs 80,000 a year. No fee for students.
- **Compliance add-on:** exportable records of grievances, promises and escalations for the grievance committee and ombudsperson.
- **Group and state licences:** consolidated dashboards across many campuses.

Sizing, as arithmetic on the AISHE counts, with our assumed price: 4.33 crore enrolled students at Rs 30 would be about Rs 1,300 crore a year if every institution adopted. That is a ceiling, not a forecast. A realistic early target is a handful of Delhi University colleges, then a few percent of the 45,473 colleges.

Cost to serve is low: the heavy AI calls happen once per new issue (about two Gemini calls), duplicates and "me too" add none, and repeats reuse saved playbooks.

## 8. Roadmap

Safe Voice screens, QR stickers on water coolers and routers, push notifications, Hindi/Tamil/Odia app language, SSO with the college login, rulebook upload by the college, Vultr object storage and hosting, and optional Solana anchoring of report hashes.

## Sources
- AISHE 2021-22, Ministry of Education: [report PDF](https://education.gov.in/sites/upload_files/mhrd/files/statistics-new/AISHE%20Book_2021-22_4.pdf); coverage: [Free Press Journal](https://www.freepressjournal.in/education/aishe-report-survey-records-433-crore-enrolments-in-higher-education-in-india), [Business Standard](https://business-standard.com/india-news/enrolment-in-higher-education-reached-43-3-million-in-2021-22-report-124012700116_1.html).
- UGC anti-ragging helpline: [Free Press Journal, 2022-23](https://www.freepressjournal.in/education/ugc-data-reveals-rise-in-ragging-cases-across-india-in-202223), [Free Press Journal, 2023-24](https://www.freepressjournal.in/education/fpj-exclusive-45-rise-in-ragging-cases-in-202324-ugc-pledges-safe-learning-environment), [Careers360, since 2018](https://news.careers360.com/over-2700-complaints-of-ragging-in-higher-educational-institutions-received-2018-govt).
- Student suicides, NCRB data as reported in Parliament: [The Week / PTI](https://www.theweek.in/wire-updates/national/2025/07/21/del88-lsq-moe-student-suicides.html).
- UGC Redress of Grievances of Students Regulations 2023: [regulation text](https://thc.nic.in/Central%20Governmental%20Regulations/University%20Grant%20Commission%20(Redressal%20of%20Grievances%20of%20Students)%20Regulations,%202023.pdf), [Careers360 on ombudsperson deadlines](https://news.careers360.com/ugc-asks-universities-appoint-ombudspersons-will-publish-names-of-defaulters-after-deadline), [Tribune](https://www.tribuneindia.com/news/delhi/159-state-run-universities-yet-to-appoint-ombudsperson-university-grants-commission-600945), [Hindustan Times via Magzter](https://www.magzter.com/tr/stories/newspaper/Hindustan-Times/727-VARSITIES-YET-TO-APPOINT-OFFICER-FOR-GRIEVANCE-PANELS).

Figures were taken from news coverage of the official reports. Check the primary documents before quoting a number on stage.
