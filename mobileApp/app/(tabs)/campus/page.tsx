"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import CampusMap, { type Marker } from "@/components/CampusMap";
import { CAMPUS_CENTER, nudge } from "@/lib/campus";
import { categories, issues } from "@/lib/mock";

const tone = (s: string): Marker["tone"] =>
  s === "escalated" || s === "overdue" ? "red" : s === "check" ? "green" : s === "promised" ? "blue" : "teal";

export default function Campus() {
  const [cat, setCat] = useState<(typeof categories)[number]>("All");
  const [added, setAdded] = useState<Set<string>>(new Set(issues.filter((i) => i.mine).map((i) => i.code)));
  const [open, setOpen] = useState<string | null>(null);

  const list = useMemo(
    () => issues.filter((i) => i.state !== "sealed" && i.state !== "fixed" && (cat === "All" || i.category === cat.toLowerCase())),
    [cat],
  );
  const markers: Marker[] = list.map((i) => ({ id: i.code, at: i.at, tone: tone(i.state), count: i.count }));

  return (
    <div style={{ margin: "-20px -18px 0" }}>
      <CampusMap markers={markers} aspect={0.86} center={nudge(CAMPUS_CENTER, 0, 14)} zoom={18} activeId={open} onMarker={setOpen} />

      <section
        style={{
          marginTop: -28, position: "relative", background: "var(--bg)", borderRadius: "30px 30px 0 0",
          padding: "12px 18px 0", boxShadow: "0 -10px 30px rgba(20,35,42,.06)",
        }}
      >
        <div style={{ width: 56, height: 6, borderRadius: 3, background: "#c9dad8", margin: "0 auto 14px" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h1 className="h1" style={{ fontSize: 30 }}>On campus now</h1>
          <span className="muted" style={{ fontSize: 18 }}>{list.length} issues</span>
        </div>

        <div className="chips" style={{ marginTop: 12 }} role="tablist" aria-label="Category">
          {categories.map((c) => (
            <button key={c} role="tab" aria-selected={cat === c} className={`pill-btn ${cat === c ? "on" : ""}`} onClick={() => setCat(c)}>{c}</button>
          ))}
        </div>

        <div className="stack" style={{ marginTop: 10 }}>
          {list.map((i) => {
            const t = tone(i.state);
            const cls = t === "red" ? "red" : t === "green" ? "green" : t === "blue" ? "blue" : "teal";
            const on = added.has(i.code);
            return (
              <div key={i.code} className="issue" style={open === i.code ? { borderColor: "var(--green)" } : undefined}>
                <Link href={`/issues/${i.code}`} aria-label={`${i.count} reports`} style={{ flex: "none" }}>
                  <div className={`count ${cls}`}><b>{i.count}</b><small>reports</small></div>
                </Link>
                <Link href={`/issues/${i.code}`} className="mid">
                  <b>{i.title}</b>
                  <div className="sub">{i.place} · {i.dept}</div>
                  <div className={`st ${cls === "teal" ? "green" : cls}`}>{i.note}</div>
                </Link>
                <button
                  className={`pill-btn ${on ? "added" : ""}`}
                  onClick={() => setAdded((s) => { const n = new Set(s); n.has(i.code) ? n.delete(i.code) : n.add(i.code); return n; })}
                  aria-pressed={on}
                >
                  {on ? "Added" : "Me too"}
                </button>
              </div>
            );
          })}
          {list.length === 0 && <p className="muted" style={{ textAlign: "center", padding: 24 }}>Nothing open here. Bol do if you see something.</p>}
        </div>
      </section>
    </div>
  );
}
