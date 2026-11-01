export const color = {
  ink: "#14232a",
  ink2: "#27414a",
  bg: "#f1f7f6",
  card: "#ffffff",
  line: "#dce8e6",
  green: "#0f6b5e",
  mint: "#e1f3f0",
  aqua: "#b3e3e6",
  muted: "#55696b",
  red: "#d93c3c",
  redBg: "#fce9e9",
  redInk: "#a32020",
  amberBg: "#fff1d6",
  amberInk: "#6b4a00",
  blue: "#2e55d6",
  blueBg: "#e6ecfd",
  teal: "#14a39a",
  leaf: "#1e9150",
  grey: "#e7efee",
};

export const font = {
  regular: "Urbanist_400Regular",
  medium: "Urbanist_600SemiBold",
  bold: "Urbanist_700Bold",
  heavy: "Urbanist_800ExtraBold",
  mono: "JetBrainsMono_700Bold",
};

export type Tone = "red" | "amber" | "green" | "blue" | "grey";
export const tone: Record<Tone, { bg: string; fg: string }> = {
  red: { bg: color.redBg, fg: color.redInk },
  amber: { bg: color.amberBg, fg: color.amberInk },
  green: { bg: color.mint, fg: color.green },
  blue: { bg: color.blueBg, fg: color.blue },
  grey: { bg: color.grey, fg: color.muted },
};

/** Every kind of issue has its own colour, used for icon tiles, count tiles, map pins and filters. */
export const cat: Record<string, { fg: string; bg: string; label: string }> = {
  water: { fg: "#1d4ed8", bg: "#e3ecff", label: "Water" },
  electricity: { fg: "#a16207", bg: "#fff1bf", label: "Electricity" },
  internet: { fg: "#7c3aed", bg: "#efe6ff", label: "Internet" },
  food: { fg: "#c2410c", bg: "#ffe7d6", label: "Food" },
  safety: { fg: "#c62828", bg: "#fde4e4", label: "Safety" },
  other: { fg: "#15803d", bg: "#dff3e5", label: "Other" },
};
export const catOf = (c?: string | null) => cat[c ?? ""] ?? cat.other;
/** Solid colour for map pins. */
export const pinColor: Record<string, string> = {
  water: "#2563eb", electricity: "#e0a100", internet: "#8b5cf6", food: "#ea6a12", safety: "#dc2626", other: "#16a34a",
};
