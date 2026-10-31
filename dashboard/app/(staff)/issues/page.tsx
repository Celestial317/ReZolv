"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { IconDownload } from "@/components/Icons";
import Mitraa from "@/components/Mitraa";
import Topbar from "@/components/Topbar";
import { Bar, Pill, TONE_COLOR } from "@/components/ui";
import { ISSUES, type Issue } from "@/lib/mock";

const TABS: { key: string; label: string; test: (i: Issue) => boolean; red?: boolean }[] = [
  { key: "all", label: "All", test: () => true },
  { key: "open", label: "Open", test: (i) => i.status === "open" },
  { key: "overdue", label: "Overdue", test: (i) => !!i.promise?.overdue, red: true },
  { key: "in_progress", label: "In progress", test: (i) => (i.status === "in_progress" && !i.promise?.overdue) || i.status === "awaiting_confirm" },
  { key: "sealed", label: "Sealed", test: (i) => i.status === "sealed" },
  { key: "resolved", label: "Resolved", test: (i) => i.status === "resolved" },
];

const DEPTS: { label: string; test: (d: string) => boolean }[] = [
  { label: "All", test: () => true },
  { label: "IT Services", test: (d) => d === "IT Services" },
  { label: "Estates", test: (d) => d.startsWith("Estates") },
  { label: "Mess", test: (d) => d.startsWith("Mess") },
  { label: "Committees", test: (d) => d.includes("Committee") && !d.startsWith("Mess") },
];

const SORTS = {
  impact: { label: "Impact, highest first", fn: (a: Issue, b: Issue) => b.impact_score - a.impact_score },
  reports: { label: "Most reports", fn: (a: Issue, b: Issue) => b.report_count - a.report_count },
  code: { label: "Newest code", fn: (a: Issue, b: Issue) => b.code.localeCompare(a.code) },
};

function statusBadge(i: Issue) {
  if (i.status === "sealed") return <Pill tone="purple">Sealed</Pill>;
  if (i.status === "resolved") return <Pill tone="green">Resolved</Pill>;
  if (i.status === "awaiting_confirm") return <Pill tone="amber">Awaiting student OK</Pill>;
  if (i.promise?.overdue) return <Pill tone="red">Promise overdue</Pill>;
  if (i.status === "in_progress") return <Pill tone="teal">In progress</Pill>;
  return <Pill tone="blue">Open</Pill>;
}

function toCsv(rows: Issue[]) {
  const head = ["code", "title", "location", "category", "department", "reports", "promise", "status"];
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  return [head.join(","), ...rows.map((i) => [i.code, i.title, i.where, i.category, i.department, i.report_count, i.promise?.label ?? "", i.status].map(esc).join(","))].join("\n");
}

export default function IssuesPage() {
  const router = useRouter();
  const [tab, setTab] = useState("all");
  const [dept, setDept] = useState("All");
  const [sort, setSort] = useState<keyof typeof SORTS>("impact");

  const rows = useMemo(() => {
    const t = TABS.find((x) => x.key === tab)!;
    const d = DEPTS.find((x) => x.label === dept)!;
    return ISSUES.filter((i) => t.test(i) && d.test(i.department)).sort(SORTS[sort].fn);
  }, [tab, dept, sort]);
  const reports = rows.reduce((n, i) => n + i.report_count, 0);

  function exportCsv() {
    const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "rezolv-issues.csv" });
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <Topbar title="Issues" sub="Overview / Issues" />
      <div className="page">
        <div className="tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.key} role="tab" aria-selected={tab === t.key} className={`tab${tab === t.key ? " on" : ""}`} onClick={() => setTab(t.key)}>
              {t.label} <span className={`n${t.red ? " red" : ""}`}>{ISSUES.filter(t.test).length}</span>
            </button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div className="chips">
            <span className="chip-label">Department</span>
            {DEPTS.map((d) => (
              <button key={d.label} className={`chip${dept === d.label ? " on" : ""}`} onClick={() => setDept(d.label)}>{d.label}</button>
            ))}
          </div>
          <label className="field" style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
            <span className="chip-label">Sort</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as keyof typeof SORTS)} style={{ width: "auto", padding: "7px 10px" }}>
              {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </label>
        </div>

        <section className="card">
          <div className="card-head">
            <h2>{rows.length} issues</h2>
            <span className="sub">from {reports} student reports, merged by the Clusterer agent</span>
            <div className="right"><button className="btn" onClick={exportCsv}><IconDownload size={16} /> Export CSV</button></div>
          </div>
          {rows.length === 0 ? (
            <div className="empty">
              <Mitraa crop="head" mood="happy" size={56} />
              <p>No issues match these filters. Sab theek hai here.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="t">
                <thead>
                  <tr><th>Issue</th><th>What · where</th><th>Category</th><th>Department</th><th>Reports</th><th>Promise</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {rows.map((i) => {
                    const sealed = i.status === "sealed";
                    return (
                      <tr key={i.code} className="clickable" onClick={() => router.push(sealed ? "/safe-voice" : `/issues/${i.code}`)}>
                        <td className="code">{i.code}</td>
                        <td className="what"><b>{i.title}</b><span>{i.where} · {i.age}</span></td>
                        <td>{i.category}</td>
                        <td>{i.department}</td>
                        <td className="num">{i.report_count}</td>
                        <td style={{ minWidth: 150 }}>
                          {i.promise ? (
                            <>
                              <div style={{ color: TONE_COLOR[i.promise.tone], fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>{i.promise.label}</div>
                              <Bar value={i.promise.progress} color={TONE_COLOR[i.promise.tone]} width={90} />
                            </>
                          ) : (
                            <>
                              <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 5 }} className="muted">No promise yet</div>
                              <Bar value={0} color="var(--text-3)" width={90} />
                            </>
                          )}
                        </td>
                        <td>{statusBadge(i)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
