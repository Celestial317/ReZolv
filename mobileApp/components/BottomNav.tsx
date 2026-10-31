"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clipboard, Home, Mic, Pin, User } from "./Icons";

const tabs = [
  { href: "/", label: "Home", Icon: Home },
  { href: "/campus", label: "Campus", Icon: Pin },
  null,
  { href: "/reports", label: "My reports", Icon: Clipboard },
  { href: "/profile", label: "Profile", Icon: User },
];

export default function BottomNav() {
  const path = usePathname();
  return (
    <nav className="nav" aria-label="Main">
      {tabs.map((t) =>
        t ? (
          <Link key={t.href} href={t.href} className={path === t.href ? "on" : ""} aria-current={path === t.href ? "page" : undefined}>
            <t.Icon />
            {t.label}
          </Link>
        ) : (
          <Link key="mic" href="/report" aria-label="Report a problem">
            <span className="mic"><Mic color="#b3e3e6" size={32} /></span>
          </Link>
        ),
      )}
    </nav>
  );
}
