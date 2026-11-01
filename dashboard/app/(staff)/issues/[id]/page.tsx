"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { api, useApi } from "@/lib/api";
import { lateness, when } from "@/lib/format";
import { Async, CatTag, Empty, LevelTag, PageHead, StatusTag, Tag, VerifyTag } from "@/components/ui";

type Detail = {
  id: string; code: string; title: string; category: string; status: string; report_count: number;
  location: string; department: string | null; department_id: string | null; suggested_fix: string | null;
  flagged: boolean; flag_reason: string | null; created_at: string;
  reports: { id: string; pseudonym: string; kind: string; text_original: string | null; text_en: string | null; lang: string | null; created_at: string }[];
  events: { id: string; type: string; actor: string; summary: string; reasoning: string | null; created_at: string; verification: string }[];
  promises: { id: string; text: string; due_at: string; status: string; escalation_level: number; department: string }[];
  links: { role: "cause" | "effect"; id: string; code: string; title: string; reason: string; hits: number | null; trials: number | null; baseline_rate: number | null }[];
  confirmations: { yes: number; partly: number; no: number };
};

const LADDER = ["Facilities Head", "Warden", "Dean"];

export default function IssueDetail() {
  const { id } = useParams<{ id: string }>();
  const d = useApi<Detail>(`/admin/issues/${id}`);
  const depts = useApi<{ id: string; name: string }[]>("/admin/departments");
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [tab, setTab] = useState<"timeline" | "why">("timeline");
  const [promiseText, setPromiseText] = useState("");
  const [due, setDue] = useState("");
  const [dept, setDept] = useState("");
  const [confirmCause, setConfirmCause] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function act(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ text: ok });
      await d.reload();
    } catch (e) {
      setMsg({ text: (e as Error).message, error: true });
    } finally {
      setBusy(false);
      setConfirmCause(null);
    }
  }

  return (
    <Async state={d}>
      {(i) => {
        const open = i.promises.find((p) => p.status === "open");
        const canAct = ["open", "in_progress"].includes(i.status);
        const effects = i.links.filter((l) => l.role === "effect");
        const causes = i.links.filter((l) => l.role === "cause");
        const events = tab === "why" ? i.events.filter((e) => e.verification !== "unverified" || e.reasoning) : i.events;

        return (
          <>
            <PageHead title={i.title} sub={`${i.code} · ${i.category} · ${i.location} · ${i.department ?? "Unrouted"}`}>
              <div className="row"><CatTag category={i.category} /><StatusTag status={i.status} /><LevelTag level={open?.escalation_level} /></div>
            </PageHead>

            {msg && <div className={`notice ${msg.error ? "error" : ""}`} style={{ marginBottom: 14 }}>{msg.text}</div>}
            {i.flagged && <div className="notice warn" style={{ marginBottom: 14 }}>Flagged for review: {i.flag_reason}</div>}

            <div className="split">
              <div className="stack">
                <div className="card">
                  <div className="card-head">
                    <div className="tabs">
                      <button className={tab === "timeline" ? "on" : ""} onClick={() => setTab("timeline")}>Timeline</button>
                      <button className={tab === "why" ? "on" : ""} onClick={() => setTab("why")}>Why</button>
                    </div>
                  </div>
                  <div className="tl">
                    {[...events].reverse().map((e) => (
                      <div key={e.id}>
                        <div className="top"><b>{e.summary}</b><small>{when(e.created_at)}</small></div>
                        {tab === "why" && e.reasoning && <p>{e.reasoning}</p>}
                        <div className="row" style={{ marginTop: 6 }}>
                          <Tag>{e.actor}</Tag>
                          {tab === "why" && <VerifyTag value={e.verification} />}
                        </div>
                      </div>
                    ))}
                    {events.length === 0 && <Empty>No decisions recorded</Empty>}
                  </div>
                </div>

                <div className="card">
                  <div className="card-head"><h2>Reports ({i.report_count})</h2></div>
                  {i.reports.filter((r) => r.kind === "report").length === 0 ? <Empty>No report text</Empty> : (
                    <table>
                      <tbody>
                        {i.reports.filter((r) => r.kind === "report").slice(0, 30).map((r) => (
                          <tr key={r.id}>
                            <td style={{ width: "62%" }}>{r.text_en ?? r.text_original}{r.lang && r.lang !== "en" && r.text_original && <div className="sub">{r.text_original}</div>}</td>
                            <td><span className="code">{r.pseudonym}</span></td>
                            <td className="sub">{when(r.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              <div className="stack">
                <div className="card pad">
                  <h2>Promise</h2>
                  {open ? (
                    <div className="stack" style={{ marginTop: 10 }}>
                      <div><b>{open.text}</b><div className="muted">{open.department} · {when(open.due_at)}</div></div>
                      {new Date(open.due_at) < new Date() && (
                        <div className="notice error">{lateness((Date.now() - new Date(open.due_at).getTime()) / 3600000)}</div>
                      )}
                      <div className="ladder">
                        {LADDER.map((n, k) => (
                          <div key={n} className={k === open.escalation_level ? "on" : k < open.escalation_level ? "done" : ""}>{n}</div>
                        ))}
                      </div>
                    </div>
                  ) : <p className="muted" style={{ marginTop: 6 }}>No open promise</p>}
                  {canAct && (
                    <form className="stack" style={{ marginTop: 14 }} onSubmit={(e) => {
                      e.preventDefault();
                      act(() => api(`/admin/issues/${i.id}/promises`, { method: "POST", body: { text: promiseText, due_at: new Date(due).toISOString() } }), "Promise saved");
                      setPromiseText(""); setDue("");
                    }}>
                      <label className="field"><span>What will be done</span>
                        <input className="input" value={promiseText} onChange={(e) => setPromiseText(e.target.value)} required />
                      </label>
                      <label className="field"><span>Deadline</span>
                        <input className="input" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} required />
                      </label>
                      <button className="btn block" disabled={busy || !i.department_id}>Save promise</button>
                    </form>
                  )}
                </div>

                <div className="card pad stack">
                  <h2>Actions</h2>
                  <button className="btn block" disabled={busy || !canAct} onClick={() => act(() => api(`/admin/issues/${i.id}/fixed`, { method: "POST" }), "Marked as fixed. Students will be asked to confirm.")}>
                    Mark as fixed
                  </button>
                  {i.status === "awaiting_confirm" && (
                    <p className="muted">Students confirmed: yes {i.confirmations.yes}, partly {i.confirmations.partly}, no {i.confirmations.no}</p>
                  )}
                  <div className="row" style={{ flexWrap: "nowrap" }}>
                    <select className="input" value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Department">
                      <option value="">Move to department</option>
                      {(depts.data ?? []).filter((x) => x.id !== i.department_id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                    </select>
                    <button className="btn grey" disabled={busy || !dept} onClick={() => act(() => api(`/admin/issues/${i.id}/reassign`, { method: "POST", body: { department_id: dept } }), "Moved. Similar issues will be routed there next time.")}>Move</button>
                  </div>
                </div>

                {(causes.length > 0 || effects.length > 0) && (
                  <div className="card pad stack">
                    <h2>Root cause</h2>
                    {causes.map((c) => (
                      <div key={c.id}>
                        <p><Link href={`/issues/${c.id}`}><b>{c.code} {c.title}</b></Link> caused this.</p>
                        <p className="muted">{c.reason}</p>
                        {c.trials != null && (
                          <p className="muted">Measured: {c.hits} of {c.trials} followed within 48 hours, chance {Math.round((c.baseline_rate ?? 0) * 100)}%.</p>
                        )}
                        <FixCause id={c.id} confirm={confirmCause} setConfirm={setConfirmCause} busy={busy}
                          run={() => act(() => api(`/admin/causes/${c.id}/fixed`, { method: "POST" }), "Cause fixed. Every linked issue now awaits student confirmation.")} />
                      </div>
                    ))}
                    {effects.length > 0 && (
                      <div>
                        <p>Caused: {effects.map((e) => <Link key={e.id} href={`/issues/${e.id}`}><b>{e.code} </b></Link>)}</p>
                        <FixCause id={i.id} confirm={confirmCause} setConfirm={setConfirmCause} busy={busy}
                          run={() => act(() => api(`/admin/causes/${i.id}/fixed`, { method: "POST" }), "Cause fixed. Every linked issue now awaits student confirmation.")} />
                      </div>
                    )}
                  </div>
                )}

                {i.suggested_fix && (
                  <div className="card pad"><h2>Suggested fix</h2><p style={{ marginTop: 6 }}>{i.suggested_fix}</p></div>
                )}
              </div>
            </div>
          </>
        );
      }}
    </Async>
  );
}

function FixCause({ id, confirm, setConfirm, run, busy }: { id: string; confirm: string | null; setConfirm: (v: string | null) => void; run: () => void; busy: boolean }) {
  return confirm === id ? (
    <div className="row" style={{ marginTop: 8 }}>
      <button className="btn" disabled={busy} onClick={run}>Confirm</button>
      <button className="btn grey" onClick={() => setConfirm(null)}>Cancel</button>
    </div>
  ) : (
    <button className="btn block" style={{ marginTop: 8 }} disabled={busy} onClick={() => setConfirm(id)}>Fix the cause, close them all</button>
  );
}
