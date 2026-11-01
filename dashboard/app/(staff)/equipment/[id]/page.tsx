"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchBlobUrl, useApi } from "@/lib/api";
import { day } from "@/lib/format";
import { Async, Empty, PageHead, StatusTag, Tag } from "@/components/ui";

type Detail = {
  id: string; code: string; name: string; type_label: string; photo_url: string | null; location: string | null; floor: string | null;
  status: string; link: string; created_by_pseudonym: string | null; approved_at: string | null;
  stats: { issues: number; fixed: number; complaints: number; avg_hours_to_fix: string | null };
  issues: { id: string; code: string; title: string; status: string; report_count: number; created_at: string; resolved_at: string | null; department: string | null }[];
};

export default function EquipmentDetail() {
  const { id } = useParams<{ id: string }>();
  const d = useApi<Detail>(`/admin/assets/${id}`);
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const approved = d.data?.status === "approved";

  useEffect(() => {
    if (!approved) return;
    fetchBlobUrl(`/admin/assets/${id}/qr.svg`).then(setQr).catch((e) => setError(e.message));
  }, [approved, id]);

  async function openLabel() {
    try {
      window.open(await fetchBlobUrl(`/admin/assets/${id}/label.pdf`), "_blank");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Async state={d}>
      {(a) => (
        <>
          <PageHead title={a.name} sub={`${a.code} · ${a.type_label} · ${a.location ?? "On campus"}${a.floor ? ` · ${a.floor}` : ""}`}>
            <div className="row">
              <Tag tone={approved ? "green" : "amber"}>{approved ? "Approved" : "Waiting for approval"}</Tag>
              <Link className="btn grey" href="/equipment">All equipment</Link>
            </div>
          </PageHead>
          {error && <div className="notice error" style={{ marginBottom: 14 }}>{error}</div>}
          <div className="split">
            <div className="stack">
              <div className="grid g3">
                <div className="card stat" style={{ borderTop: "4px solid #dc2626" }}><span>Complaints</span><b style={{ color: "#b42323" }}>{a.stats.complaints}</b></div>
                <div className="card stat" style={{ borderTop: "4px solid #16a34a" }}><span>Fixed</span><b style={{ color: "#15803d" }}>{a.stats.fixed} of {a.stats.issues}</b></div>
                <div className="card stat" style={{ borderTop: "4px solid #2563eb" }}><span>Average time to fix</span><b style={{ color: "#1d4ed8" }}>{a.stats.avg_hours_to_fix ? `${a.stats.avg_hours_to_fix} h` : "None yet"}</b></div>
              </div>
              <div className="card">
                <div className="card-head"><h2>History</h2></div>
                {a.issues.length === 0 ? <Empty>No complaints on this item yet</Empty> : (
                  <table>
                    <thead><tr><th>Issue</th><th>Reports</th><th>Department</th><th>Raised</th><th>Status</th></tr></thead>
                    <tbody>
                      {a.issues.map((i) => (
                        <tr key={i.id}>
                          <td><Link href={`/issues/${i.id}`}><span className="code">{i.code}</span> <b>{i.title}</b></Link></td>
                          <td>{i.report_count}</td>
                          <td>{i.department ?? "Unrouted"}</td>
                          <td>{day(i.created_at)}</td>
                          <td><StatusTag status={i.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="stack">
              {a.photo_url && <img className="thumb big" src={`/api${a.photo_url}`} alt={a.name} />}
              {approved ? (
                <div className="card pad stack">
                  <h2>QR label</h2>
                  <div className="qrbox">{qr ? <img src={qr} alt={`QR code for ${a.code}`} /> : <span className="muted">Loading</span>}</div>
                  <p className="muted">Opens the report screen for this item in the ReZolv app. It holds only the code <span className="code">{a.code}</span>, never who scans it.</p>
                  <button className="btn block" onClick={openLabel}>Open printable label (PDF)</button>
                </div>
              ) : (
                <div className="card pad"><p className="muted">Only approved items get a QR code. Approve it from the Equipment page.</p></div>
              )}
            </div>
          </div>
        </>
      )}
    </Async>
  );
}
