export function lateness(hoursLate: number): string {
  const h = Math.abs(hoursLate);
  const text = h >= 24 ? `${Math.floor(h / 24)}d ${Math.round(h % 24)}h` : `${Math.max(1, Math.round(h))}h`;
  return hoursLate > 0 ? `${text} late` : `due in ${text}`;
}

export const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export const dayAndTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

export const LEVEL_NAME = ["the department", "the Warden", "the Dean"] as const;
