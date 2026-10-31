// Demo data for the dashboard UI. Shapes follow the /admin/* responses in
// server/routes/admin.py, plus a few display fields (labels the API will compute later).

export type IssueStatus = "sealed" | "open" | "in_progress" | "awaiting_confirm" | "resolved";
export type Tone = "red" | "orange" | "amber" | "green" | "purple" | "teal" | "blue" | "gray";

export type Issue = {
  code: string;
  title: string;
  category: string;
  location: string;
  where: string;          // location line under the title
  age: string;            // "5 days", "3 h"
  department: string;
  status: IssueStatus;
  report_count: number;
  impact_score: number;
  is_new?: boolean;
  escalation_level?: number;
  promise: { label: string; tone: Tone; progress: number; overdue?: boolean } | null;
  link_note?: string;     // overview: "linked to Pump House power"
};

export const NOW_LABEL = "Saturday, 31 October";
export const CAMPUS = "Demo Campus";
export const STAFF_USER = { name: "Dr. Kavita Rao", short: "Dr. Rao", initials: "KR", role: "Dean of Students" };

export const ISSUES: Issue[] = [
  { code: "RZV-214", title: "WiFi down across the block", category: "Internet", location: "Hostel C · Girls", where: "Hostel C", age: "opened 6 h ago",
    department: "IT Services", status: "open", report_count: 47, impact_score: 92, is_new: true,
    promise: { label: "Due 6 PM today", tone: "orange", progress: 0.8 } },
  { code: "RZV-209", title: "No water on 2nd and 3rd floor", category: "Water", location: "Hostel B · Boys", where: "Hostel B", age: "5 days",
    department: "Estates · Plumbing", status: "in_progress", report_count: 31, impact_score: 88, escalation_level: 2,
    promise: { label: "3 days late", tone: "red", progress: 1, overdue: true }, link_note: "linked to Pump House power" },
  { code: "RZV-221", title: "Mess food hygiene, cockroaches", category: "Food", location: "Mess & Canteen", where: "Mess", age: "2 days",
    department: "Mess Committee", status: "in_progress", report_count: 22, impact_score: 71,
    promise: { label: "Due Mon 2 Nov", tone: "teal", progress: 0.45 } },
  { code: "RZV-228", title: "Street lights out near sports", category: "Safety", location: "Sports Complex road", where: "Sports road", age: "4 days",
    department: "Estates · Electrical", status: "in_progress", report_count: 12, impact_score: 64, escalation_level: 1,
    promise: { label: "1 day late", tone: "red", progress: 1, overdue: true }, link_note: "safety" },
  { code: "RZV-230", title: "Library AC not cooling", category: "Comfort", location: "Library", where: "Library · 2nd floor", age: "3 h",
    department: "Estates · HVAC", status: "open", report_count: 9, impact_score: 40, is_new: true,
    promise: null },
  { code: "RZV-224", title: "Washroom taps leaking", category: "Water", location: "Academic Block A", where: "Academic Block A", age: "1 day",
    department: "Estates · Plumbing", status: "open", report_count: 7, impact_score: 33,
    promise: { label: "Due Wed 4 Nov", tone: "teal", progress: 0.3 } },
  { code: "RZV-217", title: "Conduct concern · identities protected", category: "Sensitive", location: "Academic Block A", where: "Academic Block A", age: "9 days",
    department: "Committee", status: "sealed", report_count: 4, impact_score: 0,
    promise: { label: "Sealed until 5 reports", tone: "purple", progress: 0.8 } },
  { code: "RZV-233", title: "Ragging concern · released", category: "Sensitive", location: "Hostel B · Boys", where: "Hostel B", age: "3 h since release",
    department: "Anti-Ragging Committee", status: "in_progress", report_count: 5, impact_score: 60,
    promise: { label: "Hearing due 48 h", tone: "teal", progress: 0.1 } },
  { code: "RZV-198", title: "Lab 3 projector flickering", category: "Equipment", location: "Lab Block", where: "Lab Block", age: "closed yesterday",
    department: "IT Services", status: "resolved", report_count: 6, impact_score: 10,
    promise: { label: "Kept · 5 of 6 confirmed", tone: "green", progress: 1 } },
  { code: "RZV-219", title: "Hostel C geyser not heating", category: "Water", location: "Hostel C · Girls", where: "Hostel C · 1st floor", age: "2 days",
    department: "Estates · Electrical", status: "awaiting_confirm", report_count: 8, impact_score: 30,
    promise: { label: "Fixed · 3 of 8 confirmed", tone: "amber", progress: 0.375 } },
];

