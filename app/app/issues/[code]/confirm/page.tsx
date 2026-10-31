"use client";

import Link from "next/link";
import { notFound, useRouter, useSearchParams } from "next/navigation";
import { Suspense, use, useState } from "react";
import { Back, Check, Close, Minus } from "@/components/Icons";
import Mitraa, { type Mood, type Pose } from "@/components/Mitraa";
import { find } from "@/lib/mock";

type Answer = "yes" | "partly" | "no";

const OPTIONS: { key: Answer; title: string; text: string; Icon: typeof Check }[] = [
  { key: "yes", title: "Yes, it works", text: "Hot water on my floor now", Icon: Check },
  { key: "partly", title: "Partly", text: "Better, but not fully fixed", Icon: Minus },
  { key: "no", title: "Still broken", text: "Nothing changed", Icon: Close },
];

const RESULT: Record<Answer, { mood: Mood; pose: Pose; title: string; text: string }> = {
  yes: { mood: "proud", pose: "thumbsup", title: "Thank you!", text: "Fixed, because you spoke up. I will close it when most reporters agree." },
  partly: { mood: "concerned", pose: "idle", title: "Noted", text: "I will tell Electrical it is only partly fixed. It stays open." },
  no: { mood: "determined", pose: "hips", title: "I am on it", text: "I have reopened it and told the Warden. You will hear from me soon." },
};

function Confirm({ code }: { code: string }) {
  const router = useRouter();
  const preset = useSearchParams().get("a") as Answer | null;
  const issue = find(code);
  const [answer, setAnswer] = useState<Answer | null>(preset && ["yes", "partly", "no"].includes(preset) ? preset : null);
  const [sent, setSent] = useState(false);
  if (!issue) notFound();

  const total = issue.count;
  const done = 3 + (sent && answer === "yes" ? 1 : 0);

  if (sent && answer) {
    const r = RESULT[answer];
    return (
      <main className="page no-nav" style={{ paddingTop: 40, textAlign: "center" }}>
        <div style={{ width: 190, margin: "0 auto" }}><Mitraa pose={r.pose} mood={r.mood} /></div>
        <h1 className="h1" style={{ marginTop: 18 }}>{r.title}</h1>
        <p className="muted" style={{ fontSize: 19, margin: "12px 10px 26px", lineHeight: 1.35 }}>{r.text}</p>
        <div className="card pad" style={{ textAlign: "left" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18 }}>
            <span className="muted">Confirmed so far</span><b>{done} of {total}</b>
          </div>
          <Bars done={done} total={total} />
        </div>
        <Link href="/" className="btn" style={{ marginTop: 22 }}>Back to home</Link>
      </main>
    );
  }

  return (
    <>
      <main className="page no-nav" style={{ paddingTop: 18 }}>
        <div className="topbar">
          <button className="icon-btn" style={{ width: 52, height: 52 }} onClick={() => router.back()} aria-label="Back"><Back /></button>
          <span className="mono muted" style={{ fontSize: 18, letterSpacing: ".04em" }}>{issue.code} · CHECK THE FIX</span>
        </div>

        <h1 className="h1" style={{ fontSize: 36, margin: "18px 0 10px" }}>Is the geyser in Hostel C working now?</h1>
        <p className="muted" style={{ fontSize: 19, lineHeight: 1.35 }}>
          Electrical marked it fixed on Friday. The issue closes only when most of the {total} reporters agree.
        </p>

        <div className="card pad" style={{ margin: "18px 0 14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 19 }}>
            <span className="muted">Confirmed so far</span><b>3 of {total}</b>
          </div>
          <Bars done={3} total={total} />
        </div>

        <div className="stack" role="radiogroup">
          {OPTIONS.map(({ key, title, text, Icon }) => {
            const on = answer === key;
            return (
              <button key={key} role="radio" aria-checked={on} className={`opt ${on ? "on" : ""}`} style={{ alignItems: "center" }} onClick={() => setAnswer(key)}>
                <span className="tile-icon" style={{ width: 60, height: 60, background: on ? "var(--green)" : "#eaf1f0", color: on ? "#fff" : "var(--ink-2)" }}>
                  <Icon size={28} />
                </span>
                <span><b style={{ fontSize: 21 }}>{title}</b><span className="d" style={{ fontSize: 17 }}>{text}</span></span>
              </button>
            );
          })}
        </div>
      </main>
      <div className="bottom-bar">
        <button className="btn" disabled={!answer} onClick={() => setSent(true)}>Send answer</button>
      </div>
    </>
  );
}

function Bars({ done, total }: { done: number; total: number }) {
  return (
    <div style={{ display: "flex", gap: 6, marginTop: 12 }} aria-hidden>
      {Array.from({ length: total }, (_, n) => (
        <i key={n} style={{ flex: 1, height: 10, borderRadius: 5, background: n < done ? "var(--leaf)" : "#e2ecea" }} />
      ))}
    </div>
  );
}

export default function ConfirmPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  return (
    <Suspense>
      <Confirm code={code} />
    </Suspense>
  );
}
