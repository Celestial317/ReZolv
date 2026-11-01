"use client";

import { useRouter } from "next/navigation";
import { LEVEL_TITLE, useApi } from "@/lib/api";
import { cat, lateness, when } from "@/lib/format";
import { Async, CatTag, Empty, PageHead, StatusTag } from "@/components/ui";

type Queue = {
  level: number;
  issues: { id: string; code: string; title: string; category: string; status: string; location: string; department: string; promise_text: string; due_at: string; hours_late: number; report_count: number }[];
};

export default function Escalations() {
  const router = useRouter();
  const q = useApi<Queue>("/admin/escalations");

  return (
    <>
      <PageHead title="Escalations" sub={q.data ? `Issues whose promise is at the ${LEVEL_TITLE[q.data.level]} level` : undefined} />
      <div className="card">
        <Async state={q}>
          {(d) => d.issues.length === 0 ? <Empty>Nothing waiting at your level</Empty> : (
            <table>
              <thead><tr><th>Issue</th><th>Promise</th><th>Due</th><th>Reports</th><th>Status</th></tr></thead>
              <tbody>
                {d.issues.map((i) => (
                  <tr key={i.id} className="link" onClick={() => router.push(`/issues/${i.id}`)}>
                    <td style={{ boxShadow: `inset 5px 0 0 ${cat(i.category).pin}` }}><span className="code">{i.code}</span> <b>{i.title}</b><div className="sub"><CatTag category={i.category} /> {i.location} · {i.department}</div></td>
                    <td>{i.promise_text}</td>
                    <td>{when(i.due_at)}<div className="sub">{lateness(i.hours_late)}</div></td>
                    <td>{i.report_count}</td>
                    <td><StatusTag status={i.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Async>
      </div>
    </>
  );
}