export function issueBadge(i: Issue): { label: string; tone: Tone } {
  if (i.status === "sealed") return { label: "Sealed", tone: "purple" };
  if (i.status === "resolved") return { label: "Resolved", tone: "green" };
  if (i.status === "awaiting_confirm") return { label: "Awaiting student OK", tone: "amber" };
  if (i.promise?.overdue) return { label: "Promise overdue", tone: "red" };
  if (i.status === "in_progress") return { label: "In progress", tone: "teal" };
  if (i.is_new && !i.promise) return { label: "New · routed", tone: "purple" };
  return { label: "Open", tone: "blue" };
}

export const OVERVIEW = {
  tiles: [
    { label: "Open issues", value: 18, note: "from 214 reports this week", color: "#ffffff", href: "/issues" },
    { label: "Sealed · waiting", value: 3, note: "need more reports before release", color: "#c9b3f5", href: "/safe-voice" },
    { label: "Promises overdue", value: 4, note: "2 escalated to you today", color: "#ff8f8e", href: "/promises" },
    { label: "Predicted · 7 days", value: 2, note: "act now to prevent them", color: "#f7c948", href: "/root-causes" },
  ],
  alert: {
    title: "The swarm traced 3 issues to one cause: Pump House has no power backup",
    body: "Hostel B water outages (RZV-209) start within 48 h of every power cut. 6 of 6 matches since August. Confidence 0.91.",
    issue: "RZV-209",
  },
};

export const FORECAST = [
  { pct: 82, title: "Hostel B water outage", day: "TUE", body: "Power cut scheduled Tue 3 Nov. Pump has failed after 6 of the last 6 cuts.",
    fix: "Power cut planned Tue 3 Nov. Fix: temporary DG line to the pump before 9 AM." },
  { pct: 64, title: "Mess complaints spike on Monday", day: "MON", body: "Weekend supplier changes. 4 Mondays in a row above normal.",
    fix: "Keep the cold room unlocked on Sunday for the weekend supplier." },
  { pct: 41, title: "Library AC overload", day: "THU", body: "Mid-sem week. Reading hall occupancy above 90% for 3 days.",
    fix: "Mid-sem week. Reading hall occupancy above 90% for 3 days." },
];

export const EXPECTED_COMPLAINTS = [
  { day: "Sat", forecast: 18, usual: 12, spike: false },
  { day: "Sun", forecast: 20, usual: 13, spike: false },
  { day: "Mon", forecast: 34, usual: 14, spike: true, why: "Mess supplier change" },
  { day: "Tue", forecast: 41, usual: 13, spike: true, why: "Power cut → Hostel B water" },
  { day: "Wed", forecast: 24, usual: 12, spike: false },
  { day: "Thu", forecast: 16, usual: 10, spike: false },
  { day: "Fri", forecast: 15, usual: 9, spike: false },
];

export const SWARM_ACTIVITY = [
  { agent: "CL", text: "Clustered 9 new reports into RZV-214", when: "2 min ago", issue: "RZV-214" },
  { agent: "PK", text: "Escalated RZV-209 to Dean of Students", when: "18 min ago", issue: "RZV-209" },
  { agent: "RC", text: "Linked RZV-209 to Pump House power cuts", when: "1 h ago", issue: "RZV-209" },
  { agent: "PG", text: "Released RZV-233 at 5 of 5 reports", when: "3 h ago", issue: "RZV-233" },
];

