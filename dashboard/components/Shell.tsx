"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Mitraa from "./Mitraa";
import { LEVEL_TITLE, ROLE_LEVEL, api, session, type Staff } from "@/lib/api";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/issues", label: "Issues" },
  { href: "/escalations", label: "Escalations", queue: true },
  { href: "/promises", label: "Promises" },
  { href: "/map", label: "Campus map" },
  { href: "/root-causes", label: "Root causes" },
  { href: "/scorecard", label: "Scorecard" },
  { href: "/agents", label: "Agent activity" },
  { href: "/profile", label: "Profile" },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [user, setUser] = useState<Staff | null>(null);
  const [queue, setQueue] = useState<number | null>(null);

  useEffect(() => {
    const s = session();
    if (!s) { router.replace("/login"); return; }
    setUser(s);
    api<{ issues: unknown[] }>("/admin/escalations").then((r) => setQueue(r.issues.length)).catch(() => {});
  }, [router, path]);

  if (!user) return null;
  const level = ROLE_LEVEL[user.role];

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <div className="brand-mark"><Mitraa crop="face" mood="happy" fx={false} /></div>
          <div><b>ReZolv</b><span>SSCBS, Rohini</span></div>
        </div>
        <nav className="nav">
          {NAV.map((n) => {
            const on = n.href === "/" ? path === "/" : path.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href} className={on ? "on" : ""}>
                {n.label}
                {n.queue && queue ? <span className="count alert">{queue}</span> : null}
              </Link>
            );
          })}
        </nav>
        <div className="who">
          <b>{user.name}</b>
          <span>Level {level + 1}, {LEVEL_TITLE[level]}</span>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
