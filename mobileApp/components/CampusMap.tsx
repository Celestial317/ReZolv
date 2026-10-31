"use client";

import dynamic from "next/dynamic";
import { CAMPUS_CENTER, type LatLng } from "@/lib/campus";

export type Marker = { id: string; at: LatLng; tone: "red" | "blue" | "green" | "teal"; count?: number };

type Props = {
  markers?: Marker[];
  /** "pin" mode: the pin is fixed in the centre and the map moves under it. */
  mode?: "view" | "pin";
  center?: LatLng;
  zoom?: number;
  aspect?: number; // height / width
  controls?: boolean;
  activeId?: string | null;
  onCenter?: (c: LatLng, place: string | null) => void;
  onMarker?: (id: string) => void;
  className?: string;
};

// Leaflet touches `window`, so it only loads in the browser.
const Inner = dynamic(() => import("./CampusMapInner"), {
  ssr: false,
  loading: () => <div style={{ width: "100%", height: "100%", background: "#e8eeec" }} />,
});

/** OpenStreetMap, locked to the demo campus. */
export default function CampusMap({
  markers = [], mode = "view", center = CAMPUS_CENTER, zoom = 18, aspect = 1, controls = true,
  activeId, onCenter, onMarker, className,
}: Props) {
  return (
    <div className={`map ${className ?? ""}`} style={{ aspectRatio: `${1 / aspect}` }}>
      <Inner markers={markers} mode={mode} center={center} zoom={zoom} controls={controls} activeId={activeId} onCenter={onCenter} onMarker={onMarker} />
    </div>
  );
}
