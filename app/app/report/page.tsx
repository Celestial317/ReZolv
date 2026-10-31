"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import CampusMap, { buildingAt } from "@/components/CampusMap";
import { Back, Camera, Check, Close, Play, Send, Mic } from "@/components/Icons";
import Mitraa from "@/components/Mitraa";

const FLOORS = ["Ground", "1st", "2nd", "3rd"];
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function Wizard() {
  const router = useRouter();
  const params = useSearchParams();
  const startMode = params.get("mode") === "type" ? "type" : "speak";

  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<"speak" | "type">(startMode);
  const [rec, setRec] = useState<"idle" | "live" | "done">("idle");
  const [secs, setSecs] = useState(0);
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState(params.get("mode") === "photo");
  const [place, setPlace] = useState<string | null>("Hostel B");
  const [floor, setFloor] = useState("2nd");
  const [joined, setJoined] = useState(true);
  const [sensitive, setSensitive] = useState(false);
  const [notify, setNotify] = useState(true);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (tick.current) clearInterval(tick.current); }, []);

  const toggleRec = () => {
    if (rec === "live") {
      if (tick.current) clearInterval(tick.current);
      setRec("done");
      return;
    }
    setSecs(0);
    setRec("live");
    tick.current = setInterval(() => setSecs((s) => s + 1), 1000);
  };

  const hasInput = mode === "speak" ? rec === "done" : text.trim().length > 3;
  const mood = rec === "live" ? "listening" : rec === "done" ? "cheerful" : "happy";
  const bars = [10, 26, 18, 44, 30, 56, 70, 40, 62, 30, 20, 52, 66, 36, 24, 48, 58, 28, 16, 34, 44, 20, 12];

  const back = () => (step === 1 ? router.back() : setStep(step - 1));
  const next = () => (step < 3 ? setStep(step + 1) : router.push(`/report/sent${sensitive ? "?s=1" : ""}`));

  const titles = [
    { t: "What happened?", s: "" },
    { t: "Where is it?", s: "Drag the map until the pin sits on the spot" },
    { t: "Check and send", s: "" },
  ][step - 1];

  return (
    <>
      <main className="page no-nav" style={{ paddingTop: 18 }}>
        <div className="topbar">
          <button className="icon-btn" style={{ width: 52, height: 52 }} onClick={back} aria-label={step === 1 ? "Close" : "Back"}>
            {step === 1 ? <Close /> : <Back />}
          </button>
          <div className="t"><b>{titles.t}</b>{titles.s && <span>{titles.s}</span>}</div>
          <span className="n">{step} / 3</span>
        </div>
        <div className="steps" aria-hidden>{[1, 2, 3].map((n) => <i key={n} className={n <= step ? "on" : ""} />)}</div>

        {step === 1 && (
          <div className="stack">
            <div className="seg" role="tablist">
              <button role="tab" aria-selected={mode === "speak"} className={mode === "speak" ? "on" : ""} onClick={() => setMode("speak")}>Speak</button>
              <button role="tab" aria-selected={mode === "type"} className={mode === "type" ? "on" : ""} onClick={() => setMode("type")}>Type</button>
            </div>

            {mode === "speak" ? (
              <section className="rec">
                <div className="face"><Mitraa crop="face" mood={mood} pose="idle" fx={false} /></div>
                <div className={`wave ${rec === "live" ? "live" : ""}`} aria-hidden>
                  {bars.map((h, n) => (
                    <i key={n} style={{ height: rec === "idle" ? 10 : h, animationDelay: `${(n % 7) * 0.09}s` }} />
                  ))}
                </div>
                <div className="time">{fmt(rec === "done" ? Math.max(secs, 1) : secs)}</div>
                <button className={`big ${rec === "live" ? "live" : ""}`} onClick={toggleRec} aria-label={rec === "live" ? "Stop recording" : "Start recording"}>
                  <span>{rec === "live" ? <span style={{ width: 24, height: 24, borderRadius: 6, background: "var(--ink)" }} /> : <Mic size={36} />}</span>
                </button>
                <p>
                  {rec === "idle" && "Tap and tell Mitraa in any language"}
                  {rec === "live" && "Sun rahi hoon. Take your time."}
                  {rec === "done" && "Got it! Tap to record again"}
                </p>
              </section>
            ) : (
              <>
                <div className="bubble-row">
                  <div className="face"><Mitraa crop="face" mood="happy" fx={false} /></div>
                  <p>Type it in any language. Short is fine.</p>
                </div>
                <textarea className="input" placeholder="e.g. No water on the 2nd floor since last night" value={text} onChange={(e) => setText(e.target.value)} aria-label="Describe the problem" />
              </>
            )}

            {mode === "speak" && rec === "done" && (
              <div className="card pad">
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <span className="badge green" style={{ fontSize: 16 }}>Hindi detected</span>
                  <span className="muted" style={{ fontSize: 16 }}>transcribed on our own server</span>
                </div>
                <p style={{ fontSize: 22, margin: "10px 0 8px", lineHeight: 1.35 }}>“कल रात से दूसरे फ्लोर पर पानी नहीं है, बाथरूम में एक बूंद नहीं।”</p>
                <p className="muted" style={{ fontSize: 18 }}>Since last night there is no water on the second floor, not a drop in the bathroom.</p>
              </div>
            )}

            <div>
              <div style={{ fontWeight: 800, fontSize: 19, marginBottom: 8 }}>
                Add a photo <span className="muted" style={{ fontWeight: 500 }}>(optional)</span>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="pill-btn" style={{ display: "flex", gap: 8, alignItems: "center", height: 52, borderRadius: 16 }} onClick={() => setPhoto((p) => !p)}>
                  <Camera /> Camera
                </button>
                {photo && (
                  <div style={{ flex: 1, height: 52, borderRadius: 16, background: "repeating-linear-gradient(45deg,#e3ecea,#e3ecea 8px,#d6e4e1 8px,#d6e4e1 16px)", display: "grid", placeItems: "center", color: "var(--muted)", fontSize: 15 }}>
                    [Photo of dry tap]
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ margin: "0 -18px" }}>
            <div style={{ position: "relative" }}>
              <CampusMap mode="pin" center={[155, 385]} zoom={1.5} aspect={1} onCenter={(_, b) => setPlace(b)} />
              <div className="card" style={{ position: "absolute", top: 14, left: 14, right: 14, display: "flex", gap: 14, alignItems: "center", padding: "12px 14px", boxShadow: "0 8px 24px rgba(20,35,42,.12)" }}>
                <span className="tile-icon" style={{ width: 52, height: 52, background: "var(--mint)", color: "var(--green)" }}><span style={{ display: "grid" }}>⌂</span></span>
                <div>
                  <div className="mono muted" style={{ fontSize: 14, letterSpacing: ".08em" }}>PIN IS ON</div>
                  <b style={{ fontSize: 22 }}>{place ? `${place} · ${floor} floor` : "Open ground"}</b>
                </div>
              </div>
            </div>
            <div style={{ padding: "16px 18px 0" }}>
              <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 10 }}>Floor</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                {FLOORS.map((f) => (
                  <button key={f} className={`pill-btn ${floor === f ? "on" : ""}`} style={{ height: 56, fontSize: 19, borderRadius: 16 }} onClick={() => setFloor(f)}>{f}</button>
                ))}
              </div>
              {place === "Hostel B" && (
                <div className="card" style={{ marginTop: 16, padding: 16, display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{ flex: 1 }}>
                    <b style={{ fontSize: 21, display: "block" }}>31 students reported this here</b>
                    <span className="muted" style={{ fontSize: 17 }}>“No water on 2nd floor” · Hostel B</span>
                  </div>
                  <button className={`btn small ${joined ? "" : "ghost"}`} style={{ width: "auto", padding: "0 20px", height: 50 }} onClick={() => setJoined((j) => !j)}>
                    {joined ? "Joined" : "Join"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="stack">
            <section className="card">
              <div style={{ display: "flex", gap: 14, padding: 16, alignItems: "center" }}>
                <span className="tile-icon" style={{ width: 58, height: 58, background: "var(--ink)", color: "var(--aqua)", borderRadius: 18 }}><Play /></span>
                <div>
                  <b style={{ fontSize: 21, display: "block" }}>{mode === "speak" ? `Voice note · ${fmt(Math.max(secs, 1))}` : "Typed report"}</b>
                  <span className="muted" style={{ fontSize: 17 }}>
                    {mode === "speak" ? "Hindi · “No water on the second floor since last night”" : `“${text.slice(0, 70)}”`}
                  </span>
                </div>
              </div>
              {[
                ["Place", place ? `${place} · ${floor} floor` : "Open ground"],
                ["Category", "Water"],
                ["Photo", photo ? "1 attached" : "None"],
                ...(joined && place === "Hostel B" && !sensitive ? [["Joins issue", "31 others · RZV-209"]] : []),
              ].map(([k, v]) => (
                <div key={k} className="row-line" style={{ fontSize: 18 }}>
                  <span className="muted">{k}</span><b>{v}</b>
                </div>
              ))}
            </section>

            <h2 className="h2" style={{ fontSize: 21, paddingTop: 6 }}>Who can see it?</h2>
            <button className={`opt ${!sensitive ? "on" : ""}`} onClick={() => setSensitive(false)} role="radio" aria-checked={!sensitive}>
              <span className={`check dot ${!sensitive ? "on" : ""}`} style={{ width: 34, height: 34, borderRadius: 11 }} />
              <span><b>Normal · pseudonym only</b><span className="d">Staff see the issue and “Student #4F2A”. Never your name.</span></span>
            </button>
            <button className={`opt ${sensitive ? "on" : ""}`} onClick={() => setSensitive(true)} role="radio" aria-checked={sensitive}>
              <span className={`check dot ${sensitive ? "on" : ""}`} style={{ width: 34, height: 34, borderRadius: 11 }} />
              <span><b>Sensitive · keep it sealed</b><span className="d">For harassment, ragging or a staff member. Nobody reads it until enough other students report the same thing.</span></span>
            </button>

            {sensitive && (
              <div className="bubble-row">
                <div className="face"><Mitraa crop="face" mood="sympathetic" pose="heart" fx={false} /></div>
                <p>Thank you for trusting me. Your name stays safe.</p>
              </div>
            )}

            <button style={{ display: "flex", gap: 14, alignItems: "center", fontWeight: 800, fontSize: 19, padding: "6px 4px", textAlign: "left" }} role="checkbox" aria-checked={notify} onClick={() => setNotify((n) => !n)}>
              <span className={`check ${notify ? "on" : ""}`}>{notify && <Check size={18} />}</span>
              Tell me when something changes
            </button>
          </div>
        )}
      </main>

      <div className="bottom-bar">
        <button className="btn" disabled={step === 1 && !hasInput} onClick={next}>
          {step === 1 && "Next · pin the place"}
          {step === 2 && "Confirm place"}
          {step === 3 && (<><Send /> Send report</>)}
        </button>
      </div>
    </>
  );
}

export default function ReportPage() {
  return (
    <Suspense>
      <Wizard />
    </Suspense>
  );
}
