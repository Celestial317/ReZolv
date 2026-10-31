"use client";

import { useState } from "react";
import BarChart from "@/components/BarChart";
import Topbar from "@/components/Topbar";
import { Bar } from "@/components/ui";
import { KEPT_TARGET, SCORE_MONTHS, SCORECARD } from "@/lib/mock";

const PERIODS = ["This month", "This term", "This year"] as const;

const keptColor = (n: number) => (n >= 85 ? "var(--green)" : n >= 65 ? "var(--teal)" : "var(--red)");

export default function ScorecardPage() {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>("This term");
  const [selected, setSelected] = useState(2);
  const [publicView, setPublicView] = useState(true);
  const dept = SCORECARD[selected];
  const learned = dept.learned ?? [
    `Kept ${dept.kept}% of promises this term.`,
    `Average fix takes ${dept.fix}.`,
    `${dept.back}% of fixed issues came back within 30 days.`,
  ];

  return (
    <>
      <Topbar title="Department scorecard" sub="Who keeps their promises" />
      <div className="page">
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div className="seg" role="tablist">
            {PERIODS.map((p) => <button key={p} className={period === p ? "on" : ""} onClick={() => setPeriod(p)}>{p}</button>)}
          </div>
          <label className="check" style={{ marginLeft: "auto" }}>
            <input type="checkbox" checked={publicView} onChange={(e) => setPublicView(e.target.checked)} />
            Show this scorecard to students in the app
          </label>
        </div>

        <section className="card table-wrap">
          <table className="t">
            <thead>
              <tr><th>Department</th><th>Promises kept</th><th>Avg fix</th><th>Comes back</th><th>Student OK</th><th>Grade</th></tr>
            </thead>
            <tbody>
              {SCORECARD.map((d, k) => (
                <tr key={d.name} className={`clickable${k === selected ? " sel" : ""}`} onClick={() => setSelected(k)} aria-selected={k === selected}>
                  <td className="what"><b>{d.name}</b><span>{d.owner}</span></td>
                  <td>
                    <div className="impact">
                      <Bar value={d.kept / 100} color={keptColor(d.kept)} width={54} />
                      <b>{d.kept}%</b>
                    </div>
                  </td>
                  <td>{d.fix}</td>
                  <td style={{ color: d.back >= 20 ? "var(--red)" : undefined, fontWeight: d.back >= 20 ? 600 : 400 }}>{d.back}%</td>
                  <td>{d.ok}</td>
                  <td><span className={`grade grade-${d.grade}`}>{d.grade}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <div className="detail-grid" style={{ gridTemplateColumns: "minmax(0,2fr) minmax(260px,1fr)" }}>
          <section className="card">
            <div className="card-head">
              <h2>{dept.name} · promises kept per month</h2>
              <span className="right legend"><span><i style={{ background: "#9fd3cf" }} />at or above {KEPT_TARGET}%</span><span><i style={{ background: "#f2a5a5" }} />below</span></span>
            </div>
            <div className="card-body">
              <BarChart
                ariaLabel={`${dept.name}: promises kept per month, ${SCORE_MONTHS.map((m, i) => `${m} ${dept.months[i]}%`).join(", ")}`}
                data={SCORE_MONTHS.map((m, i) => ({ label: m, value: dept.months[i], color: dept.months[i] >= KEPT_TARGET ? "#9fd3cf" : "#f2a5a5" }))}
                max={100} ticks={[0, 50, 100]} unit="%" height={210}
              />
            </div>
          </section>
          <section className="learned">
            <div className="eyebrow">What the swarm learned</div>
            {learned.map((l) => <p key={l}>{l}</p>)}
          </section>
        </div>
      </div>
    </>
  );
}
