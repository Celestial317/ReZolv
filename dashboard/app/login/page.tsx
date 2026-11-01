"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Mitraa from "@/components/Mitraa";
import { session, signIn } from "@/lib/api";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (session()) router.replace("/"); }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      router.replace("/");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <div className="art">
        <div>
          <div className="figure"><Mitraa pose="wave" mood="happy" /></div>
          <h2>ReZolv Staff</h2>
        </div>
      </div>
      <div className="form">
        <form onSubmit={submit} className="stack">
          <h1>Sign in</h1>
          <label className="field"><span>Email</span>
            <input className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="field"><span>Password</span>
            <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {error && <div className="notice error">{error}</div>}
          <button className="btn block" disabled={busy}>{busy ? "Signing in" : "Sign in"}</button>
        </form>
      </div>
    </div>
  );
}
