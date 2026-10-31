// Demo campus: Shaheed Sukhdev College of Business Studies (SSCBS), Sector 16, Rohini, Delhi.
// Boundary and pitches come from OpenStreetMap (way 1417139911, 1303109527).
// OSM has no building footprints inside the campus, so the named points below are
// demo locations placed inside the wall. Move them here if the real layout differs.

export type LatLng = [number, number];

export const CAMPUS_NAME = "SSCBS, Rohini";

export const CAMPUS_BOUNDARY: LatLng[] = [
  [28.7327283, 77.117982], [28.7326623, 77.1180736], [28.7320807, 77.1188815], [28.7320458, 77.1189306],
  [28.731778, 77.1193134], [28.7324245, 77.1199014], [28.7326157, 77.1200721], [28.733548, 77.1187136],
];

export const SPORTS_GROUND: LatLng[] = [
  [28.7320458, 77.1189306], [28.7326943, 77.1195119], [28.7324245, 77.1199014], [28.731778, 77.1193134],
];

export const CAMPUS_CENTER: LatLng = [28.73266, 77.11903];

// Campus bounding box from OSM, padded ~60 m so the wall never sits on the screen edge.
const PAD = 0.00055;
export const CAMPUS_BOUNDS: [LatLng, LatLng] = [
  [28.731778 - PAD, 77.117982 - PAD],
  [28.733548 + PAD, 77.1200721 + PAD],
];

export type CampusLocation = { id: string; name: string; at: LatLng };

export const LOCATIONS: CampusLocation[] = [
  { id: "main-gate", name: "Main Gate", at: [28.73236, 77.11858] },
  { id: "admin", name: "Admin Block", at: [28.73266, 77.11838] },
  { id: "academic-a", name: "Academic Block A", at: [28.73292, 77.11862] },
  { id: "lab", name: "Lab Block", at: [28.7331, 77.1187] },
  { id: "library", name: "Library", at: [28.73302, 77.11915] },
  { id: "hostel-b", name: "Hostel B · Boys", at: [28.7332, 77.119] },
  { id: "hostel-c", name: "Hostel C · Girls", at: [28.73292, 77.11948] },
  { id: "auditorium", name: "Auditorium", at: [28.73272, 77.1197] },
  { id: "canteen", name: "Canteen", at: [28.73252, 77.1188] },
  { id: "mess", name: "Mess", at: [28.7325, 77.11915] },
  { id: "sports-road", name: "Sports ground path", at: [28.73262, 77.11945] },
  { id: "pump", name: "Pump House", at: [28.73226, 77.11905] },
];

export const locationById = (id: string) => LOCATIONS.find((l) => l.id === id);
