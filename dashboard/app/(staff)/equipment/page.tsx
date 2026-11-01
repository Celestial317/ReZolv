"use client";

import Link from "next/link";
import { useState } from "react";
import { api, useApi } from "@/lib/api";
import { day } from "@/lib/format";
import { Async, Empty, PageHead, Tag } from "@/components/ui";

type Asset = {
  id: string; code: string; name: string; type_label: string; photo_url: string | null; location: string | null; floor: string | null;
  status: "proposed" | "approved"; created_at: string; created_by_pseudonym: string | null; issues: number; complaints: number;
};

export default function Equipment() {
  const list = useApi<Asset[]>("/admin/assets");
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function decide(a: Asset, verb: "approve" | "reject") {
    setBusy(a.id);
    setMsg(null);
    try {
      await api(`/admin/assets/${a.id}/${verb}`, { method: "POST" });
      setMsg({ text: verb === "approve" ? `${a.code} approved. Its QR label is ready.` : `${a.code} rejected.` });
      await list.reload();
    } catch (e) {
      setMsg({ text: (e as Error).message, error: true });
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHead title="Equipment" sub="Students register items, staff approve them, and each approved item gets a QR label" />
      {msg && <div className={`notice ${msg.error ? "error" : ""}`} style={{ marginBottom: 14 }}>{msg.text}</div>}
      <Async state={list}>
        {(rows) => {
          const queue = rows.filter((r) => r.status === "proposed");
          const live = rows.filter((r) => r.status === "approved");
          return (
            <div className="stack">
              <div className="card">
                <div className="card-head"><h2>Waiting for approval</h2><Tag tone={queue.length ? "amber" : ""}>{queue.length}</Tag></div>
                {queue.length === 0 ? <Empty>No proposals waiting</Empty> : (
                  <table>
                    <tbody>
                      {queue.map((a) => (
                        <tr key={a.id}>
                          <td style={{ width: 84 }}>{a.photo_url ? <img className="thumb" src={`/api${a.photo_url}`} alt={a.name} /> : <div className="thumb" />}</td>
                          <td>
                            <b>{a.name}</b>
                            <div className="sub">{a.type_label} · {a.location ?? "On campus"}{a.floor ? ` · ${a.floor}` : ""}</div>
                            <div className="sub">Proposed {day(a.created_at)} by <span className="code">{a.created_by_pseudonym}</span></div>
                          </td>
                          <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                            <button className="btn" disabled={busy === a.id} onClick={() => decide(a, "approve")}>Approve</button>{" "}
                            <button className="btn danger" disabled={busy === a.id} onClick={() => decide(a, "reject")}>Reject</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="card">
                <div className="card-head"><h2>Registered equipment</h2><Tag>{live.length}</Tag></div>
                {live.length === 0 ? <Empty>Nothing approved yet</Empty> : (
                  <table>
                    <thead><tr><th>Item</th><th>Place</th><th>Complaints</th><th>Issues</th><th /></tr></thead>
                    <tbody>
                      {live.map((a) => (
                        <tr key={a.id}>
                          <td>
                            <div className="row" style={{ flexWrap: "nowrap" }}>
                              {a.photo_url ? <img className="thumb" src={`/api${a.photo_url}`} alt={a.name} /> : <div className="thumb" />}
                              <div><b>{a.name}</b><div className="sub"><span className="code">{a.code}</span> · {a.type_label}</div></div>
                            </div>
                          </td>
                          <td>{a.location ?? "On campus"}{a.floor ? ` · ${a.floor}` : ""}</td>
                          <td>{a.complaints}</td>
                          <td>{a.issues}</td>
                          <td style={{ textAlign: "right" }}><Link className="btn grey" href={`/equipment/${a.id}`}>Open</Link></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          );
        }}
      </Async>
    </>
  );
}
