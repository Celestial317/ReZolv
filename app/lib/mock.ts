// Static demo data for the UI. Replace with calls to the API once the screens are signed off.
import type { Mood } from "@/components/Mitraa";

export type IssueState = "open" | "promised" | "overdue" | "escalated" | "check" | "fixed" | "sealed";
export type Tone = "red" | "amber" | "green" | "blue" | "grey";

export type TimelineItem = { title: string; text: string; when: string; tone: Tone };

export type Issue = {
  code: string;
  title: string;
  category: "water" | "internet" | "safety" | "food" | "electricity";
  place: string;
  dept: string;
  count: number;
  state: IssueState;
  /** one-line status shown on lists */
  note: string;
  mine: boolean;
  /** which steps of Sent / Routed / Promised / Fixed are done */
  progress: number;
  /** position on the campus map (world units, see CampusMap) */
  at: [number, number];
  promise?: { by: string; text: string; late?: string; level?: 0 | 1 | 2 };
  rootCause?: string;
  timeline?: TimelineItem[];
  why?: TimelineItem[];
};

export const me = { pseudonym: "Student #4F2A", short: "4F2A", reports: 9, fixed: 5, metoo: 5 };

export const issues: Issue[] = [
  {
    code: "RZV-214", title: "WiFi down in Hostel C", category: "internet", place: "Hostel C", dept: "IT Services",
    count: 47, state: "promised", note: "Promised by 6 PM today", mine: false, progress: 3, at: [365, 392],
    promise: { by: "IT Services", text: "Access-point switch will be replaced by 6 PM today." },
    timeline: [
      { title: "IT Services promised a fix", text: "Replace the faulty access-point switch.", when: "Today, 9:40 AM", tone: "blue" },
      { title: "Routed to IT Services", text: "Internet issues in hostels go to IT.", when: "Thu 29 Oct", tone: "grey" },
    ],
    why: [
      { title: "Joined 46 similar reports", text: "Same place, same problem, said in Hindi and English.", when: "Intake · Clusterer", tone: "grey" },
      { title: "Sent to IT Services", text: "IT fixed 11 of its last 12 Wi-Fi issues.", when: "Router", tone: "grey" },
    ],
  },
  {
    code: "RZV-209", title: "No water on 2nd floor", category: "water", place: "Hostel B", dept: "Estates",
    count: 31, state: "escalated", note: "3 days late · with the Dean", mine: true, progress: 3, at: [155, 375],
    promise: { by: "Estates", text: "Pump wiring will be fixed by Wednesday.", late: "3d 4h", level: 1 },
    rootCause: "The water stops after every power cut, because the pump has no backup. A fix that worked in Hostel A has been sent to Estates.",
    timeline: [
      { title: "Escalated to the Dean", text: "Estates did not update after the deadline.", when: "Today, 10:05 AM", tone: "red" },
      { title: "Root cause found", text: "Linked to power cuts at the Pump House.", when: "Thu 29 Oct", tone: "amber" },
      { title: "Estates promised a fix", text: "Pump wiring will be fixed by Wednesday.", when: "Mon 26 Oct", tone: "blue" },
      { title: "Routed to Estates", text: "Water issues go to Estates · Plumbing.", when: "Sun 25 Oct", tone: "grey" },
      { title: "You and 30 others reported", text: "Sent in Hindi and English.", when: "Sun 25 Oct", tone: "grey" },
    ],
    why: [
      { title: "Joined RZV-209", text: "Same place (Hostel B) and the meaning matched at 94%.", when: "Clusterer", tone: "grey" },
      { title: "Sent to Estates", text: "9 of 11 past water issues were fixed by Estates.", when: "Router · memory", tone: "grey" },
      { title: "Linked to power cuts", text: "6 power cuts at the Pump House were each followed by a Hostel B outage.", when: "Root cause agent", tone: "amber" },
      { title: "Pushed to the Dean", text: "The promise was 24 hours overdue.", when: "Promise keeper", tone: "red" },
    ],
  },
  {
    code: "RZV-221", title: "Mess food hygiene", category: "food", place: "Mess", dept: "Mess Committee",
    count: 22, state: "promised", note: "Cleaning by Monday", mine: false, progress: 3, at: [570, 322],
    promise: { by: "Mess Committee", text: "Deep cleaning of the kitchen by Monday." },
    timeline: [{ title: "Mess Committee promised a fix", text: "Deep cleaning of the kitchen by Monday.", when: "Yesterday", tone: "blue" }],
    why: [{ title: "Sent to Mess Committee", text: "Food issues go to the Mess Committee.", when: "Router", tone: "grey" }],
  },
  {
    code: "RZV-226", title: "Street lights out", category: "safety", place: "Sports road", dept: "Electrical",
    count: 12, state: "overdue", note: "1 day late · with the Warden", mine: false, progress: 3, at: [624, 286],
    promise: { by: "Electrical", text: "Lamps replaced by Thursday.", late: "1d 2h", level: 1 },
    timeline: [{ title: "Escalated to the Warden", text: "Electrical did not update after the deadline.", when: "Today, 8:00 AM", tone: "red" }],
    why: [{ title: "Pushed to the Warden", text: "The promise was overdue.", when: "Promise keeper", tone: "red" }],
  },
  {
    code: "RZV-219", title: "Geyser not heating", category: "water", place: "Hostel C", dept: "Electrical",
    count: 8, state: "check", note: "Marked fixed on Friday. Is it?", mine: true, progress: 4, at: [330, 372],
    promise: { by: "Electrical", text: "Geyser element will be replaced." },
    timeline: [
      { title: "Electrical marked it fixed", text: "Waiting for students to confirm.", when: "Fri 30 Oct", tone: "amber" },
      { title: "Electrical promised a fix", text: "Geyser element will be replaced.", when: "Wed 28 Oct", tone: "blue" },
    ],
    why: [{ title: "Sent to Electrical", text: "Geyser faults were fixed by Electrical 5 times before.", when: "Router · memory", tone: "grey" }],
  },
  {
    code: "RZV-198", title: "Broken tap in Lab Block", category: "water", place: "Lab Block", dept: "Estates",
    count: 3, state: "fixed", note: "Fixed, you confirmed", mine: true, progress: 4, at: [150, 215],
    timeline: [{ title: "Fixed, because you spoke up", text: "3 of 3 students confirmed.", when: "Mon 19 Oct", tone: "green" }],
    why: [],
  },
  {
    code: "RZV-190", title: "Library fan not working", category: "electricity", place: "Library", dept: "Electrical",
    count: 5, state: "fixed", note: "Fixed, you confirmed", mine: true, progress: 4, at: [545, 100],
    timeline: [{ title: "Fixed, because you spoke up", text: "4 of 5 students confirmed.", when: "Thu 8 Oct", tone: "green" }],
    why: [],
  },
  {
    code: "RZV-217", title: "Sealed report", category: "safety", place: "Hidden", dept: "Welfare Committee",
    count: 4, state: "sealed", note: "Waiting for 1 more student", mine: true, progress: 1, at: [0, 0],
    timeline: [{ title: "Sealed", text: "Nobody reads it until enough other students report the same thing.", when: "Wed 28 Oct", tone: "grey" }],
    why: [],
  },
];