// ---------- Promises ----------
export type PromiseCard = {
  code: string; text: string; owner: string; dept: "Estates" | "IT Services" | "Mess Committee";
  when: string; escalated?: string; confirmed?: { yes: number; of: number };
};

export const PROMISE_TILES = [
  { label: "Open promises", value: "11", note: "across 5 departments", color: "var(--text)" },
  { label: "Overdue", value: "4", note: "2 escalated to the Dean", color: "var(--red)" },
  { label: "Kept this month", value: "23", note: "of 29 due · 79%", color: "var(--green)" },
  { label: "Avg days late", value: "1.6", note: "down from 3.1 in September", color: "var(--text)" },
];

export const PROMISE_BOARD: { key: string; title: string; color: string; whenClass: string; cards: PromiseCard[] }[] = [
  { key: "overdue", title: "Overdue · escalating", color: "var(--red)", whenClass: "late", cards: [
    { code: "RZV-209", text: "Fix Hostel B pump wiring", owner: "R. K. Bansal · Estates", dept: "Estates", when: "3d late", escalated: "Escalated · Dean" },
    { code: "RZV-228", text: "Replace 6 street lights on sports road", owner: "Electrical team · Estates", dept: "Estates", when: "1d late", escalated: "Escalated · Warden" },
  ] },
  { key: "due_soon", title: "Due soon", color: "var(--orange)", whenClass: "late soon", cards: [
    { code: "RZV-214", text: "Restore WiFi on all Hostel C floors", owner: "Neha Verma · IT Services", dept: "IT Services", when: "today 6 PM" },
    { code: "RZV-221", text: "Deep-clean mess kitchen and pest control", owner: "Mess Committee", dept: "Mess Committee", when: "Mon 2 Nov" },
    { code: "RZV-224", text: "Change washer on 4 leaking taps", owner: "Plumbing · Estates", dept: "Estates", when: "Wed 4 Nov" },
  ] },
  { key: "waiting", title: "Waiting for student OK", color: "var(--amber)", whenClass: "late soon", cards: [
    { code: "RZV-219", text: "Repair Hostel C 1st-floor geyser", owner: "Electrical · Estates", dept: "Estates", when: "fixed Fri", confirmed: { yes: 3, of: 8 } },
    { code: "RZV-215", text: "Unblock canteen drain", owner: "Plumbing · Estates", dept: "Estates", when: "fixed Thu", confirmed: { yes: 5, of: 9 } },
  ] },
  { key: "kept", title: "Kept", color: "var(--green)", whenClass: "ok kept", cards: [
    { code: "RZV-198", text: "Replace Lab 3 projector lamp", owner: "IT Services", dept: "IT Services", when: "kept, 1 day early" },
    { code: "RZV-191", text: "Add 2 water coolers in Library", owner: "Estates", dept: "Estates", when: "kept on time" },
  ] },
];

export const ESCALATION_POLICY = [
  { when: "On time", who: "Owner reminded 24 h before" },
  { when: "+24 h late", who: "Warden or HOD" },
  { when: "+48 h late", who: "Dean of Students" },
  { when: "+7 days", who: "Principal and public scorecard" },
];

// ---------- Safe Voice ----------
export const SEALED = [
  { code: "RZV-217", category: "Faculty conduct", title: "Conduct concern about one course, Academic Block A", reporters: 4, threshold: 5,
    first: "first report 9 days ago", next: "1 more report releases it to the Committee", area: "Academic Block A",
    languages: "Hindi, English", releasesTo: "Internal Complaints Committee" },
  { code: "RZV-236", category: "Harassment", title: "Repeated comments near the canteen in the evening", reporters: 2, threshold: 3,
    first: "first report 2 days ago", next: "Auto-releases to safety officer at 3", area: "Canteen",
    languages: "English", releasesTo: "Women Safety Cell" },
  { code: "RZV-238", category: "Discrimination", title: "Caste-based remarks in a hostel group", reporters: 1, threshold: 4,
    first: "first report yesterday", next: "Watching for matching reports", area: "Hostels",
    languages: "Hindi", releasesTo: "Equal Opportunity Cell" },
];

