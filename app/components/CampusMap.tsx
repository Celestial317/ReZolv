"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Nav } from "./Icons";

/** Stylised campus map (world units). Swap for Leaflet + OpenStreetMap tiles once real coordinates are wired in. */
export const BUILDINGS = [
  { name: "Academic Block A", x: 60, y: 40, w: 160, h: 90 },
  { name: "Lab Block", x: 60, y: 170, w: 160, h: 80 },
  { name: "Canteen", x: 300, y: 30, w: 120, h: 70 },
  { name: "Admin Block", x: 300, y: 130, w: 120, h: 90 },
  { name: "Library", x: 480, y: 40, w: 130, h: 90 },
  { name: "Auditorium", x: 640, y: 40, w: 120, h: 90 },
  { name: "Hostel B", x: 80, y: 330, w: 150, h: 110 },
  { name: "Hostel C", x: 290, y: 345, w: 150, h: 100 },
  { name: "Mess", x: 500, y: 305, w: 140, h: 90 },
  { name: "Pump House", x: 490, y: 440, w: 80, h: 50 },
];

export type Marker = { id: string; at: [number, number]; tone: "red" | "blue" | "green" | "teal"; size?: number };

const TONES = { red: "#d93c3c", blue: "#2563eb", green: "#1e9150", teal: "#14a39a" };

type Props = {
  markers?: Marker[];
  /** "pin" mode: the pin is fixed in the centre and the map moves under it. */
  mode?: "view" | "pin";
  center?: [number, number];
  zoom?: number;
  aspect?: number; // height / width
  controls?: boolean;
  onCenter?: (c: [number, number], building: string | null) => void;
  onMarker?: (id: string) => void;
  className?: string;
};

export function buildingAt([x, y]: [number, number]): string | null {
  const b = BUILDINGS.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
  return b ? b.name : null;
}

export default function CampusMap({
  markers = [], mode = "view", center = [330, 260], zoom = 1, aspect = 1, controls = true, onCenter, onMarker, className,
}: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [c, setC] = useState<[number, number]>(center);
  const [z, setZ] = useState(zoom);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const W = 560 / z;
  const H = W * aspect;

  useEffect(() => { onCenter?.(c, buildingAt(c)); }, [c]); // eslint-disable-line react-hooks/exhaustive-deps

  const move = useCallback((e: React.PointerEvent) => {
    if (!drag.current || !box.current) return;
    const k = W / box.current.clientWidth;
    const dx = (e.clientX - drag.current.x) * k, dy = (e.clientY - drag.current.y) * k;
    drag.current = { x: e.clientX, y: e.clientY };
    setC(([x, y]) => [Math.min(800, Math.max(0, x - dx)), Math.min(520, Math.max(0, y - dy))]);
  }, [W]);

  return (
    <div
      ref={box}
      className={`map ${className ?? ""}`}
      style={{ aspectRatio: `${1 / aspect}`, cursor: "grab" }}
      onPointerDown={(e) => { drag.current = { x: e.clientX, y: e.clientY }; }}
      onPointerMove={move}
      onPointerUp={() => { drag.current = null; }}
      onPointerCancel={() => { drag.current = null; }}
      onPointerLeave={() => { drag.current = null; }}
    >
      <svg viewBox={`${c[0] - W / 2} ${c[1] - H / 2} ${W} ${H}`} preserveAspectRatio="xMidYMid slice" role="img" aria-label="Campus map">
        <rect x="-400" y="-300" width="1600" height="1200" fill="#f0ede6" />
        {/* lake + park */}
        <ellipse cx="10" cy="295" rx="70" ry="42" fill="#a9d3e0" />
        <text x="-6" y="299" fontSize="14" fill="#4b7f91" fontWeight="600">Lake</text>
        <rect x="670" y="240" width="200" height="220" rx="10" fill="#cde8b3" />
        <text x="700" y="350" fontSize="14" fill="#5f8a46" fontWeight="600">Sports Complex</text>
        {/* roads */}
        <rect x="-400" y="265" width="1600" height="32" fill="#fff" />
        <rect x="248" y="-300" width="32" height="1200" fill="#fff" />
        <rect x="452" y="-300" width="32" height="1200" fill="#fff" />
        <path d="M60 300Q95 380 120 470" stroke="#fff" strokeWidth="14" fill="none" strokeLinecap="round" />
        {BUILDINGS.map((b) => (
          <g key={b.name}>
            <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="6" fill="#d9d0c7" stroke="#c9beb2" strokeWidth="1.5" />
            <text x={b.x + b.w / 2} y={b.y + b.h / 2 - 6} textAnchor="middle" fontSize="13" fill="#5a4b3e" fontWeight="600">{b.name}</text>
          </g>
        ))}
        {markers.map((m) => {
          const r = m.size ?? 11;
          return (
            <g key={m.id} onClick={(e) => { e.stopPropagation(); onMarker?.(m.id); }} style={{ cursor: onMarker ? "pointer" : "inherit" }}>
              <circle cx={m.at[0]} cy={m.at[1]} r={r + 4} fill="#fff" />
              <circle cx={m.at[0]} cy={m.at[1]} r={r} fill={TONES[m.tone]} />
            </g>
          );
        })}
      </svg>

      {mode === "pin" && (
        <svg
          width="46" height="62" viewBox="0 0 46 62" aria-hidden
          style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -100%)", pointerEvents: "none", filter: "drop-shadow(0 4px 4px rgba(0,0,0,.25))" }}
        >
          <path d="M23 59C23 59 3 38 3 22a20 20 0 0 1 40 0c0 16-20 37-20 37z" fill="#14232a" stroke="#fff" strokeWidth="4" />
          <circle cx="23" cy="22" r="8" fill="#b3e3e6" />
        </svg>
      )}

      {controls && (
        <div className="ctl" style={{ bottom: 52 }}>
          <button aria-label="Zoom in" onClick={() => setZ((v) => Math.min(2.4, v * 1.3))}>+</button>
          <button aria-label="Zoom out" onClick={() => setZ((v) => Math.max(0.6, v / 1.3))}>−</button>
          <button aria-label="Recentre" onClick={() => { setC(center); setZ(zoom); }}><Nav color="#0f6b5e" /></button>
        </div>
      )}
      <div className="attr">© OpenStreetMap contributors</div>
    </div>
  );
}
