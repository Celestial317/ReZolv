"use client";

import { useRef, useState } from "react";
import { IconLocate } from "./Icons";
import { MAP_COLORS, MAP_LABELS, type MapPin, type MapStatus } from "@/lib/mock";

// Stylised plan of the demo campus (fictional layout, 1000 x 640 units).
// Swap for react-leaflet + OSM tiles once real coordinates come from /admin/map.

type Building = { id: string; name: string; x: number; y: number; w: number; h: number };

const BUILDINGS: Building[] = [
  { id: "main-gate", name: "Main Gate", x: 450, y: 4, w: 90, h: 24 },
  { id: "academic-a", name: "Academic Block A", x: 160, y: 70, w: 190, h: 100 },
  { id: "lab", name: "Lab Block", x: 160, y: 200, w: 190, h: 90 },
  { id: "canteen", name: "Canteen", x: 420, y: 62, w: 145, h: 80 },
  { id: "admin", name: "Admin Block", x: 420, y: 172, w: 145, h: 110 },
  { id: "library", name: "Library", x: 625, y: 70, w: 120, h: 100 },
  { id: "auditorium", name: "Auditorium", x: 805, y: 70, w: 165, h: 100 },
  { id: "hostel-b", name: "Hostel B · Boys", x: 60, y: 372, w: 180, h: 110 },
  { id: "hostel-c", name: "Hostel C · Girls", x: 305, y: 384, w: 180, h: 110 },
  { id: "mess", name: "Mess", x: 625, y: 362, w: 125, h: 95 },
  { id: "pump", name: "Pump House", x: 505, y: 548, w: 80, h: 44 },
];

const PIN_AT: Record<string, [number, number]> = {
  "hostel-c": [395, 470], "hostel-b": [150, 458], "academic-a": [255, 145], lab: [255, 268], library: [685, 145],
  mess: [712, 444], pump: [545, 540], "sports-road": [772, 322], canteen: [492, 120], admin: [492, 250],
};

const ROADS = [
  [0, 30, 1000, 14], [0, 315, 1000, 14], [375, 30, 14, 299], [590, 30, 14, 610], [765, 30, 14, 299], [268, 329, 14, 311],
];

type View = { k: number; x: number; y: number };
const HOME: View = { k: 1, x: 0, y: 0 };

/** View that centres the plan on a building at zoom k. */
export function focusOn(building: string, k = 1.6): View {
  const [px, py] = PIN_AT[building] ?? [500, 320];
  return { k, x: 500 - px * k, y: 320 - py * k };
}