export const RELEASED = [
  { code: "RZV-233", title: "Ragging concern in Hostel B", sub: "Anti-Ragging Committee · released 3 h ago at 5 of 5", badge: { label: "Hearing in 48 h", tone: "teal" as Tone } },
  { code: "RZV-201", title: "Unfair attendance marking in one lab", sub: "Academic Office · released 12 Oct", badge: { label: "Resolved", tone: "green" as Tone } },
  { code: "RZV-187", title: "Unsafe lighting on hostel stairwell", sub: "Women Safety Cell · released 2 Oct", badge: { label: "Resolved", tone: "green" as Tone } },
];

export const THRESHOLDS = [
  { category: "Faculty conduct", goesTo: "Internal Complaints Committee", value: 5 },
  { category: "Ragging", goesTo: "Anti-Ragging Committee", value: 5 },
  { category: "Harassment", goesTo: "Women Safety Cell", value: 3 },
  { category: "Discrimination", goesTo: "Equal Opportunity Cell", value: 4 },
];

// ---------- Root causes ----------
export const CAUSAL_CHAINS = [
  { trigger: { title: "Scheduled power cut", note: "6 in 6 weeks" }, cause: { title: "Pump House has no backup", note: "single supply line" },
    issues: [{ code: "RZV-209", title: "Hostel B no water", note: "31 reports" }, { code: "RZV-212", title: "Lab cooler dry", note: "5 reports" }],
    pattern: { title: "Power cuts empty the Hostel B tank", conf: 0.91, body: "6 of 6 outages began within 48 h of a power cut. Started in August.", act: "Fix suggested from Hostel A playbook", warn: false } },
  { trigger: { title: "Weekend supplier change", note: "every Saturday" }, cause: { title: "Stock kept unrefrigerated Sunday", note: "cold room locked" },
    issues: [{ code: "RZV-221", title: "Mess hygiene", note: "Monday spikes" }],
    pattern: { title: "Monday mess complaints", conf: 0.78, body: "4 Mondays in a row at 2.3× the usual level, after the weekend supplier.", act: "Needs an owner", warn: true } },
  { trigger: { title: "Firmware auto-update, 2 AM", note: "vendor push" }, cause: { title: "Access points stuck rebooting", note: "Hostel C, 6 of 8 APs" },
    issues: [{ code: "RZV-214", title: "WiFi down", note: "47 reports" }],
    pattern: { title: "Night firmware pushes break Hostel C WiFi", conf: 0.84, body: "Last 3 outages started between 2 and 3 AM, right after vendor updates.", act: "IT pausing auto-updates", warn: false } },
];

// ---------- Scorecard ----------
export const SCORECARD = [
  { name: "IT Services", owner: "Neha Verma · 2 open", kept: 92, fix: "0.8 days", back: 6, ok: "4.5 / 5", grade: "A",
    months: [88, 90, 85, 91, 94, 92] },
  { name: "Mess Committee", owner: "Student council + vendor · 1 open", kept: 78, fix: "1.9 days", back: 22, ok: "3.6 / 5", grade: "B",
    months: [70, 74, 72, 80, 76, 78] },
  { name: "Estates · Plumbing & Electrical", owner: "R. K. Bansal · 6 open", kept: 58, fix: "3.4 days", back: 31, ok: "2.9 / 5", grade: "D",
    months: [72, 64, 62, 56, 53, 58],
    learned: ["Misses most deadlines set on Mondays. Weekend crew is short.", "Water issues return when the root cause is power, not plumbing.", "Kept 9 of 10 promises that had a named technician."] },
  { name: "Estates · HVAC", owner: "S. Pillai · 1 open", kept: 83, fix: "1.5 days", back: 12, ok: "4.0 / 5", grade: "B",
    months: [79, 81, 84, 80, 85, 83] },
  { name: "Hostel Office", owner: "Arjun Sethi · 2 open", kept: 74, fix: "2.2 days", back: 15, ok: "3.8 / 5", grade: "C",
    months: [66, 70, 71, 69, 75, 74] },
];
export const SCORE_MONTHS = ["Jun", "Jul", "Aug", "Sep", "Oct", "Nov"];
export const KEPT_TARGET = 70;

