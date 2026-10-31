"use client";

import Link from "next/link";
import { useState } from "react";
import CampusMap from "@/components/CampusMap";
import Topbar from "@/components/Topbar";
import { Bar } from "@/components/ui";
import { BUILDINGS_BY_ISSUES, MAP_PINS } from "@/lib/mock";

const RANGES = [["Today", 0], ["7 days", 7], ["30 days", 30], ["Term", 999]] as const;
const CATEGORIES = ["All", "Water", "Internet", "Safety", "Food"];

export default function MapPage() {
  const [range, setRange] = useState<number>(7);
  const [cat, setCat] = useState("All");
  const [selected, setSelected] = useState("hostel-c");

  const pins = MAP_PINS.filter((p) => p.days <= range && (cat === "All" || p.category === cat));
  const max = Math.max(...BUILDINGS_BY_ISSUES.map((b) => b.n));
  const sel = BUILDINGS_BY_ISSUES.find((b) => b.id === selected);
  const selPin = MAP_PINS.find((p) => p.building === selected && p.id.startsWith("RZV") && p.status !== "sealed");

  return (
    <>
      <Topbar title="Campus map" sub="Drag to move · switch between pins and heat" />
      <div className="page">
        <div className="detail-grid" style={{ gridTemplateColumns: "224px minmax(0,1fr)" }}>
          <aside style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <section className="card card-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div className="eyebrow">Time range</div>
              <div className="chips">
                {RANGES.map(([l, d]) => <button key={l} className={`chip${range === d ? " on" : ""}`} onClick={() => setRange(d)}>{l}</button>)}
              </div>
              <div className="eyebrow" style={{ marginTop: 4 }}>Category</div>
              <div className="chips">
                {CATEGORIES.map((c) => <button key={c} className={`chip${cat === c ? " on" : ""}`} onClick={() => setCat(c)}>{c}</button>)}
              </div>
            </section>
            <section className="card" style={{ overflow: "hidden" }}>
              <div className="card-head" style={{ padding: "12px 14px" }}><h2 style={{ fontSize: 14.5 }}>Buildings by open issues</h2></div>
              {BUILDINGS_BY_ISSUES.map((b) => (
                <button key={b.id} className={`bld-row${selected === b.id ? " on" : ""}`} onClick={() => setSelected(b.id)}>
                  <div><b>{b.name}</b><small>{b.note}</small></div>
                  <Bar value={b.n / max} color={b.color} />
                  <span className="n">{b.n}</span>
                </button>
              ))}
            </section>
          </aside>

          <section className="card" style={{ overflow: "hidden" }}>
            <div className="card-head" style={{ borderBottom: "2px solid var(--amber-soft)" }}>
              <h2>{sel?.name ?? "Campus"}</h2>
              {sel && <span className="sub">{sel.n} open · {sel.note}</span>}
              {selPin && <Link href={`/issues/${selPin.id}`} className="link" style={{ marginLeft: 6 }}>Open {selPin.id}</Link>}
              <span className="right" style={{ color: "var(--green)", fontWeight: 600, fontSize: 12.5, display: "flex", gap: 6, alignItems: "center" }}>
                <span className="live-dot" style={{ width: 6, height: 6 }} /> Updating live
              </span>
            </div>
            <CampusMap pins={pins} height={600} selected={selected} onSelect={(b) => setSelected(b)} />
          </section>
        </div>
      </div>
    </>
  );
}