export default function CampusMap({
  pins, height = 560, defaultMode = "pins", selected, onSelect, legend = true, initialView = HOME,
}: {
  pins: MapPin[]; height?: number; defaultMode?: "pins" | "heat"; selected?: string | null;
  onSelect?: (building: string, pin?: MapPin) => void; legend?: boolean; initialView?: View;
}) {
  const [mode, setMode] = useState<"pins" | "heat">(defaultMode);
  const [view, setView] = useState<View>(initialView);
  const [hover, setHover] = useState<{ pin: MapPin; x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ px: number; py: number; vx: number; vy: number; moved: boolean } | null>(null);
  const justDragged = useRef(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const unitsPerPx = () => {
    const el = svgRef.current;
    if (!el) return 1;
    return 1 / Math.max(el.clientWidth / 1000, el.clientHeight / 640);
  };

  const zoom = (delta: number) =>
    setView((v) => {
      const k = Math.min(3, Math.max(1, +(v.k + delta).toFixed(2)));
      // keep the centre of the plan fixed while zooming
      const cx = 500, cy = 320;
      return { k, x: cx - ((cx - v.x) / v.k) * k, y: cy - ((cy - v.y) / v.k) * k };
    });

  const onDown = (e: React.PointerEvent) => {
    drag.current = { px: e.clientX, py: e.clientY, vx: view.x, vy: view.y, moved: false };
    justDragged.current = false;
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.px, dy = e.clientY - d.py;
    if (!d.moved && Math.hypot(dx, dy) < 4) return;
    if (!d.moved) { d.moved = true; setDragging(true); (e.currentTarget as Element).setPointerCapture(e.pointerId); }
    const u = unitsPerPx();
    setView((v) => ({ ...v, x: d.vx + dx * u, y: d.vy + dy * u }));
  };
  const onUp = () => {
    if (drag.current?.moved) justDragged.current = true;
    drag.current = null;
    setDragging(false);
  };

  const pinPos = (p: MapPin) => PIN_AT[p.building] ?? [500, 320];
  const showTip = (pin: MapPin, e: React.PointerEvent) => {
    const box = svgRef.current?.getBoundingClientRect();
    if (box) setHover({ pin, x: e.clientX - box.left, y: e.clientY - box.top });
  };

  return (
    <div className="map" style={{ height }}>
      <svg
        ref={svgRef}
        className={`plan${dragging ? " dragging" : ""}`}
        viewBox="0 0 1000 640"
        preserveAspectRatio="xMidYMid slice"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
        role="img"
        aria-label={`Campus map, ${pins.length} issues shown as ${mode}`}
      >
        <defs>
          {(Object.keys(MAP_COLORS) as MapStatus[]).map((s) => (
            <radialGradient key={s} id={`heat-${s}`}>
              <stop offset="0%" stopColor={MAP_COLORS[s]} stopOpacity={0.55} />
              <stop offset="55%" stopColor={MAP_COLORS[s]} stopOpacity={0.22} />
              <stop offset="100%" stopColor={MAP_COLORS[s]} stopOpacity={0} />
            </radialGradient>
          ))}
        </defs>
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          <rect x={-600} y={-600} width={2200} height={1840} fill="#f1ece5" />
          <rect x={20} y={56} width={110} height={52} rx={8} fill="#cdeab0" />
          <rect x={805} y={345} width={175} height={170} rx={8} fill="#cdeab0" />
          <text x={892} y={434} textAnchor="middle" fontSize={15} fontWeight={600} fill="#4f7a3a">Sports Complex</text>
          <ellipse cx={80} cy={215} rx={62} ry={44} fill="#a9d3e3" />
          <text x={80} y={220} textAnchor="middle" fontSize={14} fill="#3e6f82">Lake</text>
          {ROADS.map(([x, y, w, h], i) => <rect key={i} x={x} y={y} width={w} height={h} fill="#fff" />)}
          <path d="M120,255 Q140,300 165,330" stroke="#fff" strokeWidth={10} fill="none" />
          <text x={900} y={25} textAnchor="middle" fontSize={13} fill="#8a8178">College Road</text>
          {BUILDINGS.map((b) => {
            const on = selected === b.id;
            return (
              <g key={b.id} onClick={() => !justDragged.current && onSelect?.(b.id)} style={{ cursor: onSelect ? "pointer" : undefined }}>
                <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={6} fill={on ? "#cfe9e6" : "#dcd3c9"} stroke={on ? "#0e6b60" : "#c9bdb0"} strokeWidth={on ? 2.5 : 1} />
                <text x={b.x + b.w / 2} y={b.y + b.h / 2 + 5} textAnchor="middle" fontSize={b.h < 40 ? 12 : 15} fontWeight={500} fill="#5c5249">{b.name}</text>
              </g>
            );
          })}

          {mode === "heat" &&
            pins.filter((p) => p.status !== "resolved").map((p) => {
              const [x, y] = pinPos(p);
              const r = p.status === "predicted" ? 80 : 60 + Math.min(p.reports, 50) * 2.4;
              return <circle key={`h-${p.id}`} cx={x} cy={y} r={r} fill={`url(#heat-${p.status})`} />;
            })}

          {pins.map((p) => {
            const [x, y] = pinPos(p);
            const r = p.status === "predicted" ? 10 : 10 + (Math.min(p.reports, 47) / 47) * 12;
            const color = MAP_COLORS[p.status];
            const small = mode === "heat";
            return (
              <g key={p.id} className="pin"
                onPointerEnter={(e) => showTip(p, e)} onPointerMove={(e) => showTip(p, e)} onPointerLeave={() => setHover(null)}
                onClick={() => !justDragged.current && onSelect?.(p.building, p)}>
                {p.status === "overdue" && <circle className="pulse" cx={x} cy={y} r={r} fill={color} />}
                {p.status === "predicted" ? (
                  <g>
                    <circle cx={x} cy={y} r={r + 3} fill="none" stroke={color} strokeWidth={3} strokeDasharray="3 3" />
                    <circle className="core" cx={x} cy={y} r={r - 2} fill={color} />
                  </g>
                ) : (
                  <circle className="core" cx={x} cy={y} r={small ? r * 0.75 : r} fill={color} stroke="#fff" strokeWidth={4} />
                )}
                <circle cx={x} cy={y} r={r + 10} fill="transparent" />
              </g>
            );
          })}
        </g>
      </svg>

      {hover && (
        <div className="map-tip" style={{ left: hover.x, top: hover.y }}>
          <b>{hover.pin.label}</b>
          <span className="mono">{hover.pin.id}</span> · {MAP_LABELS[hover.pin.status]}
          {hover.pin.reports > 0 && <> · {hover.pin.reports} reports</>}
        </div>
      )}

      <div className="mode seg">
        <button className={mode === "pins" ? "on" : ""} onClick={() => setMode("pins")}>Pins</button>
        <button className={mode === "heat" ? "on" : ""} onClick={() => setMode("heat")}>Heat</button>
      </div>
      <div className="ctrls">
        <button aria-label="Zoom in" onClick={() => zoom(0.25)}>+</button>
        <button aria-label="Zoom out" onClick={() => zoom(-0.25)}>−</button>
        <button aria-label="Reset view" onClick={() => setView(initialView)}><IconLocate size={16} /></button>
      </div>
      {legend && (
        <div className="legend-bar">
          {(Object.keys(MAP_LABELS) as MapStatus[]).map((s) => (
            <span key={s}><i style={{ background: MAP_COLORS[s] }} />{MAP_LABELS[s]}</span>
          ))}
        </div>
      )}
      <span className="attrib">Demo campus plan</span>
    </div>
  );
}