// ---------- Agents ----------
export const AGENTS = [
  { id: "IN", name: "Intake", desc: "Transcribes voice in 8 languages, reads photos, sets category and severity.", actions: 214,
    access: [["reports/*", "rw"], ["vault/identities", "none"], ["playbooks/*", "r"]] },
  { id: "PG", name: "Privacy Guardian", desc: "The only agent that can read the identity vault. Holds sealed reports and enforces release thresholds.", actions: 38,
    access: [["vault/identities", "rw"], ["sealed/*", "rw"], ["policy/thresholds", "r"], ["playbooks/*", "none"]] },
  { id: "CL", name: "Clusterer", desc: "Merges similar reports into one issue using vector search and the building they were pinned to.", actions: 61,
    access: [["issues/*", "rw"], ["reports/embeddings", "r"], ["vault/identities", "none"]] },
  { id: "RC", name: "Root-Cause Detective", desc: "Links issues by time, place and shared equipment. Builds the causal graph.", actions: 7,
    access: [["causal_links/*", "rw"], ["issues/*", "r"], ["vault/identities", "none"]] },
  { id: "FC", name: "Forecaster", desc: "Predicts issues from recurring patterns, calendars and the causal graph.", actions: 3,
    access: [["forecasts/*", "rw"], ["causal_links/*", "r"], ["vault/identities", "none"]] },
  { id: "RT", name: "Router", desc: "Picks the department most likely to actually fix it, learning from past outcomes.", actions: 58,
    access: [["dept_track_record/*", "rw"], ["playbooks/*", "r"], ["vault/identities", "none"]] },
  { id: "RA", name: "Rights Agent", desc: "Answers students with the exact rulebook or UGC clause that applies.", actions: 44,
    access: [["knowledge/rulebook", "r"], ["knowledge/ugc", "r"], ["vault/identities", "none"]] },
  { id: "PK", name: "Promise Keeper", desc: "Turns admin replies into tracked promises, reminds owners and escalates.", actions: 19,
    access: [["promises/*", "rw"], ["policy/escalation", "r"], ["vault/identities", "none"]] },
] as const;

export const AGENT_DECISIONS: Record<string, { text: string; when: string }[]> = {
  IN: [{ text: "Transcribed a Hindi voice note: no water, Hostel B 2nd floor", when: "4 min ago" }, { text: "Set severity 4 of 5 on a mess hygiene report with photos", when: "40 min ago" }],
  PG: [{ text: "Released RZV-233 at 5 of 5 reports", when: "3 h ago" }, { text: "Held a new RZV-217 report, now 4 of 5", when: "yesterday" }],
  CL: [{ text: "Clustered 9 new reports into RZV-214", when: "2 min ago" }, { text: "Kept 2 Hostel C reports separate from RZV-209", when: "5 days ago" }],
  RC: [{ text: "Linked RZV-209 to Pump House power cuts", when: "1 h ago" }, { text: "Linked RZV-214 to 2 AM firmware pushes", when: "2 days ago" }],
  FC: [{ text: "Predicted Hostel B outage on Tue 3 Nov (82%)", when: "1 h ago" }],
  RT: [{ text: "Routed RZV-230 to Estates · HVAC", when: "3 h ago" }, { text: "Routed RZV-209 to Estates · Plumbing (not Hostel Office)", when: "5 days ago" }],
  RA: [{ text: "Quoted UGC anti-ragging regulation 2009, clause 6.3", when: "3 h ago" }],
  PK: [{ text: "Escalated RZV-209 to Dean of Students", when: "18 min ago" }, { text: "Escalated RZV-228 to the Warden", when: "6 h ago" }],
};

