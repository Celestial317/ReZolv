import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { ArrowUpIcon, ChevronIcon, categoryIcon } from "@/components/Icons";
import Mitraa from "@/components/Mitraa";
import { Badge, Button, Card, ErrorBox, Loading, Screen, Txt } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { type Awaiting, type Issue, type MyReport, type Profile } from "@/lib/api";
import { LEVEL_NAME } from "@/lib/format";
import { promiseLine } from "@/lib/issue";
import { catOf, color, tone } from "@/lib/theme";
import { useApi } from "@/lib/useApi";

const toneFg = (t: "red" | "amber" | "green" | "blue" | "grey") => tone[t].fg;

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();
  const me = useApi<Profile>("/me");
  const awaiting = useApi<Awaiting[]>("/issues/awaiting");
  const mine = useApi<MyReport[]>("/reports/mine");
  const near = useApi<Issue[]>("/issues/nearby");

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const escalated = (mine.data ?? []).find((r) => r.kind === "report" && (r.escalation_level ?? 0) > 0 && r.status === "in_progress");
  const failed = [me.error, awaiting.error, mine.error, near.error].find(Boolean);
  const nearby = (near.data ?? []).filter((i) => !i.mine).slice(0, 3);
  const short = (user?.pseudonym ?? "").replace("Student #", "");

  return (
    <Screen nav>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: color.ink, alignItems: "center", justifyContent: "center" }}>
          <Txt w="mono" size={19} c={color.aqua}>{short}</Txt>
        </View>
        <View>
          <Txt c={color.muted} size={17}>{greeting}</Txt>
          <Txt w="heavy" size={24}>{user?.pseudonym}</Txt>
        </View>
      </View>

      <Card dark style={{ padding: 22, borderRadius: 30, gap: 16 }}>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Txt w="heavy" size={30} c="#fff">Something wrong on campus?</Txt>
          </View>
          <View style={{ width: 112, height: 112, borderRadius: 24, backgroundColor: "#dbe4ff", overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
            <Mitraa crop="bust" mood="happy" pose="idle" fx={false} size={112} />
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {([["Voice", "speak"], ["Photo", "photo"], ["Type", "type"]] as const).map(([label, mode]) => (
            <Pressable key={mode} onPress={() => router.push(`/report?mode=${mode}`)} style={{ flex: 1, height: 52, borderRadius: 16, backgroundColor: color.ink2, alignItems: "center", justifyContent: "center" }}>
              <Txt w="heavy" size={18} c={color.aqua}>{label}</Txt>
            </Pressable>
          ))}
        </View>
      </Card>

      {failed && <ErrorBox message={failed} retry={() => { me.reload(); awaiting.reload(); mine.reload(); near.reload(); }} />}
      {!failed && me.loading && !me.data && <Loading />}

      {escalated && (
        <Pressable onPress={() => router.push(`/issue/${escalated.issue_id}`)} style={{ flexDirection: "row", gap: 14, alignItems: "center", padding: 16, borderRadius: 22, backgroundColor: color.redBg, borderWidth: 1, borderColor: "#f2c4c4" }}>
          <View style={{ width: 54, height: 54, borderRadius: 16, backgroundColor: color.red, alignItems: "center", justifyContent: "center" }}>
            <ArrowUpIcon color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Txt w="heavy" size={19}>{escalated.title} was escalated</Txt>
            <Txt c={color.redInk} size={16}>Now with {LEVEL_NAME[escalated.escalation_level ?? 1]}.</Txt>
          </View>
          <ChevronIcon color={color.redInk} />
        </Pressable>
      )}

      {me.data && (
        <Card style={{ flexDirection: "row", paddingVertical: 14 }}>
          {([["Open", me.data.open, "#c2410c"], ["Fixed", me.data.fixed, "#15803d"], ["Me too", me.data.me_too, "#7c3aed"]] as const).map(([label, n, c], k) => (
            <View key={label} style={{ flex: 1, paddingHorizontal: 18, borderLeftWidth: k ? 1 : 0, borderLeftColor: color.line }}>
              <Txt c={color.muted} size={17}>{label}</Txt>
              <Txt w="heavy" size={30} c={c}>{n}</Txt>
            </View>
          ))}
        </Card>
      )}

      {(awaiting.data ?? []).length > 0 && (
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Txt w="heavy" size={22}>Needs your OK</Txt>
            <Badge t="amber" label={`${awaiting.data!.length} waiting`} />
          </View>
          {awaiting.data!.map((a) => {
            const Icon = categoryIcon[a.category] ?? categoryIcon.other;
            const k = catOf(a.category);
            return (
              <Card key={a.id} style={{ padding: 16, gap: 14 }}>
                <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
                  <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: k.bg, alignItems: "center", justifyContent: "center" }}>
                    <Icon color={k.fg} size={28} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt w="heavy" size={20}>{a.title}</Txt>
                    <Txt c={color.muted} size={16}>{a.department ?? "Staff"} marked it fixed</Txt>
                  </View>
                </View>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Button small ghost label="Still broken" style={{ flex: 1 }} onPress={() => router.push(`/confirm/${a.id}?a=no`)} />
                  <Button small label="Yes, it works" style={{ flex: 1 }} onPress={() => router.push(`/confirm/${a.id}?a=yes`)} />
                </View>
              </Card>
            );
          })}
        </View>
      )}

      {nearby.length > 0 && (
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Txt w="heavy" size={22}>Near you</Txt>
            <Pressable onPress={() => router.replace("/campus")}><Txt w="heavy" size={16} c={color.green}>See map</Txt></Pressable>
          </View>
          {nearby.map((i) => {
            const line = promiseLine(i);
            const k = catOf(i.category);
            return (
              <Card key={i.id} onPress={() => router.push(`/issue/${i.id}`)} style={{ flexDirection: "row", gap: 14, alignItems: "center", padding: 14, borderLeftWidth: 6, borderLeftColor: k.fg }}>
                <View style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: k.bg, alignItems: "center", justifyContent: "center" }}>
                  <Txt w="heavy" size={24} c={k.fg}>{i.report_count}</Txt>
                  <Txt w="bold" size={13} c={k.fg}>reports</Txt>
                </View>
                <View style={{ flex: 1 }}>
                  <Txt w="heavy" size={19}>{i.title}</Txt>
                  <Txt c={color.muted} size={15}>{i.location} · {i.department ?? "Unrouted"}</Txt>
                  <Txt w="heavy" size={15} c={toneFg(line.tone)}>{line.text}</Txt>
                </View>
                <ChevronIcon color={color.muted} />
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
