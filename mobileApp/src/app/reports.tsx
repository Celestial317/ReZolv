import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { categoryIcon } from "@/components/Icons";
import { Badge, Card, Empty, ErrorBox, Loading, Screen, Segmented, Txt } from "@/components/ui";
import { type MyReport } from "@/lib/api";
import { progressOf, promiseLine, stateBadge } from "@/lib/issue";
import { catOf, color, tone } from "@/lib/theme";
import { useApi } from "@/lib/useApi";

const STEPS = ["Sent", "Routed", "Promised", "Fixed"];

export default function MyReports() {
  const router = useRouter();
  const data = useApi<MyReport[]>("/reports/mine");
  const [tab, setTab] = useState<"active" | "fixed">("active");

  // one card per issue, preferring the report the student wrote over a "me too"
  const issues = useMemo(() => {
    const byIssue = new Map<string, MyReport>();
    for (const r of data.data ?? []) {
      if (!r.issue_id || r.is_sensitive) continue;
      const seen = byIssue.get(r.issue_id);
      if (!seen || (seen.kind === "me_too" && r.kind === "report")) byIssue.set(r.issue_id, r);
    }
    return [...byIssue.values()];
  }, [data.data]);

  const active = issues.filter((r) => r.status !== "resolved");
  const fixed = issues.filter((r) => r.status === "resolved");
  const rows = tab === "active" ? active : fixed;

  return (
    <Screen nav>
      <Txt w="heavy" size={34}>My reports</Txt>
      <Segmented value={tab} onChange={setTab} options={[{ key: "active", label: `Active · ${active.length}` }, { key: "fixed", label: `Fixed · ${fixed.length}` }]} />
      {data.error && <ErrorBox message={data.error} retry={data.reload} />}
      {data.loading && !data.data && <Loading />}
      {data.data && rows.length === 0 && <Empty text={tab === "active" ? "No open reports" : "Nothing fixed yet"} />}
      {rows.map((r) => {
        const b = stateBadge(r.status, r.escalation_level);
        const others = (r.report_count ?? 1) - 1;
        const line = promiseLine({ ...r, hours_late: r.promise_due_at ? (Date.now() - new Date(r.promise_due_at).getTime()) / 3600000 : null });
        const done = progressOf(r.status);
        const k = catOf(r.category);
        const Icon = categoryIcon[r.category ?? ""] ?? categoryIcon.other;
        return (
          <Card key={r.issue_id!} onPress={() => router.push(`/issue/${r.issue_id}`)} style={{ padding: 20, gap: 10, borderLeftWidth: 7, borderLeftColor: k.fg }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: k.bg, alignItems: "center", justifyContent: "center" }}><Icon size={22} color={k.fg} /></View>
                <Txt w="mono" size={15} c={k.fg}>{r.code}</Txt>
              </View>
              <Badge label={b.label} t={b.tone} />
            </View>
            <Txt w="heavy" size={23}>{r.title}</Txt>
            <Txt c={color.muted} size={18}>{others > 0 ? `You and ${others} other students` : "Only you so far"}</Txt>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
              {STEPS.map((_, n) => <View key={n} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: n < done ? color.green : "#dfe9e8" }} />)}
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {STEPS.map((s) => <Txt key={s} w="bold" size={14} style={{ flex: 1 }}>{s}</Txt>)}
            </View>
            {r.status !== "resolved" && (
              <Txt w="heavy" size={17} c={r.status === "awaiting_confirm" ? tone.amber.fg : tone[line.tone].fg}>
                {r.status === "awaiting_confirm" ? "Marked fixed. Is it?" : line.text}
              </Txt>
            )}
          </Card>
        );
      })}
    </Screen>
  );
}
