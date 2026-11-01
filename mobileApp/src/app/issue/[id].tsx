import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import Mitraa, { type Mood } from "@/components/Mitraa";
import { Badge, Button, Card, ErrorBox, Loading, Notice, Screen, Segmented, TopBar, Txt } from "@/components/ui";
import { api, type IssueDetail, type TimelineEvent } from "@/lib/api";
import { LEVEL_NAME, dayAndTime, lateness } from "@/lib/format";
import { stateBadge } from "@/lib/issue";
import { catOf, color } from "@/lib/theme";
import { categoryIcon } from "@/components/Icons";
import { useApi } from "@/lib/useApi";

const LADDER = ["Department", "Warden", "Dean"];
const DOT: Record<string, string> = { escalated: color.red, reopened: color.red, root_cause: "#e8a317", promise_made: color.blue, fixed: color.leaf, confirmed: color.leaf };

function mitraaLine(i: IssueDetail): { mood: Mood; text: string } {
  const level = i.promise?.escalation_level ?? 0;
  if (i.status === "resolved") return { mood: "proud", text: "Fixed, because you spoke up." };
  if (i.status === "awaiting_confirm") return { mood: "happy", text: "They say it is fixed. Can you check for me?" };
  if (level > 0) return { mood: "determined", text: `Deadline missed, so I pushed it to ${LEVEL_NAME[level]}.` };
  if (i.promise && i.promise.hours_late > 0) return { mood: "concerned", text: "Late again. I am pushing it up." };
  if (i.promise) return { mood: "happy", text: "They have promised a fix. I am watching the date." };
  return { mood: "happy", text: "Sent on. Waiting for a promise." };
}

function Event({ e, why }: { e: TimelineEvent; why?: boolean }) {
  return (
    <View style={{ flexDirection: "row", gap: 14, paddingVertical: 14, borderTopWidth: 1, borderTopColor: color.line }}>
      <View style={{ width: 16, height: 16, borderRadius: 5, marginTop: 4, backgroundColor: DOT[e.type] ?? "#9db3b1" }} />
      <View style={{ flex: 1, gap: 3 }}>
        <Txt w="heavy" size={18}>{e.summary}</Txt>
        {e.reasoning ? <Txt c={color.muted} size={15}>{e.reasoning}</Txt> : null}
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center", marginTop: 2 }}>
          <Txt w="mono" size={12} c={color.muted}>{dayAndTime(e.created_at)}</Txt>
          {why && <Badge label={e.verification === "verified" ? "Verified" : e.verification === "contradicted" ? "Contradicted" : "Unverified"} t={e.verification === "verified" ? "green" : e.verification === "contradicted" ? "red" : "grey"} />}
        </View>
      </View>
    </View>
  );
}

