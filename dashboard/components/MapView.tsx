"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapContainer, Marker, Polygon, TileLayer } from "react-leaflet";
import { CAMPUS_BOUNDS, CAMPUS_CENTER, CAMPUS_POLYGON, type LatLng } from "@/lib/campus";

export type Pin = { id: string; at: LatLng; count: number; color: string };

const OUTSIDE: LatLng[] = [[-85, -180], [-85, 180], [85, 180], [85, -180]];

function icon(p: Pin, active: boolean) {
  const d = p.count >= 20 ? 40 : 32;
  return L.divIcon({
    className: "pin",
    iconSize: [d, d],
    iconAnchor: [d / 2, d / 2],
    html: `<span style="width:${d}px;height:${d}px;background:${p.color};${active ? "border-color:#1e272c;" : ""}">${p.count}</span>`,
  });
}

/** OpenStreetMap, locked to the campus: the view cannot leave the boundary. */
export default function MapView({ pins, activeId, onPick }: { pins: Pin[]; activeId?: string | null; onPick: (id: string) => void }) {
  return (
    <MapContainer
      center={CAMPUS_CENTER}
      zoom={18}
      minZoom={17}
      maxZoom={20}
      maxBounds={CAMPUS_BOUNDS}
      maxBoundsViscosity={1}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxNativeZoom={19} maxZoom={20}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />
      <Polygon positions={[OUTSIDE, CAMPUS_POLYGON]} pathOptions={{ stroke: false, fillColor: "#1e272c", fillOpacity: 0.25 }} interactive={false} />
      <Polygon positions={CAMPUS_POLYGON} pathOptions={{ color: "#0d9488", weight: 2, dashArray: "6 6", fill: false }} interactive={false} />
      {pins.map((p) => (
        <Marker key={p.id} position={p.at} icon={icon(p, p.id === activeId)} eventHandlers={{ click: () => onPick(p.id) }} />
      ))}
    </MapContainer>
  );
}
