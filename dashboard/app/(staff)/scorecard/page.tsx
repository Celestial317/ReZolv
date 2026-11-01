"use client";

import { useApi } from "@/lib/api";
import { Async, Bar, Empty, PageHead } from "@/components/ui";

type Dept = { id: string; name: string; kept: number; closed: number; kept_pct: number | null; open_issues: number };
type Accuracy = { day: string; routed: number; moved: number; accuracy_pct: number | null };
type Verify = { verified: number; contradicted: number; unverified: number; total: number };
type Eval = { reports: number; category_accuracy_pct: number; routing_accuracy_pct: number; merge_precision_pct: number; merge_recall_pct: number };

export default function Scorecard() {
  const score = useApi<Dept[]>("/admin/scorecard");
  const acc = useApi<Accuracy[]>("/admin/routing-accuracy");
  const ver = useApi<Verify>("/admin/verification-stats");
  const ev = useApi<Eval>("/admin/eval");

  return (
    <>
      <PageHead title="Scorecard" sub="Share of promises each department kept" />
      <div className="stack">
        <div className="card">
          <Async state={score}>
            {(rows) => (
              <table>
                <thead><tr><th>Department</th><th style={{ width: "40%" }}>Promises kept</th><th>Kept</th><th>Open issues</th></tr></thead>
                <tbody>
                  {rows.map((d) => (
                    <tr key={d.id}>
                      <td><b>{d.name}</b></td>
                      <td>{d.kept_pct == null ? <span className="muted">No closed promises</span> : <div className="row" style={{ flexWrap: "nowrap" }}><Bar pct={d.kept_pct} /><b>{d.kept_pct}%</b></div>}</td>
                      <td>{d.kept} of {d.closed}</td>
                      <td>{d.open_issues}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Async>
        </div>

        <div className="grid g2">
          <div className="card">
            <div className="card-head"><h2>Measured on the labelled test set</h2></div>
            <Async state={ev}>
              {(e) => (
                <table>
                  <tbody>
                    <tr><td>Category accuracy</td><td><b>{e.category_accuracy_pct}%</b></td></tr>
                    <tr><td>Routing accuracy</td><td><b>{e.routing_accuracy_pct}%</b></td></tr>
                    <tr><td>Merge precision</td><td><b>{e.merge_precision_pct}%</b></td></tr>
                    <tr><td>Merge recall</td><td><b>{e.merge_recall_pct}%</b></td></tr>
                    <tr><td colSpan={2} className="sub muted">{e.reports} reports with known answers</td></tr>
                  </tbody>
                </table>
              )}
            </Async>
          </div>

          <div className="card">
            <div className="card-head"><h2>Checked claims</h2></div>
            <Async state={ver}>
              {(v) => (
                <table>
                  <tbody>
                    <tr><td>Verified against the data</td><td><b>{v.verified}</b></td></tr>
                    <tr><td>Contradicted</td><td><b>{v.contradicted}</b></td></tr>
                    <tr><td>Unverified</td><td><b>{v.unverified}</b></td></tr>
                  </tbody>
                </table>
              )}
            </Async>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h2>Routing accuracy by day</h2></div>
          <Async state={acc}>
            {(rows) => rows.length === 0 ? <Empty>No routed issues yet</Empty> : (
              <table>
                <thead><tr><th>Day</th><th>Routed</th><th>Moved by staff</th><th>Accuracy</th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.day}><td>{r.day}</td><td>{r.routed}</td><td>{r.moved}</td><td><b>{r.accuracy_pct ?? 0}%</b></td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </Async>
        </div>
      </div>
    </>
  );
}