export const find = (code: string) => issues.find((i) => i.code === code);

export const categories = ["All", "Water", "Internet", "Safety", "Food"] as const;

export const scorecard = [
  { name: "IT Services", pct: 92, color: "var(--leaf)" },
  { name: "Mess Committee", pct: 78, color: "var(--teal)" },
  { name: "Estates", pct: 58, color: "var(--red)" },
];

/** Mood is picked on the client from the issue state (architecture.md section 8). */
export function moodFor(state: IssueState): Mood {
  switch (state) {
    case "overdue": return "concerned";
    case "escalated": return "determined";
    case "fixed": return "proud";
    case "sealed": return "sympathetic";
    case "check": return "happy";
    default: return "happy";
  }
}

export const mitraaLine: Record<IssueState, string> = {
  open: "I have sent it on. Waiting for a promise.",
  promised: "They have promised a fix. I am watching the date.",
  overdue: "Late again. I am pushing it up.",
  escalated: "Deadline missed, so I pushed it to the Dean. I'll ping you the moment they reply.",
  check: "They say it is fixed. Can you check for me?",
  fixed: "Fixed, because you spoke up.",
  sealed: "Your name stays safe with me.",
};

export const stateBadge: Record<IssueState, { label: string; tone: Tone }> = {
  open: { label: "Open", tone: "grey" },
  promised: { label: "Promised", tone: "blue" },
  overdue: { label: "Overdue", tone: "red" },
  escalated: { label: "Escalated", tone: "red" },
  check: { label: "Check the fix", tone: "amber" },
  fixed: { label: "Fixed", tone: "green" },
  sealed: { label: "Sealed", tone: "grey" },
};
