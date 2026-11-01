import { LEVEL_NAME, lateness, when } from "./format";
import type { Tone } from "./theme";

type PromiseBits = { promise_text: string | null; promise_due_at: string | null; escalation_level: number | null; hours_late: number | null };

/** The one-line promise status shown under an issue: late and with whom, due when, or still waiting. */
export function promiseLine(i: PromiseBits): { text: string; tone: Tone } {
  if (i.promise_text && i.hours_late != null && i.hours_late > 0) {
    const level = i.escalation_level ?? 0;
    return { text: `${lateness(i.hours_late)}${level > 0 ? ` · with ${LEVEL_NAME[level]}` : ""}`, tone: "red" };
  }
  if (i.promise_text && i.promise_due_at) return { text: `Promised by ${when(i.promise_due_at)}`, tone: "blue" };
  return { text: "Waiting for a promise", tone: "grey" };
}

export function stateBadge(status: string | null, level: number | null): { label: string; tone: Tone } {
  if (status === "resolved") return { label: "Fixed", tone: "green" };
  if (status === "awaiting_confirm") return { label: "Check the fix", tone: "amber" };
  if ((level ?? 0) > 0) return { label: "Escalated", tone: "red" };
  if (status === "in_progress") return { label: "Promised", tone: "blue" };
  return { label: "Open", tone: "grey" };
}

/** Sent, Routed, Promised, Fixed: how many of the four steps are done. */
export const progressOf = (status: string | null) =>
  status === "resolved" || status === "awaiting_confirm" ? 4 : status === "in_progress" ? 3 : 2;

/** A sticker holds rezolv://a/RZV-A-014 (or just the code). */
export function assetCodeFrom(data: string): string | null {
  const m = data.trim().match(/(?:^|\/)(RZV-A-\d+)$/i);
  return m ? m[1].toUpperCase() : null;
}

export const CATEGORIES = ["water", "internet", "electricity", "food", "safety", "other"] as const;
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
