"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Mitraa from "@/components/Mitraa";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("ananya.s@democampus.edu");
  const [password, setPassword] = useState("rezolv123");
  const [show, setShow] = useState(false);

  return (
    <main
      style={{ minHeight: "100dvh", padding: "56px 18px 28px", background: "linear-gradient(#e3f2f1, #f1f7f6 60%)" }}
    >
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, paddingLeft: 12 }}>
        <div style={{ width: 120, flex: "none" }} className="floaty">
          <Mitraa pose="wave" mood="cheerful" />
        </div>
        <div style={{ paddingBottom: 56 }}>
          <div
            style={{
              background: "var(--blue)", color: "#fff", padding: "14px 18px", fontWeight: 700, fontSize: 18,
              lineHeight: 1.2, borderRadius: "20px 20px 20px 6px",
            }}
          >
            Hi! I&apos;m Campus Mitraa. Bol do, main hoon na.
          </div>
          <div className="h1" style={{ fontSize: 40, marginTop: 12 }}>ReZolv</div>
        </div>
      </div>

      <form
        className="card pad"
        style={{ marginTop: 8, padding: "26px 20px 22px", boxShadow: "0 14px 40px rgba(20,35,42,.08)" }}
        onSubmit={(e) => { e.preventDefault(); router.push("/"); }}
      >
        <h1 className="h1" style={{ textAlign: "center", fontSize: 32 }}>Log in</h1>
        <p className="muted" style={{ textAlign: "center", fontSize: 19, margin: "4px 0 22px" }}>Speak up. Get it fixed.</p>

        <div className="field">
          <label htmlFor="email">College email</label>
          <input id="email" className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>

        <div className="field" style={{ marginTop: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <label htmlFor="pw">Password</label>
            <a className="link" href="#" onClick={(e) => e.preventDefault()}>Reset password</a>
          </div>
          <div className="input-wrap">
            <input id="pw" className="input" type={show ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" className="show" onClick={() => setShow((s) => !s)}>{show ? "Hide" : "Show"}</button>
          </div>
        </div>

        <button type="submit" className="btn" style={{ marginTop: 22 }}>Log in</button>
        <p className="muted" style={{ textAlign: "center", marginTop: 18, fontSize: 17, lineHeight: 1.35 }}>
          Staff only ever see your pseudonym, never your name.
        </p>
      </form>
      <p className="muted" style={{ textAlign: "center", marginTop: 22, fontSize: 17 }}>Students of Demo Campus only</p>
    </main>
  );
}
