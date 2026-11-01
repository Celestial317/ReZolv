"use client";

import Link from "next/link";
import { useApi } from "@/lib/api";
import { cat, lateness, when } from "@/lib/format";
import { Async, CatTag, LevelTag, PageHead } from "@/components/ui";

type Card = { id: string; issue_id: string; code: string; title: string; category: string; text: string; due_at: string; department: string; escalation_level: number; hours_late: number };
type Board = Record<"overdue" | "due_soon" | "waiting_for_students" | "on_track" | "kept", Card[]>;

const COLUMNS: { key: keyof Board; label: string }[] = [
  { key: "overdue", label: "Overdue" },
  { key: "due_soon", label: "Due within 48 hours" },
  { key: "waiting_for_students", label: "Waiting for students" },
  { key: "on_track", label: "On track" },
  { key: "kept", label: "Kept" },
];

export default function Promises() {
  const board = useApi<Board>("/admin/promises");
  return (
    <>
      <PageHead title="Promises" />
      <Async state={board}>
        {(b) => (
          <div className="board">
            {COLUMNS.map((c) => (
              <div className="col" key={c.key}>
                <h3>{c.label}<span>{b[c.key].length}</span></h3>
                {b[c.key].length === 0 && <p className="muted" style={{ padding: "4px 4px 8px" }}>None</p>}
                {b[c.key].map((p) => (
                  <Link href={`/issues/${p.issue_id}`} className="item" key={p.id} style={{ borderLeft: `5px solid ${cat(p.category).pin}` }}>
                    <span className="code">{p.code}</span> <CatTag category={p.category} />
                    <div><b>{p.title}</b></div>
                    <div className="sub muted">{p.text}</div>
                    <div className="row" style={{ marginTop: 6 }}>
                      <LevelTag level={p.escalation_level} />
                      <span className="sub muted">{c.key === "overdue" ? lateness(p.hours_late) : when(p.due_at)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            ))}
          </div>
        )}
      </Async>
    </>
  );
}
