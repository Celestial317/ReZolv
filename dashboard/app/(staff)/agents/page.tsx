"use client";

import Link from "next/link";
import { useApi } from "@/lib/api";
import { when } from "@/lib/format";
import { Async, Empty, PageHead, Tag } from "@/components/ui";

type Activity = Record<string, { type: string; summary: string; reasoning: string | null; created_at: string; code: string }[]>;
type Flagged = { id: string; code: string; title: string; flag_reason: string; report_count: number; location: string }[];

const NAMES: Record<string, string> = {
  intake: "Intake", clusterer: "Clusterer", router: "Router", root_cause: "Root cause", memory: "Memory",
  promise_keeper: "Promise keeper", fraud_check: "Fraud check", privacy_guardian: "Privacy guardian", safe_review: "Safe review",
};

export default function Agents() {
  const act = useApi<Activity>("/admin/agents/activity");
  const flagged = useApi<Flagged>("/admin/flagged");

  return (
    <>
      <PageHead title="Agent activity" sub="The latest decisions of each agent" />
      <div className="stack">
        <Async state={flagged}>
          {(f) => f.length > 0 && (
            <div className="card">
              <div className="card-head"><h2>Flagged for review</h2></div>
              <table>
                <tbody>
                  {f.map((i) => (
                    <tr key={i.id}>
                      <td><Link href={`/issues/${i.id}`}><span className="code">{i.code}</span> <b>{i.title}</b></Link><div className="sub">{i.location}</div></td>
                      <td>{i.flag_reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Async>
        <Async state={act}>
          {(a) => (
            <div className="grid g2">
              {Object.entries(a).filter(([k, v]) => v.length && NAMES[k] && k !== "privacy_guardian" && k !== "safe_review").map(([agent, rows]) => (
                <div className="card" key={agent}>
                  <div className="card-head"><h2>{NAMES[agent]}</h2><Tag>{rows.length} recent</Tag></div>
                  <div className="tl">
                    {rows.map((r, n) => (
                      <div key={n}>
                        <div className="top"><b>{r.summary}</b><small>{when(r.created_at)}</small></div>
                        {r.reasoning && <p>{r.reasoning}</p>}
                        <small className="code">{r.code}</small>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {Object.values(a).every((v) => v.length === 0) && <Empty>No agent activity yet</Empty>}
            </div>
          )}
        </Async>
      </div>
    </>
  );
}
