"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import CampusMap, { focusOn } from "@/components/CampusMap";
import { IconArrowRight, IconMic, IconPhoto } from "@/components/Icons";
import Mitraa from "@/components/Mitraa";
import { AgentBadge, Pill } from "@/components/ui";
import { MAP_PINS, type IssueDetail } from "@/lib/mock";

const LEVELS = ["Warden", "Dean", "Principal"];
const DEPARTMENTS = ["Estates · Plumbing", "Estates · Electrical", "Estates · HVAC", "IT Services", "Hostel Office", "Mess Committee", "Student Welfare Committee"];

type Modal = null | "promise" | "reassign" | "message";

function statusPill(d: IssueDetail) {
  const i = d.issue;
  if (i.status === "resolved") return <Pill tone="green">Resolved</Pill>;
  if (i.status === "awaiting_confirm") return <Pill tone="amber">Awaiting student OK</Pill>;
  if (i.promise?.overdue) return <Pill tone="red">Promise overdue · {i.promise.label.replace(" late", "")}</Pill>;
  if (i.status === "in_progress") return <Pill tone="teal">In progress</Pill>;
  return <Pill tone="blue">Open</Pill>;
}

export default function IssueDetailView({ detail }: { detail: IssueDetail }) {
  const { issue } = detail;
  const [tab, setTab] = useState<"why" | "reports" | "timeline">("why");
  const [modal, setModal] = useState<Modal>(null);
  const [promise, setPromise] = useState(detail.promise);
  const [dept, setDept] = useState(issue.department);
  const [timeline, setTimeline] = useState(detail.timeline);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const pin = MAP_PINS.find((p) => p.id === issue.code);
  const level = promise?.level ?? 0;
  const resolved = issue.status === "resolved";

  function log(text: string) {
    setTimeline((t) => [...t, { when: "Just now", actor: "Dr. Kavita Rao", text }]);
  }

  function savePromise(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const text = String(f.get("text") || "").trim();
    const due = String(f.get("due") || "");
    if (!text || !due) return;
    const dueLabel = new Date(due).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
    setPromise({ text, by: dept, said: `set just now · due ${dueLabel}`, lateLabel: dueLabel, late: false, level: 0 });
    log(`New promise: ${text} (due ${dueLabel})`);
    setModal(null);
    setToast("Promise saved. Students see it in the app and the Promise Keeper starts tracking.");
  }

  function saveReassign(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const next = String(new FormData(e.currentTarget).get("dept"));
    if (next !== dept) {
      setDept(next);
      log(`Reassigned to ${next}`);
      setToast(`Reassigned to ${next}. The Router will learn from this override.`);
    }
    setModal(null);
  }

  function sendMessage(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = String(new FormData(e.currentTarget).get("msg") || "").trim();
    if (!text) return;
    log(`Update sent to ${issue.report_count} students`);
    setModal(null);
    setToast(`Update sent to ${issue.report_count} students. No names were shared.`);
  }

  return (
    <div className="page">
      <section className="card issue-head">
        <div style={{ minWidth: 0 }}>
          <div className="meta">
            <span className="mono" style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.06em" }}>
              {issue.code} · {issue.category.toUpperCase()} · {issue.location.split(" · ")[0].toUpperCase()}
            </span>
            {statusPill(detail)}
            {level >= 1 && <Pill tone="amber">Escalated · level {level}</Pill>}
          </div>
          <h2>{issue.title}</h2>
          <p className="muted" style={{ fontSize: 13 }}>
            {dept === issue.department ? detail.summary : detail.summary.replace(issue.department, dept)}
          </p>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => setModal("reassign")} disabled={resolved}>Reassign</button>
          <button className="btn" onClick={() => setModal("message")}>Message students</button>
          <button className="btn btn-primary" onClick={() => setModal("promise")} disabled={resolved}>Set new promise</button>
        </div>
      </section>

      <div className="detail-grid">
        <section className="card">
          <div className="card-body" style={{ paddingBottom: 0 }}>
            <div className="tabs" role="tablist">
              <button role="tab" aria-selected={tab === "why"} className={`tab${tab === "why" ? " on" : ""}`} onClick={() => setTab("why")}>Why? · decision trace</button>
              <button role="tab" aria-selected={tab === "reports"} className={`tab${tab === "reports" ? " on" : ""}`} onClick={() => setTab("reports")}>Reports · {issue.report_count}</button>
              <button role="tab" aria-selected={tab === "timeline"} className={`tab${tab === "timeline" ? " on" : ""}`} onClick={() => setTab("timeline")}>Timeline</button>
            </div>
          </div>
          <div className="card-body">
            {tab === "why" && (
              <>
                <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>
                  Every decision the swarm made on this issue, with its reasoning. Stored as decision traces in Meko.
                </p>
                <div className="trace">
                  {detail.trace.map((s) => (
                    <div className="trace-item" key={s.title}>
                      <AgentBadge id={s.agent} />
                      <div style={{ minWidth: 0 }}>
                        <h4>{s.title} <span className="mono">{s.actor} · {s.when}</span></h4>
                        <p>{s.body}</p>
                        <span className="code-tag">{s.tag}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {tab === "reports" && (
              <>
                <p className="muted" style={{ fontSize: 13, marginBottom: 6 }}>
                  Pseudonyms only. Showing {detail.reports.length} of {issue.report_count} reports.
                </p>
                {detail.reports.map((r, k) => (
                  <div className="report-row" key={k}>
                    <AgentBadge id={r.lang.toUpperCase()} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <span className="who">{r.pseudonym}</span>
                        <span className="faint" style={{ fontSize: 12 }}>{r.when}</span>
                        {r.kind === "me_too" && <Pill tone="gray">Me too</Pill>}
                        {r.voice && <Pill tone="blue"><IconMic size={12} /> Voice</Pill>}
                        {r.photo && <Pill tone="teal"><IconPhoto size={12} /> Photo</Pill>}
                      </div>
                      {r.text_original && <p className="orig">{r.text_original}</p>}
                      <p>{r.text_en}</p>
                    </div>
                  </div>
                ))}
              </>
            )}

            {tab === "timeline" && (
              <div className="trace">
                {timeline.map((t, k) => (
                  <div className="trace-item" key={k} style={{ paddingBottom: 14 }}>
                    <span className="agent-badge" style={{ background: "var(--primary-soft)" }}><span className="live-dot" style={{ boxShadow: "none", background: "var(--primary)" }} /></span>
                    <div>
                      <h4 style={{ fontWeight: 600 }}>{t.text}</h4>
                      <span className="mono faint" style={{ fontSize: 11.5 }}>{t.actor} · {t.when}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <aside style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {promise ? (
            <div className="promise-card">
              <div className="eyebrow">Promise</div>
              <q>{promise.text}</q>
              <small>{promise.by} · {promise.said}</small>
              <div className="late-big">
                <b className={promise.late ? "" : "ok"}>{promise.lateLabel}</b>
                <span style={{ color: "#c4d3d5" }}>{promise.late ? "overdue" : resolved ? "" : "on track"}</span>
              </div>
              <div className="levels">
                {LEVELS.map((l, k) => (
                  <div key={l} className={`level${level === k + 1 ? " now" : level > k + 1 ? " done" : ""}`}>
                    <span>LEVEL {k + 1}{level === k + 1 ? " · NOW" : ""}</span>{l}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="card card-body" style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start" }}>
              <div className="eyebrow">Promise</div>
              <p className="muted" style={{ fontSize: 13 }}>No promise yet. Students see &ldquo;waiting for a promise&rdquo; in the app.</p>
              <button className="btn btn-primary btn-sm" onClick={() => setModal("promise")}>Set a promise</button>
            </div>
          )}

          {detail.rootCause && (
            <div className="card">
              <div className="card-head" style={{ padding: "12px 14px" }}>
                <h2 style={{ fontSize: 14.5 }}>Root cause</h2>
                <span className="right mono faint" style={{ fontSize: 11.5 }}>conf {detail.rootCause.conf.toFixed(2)}</span>
              </div>
              <div className="card-body" style={{ padding: "12px 14px" }}>
                <div className="chain">
                  {detail.rootCause.chain.map((c, k, arr) => (
                    <span key={c} style={{ display: "contents" }}>
                      <span className={`node ${k === arr.length - 1 ? "node-red" : k === 0 ? "node-amber" : "node-orange"}`}>{c}</span>
                      {k < arr.length - 1 && <IconArrowRight size={15} />}
                    </span>
                  ))}
                </div>
                <p style={{ fontSize: 12.5, color: "var(--ink-3)" }}>{detail.rootCause.memory}</p>
                <Link href="/root-causes" className="link" style={{ display: "inline-block", marginTop: 8 }}>Open causal graph</Link>
              </div>
            </div>
          )}

          {pin && (
            <div className="card" style={{ overflow: "hidden" }}>
              <CampusMap pins={[pin]} height={190} legend={false} selected={pin.building}
                initialView={focusOn(pin.building)} />
            </div>
          )}
        </aside>
      </div>

      {modal && (
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            {modal === "promise" && (
              <form onSubmit={savePromise}>
                <div className="card-head"><h2>Set new promise · {issue.code}</h2></div>
                <div className="card-body">
                  <div className="field">
                    <label htmlFor="p-text">What will be done</label>
                    <input id="p-text" name="text" required placeholder="Install changeover switch to the DG set" autoFocus />
                  </div>
                  <div className="field">
                    <label htmlFor="p-due">Due by</label>
                    <input id="p-due" name="due" type="datetime-local" required />
                    <p className="hint">Owner is reminded 24 h before. Escalates to the Warden 24 h after, the Dean 48 h after.</p>
                  </div>
                </div>
                <div className="modal-foot">
                  <button type="button" className="btn" onClick={() => setModal(null)}>Cancel</button>
                  <button className="btn btn-primary">Save promise</button>
                </div>
              </form>
            )}
            {modal === "reassign" && (
              <form onSubmit={saveReassign}>
                <div className="card-head"><h2>Reassign {issue.code}</h2></div>
                <div className="card-body">
                  <div className="field">
                    <label htmlFor="r-dept">Department</label>
                    <select id="r-dept" name="dept" defaultValue={dept}>
                      {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
                    </select>
                    <p className="hint">Saved to shared memory, so the Router learns from the override.</p>
                  </div>
                </div>
                <div className="modal-foot">
                  <button type="button" className="btn" onClick={() => setModal(null)}>Cancel</button>
                  <button className="btn btn-primary">Reassign</button>
                </div>
              </form>
            )}
            {modal === "message" && (
              <form onSubmit={sendMessage}>
                <div className="card-head"><h2>Message {issue.report_count} students</h2></div>
                <div className="card-body">
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <Mitraa crop="head" mood="wink" size={44} />
                    <p className="muted" style={{ fontSize: 13 }}>Mitraa delivers this in the app. Nobody&apos;s name is shown to you or to them.</p>
                  </div>
                  <div className="field">
                    <label htmlFor="m-text">Update</label>
                    <textarea id="m-text" name="msg" rows={3} required placeholder="The electrician is on site. Water should be back by 6 PM." autoFocus />
                  </div>
                </div>
                <div className="modal-foot">
                  <button type="button" className="btn" onClick={() => setModal(null)}>Cancel</button>
                  <button className="btn btn-primary">Send update</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
