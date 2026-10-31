"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import CampusMap from "@/components/CampusMap";
import { IconRoot } from "@/components/Icons";
import Mitraa from "@/components/Mitraa";
import Topbar from "@/components/Topbar";
import { AgentBadge, Bar, Pill, StatTile } from "@/components/ui";
import {
  CAMPUS, FORECAST, ISSUES, MAP_PINS, NOW_LABEL, OVERVIEW, PROMISE_BOARD, STAFF_USER, SWARM_ACTIVITY, issueBadge,
} from "@/lib/mock";

const FILTERS = ["All", "Overdue", "New today"] as const;

// Demo clock: the seeded story happens on a Saturday afternoon.
const GREETING = "Good afternoon";

function impactColor(n: number) {
  return n >= 80 ? "var(--red)" : n >= 55 ? "var(--orange)" : "var(--teal)";
}

export default function OverviewPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");

  const top = ISSUES.filter((i) => !["sealed", "resolved", "awaiting_confirm"].includes(i.status) && i.code !== "RZV-233")
    .filter((i) => (filter === "Overdue" ? i.promise?.overdue : filter === "New today" ? i.is_new : true))
    .sort((a, b) => b.impact_score - a.impact_score)
    .slice(0, 6);

  const promises = PROMISE_BOARD.filter((c) => c.key === "overdue" || c.key === "due_soon").flatMap((c) =>
    c.cards.map((p) => ({ ...p, cls: c.whenClass, overdue: c.key === "overdue" })),
  ).slice(0, 4);

  return (
    <>
      <Topbar title={`${GREETING}, ${STAFF_USER.short}`} sub={`${NOW_LABEL} · ${CAMPUS}`} />
      <div className="page">
        <section className="tiles" aria-label="Today at a glance">
          {OVERVIEW.tiles.map((t) => <StatTile key={t.label} {...t} />)}
        </section>

        <section className="alert-banner">
          <span className="ic"><IconRoot size={20} /></span>
          <div>
            <h3>{OVERVIEW.alert.title}</h3>
            <p>{OVERVIEW.alert.body}</p>
          </div>
          <div className="actions">
            <Link href="/root-causes" className="btn">See the chain</Link>
            <Link href={`/issues/${OVERVIEW.alert.issue}`} className="btn btn-primary">Open {OVERVIEW.alert.issue}</Link>
          </div>
        </section>

        <div className="ov-main">
          <section className="card">
            <div className="card-head">
              <h2>Needs you now</h2>
              <span className="sub">ranked by impact</span>
              <div className="right chips">
                {FILTERS.map((f) => (
                  <button key={f} className={`chip${filter === f ? " on" : ""}`} onClick={() => setFilter(f)}>{f}</button>
                ))}
              </div>
            </div>
            {top.length === 0 ? (
              <div className="empty">
                <Mitraa crop="head" mood="happy" size={56} />
                <p>Nothing here right now. Main hoon na, I&apos;ll flag it the moment something comes in.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="t">
                  <thead>
                    <tr><th>Issue</th><th>What · where</th><th>Department</th><th>Reports</th><th>Status</th><th>Impact</th></tr>
                  </thead>
                  <tbody>
                    {top.map((i) => {
                      const b = issueBadge(i);
                      return (
                        <tr key={i.code} className="clickable" onClick={() => router.push(`/issues/${i.code}`)}>
                          <td className="code">{i.code}</td>
                          <td className="what">
                            <b>{i.title}</b>
                            <span className={i.link_note ? "alert" : ""}>{i.where}{i.link_note ? ` · ${i.link_note}` : ` · ${i.age}`}</span>
                          </td>
                          <td style={{ whiteSpace: "nowrap" }}>{i.department}</td>
                          <td className="num">{i.report_count}</td>
                          <td><Pill tone={b.tone}>{b.label}</Pill></td>
                          <td>
                            <div className="impact">
                              <Bar value={i.impact_score / 100} color={impactColor(i.impact_score)} width={36} />
                              <span>{i.impact_score}</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="card-body" style={{ borderTop: "1px solid var(--border)", paddingTop: 12, paddingBottom: 12 }}>
              <Link href="/issues" className="link">See all 18 open issues</Link>
            </div>
          </section>

          <section className="card" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div className="card-head">
              <h2>Campus heatmap</h2>
              <span className="pill pill-green" style={{ background: "none", padding: 0 }}><span className="live-dot" style={{ width: 6, height: 6 }} /> Live</span>
              <div className="right"><Link href="/map" className="link">Full map</Link></div>
            </div>
            <div style={{ flex: 1, minHeight: 360 }}>
              <CampusMap pins={MAP_PINS} defaultMode="heat" height={460} legend={false}
                scrollZoom={false}
                onSelect={(_, pin) => pin && pin.id.startsWith("RZV") && pin.status !== "sealed" && router.push(`/issues/${pin.id}`)} />
            </div>
          </section>
        </div>

        <div className="ov-bottom">
          <section className="card">
            <div className="card-head"><h2>Forecast · next 7 days</h2><div className="right"><Link href="/root-causes" className="link">All</Link></div></div>
            {FORECAST.slice(0, 2).map((f) => (
              <div className="list-row" key={f.title} style={{ alignItems: "flex-start" }}>
                <div className="pct-box"><b>{f.pct}%</b><span>LIKELY</span></div>
                <div><b>{f.title}</b><small>{f.body}</small></div>
              </div>
            ))}
            <div className="card-body"><Link href="/root-causes" className="btn btn-block">Create preventive task</Link></div>
          </section>

          <section className="card">
            <div className="card-head">
              <h2>Promises</h2><Pill tone="red">4 overdue</Pill>
              <div className="right"><Link href="/promises" className="link">All</Link></div>
            </div>
            {promises.map((p) => (
              <Link href={`/issues/${p.code}`} className="list-row" key={p.code}>
                <div><b>{p.text}</b><small>{p.owner}</small></div>
                <span className={`end ${p.cls}`}>{p.overdue ? p.when.replace("d late", " days late").replace("1 days", "1 day") : `due ${p.when}`}</span>
              </Link>
            ))}
          </section>

          <section className="card">
            <div className="card-head"><h2>Swarm activity</h2><div className="right"><Link href="/agents" className="link">Traces</Link></div></div>
            {SWARM_ACTIVITY.map((a) => (
              <div className="list-row" key={a.text}>
                <AgentBadge id={a.agent} dark />
                <div>
                  <b>{a.text}</b>
                  <small>{a.when} · <Link href={`/issues/${a.issue}`} className="link" style={{ fontSize: 12, fontWeight: 500 }}>Why?</Link></small>
                </div>
              </div>
            ))}
          </section>
        </div>
      </div>
    </>
  );
}
