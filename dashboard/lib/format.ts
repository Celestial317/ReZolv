export const when = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "None";

export const day = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "None";

/** "3d 4h late" or "in 5h". */
export function lateness(hoursLate: number): string {
  const h = Math.abs(hoursLate);
  const text = h >= 24 ? `${Math.floor(h / 24)}d ${Math.round(h % 24)}h` : `${Math.max(1, Math.round(h))}h`;
  return hoursLate > 0 ? `${text} late` : `due in ${text}`;
}

export const STATUS: Record<string, { label: string; tone: string }> = {
  open: { label: "Open", tone: "" },
  in_progress: { label: "In progress", tone: "teal" },
  awaiting_confirm: { label: "Awaiting students", tone: "amber" },
  resolved: { label: "Resolved", tone: "green" },
};

export const LEVEL_TAG: { label: string; tone: string }[] = [
  { label: "Facilities", tone: "" },
  { label: "Warden", tone: "amber" },
  { label: "Dean", tone: "red" },
];

export const VERIFICATION: Record<string, { label: string; tone: string }> = {
  verified: { label: "Verified", tone: "green" },
  unverified: { label: "Unverified", tone: "" },
  contradicted: { label: "Contradicted", tone: "red" },
};

/** One colour per kind of issue, shared by tags, accents and map pins. */
export const CATEGORY: Record<string, { label: string; fg: string; bg: string; pin: string }> = {
  water: { label: "Water", fg: "#1d4ed8", bg: "#e3ecff", pin: "#2563eb" },
  electricity: { label: "Electricity", fg: "#8a5a00", bg: "#fff1bf", pin: "#e0a100" },
  internet: { label: "Internet", fg: "#6d28d9", bg: "#efe6ff", pin: "#8b5cf6" },
  food: { label: "Food", fg: "#b9400c", bg: "#ffe7d6", pin: "#ea6a12" },
  safety: { label: "Safety", fg: "#b42323", bg: "#fde4e4", pin: "#dc2626" },
  other: { label: "Other", fg: "#15803d", bg: "#dff3e5", pin: "#16a34a" },
};
export const cat = (c?: string | null) => CATEGORY[c ?? ""] ?? CATEGORY.other;
