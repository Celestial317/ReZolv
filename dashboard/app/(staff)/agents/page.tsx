"use client";

import { useState } from "react";
import Topbar from "@/components/Topbar";
import { AgentBadge, StatTile } from "@/components/ui";
import { AGENT_DECISIONS, AGENT_TILES, AGENTS, SHARED_MEMORY } from "@/lib/mock";

const ACCESS_LABEL = { rw: "read · write", r: "read", none: "no access" } as const;

export default function AgentsPage() {
  const [selected, setSelected] = useState<string>("PG");
  const [tab, setTab] = useState<"access" | "decisions">("access");
  const agent = AGENTS.find((a) => a.id === selected)!;

  return (
    <>
      <Topbar title="Agent swarm and memory" sub="8 agents sharing one memory on Meko" />
      <div className="page">
        <section className="tiles">
          {AGENT_TILES.map((t) => <StatTile key={t.label} {...t} color="#fff" />)}
        </section>

        <div className="detail-grid" style={{ gridTemplateColumns: "minmax(0,1fr) 286px" }}>
          <div className="agents-grid">
            {AGENTS.map((a) => (
              <button key={a.id} className={`agent-card${selected === a.id ? " on" : ""}`} onClick={() => setSelected(a.id)} aria-pressed={selected === a.id}>
                <div className="hd"><AgentBadge id={a.id} />{a.name}<span className="live-dot" title="Running" /></div>
                <p>{a.desc}</p>
                <span className="mono">{a.actions} actions today</span>
              </button>
            ))}
          </div>

          <aside className="card" style={{ alignSelf: "start" }}>
            <div className="card-body" style={{ paddingBottom: 0 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>{agent.name}</h2>
              <p className="muted" style={{ fontSize: 12.5, margin: "3px 0 10px" }}>{agent.desc}</p>
              <div className="tabs">
                <button className={`tab${tab === "access" ? " on" : ""}`} onClick={() => setTab("access")}>Memory access</button>
                <button className={`tab${tab === "decisions" ? " on" : ""}`} onClick={() => setTab("decisions")}>Recent decisions</button>
              </div>
            </div>
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {tab === "access"
                ? agent.access.map(([path, mode]) => (
                    <div key={path} className={`access-row ${mode}`}>{path}<b>{ACCESS_LABEL[mode]}</b></div>
                  ))
                : (AGENT_DECISIONS[agent.id] ?? []).map((d) => (
                    <div key={d.text} style={{ padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                      <b style={{ fontSize: 13, fontWeight: 600, display: "block" }}>{d.text}</b>
                      <span className="faint" style={{ fontSize: 12 }}>{d.when} · trace in Meko</span>
                    </div>
                  ))}
            </div>
          </aside>
        </div>

        <section className="card">
          <div className="card-head">
            <h2>Shared memory</h2>
            <span className="code-tag">datapack: demo-campus</span>
            <span className="right sub">Learned once, reused by every agent</span>
          </div>
          <div className="mem-grid">
            {SHARED_MEMORY.map((m) => (
              <div className="mem-col" key={m.label}>
                <h4><b>{m.n}</b>{m.label}</h4>
                <ul>{m.items.map((i) => <li key={i}>{i}</li>)}</ul>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
