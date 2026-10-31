import Link from "next/link";
import { ArrowUp, Bell, Chevron, Drop } from "@/components/Icons";
import Mitraa from "@/components/Mitraa";
import { issues, me } from "@/lib/mock";

export default function Home() {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const escalated = issues.find((i) => i.state === "escalated" && i.mine);
  const check = issues.find((i) => i.state === "check" && i.mine);
  const near = issues.filter((i) => !["fixed", "sealed"].includes(i.state)).slice(0, 2);

  return (
    <>
      <header style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div className="avatar">{me.short}</div>
        <div style={{ flex: 1 }}>
          <div className="muted" style={{ fontSize: 18 }}>{greeting}</div>
          <div className="h2" style={{ fontSize: 24 }}>{me.pseudonym}</div>
        </div>
        <button className="icon-btn" aria-label="Notifications" style={{ position: "relative" }}>
          <Bell />
          <span style={{ position: "absolute", top: 12, right: 14, width: 12, height: 12, borderRadius: 6, background: "var(--red)", border: "2px solid #fff" }} />
        </button>
      </header>

      <section className="card dark" style={{ marginTop: 18, padding: 22, borderRadius: 30 }}>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <h1 className="h1" style={{ fontSize: 31 }}>Something wrong on campus?</h1>
            <p style={{ color: "#cfe6e6", fontSize: 18, marginTop: 10, lineHeight: 1.3 }}>
              Tell Mitraa in any language. Takes 30 seconds.
            </p>
          </div>
          <div style={{ width: 118, height: 118, borderRadius: 24, background: "#dbe4ff", overflow: "hidden", flex: "none" }}>
            <Mitraa crop="bust" mood="happy" pose="idle" fx={false} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 18 }}>
          {[["Voice", "speak"], ["Photo", "photo"], ["Type", "type"]].map(([label, mode]) => (
            <Link
              key={mode}
              href={`/report?mode=${mode}`}
              style={{ height: 52, borderRadius: 16, background: "#27414a", color: "var(--aqua)", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 18 }}
            >
              {label}
            </Link>
          ))}
        </div>
      </section>

      {escalated && (
        <Link
          href={`/issues/${escalated.code}`}
          style={{
            display: "flex", gap: 14, alignItems: "center", marginTop: 16, padding: 16, borderRadius: 22,
            background: "var(--red-bg)", border: "1px solid #f2c4c4",
          }}
        >
          <span style={{ width: 54, height: 54, borderRadius: 16, background: "var(--red)", color: "#fff", display: "grid", placeItems: "center", flex: "none" }}>
            <ArrowUp />
          </span>
          <span style={{ flex: 1 }}>
            <b style={{ fontSize: 20, display: "block", lineHeight: 1.15 }}>Your water report was escalated</b>
            <span style={{ color: "var(--red-ink)", fontSize: 17 }}>Estates missed the deadline. Now with the Dean.</span>
          </span>
          <Chevron color="var(--red-ink)" />
        </Link>
      )}

      <section className="card stats" style={{ marginTop: 16 }}>
        <div><small>Open</small><b>2</b></div>
        <div><small>Fixed</small><b>3</b></div>
        <div><small>Me too</small><b>5</b></div>
      </section>

      {check && (
        <>
          <div className="sec-head">
            <h2 className="h2">Needs your OK</h2>
            <span className="badge amber">1 waiting</span>
          </div>
          <div className="card pad">
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <span className="tile-icon" style={{ background: "var(--amber-bg)", color: "#8a6100" }}><Drop /></span>
              <div>
                <b style={{ fontSize: 21 }}>Geyser in Hostel C fixed?</b>
                <div className="muted" style={{ fontSize: 17 }}>Electrical marked it done on Friday</div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
              <Link href={`/issues/${check.code}/confirm?a=no`} className="btn ghost" style={{ height: 54 }}>Still broken</Link>
              <Link href={`/issues/${check.code}/confirm?a=yes`} className="btn" style={{ height: 54 }}>Yes, it works</Link>
            </div>
          </div>
        </>
      )}

      <div className="sec-head">
        <h2 className="h2">Near you</h2>
        <Link href="/campus" className="link" style={{ textDecoration: "none" }}>See map</Link>
      </div>
      <div className="stack">
        {near.map((i) => (
          <Link key={i.code} href={`/issues/${i.code}`} className="issue">
            <div className={`count ${i.state === "escalated" ? "red" : "blue"}`}>
              <b>{i.count}</b><small>reports</small>
            </div>
            <div className="mid">
              <b>{i.title}</b>
              <div className="sub">{i.place} · {i.dept}</div>
              <div className={`st ${i.state === "escalated" ? "red" : "blue"}`}>{i.note}</div>
            </div>
            <Chevron color="var(--muted)" />
          </Link>
        ))}
      </div>
    </>
  );
}
