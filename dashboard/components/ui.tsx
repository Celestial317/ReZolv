import Link from "next/link";
import { IconArrowUpRight } from "./Icons";
import type { Tone } from "@/lib/mock";

export const TONE_COLOR: Record<Tone, string> = {
  red: "var(--red)", orange: "var(--orange)", amber: "var(--amber)", green: "var(--green)",
  purple: "var(--purple)", teal: "var(--teal)", blue: "var(--blue)", gray: "var(--text-3)",
};

export function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const cls = tone === "orange" ? "amber" : tone;
  return <span className={`pill pill-${cls}`}>{children}</span>;
}

export function Bar({ value, color, width }: { value: number; color: string; width?: number }) {
  return (
    <div className="bar" style={width ? { width } : undefined} role="presentation">
      <i style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color }} />
    </div>
  );
}

export function AgentBadge({ id, dark }: { id: string; dark?: boolean }) {
  return <span className={`agent-badge ${dark ? "ab-dark" : `ab-${id}`}`}>{id}</span>;
}

export function StatTile({ label, value, note, color, href, dark = true }: {
  label: string; value: string | number; note: string; color: string; href?: string; dark?: boolean;
}) {
  const body = (
    <>
      <div className="eyebrow">{label}</div>
      {href && <span className="arrow"><IconArrowUpRight size={15} /></span>}
      {dark ? (
        <div className="row">
          <span className="big" style={{ color }}>{value}</span>
          <p>{note}</p>
        </div>
      ) : (
        <>
          <div className="row"><span className="big sm" style={{ color }}>{value}</span></div>
          <p className="under">{note}</p>
        </>
      )}
    </>
  );
  const cls = `tile ${dark ? "tile-dark" : "tile-light"}`;
  return href ? <Link href={href} className={cls}>{body}</Link> : <div className={cls}>{body}</div>;
}
