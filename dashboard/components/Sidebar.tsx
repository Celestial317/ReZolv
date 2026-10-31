"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Mitraa from "./Mitraa";
import { IconIssues, IconLock, IconOverview, IconPin, IconPromise, IconRoot, IconScore, IconSwarm } from "./Icons";
import { CAMPUS } from "@/lib/mock";

type Item = { href: string; label: string; icon: React.ReactNode; count?: number; tone?: "neutral" | "purple" | "red" };

const CAMPUS_NAV: Item[] = [
  { href: "/", label: "Overview", icon: <IconOverview /> },
  { href: "/issues", label: "Issues", icon: <IconIssues />, count: 18, tone: "neutral" },
  { href: "/safe-voice", label: "Safe Voice", icon: <IconLock />, count: 3, tone: "purple" },
  { href: "/promises", label: "Promises", icon: <IconPromise />, count: 4, tone: "red" },
  { href: "/map", label: "Campus map", icon: <IconPin /> },
];

const INTEL_NAV: Item[] = [
  { href: "/root-causes", label: "Root causes", icon: <IconRoot /> },
  { href: "/scorecard", label: "Scorecard", icon: <IconScore /> },
  { href: "/agents", label: "Agent swarm", icon: <IconSwarm /> },
];

function NavList({ items, path }: { items: Item[]; path: string }) {
  return (
    <nav className="nav">
      {items.map((it) => {
        const active = it.href === "/" ? path === "/" : path.startsWith(it.href);
        return (
          <Link key={it.href} href={it.href} className={`nav-item${active ? " active" : ""}`} aria-current={active ? "page" : undefined} title={it.label}>
            {it.icon}
            <span>{it.label}</span>
            {it.count != null && <em className={`nav-count c-${it.tone}`} style={{ fontStyle: "normal" }}>{it.count}</em>}
          </Link>
        );
      })}
    </nav>
  );
}

export default function Sidebar() {
  const path = usePathname();
  return (
    <aside className="sidebar">
      <Link href="/" className="brand">
        <div className="brand-avatar"><Mitraa crop="head" mood="happy" /></div>
        <div className="brand-text">
          <div className="brand-name">ReZolv</div>
          <div className="brand-sub">{CAMPUS}</div>
        </div>
      </Link>
      <div className="nav-label">Campus</div>
      <NavList items={CAMPUS_NAV} path={path} />
      <div className="nav-label" style={{ marginTop: 14 }}>Intelligence</div>
      <NavList items={INTEL_NAV} path={path} />
      <div className="agents-status">
        <b><span className="live-dot" /> 8 agents running</b>
        Shared memory on Meko · YugabyteDB
      </div>
    </aside>
  );
}
