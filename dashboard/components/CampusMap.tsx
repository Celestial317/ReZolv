"use client";

import dynamic from "next/dynamic";
import type { MapProps } from "./LeafletMap";

// Leaflet touches `window`, so the map only renders in the browser (architecture.md §7).
const LeafletMap = dynamic(() => import("./LeafletMap"), {
  ssr: false,
  loading: () => <div className="map map-loading" aria-hidden="true" />,
});

export default function CampusMap(props: MapProps) {
  return (
    <div style={{ height: props.height ?? 560 }}>
      <LeafletMap {...props} />
    </div>
  );
}