export const AGENT_TILES = [
  { label: "Decisions today", value: "540", note: "every one with a trace" },
  { label: "Playbooks learned", value: "37", note: "fixes that worked, reused" },
  { label: "Tokens saved", value: "41%", note: "agents read memory, not chat logs" },
  { label: "Human overrides", value: "6", note: "this week · fed back as learning" },
];

export const SHARED_MEMORY = [
  { n: "128", label: "Knowledge", items: ["Institute rulebook 2026", "UGC regulations", "Campus buildings and equipment"] },
  { n: "37", label: "Playbooks", items: ["Pump backup via DG changeover", "Pause AP firmware at night", "Unlock mess cold room Sundays"] },
  { n: "14", label: "Causal links", items: ["Power cut → Hostel B water", "Firmware push → Hostel C WiFi", "Supplier change → Monday mess"] },
  { n: "4,812", label: "Decision traces", items: ["Routing, release, escalation", "Kept for the full academic year", "Shown behind every Why? button"] },
];

// ---------- Issue detail ----------
export type TraceStep = { agent: string; actor: string; title: string; when: string; body: string; tag: string };
export type ReportRow = { pseudonym: string; when: string; lang: string; text_en: string; text_original?: string; voice?: boolean; photo?: boolean; kind?: "me_too" };
export type IssueDetail = {
  issue: Issue;
  summary: string;
  owner: string;
  trace: TraceStep[];
  reports: ReportRow[];
  timeline: { when: string; text: string; actor: string }[];
  promise: { text: string; by: string; said: string; lateLabel: string; late: boolean; level: number } | null;
  rootCause: { chain: string[]; conf: number; memory: string } | null;
};

const AGENT_NAME: Record<string, string> = {
  IN: "Intake", CL: "Clusterer", RT: "Router", RC: "Root-Cause Detective", PK: "Promise Keeper", ME: "Memory", PG: "Privacy Guardian",
};
export const agentName = (id: string) => AGENT_NAME[id] ?? id;

const PSEUDO = ["4F2A", "9C1E", "B7D3", "21AF", "E5C8", "7A90", "3D6B", "C2F1"];

