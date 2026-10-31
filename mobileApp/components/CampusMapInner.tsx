"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo } from "react";
import { MapContainer, Marker as LMarker, Polygon, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { CAMPUS_BOUNDS, CAMPUS_CENTER, CAMPUS_POLYGON, placeAt, type LatLng } from "@/lib/campus";
import { Nav } from "./Icons";
import type { Marker } from "./CampusMap";

const TONES = { red: "#d93c3c", blue: "#2563eb", green: "#1e9150", teal: "#14a39a" };

/** Clean round pin: coloured disc, white ring, report count inside. */
function pinIcon(m: Marker, active: boolean) {
  const big = (m.count ?? 0) >= 40;
  const d = big ? 38 : 30;
  const ring = active ? "#14232a" : "#fff";
  return L.divIcon({
    className: "pin",
    iconSize: [d, d],
    iconAnchor: [d / 2, d / 2],
    html: `<span style="width:${d}px;height:${d}px;background:${TONES[m.tone]};border-color:${ring}">${m.count ?? ""}</span>`,
  });
}

const OUTSIDE: LatLng[] = [[-85, -180], [-85, 180], [85, 180], [85, -180]];

function Watch({ onCenter }: { onCenter?: (c: LatLng, place: string | null) => void }) {
  const map = useMap();
  const emit = () => {
    const c = map.getCenter();
    onCenter?.([c.lat, c.lng], placeAt([c.lat, c.lng]));
  };
  useMapEvents({ moveend: emit });
  useEffect(emit, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function Controls({ center, zoom }: { center: LatLng; zoom: number }) {
  const map = useMap();
  return (
    <div className="ctl" style={{ bottom: 40 }}>
      <button aria-label="Zoom in" onClick={() => map.zoomIn()}>+</button>
      <button aria-label="Zoom out" onClick={() => map.zoomOut()}>−</button>
      <button aria-label="Recentre on campus" onClick={() => map.setView(center, zoom)}><Nav color="#0f6b5e" /></button>
    </div>
  );
}

type Props = {
  markers: Marker[];
  mode: "view" | "pin";
  center: LatLng;
  zoom: number;
  controls: boolean;
  activeId?: string | null;
  onCenter?: (c: LatLng, place: string | null) => void;
  onMarker?: (id: string) => void;
};

export default function CampusMapInner({ markers, mode, center, zoom, controls, activeId, onCenter, onMarker }: Props) {
  const icons = useMemo(() => markers.map((m) => pinIcon(m, m.id === activeId)), [markers, activeId]);

  return (
    <>
      <MapContainer
        center={center ?? CAMPUS_CENTER}
        zoom={zoom}
        minZoom={18}
        maxZoom={20}
        zoomSnap={0.5}
        maxBounds={CAMPUS_BOUNDS}
        maxBoundsViscosity={1}
        zoomControl={false}
        attributionControl
        style={{ height: "100%", width: "100%", background: "#eef1ee" }}
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxNativeZoom={19}
          maxZoom={20}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        {/* dim everything outside the campus, outline the campus itself */}
        <Polygon positions={[OUTSIDE, CAMPUS_POLYGON]} pathOptions={{ stroke: false, fillColor: "#14232a", fillOpacity: 0.28 }} interactive={false} />
        <Polygon positions={CAMPUS_POLYGON} pathOptions={{ color: "#0f6b5e", weight: 2, dashArray: "6 6", fill: false }} interactive={false} />

        {markers.map((m, n) => (
          <LMarker key={m.id} position={m.at} icon={icons[n]} eventHandlers={{ click: () => onMarker?.(m.id) }} keyboard={!!onMarker} />
        ))}

        <Watch onCenter={onCenter} />
        {controls && <Controls center={center} zoom={zoom} />}
      </MapContainer>

      {mode === "pin" && (
        <svg
          width="40" height="54" viewBox="0 0 46 62" aria-hidden
          style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -100%)", pointerEvents: "none", zIndex: 1000, filter: "drop-shadow(0 3px 3px rgba(0,0,0,.28))" }}
        >
          <path d="M23 59C23 59 3 38 3 22a20 20 0 0 1 40 0c0 16-20 37-20 37z" fill="#14232a" stroke="#fff" strokeWidth="4" />
          <circle cx="23" cy="22" r="8" fill="#b3e3e6" />
        </svg>
      )}
    </>
  );
}