export default function IssuePage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const d = useApi<IssueDetail>(`/issues/${id}`);
  const [tab, setTab] = useState<"timeline" | "why">("timeline");
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const i = d.data;

  async function meToo() {
    setBusy(true);
    try {
      await api(`/issues/${id}/metoo`, { method: "POST" });
      setMsg({ text: "Added. You are counted on this issue." });
      d.reload();
    } catch (e) {
      setMsg({ text: (e as Error).message, error: true });
    } finally {
      setBusy(false);
    }
  }

  if (!i) {
    return (
      <Screen>
        <TopBar title="Issue" />
        {d.error ? <ErrorBox message={d.error} retry={d.reload} /> : <Loading />}
      </Screen>
    );
  }

  const b = stateBadge(i.status, i.promise?.escalation_level ?? null);
  const level = i.promise?.escalation_level ?? 0;
  const late = !!i.promise && i.promise.hours_late > 0;
  const mood = mitraaLine(i);
  const others = i.report_count - (i.mine ? 1 : 0);

  return (
    <Screen>
      <TopBar title={i.code} sub={i.category.toUpperCase()} right={<Badge label={b.label} t={b.tone} />} />
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", backgroundColor: catOf(i.category).bg, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7 }}>
          {(() => { const Icon = categoryIcon[i.category] ?? categoryIcon.other; return <Icon size={18} color={catOf(i.category).fg} />; })()}
          <Txt w="heavy" size={15} c={catOf(i.category).fg}>{catOf(i.category).label}</Txt>
        </View>
        <Txt w="heavy" size={32} style={{ lineHeight: 36 }}>{i.title}</Txt>
        <Txt c={color.muted} size={18}>{i.location} · {i.mine ? `you and ${others} other students` : `${i.report_count} students`}</Txt>
      </View>

      {i.promise ? (
        <Card dark style={{ padding: 20, borderRadius: 28, gap: 10 }}>
          <Txt w="mono" size={14} c={color.aqua} style={{ letterSpacing: 2 }}>{(i.department ?? "STAFF").toUpperCase()} PROMISED</Txt>
          <Txt w="heavy" size={24} c="#fff">{i.promise.text}</Txt>
          {late ? (
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
              <Txt w="heavy" size={48} c="#ff8c8c" style={{ lineHeight: 52 }}>{lateness(i.promise.hours_late).replace(" late", "")}</Txt>
              <Txt c="#cfe6e6" size={20}>late</Txt>
            </View>
          ) : <Txt c="#cfe6e6" size={17}>{lateness(i.promise.hours_late)}</Txt>}
          <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
            {LADDER.map((name, n) => (
              <View key={name} style={{ flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center", backgroundColor: n === level && late ? "#ff8c8c" : "#27414a" }}>
                <Txt w="heavy" size={15} c={n === level && late ? "#3a0d0d" : "#cfe6e6"}>{name}{n === level && late ? " · now" : ""}</Txt>
              </View>
            ))}
          </View>
        </Card>
      ) : (
        <Card style={{ padding: 18 }}><Txt w="heavy" size={18}>Waiting for a promise</Txt></Card>
      )}

      <View style={{ flexDirection: "row", gap: 14, alignItems: "center", padding: 14, backgroundColor: "#fff", borderWidth: 1, borderColor: "#cfdcf5", borderRadius: 22 }}>
        <View style={{ width: 66, height: 66, borderRadius: 18, backgroundColor: "#dbe4ff", overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
          <Mitraa crop="face" mood={mood.mood} fx={false} size={66} />
        </View>
        <Txt size={18} c="#1d2b6b" style={{ flex: 1 }}><Txt w="heavy" size={18} c="#1d2b6b">Mitraa: </Txt>{mood.text}</Txt>
      </View>

      {i.cause && (
        <View style={{ padding: 20, borderRadius: 24, backgroundColor: "#fff1d6", borderWidth: 1, borderColor: "#f1d9a0", gap: 8 }}>
          <Txt w="heavy" size={21} c="#4a3200">ReZolv found the real cause</Txt>
          <Txt size={18} c="#5d4300">{i.cause.reason}</Txt>
          {i.cause.trials != null && <Txt c="#5d4300" size={15}>Measured: {i.cause.hits} of {i.cause.trials} cases followed within 48 hours.</Txt>}
        </View>
      )}

      {i.suggested_fix && (
        <Card style={{ padding: 18, gap: 4 }}><Txt w="heavy" size={18}>Suggested fix</Txt><Txt c={color.muted} size={16}>{i.suggested_fix}</Txt></Card>
      )}

      {msg && <Notice text={msg.text} error={msg.error} />}
      {i.status === "awaiting_confirm" && i.mine && !i.my_confirmation && <Button label="Check the fix" onPress={() => router.push(`/confirm/${i.id}`)} />}
      {!i.mine && !["resolved", "sealed"].includes(i.status) && <Button label="Me too" onPress={meToo} loading={busy} />}

      <Segmented value={tab} onChange={setTab} options={[{ key: "timeline", label: "Timeline" }, { key: "why", label: "Why?" }]} />
      <Card style={{ paddingHorizontal: 18 }}>
        {(tab === "timeline" ? [...i.events].reverse() : [...i.why].reverse()).map((e, n) => <Event key={n} e={e} why={tab === "why"} />)}
        {(tab === "timeline" ? i.events : i.why).length === 0 && <View style={{ padding: 20 }}><Txt c={color.muted}>Nothing recorded yet</Txt></View>}
      </Card>
    </Screen>
  );
}
