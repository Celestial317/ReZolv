"use client";

import Link from "next/link";
import { useState } from "react";
import BarChart from "@/components/BarChart";
import { IconCheck } from "@/components/Icons";
import Topbar from "@/components/Topbar";
import { CAUSAL_CHAINS, EXPECTED_COMPLAINTS, FORECAST } from "@/lib/mock";

export default function RootCausesPage() {
  const [active, setActive] = useState(0);
  const [tasks, setTasks] = useState<Set<string>>(new Set());

  return (
    <>
      <Topbar title="Root causes and forecast" sub="What keeps causing complaints, and what is coming next" />
      <div className="page">
        <div className="detail-grid" style={{ gridTemplateColumns: "minmax(0,1fr) 240px" }}>
          <section className="card">
            <div className="card-head">
              <h2>Causal graph</h2>
              <span className="sub">built by the Root-Cause Detective from 6 weeks of issues</span>
              <span className="right legend">
                <span><i style={{ background: "var(--amber)" }} />Trigger</span>
                <span><i style={{ background: "var(--orange)" }} />Root cause</span>
                <span><i style={{ background: "var(--red)" }} />Issue</span>
              </span>
            </div>
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 22, padding: "20px 16px 22px" }}>
              {CAUSAL_CHAINS.map((c, k) => (
                <div key={c.cause.title} className={`graph-row${active === k ? "" : " dim"}`} onClick={() => setActive(k)}
                  role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setActive(k)} aria-pressed={active === k}>
                  <div className="gnode trigger"><div className="eyebrow">Trigger</div><b>{c.trigger.title}</b><small>{c.trigger.note}</small></div>
                  <div className="gline" />
                  <div className="gnode cause"><div className="eyebrow">Root cause</div><b>{c.cause.title}</b><small>{c.cause.note}</small></div>
                  {c.issues.length > 1 ? (
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: "100%", height: 110 }} aria-hidden="true">
                      <path d="M0,50 C50,50 50,22 100,22 M0,50 C50,50 50,78 100,78" stroke={active === k ? "var(--primary)" : "var(--border-2)"} strokeWidth={2} fill="none" vectorEffect="non-scaling-stroke" />
                    </svg>
                  ) : <div className="gline" />}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {c.issues.map((i) => (
                      <Link key={i.code} href={`/issues/${i.code}`} className="gnode issue" onClick={(e) => e.stopPropagation()}>
                        <div className="eyebrow">Issue</div><b>{i.code} · {i.title}</b><small>{i.note}</small>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <aside style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="eyebrow">Confirmed patterns</div>
            {CAUSAL_CHAINS.map((c, k) => (
              <button key={c.pattern.title} className={`pattern${active === k ? " on" : ""}`} style={{ textAlign: "left" }} onClick={() => setActive(k)}>
                <h4>{c.pattern.title} <span className="mono" style={{ color: "var(--primary)", fontSize: 12 }}>{c.pattern.conf.toFixed(2)}</span></h4>
                <p>{c.pattern.body}</p>
                <span className={`act${c.pattern.warn ? " warn" : ""}`}>{c.pattern.act}</span>
              </button>
            ))}
          </aside>
        </div>

        <div className="detail-grid" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)" }}>
          <section className="card">
            <div className="card-head">
              <h2>Expected complaints · next 7 days</h2>
              <span className="right legend">
                <span><i style={{ background: "#9fd3cf" }} />forecast</span>
                <span><i style={{ background: "var(--orange)" }} />spike</span>
                <span style={{ display: "flex", alignItems: "center" }}><svg width="16" height="4" style={{ marginRight: 5 }}><path d="M0,2 H16" stroke="#13242b" strokeDasharray="4 3" strokeWidth={1.6} /></svg>usual</span>
              </span>
            </div>
            <div className="card-body">
              <BarChart
                ariaLabel={`Expected complaints next 7 days: ${EXPECTED_COMPLAINTS.map((d) => `${d.day} ${d.forecast} (usual ${d.usual})`).join(", ")}`}
                data={EXPECTED_COMPLAINTS.map((d) => ({ label: d.day, value: d.forecast, ref: d.usual, color: d.spike ? "#e8762b" : "#9fd3cf", note: d.why }))}
                max={45} ticks={[0, 15, 30, 45]} refLabel="usual"
              />
            </div>
          </section>

          <section className="card">
            <div className="card-head"><h2>Prevent before it happens</h2></div>
            {FORECAST.map((f) => (
              <div className="list-row" key={f.title}>
                <div className="pct-box"><b>{f.pct}%</b><span>{f.day}</span></div>
                <div style={{ minWidth: 0 }}><b>{f.title}</b><small>{f.fix}</small></div>
                <div className="end">
                  {tasks.has(f.title) ? (
                    <span className="pill pill-green"><IconCheck size={13} /> Task created</span>
                  ) : (
                    <button className="btn btn-primary btn-sm" onClick={() => setTasks((s) => new Set(s).add(f.title))}>Create task</button>
                  )}
                </div>
              </div>
            ))}
          </section>
        </div>
      </div>
    </>
  );
}
