"use client";

import Link from "next/link";
import { useState } from "react";
import { issues, stateBadge } from "@/lib/mock";

const tabs = [
  { key: "active", label: "Active", test: (s: string) => !["fixed", "sealed"].includes(s) },
  { key: "fixed", label: "Fixed", test: (s: string) => s === "fixed" },
  { key: "sealed", label: "Sealed", test: (s: string) => s === "sealed" },
] as const;

const steps = ["Sent", "Routed", "Promised", "Fixed"];

export default function MyReports() {
  const [tab, setTab] = useState<(typeof tabs)[number]["key"]>("active");
  const mine = issues.filter((i) => i.mine);
  const count = (k: (typeof tabs)[number]) => mine.filter((i) => k.test(i.state)).length;
  const current = tabs.find((t) => t.key === tab)!;
  const list = mine.filter((i) => current.test(i.state));

  return (
    <>
      <h1 className="h1" style={{ marginBottom: 14 }}>My reports</h1>
      <div className="seg" role="tablist">
        {tabs.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} className={tab === t.key ? "on" : ""} onClick={() => setTab(t.key)}>
            {t.label} · {count(t)}
          </button>
        ))}
      </div>

      <div className="stack" style={{ marginTop: 14 }}>
        {list.map((i) => {
          const b = stateBadge[i.state];
          const others = i.count - 1;
          return (
            <Link key={i.code} href={i.state === "sealed" ? "#" : `/issues/${i.code}`} className="card pad" style={{ display: "block", padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="mono muted" style={{ fontSize: 17 }}>{i.code}</span>
                <span className={`badge ${b.tone}`}>{b.label}</span>
              </div>
              <h2 className="h2" style={{ marginTop: 12, fontSize: 24 }}>{i.state === "sealed" ? "Sealed report" : i.title}</h2>
              <p className="muted" style={{ fontSize: 19, margin: "8px 0 16px" }}>
                {i.state === "sealed" ? `${i.count} of 5 students so far` : `${i.place} · you + ${others} students`}
              </p>
              <div className="prog">{steps.map((_, n) => <i key={n} className={n < i.progress ? "on" : ""} />)}</div>
              <div className="prog-l">{steps.map((s) => <span key={s}>{s}</span>)}</div>
              <p
                className={`st ${i.state === "escalated" || i.state === "overdue" ? "red" : i.state === "check" ? "amber" : "green"}`}
                style={{ fontWeight: 800, fontSize: 18, marginTop: 14 }}
              >
                {i.state === "escalated" ? "Promise 3 days late · now with the Dean" : i.note}
              </p>
            </Link>
          );
        })}
        {list.length === 0 && <p className="muted" style={{ textAlign: "center", padding: 28 }}>Nothing here yet.</p>}
      </div>
    </>
  );
}
