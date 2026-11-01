"use client";

import { useState } from "react";
import { LEVEL_TITLE, ROLE_LEVEL, api, signOut, useApi, type Staff } from "@/lib/api";
import { day } from "@/lib/format";
import { Async, PageHead, Tag } from "@/components/ui";

type Me = { email: string; role: Staff["role"]; name: string; department: string | null; created_at: string };

export default function Profile() {
  const me = useApi<Me>("/auth/me");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  async function change(e: React.FormEvent) {
    e.preventDefault();
    if (next !== again) { setMsg({ text: "The new passwords do not match", error: true }); return; }
    setBusy(true);
    try {
      await api("/auth/password", { method: "POST", body: { current, new: next } });
      setMsg({ text: "Password changed" });
      setCurrent(""); setNext(""); setAgain("");
    } catch (err) {
      setMsg({ text: (err as Error).message, error: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead title="Profile" />
      <Async state={me}>
        {(m) => {
          const level = ROLE_LEVEL[m.role];
          return (
            <div className="grid g2">
              <div className="card pad stack">
                <h2>{m.name}</h2>
                <table>
                  <tbody>
                    <tr><td className="muted">Email</td><td>{m.email}</td></tr>
                    <tr><td className="muted">Role</td><td><Tag tone="teal">{LEVEL_TITLE[level]}</Tag></td></tr>
                    <tr><td className="muted">Escalation level</td><td>{level + 1} of 3</td></tr>
                    <tr><td className="muted">Department</td><td>{m.department ?? "All departments"}</td></tr>
                    <tr><td className="muted">Account created</td><td>{day(m.created_at)}</td></tr>
                  </tbody>
                </table>
                <button className="btn grey" onClick={signOut}>Sign out</button>
              </div>

              <form className="card pad stack" onSubmit={change}>
                <h2>Change password</h2>
                <label className="field"><span>Current password</span><input className="input" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required /></label>
                <label className="field"><span>New password</span><input className="input" type="password" autoComplete="new-password" minLength={8} value={next} onChange={(e) => setNext(e.target.value)} required /></label>
                <label className="field"><span>Repeat new password</span><input className="input" type="password" autoComplete="new-password" minLength={8} value={again} onChange={(e) => setAgain(e.target.value)} required /></label>
                {msg && <div className={`notice ${msg.error ? "error" : ""}`}>{msg.text}</div>}
                <button className="btn" disabled={busy}>Change password</button>
              </form>
            </div>
          );
        }}
      </Async>
    </>
  );
}
