"use client";

import Link from "next/link";
import { useState } from "react";
import { Check } from "@/components/Icons";
import { me, scorecard } from "@/lib/mock";

const languages = ["English", "हिंदी", "Hinglish", "ଓଡ଼ିଆ", "தமிழ்"];
const toggles = ["Updates on my reports", "New issues near my hostel", "Ask me to confirm fixes"];

export default function Profile() {
  const [lang, setLang] = useState("हिंदी");
  const [on, setOn] = useState<Record<string, boolean>>({ [toggles[0]]: true, [toggles[1]]: true, [toggles[2]]: true });

  return (
    <>
      <h1 className="h1">Profile</h1>

      <section className="card dark" style={{ marginTop: 16, padding: 20, borderRadius: 30 }}>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div className="avatar" style={{ width: 80, height: 80, borderRadius: 24, background: "var(--aqua)", color: "var(--ink)", fontSize: 24 }}>{me.short}</div>
          <div>
            <div className="mono" style={{ fontSize: 26, fontWeight: 700 }}>{me.pseudonym}</div>
            <div style={{ color: "#cfe6e6", fontSize: 18 }}>Demo Campus · verified student</div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 16 }}>
          {[[me.reports, "reports"], [me.fixed, "fixed"], [me.metoo, "me too"]].map(([n, l]) => (
            <div key={l} style={{ background: "#27414a", borderRadius: 16, padding: "12px 14px" }}>
              <b style={{ fontSize: 28, display: "block" }}>{n}</b>
              <span style={{ color: "#cfe6e6", fontSize: 17 }}>{l}</span>
            </div>
          ))}
        </div>
      </section>

      <h2 className="h2" style={{ margin: "22px 0 10px", fontSize: 20 }}>App language</h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {languages.map((l) => (
          <button key={l} className={`pill-btn ${lang === l ? "on" : ""}`} style={{ fontSize: 18, padding: "12px 20px", borderRadius: 16 }} onClick={() => setLang(l)}>{l}</button>
        ))}
      </div>

      <section className="card" style={{ marginTop: 18 }}>
        {toggles.map((t) => (
          <button key={t} className="row-line" style={{ width: "100%", fontSize: 19 }} role="checkbox" aria-checked={!!on[t]} onClick={() => setOn((s) => ({ ...s, [t]: !s[t] }))}>
            <span>{t}</span>
            <span className={`check ${on[t] ? "on" : ""}`}>{on[t] && <Check size={18} />}</span>
          </button>
        ))}
      </section>

      <section className="card pad" style={{ marginTop: 16, padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
          <b style={{ fontSize: 22 }}>Campus scorecard</b>
          <span className="muted" style={{ fontSize: 17 }}>promises kept</span>
        </div>
        {scorecard.map((s) => (
          <div key={s.name} style={{ display: "grid", gridTemplateColumns: "130px 1fr 48px", gap: 12, alignItems: "center", padding: "6px 0", fontSize: 18 }}>
            <span>{s.name}</span>
            <span style={{ height: 12, borderRadius: 6, background: "#e8f0ef", overflow: "hidden" }}>
              <span style={{ display: "block", height: "100%", width: `${s.pct}%`, background: s.color, borderRadius: 6 }} />
            </span>
            <b style={{ textAlign: "right" }}>{s.pct}%</b>
          </div>
        ))}
      </section>

      <Link href="/login" className="card" style={{ display: "block", marginTop: 16, padding: 20, color: "var(--red-ink)", fontWeight: 800, fontSize: 19 }}>
        Log out
      </Link>
    </>
  );
}
