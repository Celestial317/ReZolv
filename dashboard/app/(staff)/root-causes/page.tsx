"use client";

import Link from "next/link";
import { useState } from "react";
import { api, useApi } from "@/lib/api";
import { when } from "@/lib/format";
import { Async, Empty, PageHead, Tag } from "@/components/ui";

type Cause = {
  reason: string; created_at: string; hits: number | null; trials: number | null; baseline_rate: number | null; p_value: number | null;
  cause_id: string; cause_code: string; cause_title: string; effect_id: string; effect_code: string; effect_title: string; location: string;
};
type Forecast = { id: string; starts_at: string; note: string | null; location: string; trigger: string; likely_issue: string; hits: number; trials: number; probability_pct: number };
type Place = { location_id: string; location: string; issues: { id: string; code: string; title: string; category: string; status: string; reports: number; caused_by: { code: string }[] | null }[] };

export default function RootCauses() {
  const causes = useApi<Cause[]>("/admin/root-causes");
  const forecasts = useApi<Forecast[]>("/admin/forecasts");
  const places = useApi<Place[]>("/admin/campus-graph");
  const [confirm, setConfirm] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  async function fix(causeId: string) {
    setBusy(true);
    try {
      const r = await api<{ cause: string; awaiting_confirm: string[] }>(`/admin/causes/${causeId}/fixed`, { method: "POST" });
      setMsg({ text: r.awaiting_confirm.length ? `${r.awaiting_confirm.join(", ")} now await student confirmation.` : "Nothing was open to close." });
      setConfirm(null);
      causes.reload();
    } catch (e) {
      setMsg({ text: (e as Error).message, error: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead title="Root causes" sub="Patterns measured on campus data. The AI explains them, it does not find them." />
      {msg && <div className={`notice ${msg.error ? "error" : ""}`} style={{ marginBottom: 14 }}>{msg.text}</div>}
      <div className="stack">
        <Async state={causes}>
          {(rows) => rows.length === 0 ? <div className="card"><Empty>No pattern has passed the test yet</Empty></div> : (
            <div className="grid g2">
              {rows.map((r) => (
                <div className="card pad stack" key={`${r.cause_id}-${r.effect_id}`}>
                  <div className="row"><Tag tone="teal">{r.location}</Tag><span className="muted">{when(r.created_at)}</span></div>
                  <h2>
                    <Link href={`/issues/${r.cause_id}`}>{r.cause_title}</Link> leads to <Link href={`/issues/${r.effect_id}`}>{r.effect_title}</Link>
                  </h2>
                  <p>{r.reason}</p>
                  {r.trials != null && (
                    <p className="muted">
                      {r.hits} of {r.trials} cases followed within 48 hours. Chance alone gives {Math.round((r.baseline_rate ?? 0) * 100)}% (p = {(r.p_value ?? 0).toFixed(3)}).
                    </p>
                  )}
                  {confirm === r.cause_id ? (
                    <div className="row">
                      <button className="btn" disabled={busy} onClick={() => fix(r.cause_id)}>Confirm</button>
                      <button className="btn grey" onClick={() => setConfirm(null)}>Cancel</button>
                    </div>
                  ) : (
                    <button className="btn" onClick={() => setConfirm(r.cause_id)}>Fix the cause, close them all</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Async>

        <div className="card">
          <div className="card-head"><h2>Forecasts</h2></div>
          <Async state={forecasts}>
            {(f) => f.length === 0 ? <Empty>No planned event matches a measured pattern</Empty> : (
              <table>
                <thead><tr><th>When</th><th>Place</th><th>Planned</th><th>Likely issue</th><th>Basis</th></tr></thead>
                <tbody>
                  {f.map((x) => (
                    <tr key={x.id}>
                      <td>{when(x.starts_at)}</td>
                      <td>{x.location}</td>
                      <td>{x.note ?? x.trigger}</td>
                      <td><b>{x.likely_issue}</b> <Tag tone="amber">{x.probability_pct}%</Tag></td>
                      <td className="muted">{x.hits} of {x.trials} past cases</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Async>
        </div>

        <div className="card">
          <div className="card-head"><h2>By place</h2></div>
          <Async state={places}>
            {(p) => (
              <table>
                <thead><tr><th>Place</th><th>Issues in 90 days</th><th>With a measured cause</th></tr></thead>
                <tbody>
                  {p.filter((x) => x.issues.length).map((x) => (
                    <tr key={x.location_id}>
                      <td><b>{x.location}</b></td>
                      <td>{x.issues.length} <span className="sub muted">({x.issues.filter((i) => i.status !== "resolved").length} open)</span></td>
                      <td>{x.issues.filter((i) => i.caused_by?.length).map((i) => i.code).join(", ") || "None"}</td>
                    </tr>
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
