"use client";

import Link from "next/link";
import { useState } from "react";
import { IconCheck } from "@/components/Icons";
import Topbar from "@/components/Topbar";
import { Bar, Pill, StatTile } from "@/components/ui";
import { ESCALATION_POLICY, PROMISE_BOARD, PROMISE_TILES } from "@/lib/mock";

const OWNERS = ["All", "Estates", "IT Services", "Mess Committee"] as const;

export default function PromisesPage() {
  const [owner, setOwner] = useState<(typeof OWNERS)[number]>("All");
  const [nudged, setNudged] = useState<Set<string>>(new Set());

  return (
    <>
      <Topbar title="Promises" sub="Every commitment, tracked until students confirm the fix" />
      <div className="page">
        <section className="tiles">
          {PROMISE_TILES.map((t) => <StatTile key={t.label} {...t} dark={false} />)}
        </section>

        <div className="chips">
          <span className="chip-label">Owner</span>
          {OWNERS.map((o) => (
            <button key={o} className={`chip${owner === o ? " on" : ""}`} onClick={() => setOwner(o)}>{o}</button>
          ))}
        </div>

        <div className="board">
          {PROMISE_BOARD.map((col) => {
            const cards = col.cards.filter((c) => owner === "All" || c.dept === owner);
            return (
              <section className="col" key={col.key} aria-label={col.title}>
                <div className="col-head"><i style={{ background: col.color }} />{col.title}<span className="n">{cards.length}</span></div>
                {cards.length === 0 && <p className="faint" style={{ fontSize: 12.5, padding: "4px 4px 8px" }}>Nothing here.</p>}
                {cards.map((c) => (
                  <article className="pcard" key={c.code}>
                    <div className="top">
                      <Link href={`/issues/${c.code}`} className="c">{c.code}</Link>
                      <span className={col.whenClass.includes("kept") ? "" : col.whenClass} style={col.key === "kept" ? { color: "var(--green)" } : undefined}>{c.when}</span>
                    </div>
                    <h4>{c.text}</h4>
                    <small>{c.owner}</small>
                    {c.escalated && <span><Pill tone="red">{c.escalated}</Pill></span>}
                    {c.confirmed && (
                      <>
                        <b style={{ fontSize: 12, color: "var(--amber-ink)" }}>{c.confirmed.yes} of {c.confirmed.of} students confirmed</b>
                        <Bar value={c.confirmed.yes / c.confirmed.of} color="var(--amber)" />
                      </>
                    )}
                    {(col.key === "overdue" || col.key === "due_soon") && (
                      <button className="btn btn-sm" style={{ marginTop: 4 }} disabled={nudged.has(c.code)}
                        onClick={() => setNudged((s) => new Set(s).add(c.code))}>
                        {nudged.has(c.code) ? <><IconCheck size={14} /> Owner nudged</> : "Nudge owner"}
                      </button>
                    )}
                  </article>
                ))}
              </section>
            );
          })}
        </div>

        <section className="card policy">
          <div>
            <h3>Escalation policy</h3>
            <p className="muted" style={{ fontSize: 12.5 }}>Applied automatically by the Promise Keeper.</p>
          </div>
          <div className="steps">
            {ESCALATION_POLICY.map((p) => <div className="step" key={p.when}><span>{p.when.toUpperCase()}</span>{p.who}</div>)}
          </div>
        </section>
      </div>
    </>
  );
}
