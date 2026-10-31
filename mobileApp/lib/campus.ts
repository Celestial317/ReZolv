// Demo campus: Shaheed Sukhdev College of Business Studies, Sector 16, Rohini, Delhi.
// Boundary is the OpenStreetMap way for the campus (Nominatim, [lat, lng]).
// The map never leaves this area. Place names are demo labels (the story uses
// "Hostel B", "Mess" ...) pinned onto the real building, grounds and gate.

export type LatLng = [number, number];

export const CAMPUS_NAME = "Shaheed Sukhdev College";

export const CAMPUS_POLYGON: LatLng[] = [
  [28.7327283, 77.117982],
  [28.7326623, 77.1180736],
  [28.7320807, 77.1188815],
  [28.7320458, 77.1189306],
  [28.731778, 77.1193134],
  [28.7324245, 77.1199014],
  [28.7326157, 77.1200721],
  [28.733548, 77.1187136],
];

const lats = CAMPUS_POLYGON.map((p) => p[0]);
const lngs = CAMPUS_POLYGON.map((p) => p[1]);

export const CAMPUS_CENTER: LatLng = [
  (Math.min(...lats) + Math.max(...lats)) / 2,
  (Math.min(...lngs) + Math.max(...lngs)) / 2,
];

/** The map can be dragged only this far (a little padding around the boundary). */
const PAD = 0.00025;
export const CAMPUS_BOUNDS: [LatLng, LatLng] = [
  [Math.min(...lats) - PAD, Math.min(...lngs) - PAD],
  [Math.max(...lats) + PAD, Math.max(...lngs) + PAD],
];

export type Place = { name: string; at: LatLng };

/** Named spots inside the campus. Used for "Pin is on ..." and for issue pins. */
export const PLACES: Place[] = [
  { name: "Main Gate", at: [28.732195, 77.118893] },
  { name: "Hostel B", at: [28.732783, 77.118477] },
  { name: "Hostel C", at: [28.732516, 77.118881] },
  { name: "Library", at: [28.732804, 77.119199] },
  { name: "Admin Block", at: [28.733114, 77.118722] },
  { name: "Lab Block", at: [28.733018, 77.119003] },
  { name: "Mess", at: [28.732441, 77.119309] },
  { name: "Sports Ground", at: [28.732259, 77.119456] },
  { name: "Sports Court", at: [28.732687, 77.119798] },
];

const R = 6371000;
export function metres(a: LatLng, b: LatLng): number {
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const x = dLng * Math.cos((((a[0] + b[0]) / 2) * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + x * x) * R;
}

/** Nearest named place within `within` metres, otherwise null. */
export function placeAt(p: LatLng, within = 28): string | null {
  let best: Place | null = null;
  let d = Infinity;
  for (const pl of PLACES) {
    const m = metres(p, pl.at);
    if (m < d) { d = m; best = pl; }
  }
  return best && d <= within ? best.name : null;
}

export const placePos = (name: string): LatLng =>
  PLACES.find((p) => p.name === name)?.at ?? CAMPUS_CENTER;

/** Shift a point by a few metres so two pins on one building do not overlap. */
export const nudge = (p: LatLng, eastM: number, northM = 0): LatLng => [
  p[0] + northM / 111320,
  p[1] + eastM / (111320 * Math.cos((p[0] * Math.PI) / 180)),
];