const DETAIL_209: Omit<IssueDetail, "issue"> = {
  summary: "31 students · first report Mon 26 Oct · routed to Estates · Plumbing · owner R. K. Bansal",
  owner: "R. K. Bansal",
  trace: [
    { agent: "IN", actor: "Intake", title: "Understood 31 reports", when: "Mon 26 Oct, 7:12 AM",
      body: "Transcribed 19 Hindi and Hinglish voice notes, read 12 texts. Category Water, severity 4 of 5 because two floors have no drinking water.", tag: "lang: hi 61% · en 39%" },
    { agent: "CL", actor: "Clusterer", title: "Merged into one issue", when: "Mon 26 Oct, 7:14 AM",
      body: "Average similarity 0.86 and all pinned inside Hostel B. Kept 2 reports about Hostel C separate.", tag: "similarity ≥ 0.80 · same building" },
    { agent: "RT", actor: "Router", title: "Sent to Estates · Plumbing", when: "Mon 26 Oct, 7:14 AM",
      body: "Shared memory: Estates resolved 9 of 11 similar water issues; the Hostel Office resolved 0 and forwarded each one to Estates.", tag: "memory: dept_track_record · conf 0.93" },
    { agent: "RC", actor: "Root-Cause Detective", title: "Linked to Pump House power cuts", when: "Thu 29 Oct, 2:40 PM",
      body: "Every outage since August began within 48 hours of a recorded power cut. 6 of 6 matches. Pump House has no backup supply.", tag: "causal_link conf 0.91" },
    { agent: "PK", actor: "Promise Keeper", title: "Escalated to the Dean of Students", when: "Sat 31 Oct, 10:05 AM",
      body: "Promise “fixed by Wednesday” passed 72 hours ago with no update. Campus policy escalates after 48 hours overdue.", tag: "policy: escalate_after 48h · level 2" },
    { agent: "ME", actor: "Memory", title: "Suggested a fix that worked before", when: "Sat 31 Oct, 10:06 AM",
      body: "Found the Hostel A playbook from March 2026: changeover switch to DG set, fixed in 2 days, no repeat since.", tag: "datapack: playbooks/water/pump-backup" },
  ],
  reports: [
    { pseudonym: "Student #4F2A", when: "Mon 26 Oct, 6:58 AM", lang: "hi", voice: true, text_original: "दूसरी मंज़िल पर सुबह से पानी नहीं है", text_en: "No water on the 2nd floor since morning." },
    { pseudonym: "Student #9C1E", when: "Mon 26 Oct, 7:03 AM", lang: "en", text_en: "3rd floor taps dry, can't even fill bottles." },
    { pseudonym: "Student #B7D3", when: "Mon 26 Oct, 7:10 AM", lang: "hi", voice: true, text_original: "Bhaiya paani hi nahi aa raha, nahane ka bhi nahi", text_en: "There's no water at all, not even for bathing." },
    { pseudonym: "Student #21AF", when: "Tue 27 Oct, 8:20 AM", lang: "en", kind: "me_too", text_en: "Me too." },
    { pseudonym: "Student #E5C8", when: "Thu 29 Oct, 9:45 PM", lang: "en", photo: true, text_en: "Again after tonight's power cut. Tank empty." },
  ],
  timeline: [
    { when: "Mon 26 Oct, 7:12 AM", actor: "intake", text: "Issue created from 3 reports" },
    { when: "Mon 26 Oct, 7:14 AM", actor: "router", text: "Routed to Estates · Plumbing" },
    { when: "Mon 26 Oct, 11:30 AM", actor: "R. K. Bansal", text: "Promised: Pump wiring will be fixed by Wednesday" },
    { when: "Thu 29 Oct, 2:40 PM", actor: "root_cause", text: "Linked to Pump House power cuts" },
    { when: "Fri 30 Oct, 10:00 AM", actor: "promise_keeper", text: "Escalated to the Warden (level 1)" },
    { when: "Sat 31 Oct, 10:05 AM", actor: "promise_keeper", text: "Escalated to the Dean of Students (level 2)" },
  ],
  promise: { text: "Pump wiring will be fixed by Wednesday.", by: "R. K. Bansal", said: "said Mon 26 Oct · extracted by Promise Keeper", lateLabel: "3d 4h", late: true, level: 2 },
  rootCause: { chain: ["Power cut", "Pump stops", "No water"], conf: 0.91,
    memory: "Memory from March 2026: the same fault in Hostel A was fixed by adding a changeover switch to the DG set. Suggested to Estates." },
};

export function getIssueDetail(code: string): IssueDetail | null {
  const issue = ISSUES.find((i) => i.code.toLowerCase() === code.toLowerCase());
  if (!issue || issue.status === "sealed") return null;
  if (issue.code === "RZV-209") return { issue, ...DETAIL_209 };

  const n = issue.report_count;
  const promise = issue.promise && !["purple"].includes(issue.promise.tone)
    ? { text: `${issue.title}: fix promised.`, by: issue.department, said: "set by the department", lateLabel: issue.promise.label,
        late: !!issue.promise.overdue, level: issue.escalation_level ?? 0 }
    : null;
  return {
    issue,
    summary: `${n} students · ${issue.age} · routed to ${issue.department}`,
    owner: issue.department,
    trace: [
      { agent: "IN", actor: "Intake", title: `Understood ${n} reports`, when: issue.age,
        body: `Read voice notes and texts about ${issue.title.toLowerCase()}. Category ${issue.category}.`, tag: `category: ${issue.category.toLowerCase()}` },
      { agent: "CL", actor: "Clusterer", title: "Merged into one issue", when: issue.age,
        body: `All reports pinned inside ${issue.location} with high text similarity.`, tag: "similarity ≥ 0.80 · same building" },
      { agent: "RT", actor: "Router", title: `Sent to ${issue.department}`, when: issue.age,
        body: `Category ${issue.category} maps to ${issue.department}. No override found in shared memory.`, tag: "memory: dept_track_record" },
    ],
    reports: Array.from({ length: Math.min(n, 4) }, (_, k) => ({
      pseudonym: `Student #${PSEUDO[(k + code.length) % PSEUDO.length]}`, when: issue.age, lang: k % 2 ? "en" : "hi",
      voice: k % 2 === 0, text_en: k === 0 ? issue.title + "." : "Same problem here.", kind: k > 1 ? ("me_too" as const) : undefined,
    })),
    timeline: [
      { when: issue.age, actor: "intake", text: "Issue created" },
      { when: issue.age, actor: "router", text: `Routed to ${issue.department}` },
      ...(issue.status === "resolved" ? [{ when: "yesterday", actor: "students", text: "Students confirmed the fix" }] : []),
      ...(issue.status === "awaiting_confirm" ? [{ when: "Fri 30 Oct", actor: issue.department, text: "Marked fixed, waiting for students" }] : []),
    ],
    promise,
    rootCause: null,
  };
}

