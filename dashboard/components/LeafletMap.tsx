"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo, useState } from "react";
import { Circle, MapContainer, Marker, Polygon, TileLayer, Tooltip } from "react-leaflet";
import { IconLocate } from "./Icons";
import { CAMPUS_BOUNDARY, CAMPUS_BOUNDS, LOCATIONS, SPORTS_GROUND, locationById } from "@/lib/campus";
import { MAP_COLORS, MAP_LABELS, type MapPin, type MapStatus } from "@/lib/mock";

export type MapProps = {
  pins: MapPin[];
  height?: number;
  defaultMode?: "pins" | "heat";
  selected?: string | null;
  onSelect?: (location: string, pin?: MapPin) => void;
  legend?: boolean;
  focus?: string;          // location id to centre on instead of the whole campus
  labels?: boolean;        // location names under the points
  scrollZoom?: boolean;
  compact?: boolean;       // small embeds: zoom buttons only
};

// Everything outside the wall is washed out, so the campus reads as the only place on the map.
const WORLD: L.LatLngExpression[] = [[-85, -180], [-85, 180], [85, 180], [85, -180]];
const MIN_ZOOM = 17;
const MAX_ZOOM = 19; // OSM standard tiles stop at 19

function pinSize(p: MapPin) {
  if (p.status === "predicted") return 18;
  return Math.round(20 + (Math.min(p.reports, 47) / 47) * 10);
}

function pinIcon(p: MapPin, selected: boolean, compact: boolean) {
  const s = compact ? 14 : pinSize(p);
  const label = !compact && p.reports > 0 ? String(p.reports) : "";
  const cls = ["mpin", p.status, selected ? "sel" : "", compact ? "dot" : ""].filter(Boolean).join(" ");
  return L.divIcon({
    className: "mpin-wrap",
    html: `<span class="${cls}" style="--c:${MAP_COLORS[p.status]};--s:${s}px">${label}</span>`,
    iconSize: [s, s],
    iconAnchor: [s / 2, s / 2],
    tooltipAnchor: [0, -s / 2 - 2],
  });
}

const labelIcon = (name: string) =>
  L.divIcon({ className: "mlabel-wrap", html: `<span class="mlabel">${name}</span>`, iconSize: [0, 0], iconAnchor: [0, 0] });

export default function LeafletMap({
  pins, height = 560, defaultMode = "pins", selected, onSelect, legend = true, focus, labels = true, scrollZoom = true, compact = false,
}: MapProps) {
  const [map, setMap] = useState<L.Map | null>(null);
  const [mode, setMode] = useState<"pins" | "heat">(defaultMode);
  const [zoom, setZoom] = useState(18);
  const focusAt = focus ? locationById(focus)?.at : undefined;

  const home = useMemo(() => () => {
    if (!map) return;
    if (focusAt) map.setView(focusAt, 19);
    else map.fitBounds(CAMPUS_BOUNDARY, { padding: [16, 16] });
  }, [map, focusAt]);

  useEffect(() => {
    if (!map) return;
    home();
    const onZoom = () => setZoom(map.getZoom());
    onZoom();
    map.on("zoomend", onZoom);
    return () => { map.off("zoomend", onZoom); };
  }, [map, home]);

  // Pan to whatever is picked from a list outside the map.
  useEffect(() => {
    const at = selected ? locationById(selected)?.at : undefined;
    if (map && at && !focus) map.panTo(at, { animate: true });
  }, [map, selected, focus]);

  const heat = mode === "heat";
  const showLabels = labels && zoom >= 18;
  const pinLocations = new Set(pins.map((p) => p.building));

  return (
    <div className="map" style={{ height }}>
      <MapContainer
        ref={setMap}
        center={focusAt ?? [28.73266, 77.11903]}
        zoom={18}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        maxBounds={CAMPUS_BOUNDS}
        maxBoundsViscosity={1}
        zoomControl={false}
        scrollWheelZoom={scrollZoom}
        zoomSnap={0.5}
        attributionControl
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={MAX_ZOOM}
          bounds={CAMPUS_BOUNDS}
        />
        <Polygon positions={[WORLD, CAMPUS_BOUNDARY]} pathOptions={{ stroke: false, fillColor: "#f4fafa", fillOpacity: 0.72 }} interactive={false} />
        <Polygon positions={CAMPUS_BOUNDARY} pathOptions={{ color: "#0e6b60", weight: 2, opacity: 0.8, fill: false }} interactive={false} />
        <Polygon positions={SPORTS_GROUND} pathOptions={{ stroke: false, fillColor: "#7cc47f", fillOpacity: 0.18 }} interactive={false} />

        {showLabels &&
          LOCATIONS.map((l) => (
            <Marker key={`l-${l.id}`} position={l.at} icon={labelIcon(l.name)} interactive={false} keyboard={false}
              zIndexOffset={-1000} opacity={pinLocations.has(l.id) || l.id === selected ? 1 : 0.7} />
          ))}

        {heat &&
          pins.filter((p) => p.status !== "resolved").map((p) => {
            const at = locationById(p.building)?.at;
            if (!at) return null;
            const r = p.status === "predicted" ? 16 : 10 + Math.min(p.reports, 47) * 0.32;
            return [0.14, 0.18].map((o, k) => (
              <Circle key={`h-${p.id}-${k}`} center={at} radius={r * (1 - k * 0.45)} interactive={false}
                pathOptions={{ stroke: false, fillColor: MAP_COLORS[p.status], fillOpacity: o }} />
            ));
          })}

        {pins.map((p) => {
          const at = locationById(p.building)?.at;
          if (!at) return null;
          const name = locationById(p.building)?.name ?? "";
          return (
            <Marker key={p.id} position={at} icon={pinIcon(p, selected === p.building, heat)}
              eventHandlers={{ click: () => onSelect?.(p.building, p) }}
              title={`${p.label}, ${name}`} riseOnHover>
              <Tooltip direction="top" className="rz-tip" opacity={1}>
                <b>{p.label}</b>
                <span>{p.id.startsWith("RZV") ? `${p.id} · ` : ""}{MAP_LABELS[p.status]}{p.reports ? ` · ${p.reports} reports` : ""}</span>
                <span className="faint">{name}</span>
              </Tooltip>
            </Marker>
          );
        })}
      </MapContainer>

      {!compact && (
        <div className="mode seg">
          <button className={mode === "pins" ? "on" : ""} onClick={() => setMode("pins")}>Pins</button>
          <button className={mode === "heat" ? "on" : ""} onClick={() => setMode("heat")}>Heat</button>
        </div>
      )}
      <div className="ctrls">
        <button aria-label="Zoom in" onClick={() => map?.zoomIn()} disabled={zoom >= MAX_ZOOM}>+</button>
        <button aria-label="Zoom out" onClick={() => map?.zoomOut()} disabled={zoom <= MIN_ZOOM}>−</button>
        <button aria-label="Show whole campus" onClick={home}><IconLocate size={16} /></button>
      </div>
      {legend && !compact && (
        <div className="legend-bar">
          {(Object.keys(MAP_LABELS) as MapStatus[]).map((s) => (
            <span key={s}><i style={{ background: MAP_COLORS[s] }} />{MAP_LABELS[s]}</span>
          ))}
        </div>
      )}
    </div>
  );
}
