"use client";

import { useState } from "react";
import { IconLock } from "@/components/Icons";
import Topbar from "@/components/Topbar";
import { Pill } from "@/components/ui";
import { RELEASED, SEALED, THRESHOLDS } from "@/lib/mock";

// Staff only ever see counts for sealed issues (GET /admin/sealed): no text, no pseudonyms, no rooms.
export default function SafeVoicePage() {
  const [selected, setSelected] = useState(SEALED[0].code);
  const [thresholds, setThresholds] = useState(THRESHOLDS.map((t) => t.value));
  const [pending, setPending] = useState(false);
  const s = SEALED.find((x) => x.code === selected)!;

  function bump(k: number, d: number) {
    setThresholds((all) => all.map((v, i) => (i === k ? Math.min(10, Math.max(2, v + d)) : v)));
    setPending(true);
  }

  return (
    <>
      <Topbar title="Safe Voice" sub="Sensitive reports, released only when enough students agree" />
      <div className="page">
        <section className="vault-banner">
          <span className="ic"><IconLock size={22} /></span>
          <div>
            <h3>Nobody on this dashboard can see who reported</h3>
            <p>
              Identities sit in a separate vault that only the Privacy Guardian agent can read. A sealed issue opens only when
              enough separate students report the same pattern, so no single reporter can be singled out.
            </p>
          </div>
          <div className="nums">
            <div><b style={{ color: "var(--lilac)" }}>{SEALED.length}</b><span>sealed now</span></div>
            <div><b>7</b><span>released this term</span></div>
          </div>
        </section>

        <div className="detail-grid" style={{ gridTemplateColumns: "minmax(0,1fr) 300px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="eyebrow">Sealed · waiting for more reports</div>
            {SEALED.map((x) => (
              <button key={x.code} className={`sealed-card${selected === x.code ? " on" : ""}`} onClick={() => setSelected(x.code)} aria-pressed={selected === x.code}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{x.code}</span>
                  <Pill tone="purple">{x.category}</Pill>
                  <span className="faint" style={{ marginLeft: "auto", fontSize: 12 }}>{x.first}</span>
                </div>
                <h4>{x.title}</h4>
                <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <span className="segs" aria-hidden="true">
                    {Array.from({ length: x.threshold }, (_, k) => <i key={k} className={k < x.reporters ? "on" : ""} />)}
                  </span>
                  <b style={{ color: "var(--purple)", fontSize: 13 }}>{x.reporters} of {x.threshold} reports</b>
                  <span className="muted" style={{ fontSize: 12.5 }}>{x.next}</span>
                </div>
              </button>
            ))}

            <div className="eyebrow" style={{ marginTop: 10 }}>Released · now with a committee</div>
            <section className="card">
              {RELEASED.map((r) => (
                <div className="list-row" key={r.code}>
                  <span className="mono" style={{ fontSize: 12, fontWeight: 600, width: 64 }}>{r.code}</span>
                  <div><b>{r.title}</b><small>{r.sub}</small></div>
                  <span className="end"><Pill tone={r.badge.tone}>{r.badge.label}</Pill></span>
                </div>
              ))}
            </section>
          </div>

          <aside style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <section className="card">
              <div className="card-head" style={{ padding: "12px 14px" }}><h2 style={{ fontSize: 14.5 }}>{s.code} · what you can see</h2></div>
              <div className="card-body" style={{ padding: "8px 14px 14px" }}>
                <div className="kv"><span>Category</span><b>{s.category}</b></div>
                <div className="kv"><span>Reports</span><b>{s.reporters} of {s.threshold}</b></div>
                <div className="kv"><span>Area</span><b>{s.area}</b></div>
                <div className="kv"><span>Languages</span><b>{s.languages}</b></div>
                <div className="kv"><span>Releases to</span><b>{s.releasesTo}</b></div>
                <div className="note-purple" style={{ marginTop: 8 }}>
                  Report text stays sealed until release. Pseudonyms, times and exact rooms are hidden even from committee members.
                </div>
              </div>
            </section>

            <section className="card">
              <div className="card-head" style={{ padding: "12px 14px", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
                <h2 style={{ fontSize: 14.5 }}>Release thresholds</h2>
                <span className="sub">How many separate students must agree</span>
              </div>
              {THRESHOLDS.map((t, k) => (
                <div className="list-row" key={t.category} style={{ padding: "10px 14px" }}>
                  <div><b>{t.category}</b><small>goes to {t.goesTo}</small></div>
                  <div className="end stepper">
                    <button aria-label={`Lower ${t.category} threshold`} onClick={() => bump(k, -1)}>−</button>
                    <b>{thresholds[k]}</b>
                    <button aria-label={`Raise ${t.category} threshold`} onClick={() => bump(k, 1)}>+</button>
                  </div>
                </div>
              ))}
              <div className="card-body" style={{ padding: "10px 14px", fontSize: 12, color: "var(--text-2)" }}>
                {pending ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
                    <span>Change sent for approval by 2 committee members.</span>
                    <button className="link" onClick={() => { setThresholds(THRESHOLDS.map((t) => t.value)); setPending(false); }}>Undo</button>
                  </div>
                ) : (
                  "Changes need approval from 2 committee members."
                )}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </>
  );
}
