"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LEVEL_TITLE, useApi } from "@/lib/api";
import { cat, lateness } from "@/lib/format";
import { Async, CatTag, Empty, LevelTag, PageHead, StatusTag } from "@/components/ui";

type Overview = {
  tiles: { open_issues: number; resolved_7d: number; open_reports: number; reports_24h: number; overdue_promises: number; escalated_to_me: number };
  top_issues: { id: string; code: string; title: string; category: string; status: string; report_count: number; location: string; department: string }[];
  root_cause_alert: { effect_id: string; cause_code: string; cause_title: string; effect_code: string; effect_title: string; reason: string; location: string } | null;
};
type Queue = { level: number; issues: { id: string; code: string; title: string; location: string; promise_text: string; hours_late: number; escalation_level: number }[] };

export default function Overview() {
  const router = useRouter();
  const ov = useApi<Overview>("/admin/overview");
  const q = useApi<Queue>("/admin/escalations");

  return (
    <>
      <PageHead title="Overview" />
      <Async state={ov}>
        {(d) => (
          <div className="stack">
            <div className="grid g4">
              <Link href="/issues" className="card stat" style={{ borderTop: "4px solid #2563eb" }}><span>Open issues</span><b style={{ color: "#1d4ed8" }}>{d.tiles.open_issues}</b></Link>
              <Link href="/issues" className="card stat" style={{ borderTop: "4px solid #ea6a12" }}><span>Reports in 24 hours</span><b style={{ color: "#b9400c" }}>{d.tiles.reports_24h}</b></Link>
              <Link href="/promises" className="card stat" style={{ borderTop: "4px solid #dc2626" }}><span>Overdue promises</span><b style={{ color: "#b42323" }}>{d.tiles.overdue_promises}</b></Link>
              <Link href="/escalations" className="card stat" style={{ borderTop: "4px solid #8b5cf6" }}><span>Waiting on you</span><b style={{ color: "#6d28d9" }}>{d.tiles.escalated_to_me}</b></Link>
            </div>

            {d.root_cause_alert && (
              <Link href={`/issues/${d.root_cause_alert.effect_id}`} className="card pad" style={{ display: "block" }}>
                <h2>Root cause found</h2>
                <p style={{ marginTop: 6 }}>
                  <b>{d.root_cause_alert.effect_code} {d.root_cause_alert.effect_title}</b> follows <b>{d.root_cause_alert.cause_code} {d.root_cause_alert.cause_title}</b> at {d.root_cause_alert.location}.
                </p>
                <p className="muted" style={{ marginTop: 4 }}>{d.root_cause_alert.reason}</p>
              </Link>
            )}

            <div className="split">
              <div className="card">
                <div className="card-head"><h2>Top issues</h2><Link href="/issues" className="btn grey">All issues</Link></div>
                {d.top_issues.length === 0 ? <Empty>No open issues</Empty> : (
                  <table>
                    <thead><tr><th>Issue</th><th>Reports</th><th>Status</th></tr></thead>
                    <tbody>
                      {d.top_issues.map((i) => (
                        <tr key={i.id} className="link" onClick={() => router.push(`/issues/${i.id}`)}>
                          <td style={{ boxShadow: `inset 5px 0 0 ${cat(i.category).pin}` }}><span className="code">{i.code}</span> <b>{i.title}</b><div className="sub"><CatTag category={i.category} /> {i.location} · {i.department ?? "Unrouted"}</div></td>
                          <td>{i.report_count}</td>
                          <td><StatusTag status={i.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="card">
                <div className="card-head"><h2>Waiting on you</h2><Link href="/escalations" className="btn grey">Open</Link></div>
                <Async state={q}>
                  {(x) => x.issues.length === 0 ? <Empty>Nothing at the {LEVEL_TITLE[x.level]} level</Empty> : (
                    <table>
                      <tbody>
                        {x.issues.slice(0, 5).map((i) => (
                          <tr key={i.id} className="link" onClick={() => router.push(`/issues/${i.id}`)}>
                            <td><span className="code">{i.code}</span> <b>{i.title}</b><div className="sub">{i.promise_text}</div></td>
                            <td style={{ textAlign: "right" }}><LevelTag level={i.escalation_level} /><div className="sub">{lateness(i.hours_late)}</div></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </Async>
              </div>
            </div>
          </div>
        )}
      </Async>
    </>
  );
}
