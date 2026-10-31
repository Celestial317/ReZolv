"use client";

import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import { use, useState } from "react";
import CampusMap from "@/components/CampusMap";
import { Back } from "@/components/Icons";
import Mitraa from "@/components/Mitraa";
import { find, mitraaLine, moodFor, stateBadge } from "@/lib/mock";

const LADDER = ["Warden", "Dean", "Principal"];

export default function IssuePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();
  const issue = find(code);
  const [tab, setTab] = useState<"timeline" | "why">("timeline");
  if (!issue || issue.state === "sealed") notFound();

  const b = stateBadge[issue.state];
  const events = tab === "timeline" ? issue.timeline ?? [] : issue.why ?? [];
  const late = issue.state === "escalated" || issue.state === "overdue";
  const level = issue.promise?.level ?? 0;
  const ladderOn = issue.state === "escalated" ? 1 : issue.state === "overdue" ? 0 : -1;

  return (
    <main className="page no-nav" style={{ paddingTop: 18 }}>
      <div className="topbar">
        <button className="icon-btn" style={{ width: 52, height: 52 }} onClick={() => router.back()} aria-label="Back"><Back /></button>
        <span className="mono muted" style={{ flex: 1, fontSize: 18, letterSpacing: ".04em" }}>{issue.code} · {issue.category.toUpperCase()}</span>
        <span className={`badge ${b.tone}`}>{b.label}</span>
      </div>

      <h1 className="h1" style={{ fontSize: 34, marginTop: 16 }}>{issue.title}</h1>
      <p className="muted" style={{ fontSize: 19, margin: "6px 0 16px" }}>
        {issue.place} · {issue.mine ? `you and ${issue.count - 1} other students` : `${issue.count} students`}
      </p>

      {issue.promise ? (
        <section className="card dark" style={{ padding: 20, borderRadius: 28 }}>
          <div className="mono" style={{ color: "var(--aqua)", fontSize: 16, letterSpacing: ".14em" }}>{issue.promise.by.toUpperCase()} PROMISED</div>
          <p style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.2, margin: "10px 0" }}>“{issue.promise.text}”</p>
          {late && issue.promise.late && (
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <span style={{ fontSize: 52, fontWeight: 800, color: "#ff8c8c", lineHeight: 1 }}>{issue.promise.late}</span>
              <span style={{ fontSize: 20, color: "#cfe6e6" }}>late</span>
            </div>
          )}
          {ladderOn >= 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 14 }}>
              {LADDER.map((l, n) => {
                const now = n === level || (issue.state === "escalated" && n === 1);
                return (
                  <span key={l} style={{ padding: "11px 8px", borderRadius: 12, textAlign: "center", fontWeight: 800, fontSize: 17, background: now ? "#ff8c8c" : "#27414a", color: now ? "#3a0d0d" : "#cfe6e6" }}>
                    {l}{now ? " · now" : ""}
                  </span>
                );
              })}
            </div>
          )}
        </section>
      ) : (
        <section className="card pad"><b style={{ fontSize: 19 }}>Waiting for a promise</b><p className="muted" style={{ marginTop: 4 }}>I will tell you the moment {issue.dept} sets a date.</p></section>
      )}

      <div className="bubble-row" style={{ marginTop: 14 }}>
        <div className="face"><Mitraa crop="face" mood={moodFor(issue.state)} fx={false} /></div>
        <p><b>Mitraa:</b> {mitraaLine[issue.state]}</p>
      </div>

      {issue.rootCause && (
        <section style={{ marginTop: 14, padding: 20, borderRadius: 24, background: "var(--amber-bg)", border: "1px solid #f1d9a0" }}>
          <b style={{ fontSize: 22, color: "#4a3200" }}>ReZolv found the real cause</b>
          <p style={{ fontSize: 19, color: "#5d4300", marginTop: 8, lineHeight: 1.35 }}>{issue.rootCause}</p>
        </section>
      )}

      <div style={{ margin: "16px -18px 0", position: "relative" }}>
        <CampusMap center={issue.at} zoom={19} aspect={0.7} controls={false} markers={[{ id: issue.code, at: issue.at, tone: late ? "red" : "blue", count: issue.count }]} />
        <div className="card" style={{ position: "absolute", left: 18, bottom: 40, padding: "10px 14px" }}>
          <div className="mono muted" style={{ fontSize: 13, letterSpacing: ".08em" }}>REPORTED AT</div>
          <b style={{ fontSize: 18 }}>{issue.place}</b>
        </div>
      </div>

      <div className="seg" style={{ marginTop: 18 }} role="tablist">
        <button role="tab" aria-selected={tab === "timeline"} className={tab === "timeline" ? "on" : ""} onClick={() => setTab("timeline")}>Timeline</button>
        <button role="tab" aria-selected={tab === "why"} className={tab === "why" ? "on" : ""} onClick={() => setTab("why")}>Why?</button>
      </div>

      <section className="card" style={{ marginTop: 12, padding: "6px 18px" }}>
        {events.length === 0 && <p className="muted" style={{ padding: 18 }}>Nothing to show yet.</p>}
        {events.map((e, n) => (
          <div key={n} className="tl-item">
            <span className={`dot ${e.tone}`} />
            <div>
              <b>{e.title}</b>
              <p>{e.text}</p>
              <span className="when">{e.when}</span>
            </div>
          </div>
        ))}
      </section>

      {issue.state === "check" && (
        <div className="bottom-bar"><Link href={`/issues/${issue.code}/confirm`} className="btn">Check the fix</Link></div>
      )}
    </main>
  );
}