// ---------- Map ----------
export type MapStatus = "overdue" | "open" | "in_progress" | "sealed" | "predicted" | "resolved";
export const MAP_COLORS: Record<MapStatus, string> = {
  overdue: "#d93b3b", open: "#2563ea", in_progress: "#15a397", sealed: "#7b3aec", predicted: "#e8a317", resolved: "#1d8e4e",
};
export const MAP_LABELS: Record<MapStatus, string> = {
  overdue: "Overdue", open: "Open", in_progress: "In progress", sealed: "Sealed", predicted: "Predicted", resolved: "Resolved",
};

export type MapPin = { id: string; building: string; status: MapStatus; label: string; reports: number; category: string; days: number };
export const MAP_PINS: MapPin[] = [
  { id: "RZV-214", building: "hostel-c", status: "open", label: "WiFi down", reports: 47, category: "Internet", days: 0 },
  { id: "RZV-209", building: "hostel-b", status: "overdue", label: "No water", reports: 31, category: "Water", days: 5 },
  { id: "RZV-221", building: "mess", status: "in_progress", label: "Food hygiene", reports: 22, category: "Food", days: 2 },
  { id: "RZV-228", building: "sports-road", status: "overdue", label: "Street lights", reports: 12, category: "Safety", days: 4 },
  { id: "RZV-230", building: "library", status: "open", label: "AC not cooling", reports: 9, category: "Comfort", days: 0 },
  { id: "RZV-217", building: "academic-a", status: "sealed", label: "Sealed report", reports: 4, category: "Sensitive", days: 9 },
  { id: "RZV-198", building: "lab", status: "resolved", label: "Projector fixed", reports: 6, category: "Equipment", days: 1 },
  { id: "FC-03", building: "pump", status: "predicted", label: "Predicted failure Tue", reports: 0, category: "Water", days: 0 },
];

export const BUILDINGS_BY_ISSUES = [
  { id: "hostel-c", name: "Hostel C · Girls", note: "WiFi down · 47 reports", n: 3, color: "#2563ea" },
  { id: "hostel-b", name: "Hostel B · Boys", note: "No water · overdue", n: 3, color: "#d93b3b" },
  { id: "academic-a", name: "Academic Block A", note: "Leaking taps · 1 sealed", n: 2, color: "#7b3aec" },
  { id: "mess", name: "Mess & Canteen", note: "Food hygiene · in progress", n: 2, color: "#15a397" },
  { id: "sports-road", name: "Sports Complex road", note: "Street lights · overdue", n: 1, color: "#d93b3b" },
  { id: "library", name: "Library", note: "AC not cooling", n: 1, color: "#2563ea" },
  { id: "pump", name: "Pump House", note: "Predicted failure Tue", n: 1, color: "#e8a317" },
  { id: "lab", name: "Lab Block", note: "Projector fixed yesterday", n: 0, color: "#1d8e4e" },
];
