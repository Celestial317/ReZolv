"use client";

import { LEVEL_TAG, STATUS, VERIFICATION, cat } from "@/lib/format";

export function PageHead({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {children}
    </div>
  );
}

export function Tag({ tone = "", children }: { tone?: string; children: React.ReactNode }) {
  return <span className={`tag ${tone}`}>{children}</span>;
}

export const StatusTag = ({ status }: { status: string }) => {
  const s = STATUS[status] ?? { label: status, tone: "" };
  return <Tag tone={s.tone}>{s.label}</Tag>;
};

export const LevelTag = ({ level }: { level: number | null | undefined }) =>
  level == null ? null : <Tag tone={LEVEL_TAG[level].tone}>{LEVEL_TAG[level].label}</Tag>;

export const VerifyTag = ({ value }: { value: string }) => {
  const v = VERIFICATION[value] ?? VERIFICATION.unverified;
  return <Tag tone={v.tone}>{v.label}</Tag>;
};

/** Shows loading and error states for data fetched with useApi. */
export function Async<T>({ state, children }: {
  state: { data: T | null; error: string | null; loading: boolean };
  children: (data: T) => React.ReactNode;
}) {
  if (state.error) return <div className="notice error">{state.error}</div>;
  if (!state.data) return <div className="empty">{state.loading ? "Loading" : "Nothing to show"}</div>;
  return <>{children(state.data)}</>;
}

/** Category in its own colour: water blue, electricity yellow, internet purple, food orange, safety red. */
export const CatTag = ({ category }: { category: string }) => {
  const c = cat(category);
  return <span className="tag" style={{ background: c.bg, color: c.fg }}>{c.label}</span>;
};

export const Empty = ({ children }: { children: React.ReactNode }) => <div className="empty">{children}</div>;

export function Bar({ pct }: { pct: number | null }) {
  const v = Math.max(0, Math.min(100, pct ?? 0));
  return (
    <div className={`bar ${v < 60 ? "low" : v < 80 ? "mid" : ""}`}>
      <i style={{ width: `${v}%` }} />
    </div>
  );
}
