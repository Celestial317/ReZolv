import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { CheckIcon, CloseIcon, MinusIcon } from "@/components/Icons";
import Mitraa, { type Mood, type Pose } from "@/components/Mitraa";
import { Button, Card, ErrorBox, Loading, Notice, Screen, TopBar, Txt } from "@/components/ui";
import { api, type IssueDetail } from "@/lib/api";
import { color } from "@/lib/theme";
import { useApi } from "@/lib/useApi";

type Answer = "yes" | "partly" | "no";
type Result = { outcome: "resolved" | "escalated" | "reopened" | "pending"; yes: number; no: number; reporters: number; escalated_to: string | null };

const OPTIONS: { key: Answer; title: string; text: string; Icon: typeof CheckIcon }[] = [
  { key: "yes", title: "Yes, it works", text: "The problem is gone", Icon: CheckIcon },
  { key: "partly", title: "Partly", text: "Better, but not fully fixed", Icon: MinusIcon },
  { key: "no", title: "Still broken", text: "Nothing changed", Icon: CloseIcon },
];

const REPLY: Record<Answer, { mood: Mood; pose: Pose; title: string }> = {
  yes: { mood: "proud", pose: "thumbsup", title: "Thank you" },
  partly: { mood: "concerned", pose: "idle", title: "Noted" },
  no: { mood: "determined", pose: "hips", title: "I am on it" },
};

export default function Confirm() {
  const { id, a } = useLocalSearchParams<{ id: string; a?: string }>();
  const router = useRouter();
  const d = useApi<IssueDetail>(`/issues/${id}`);
  const [answer, setAnswer] = useState<Answer | null>(a === "yes" || a === "partly" || a === "no" ? a : null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const i = d.data;

  async function send() {
    if (!answer) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await api<Result>(`/issues/${id}/confirm`, { method: "POST", body: { answer } }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!i) {
    return <Screen><TopBar title="Check the fix" />{d.error ? <ErrorBox message={d.error} retry={d.reload} /> : <Loading />}</Screen>;
  }

  if (result && answer) {
    const r = REPLY[answer];
    const line =
      result.outcome === "resolved" ? "Most reporters agree, so it is closed."
      : result.outcome === "escalated" ? `The deadline had passed, so I moved it up to ${result.escalated_to}.`
      : result.outcome === "reopened" ? "Most reporters say it is not fixed, so it is open again."
      : "Your answer is saved. It stays open until most reporters agree.";
    return (
      <Screen>
        <View style={{ alignItems: "center", gap: 14, paddingTop: 30 }}>
          <Mitraa pose={r.pose} mood={r.mood} size={170} />
          <Txt w="heavy" size={34}>{r.title}</Txt>
          <Txt c={color.muted} size={19} style={{ textAlign: "center" }}>{line}</Txt>
        </View>
        <Card style={{ padding: 18, gap: 10 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Txt c={color.muted} size={18}>Confirmed so far</Txt>
            <Txt w="heavy" size={18}>{result.yes} of {result.reporters}</Txt>
          </View>
          <Bars done={result.yes} total={result.reporters} />
        </Card>
        <Button label="Back to home" onPress={() => router.replace("/")} />
      </Screen>
    );
  }

  const answered = i.my_confirmation != null;
  return (
    <Screen>
      <TopBar title="Check the fix" sub={i.code} />
      <Txt w="heavy" size={32} style={{ lineHeight: 36 }}>Is it fixed: {i.title}?</Txt>
      <Txt c={color.muted} size={18}>{i.department ?? "Staff"} marked it fixed. It closes when most of the {i.report_count} reporters agree.</Txt>
      <Card style={{ padding: 18, gap: 10 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Txt c={color.muted} size={18}>Confirmed so far</Txt>
          <Txt w="heavy" size={18}>{i.confirmations.yes} of {i.report_count}</Txt>
        </View>
        <Bars done={i.confirmations.yes} total={i.report_count} />
      </Card>

      {OPTIONS.map(({ key, title, text, Icon }) => {
        const on = answer === key;
        return (
          <Pressable key={key} disabled={answered} onPress={() => setAnswer(key)} style={{ flexDirection: "row", gap: 14, alignItems: "center", padding: 16, borderRadius: 20, backgroundColor: on ? "#f0f8f6" : "#fff", borderWidth: on ? 1.5 : 1, borderColor: on ? color.green : color.line, opacity: answered ? 0.6 : 1 }}>
            <View style={{ width: 58, height: 58, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: on ? color.green : "#eaf1f0" }}>
              <Icon size={28} color={on ? "#fff" : color.ink2} />
            </View>
            <View style={{ flex: 1 }}>
              <Txt w="heavy" size={20}>{title}</Txt>
              <Txt c={color.muted} size={16}>{text}</Txt>
            </View>
          </Pressable>
        );
      })}
      {answered && <Notice text="You have already answered for this round." />}
      {error && <ErrorBox message={error} />}
      <Button label="Send answer" onPress={send} loading={busy} disabled={!answer || answered} />
    </Screen>
  );
}

function Bars({ done, total }: { done: number; total: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      {Array.from({ length: Math.min(total, 24) }, (_, n) => <View key={n} style={{ flex: 1, height: 10, borderRadius: 5, backgroundColor: n < done ? color.leaf : "#e2ecea" }} />)}
    </View>
  );
}
