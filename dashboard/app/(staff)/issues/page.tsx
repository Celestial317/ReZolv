"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useApi } from "@/lib/api";
import { cat, day } from "@/lib/format";
import { Async, CatTag, Empty, LevelTag, PageHead, StatusTag } from "@/components/ui";

type Issue = {
  id: string; code: string; title: string; category: string; status: string; report_count: number;
  location: string; department: string | null; escalation_level: number | null; promise_due_at: string | null; flagged?: boolean;
};

export default function Issues() {
  const router = useRouter();
  const list = useApi<Issue[]>("/admin/issues");
  const depts = useApi<{ id: string; name: string }[]>("/admin/departments");
  const [status, setStatus] = useState("");
  const [dept, setDept] = useState("");
  const [text, setText] = useState("");

  const rows = useMemo(() => (list.data ?? []).filter((i) =>
    (!status || i.status === status) && (!dept || i.department === dept) &&
    (!text || `${i.code} ${i.title} ${i.location}`.toLowerCase().includes(text.toLowerCase()))), [list.data, status, dept, text]);

  return (
    <>
      <PageHead title="Issues" sub={list.data ? `${rows.length} of ${list.data.length}` : undefined} />
      <div className="row" style={{ marginBottom: 14 }}>
        <input className="input" style={{ maxWidth: 280 }} placeholder="Search code, title or place" value={text} onChange={(e) => setText(e.target.value)} aria-label="Search issues" />
        <select className="input" style={{ maxWidth: 190 }} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In progress</option>
          <option value="awaiting_confirm">Awaiting students</option>
          <option value="resolved">Resolved</option>
        </select>
        <select className="input" style={{ maxWidth: 220 }} value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Department">
          <option value="">All departments</option>
          {(depts.data ?? []).map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
        </select>
      </div>
      <div className="card">
        <Async state={list}>
          {() => rows.length === 0 ? <Empty>No issues match</Empty> : (
            <table>
              <thead><tr><th>Issue</th><th>Type</th><th>Place</th><th>Department</th><th>Reports</th><th>Status</th><th>Level</th><th>Promise due</th></tr></thead>
              <tbody>
                {rows.map((i) => (
                  <tr key={i.id} className="link" onClick={() => router.push(`/issues/${i.id}`)}>
                    <td style={{ boxShadow: `inset 5px 0 0 ${cat(i.category).pin}` }}><span className="code">{i.code}</span> <b>{i.title}</b></td>
                    <td><CatTag category={i.category} /></td>
                    <td>{i.location}</td>
                    <td>{i.department ?? "Unrouted"}</td>
                    <td>{i.report_count}</td>
                    <td><StatusTag status={i.status} /></td>
                    <td><LevelTag level={i.escalation_level} /></td>
                    <td>{day(i.promise_due_at)}</td>
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
