"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import Mitraa from "@/components/Mitraa";

const CODE = "RZV-R-7F3A-91C2";

function Sent() {
  const sensitive = useSearchParams().get("s") === "1";
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try { await navigator.clipboard.writeText(CODE); } catch { /* clipboard blocked: still show feedback */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const steps = sensitive
    ? ["Nobody reads your report until enough other students say the same thing.", "You will see only a count, never a name.", "When it opens, the committee handles it. You decide if it is fixed."]
    : ["The Dean has 48 hours to set a new deadline.", "You get a notification when Estates makes a promise.", "When it is fixed, you decide if it is really fixed."];

  return (
    <main className="page no-nav" style={{ paddingTop: 24, paddingBottom: 40, textAlign: "center" }}>
      <div style={{ width: 210, margin: "0 auto" }}>
        {/* No confetti and no cheering on sensitive reports. */}
        <Mitraa pose={sensitive ? "heart" : "cheer"} mood={sensitive ? "sympathetic" : "cheerful"} fx={!sensitive} />
      </div>
      <h1 className="h1" style={{ fontSize: 36, marginTop: 18 }}>{sensitive ? "Safely received" : "Your voice is in"}</h1>
      <p className="muted" style={{ fontSize: 19, margin: "12px 8px 22px", lineHeight: 1.35 }}>
        {sensitive
          ? "Mitraa: “Thank you for trusting me. Your name stays safe.”"
          : "Mitraa: “You joined 31 others on the Hostel B water issue. It is already with the Dean.”"}
      </p>

      <section className="card dark" style={{ padding: 20, textAlign: "left", borderRadius: 26 }}>
        <div className="mono" style={{ color: "var(--aqua)", fontSize: 16, letterSpacing: ".14em" }}>YOUR RECEIPT</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "10px 0 12px", gap: 10 }}>
          <span className="mono" style={{ fontSize: 24, fontWeight: 700, letterSpacing: ".03em" }}>{CODE}</span>
          <button onClick={copy} style={{ border: "1px solid #3b565e", borderRadius: 14, padding: "10px 16px", color: "var(--aqua)", fontWeight: 800, fontSize: 17 }}>
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <p style={{ color: "#cfe6e6", fontSize: 17, lineHeight: 1.35 }}>Use this code to track your report. It does not reveal who you are.</p>
      </section>

      <section className="card pad" style={{ marginTop: 16, textAlign: "left", padding: 20 }}>
        <b style={{ fontSize: 22 }}>What happens next</b>
        <ol style={{ listStyle: "none", marginTop: 12 }}>
          {steps.map((t, n) => (
            <li key={n} style={{ display: "flex", gap: 14, alignItems: "center", padding: "8px 0", fontSize: 18, lineHeight: 1.3 }}>
              <span style={{ width: 40, height: 40, borderRadius: 12, background: "var(--mint)", color: "var(--green)", display: "grid", placeItems: "center", fontWeight: 800, flex: "none" }}>{n + 1}</span>
              {t}
            </li>
          ))}
        </ol>
      </section>

      <div className="stack" style={{ marginTop: 22 }}>
        {!sensitive && <Link href="/issues/RZV-209" className="btn">Track this issue</Link>}
        <Link href="/" className={sensitive ? "btn" : "btn ghost"}>Back to home</Link>
      </div>
    </main>
  );
}

export default function SentPage() {
  return (
    <Suspense>
      <Sent />
    </Suspense>
  );
}
