"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Mitraa from "@/components/Mitraa";

// UI only for now: any non-empty email + password goes to the overview.
// Wiring: POST /api/auth/login {email, password} -> {token, role}; keep the token in localStorage.
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("dean@rezolv.demo");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter your staff email and password.");
      return;
    }
    setError("");
    setBusy(true);
    router.push("/");
  }

  return (
    <main className="login-page">
      <div className="login-wrap">
        <div className="login-hero">
          <Mitraa pose="wave" mood="happy" size={110} />
          <div style={{ paddingBottom: 26 }}>
            <div className="bubble">Welcome back! Let&apos;s fix what students told us today.</div>
            <h2>ReZolv <span>Staff</span></h2>
          </div>
        </div>

        <form className="card login-card" onSubmit={submit} noValidate>
          <h1>Log in</h1>
          <p className="tag">Fix the cause, not just the complaint.</p>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <div className="row-between">
              <label htmlFor="password">Password</label>
              <button type="button" className="link" onClick={() => setError("Ask the Tech Team to reset staff passwords.")}>Reset password</button>
            </div>
            <div className="pw">
              <input id="password" type={show ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" onClick={() => setShow((s) => !s)} aria-pressed={show}>{show ? "Hide" : "Show"}</button>
            </div>
          </div>
          {error && <div className="err" role="alert">{error}</div>}
          <button className="btn btn-primary btn-block" style={{ padding: "13px 16px", fontSize: 15 }} disabled={busy}>
            {busy ? "Logging in..." : "Log in"}
          </button>
          <p className="muted" style={{ textAlign: "center", fontSize: 13 }}>
            Students report through the <b style={{ color: "var(--primary)" }}>ReZolv app</b>
          </p>
        </form>
        <p className="faint" style={{ marginTop: 18, fontSize: 12.5 }}>Campus staff only</p>
      </div>
    </main>
  );
}
