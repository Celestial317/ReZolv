// Shaheed Sukhdev College of Business Studies, Sector 16, Rohini, Delhi.
// The boundary is the OpenStreetMap way for the campus. The map never leaves this area.

export type LatLng = [number, number];

export const CAMPUS_POLYGON: LatLng[] = [
  [28.7327283, 77.117982], [28.7326623, 77.1180736], [28.7320807, 77.1188815], [28.7320458, 77.1189306],
  [28.731778, 77.1193134], [28.7324245, 77.1199014], [28.7326157, 77.1200721], [28.733548, 77.1187136],
];

export const CAMPUS_CENTER: LatLng = [28.732663, 77.118998];

const PAD = 0.00025;
export const CAMPUS_BOUNDS: [LatLng, LatLng] = [
  [28.731778 - PAD, 77.117982 - PAD],
  [28.733548 + PAD, 77.1200721 + PAD],
];
