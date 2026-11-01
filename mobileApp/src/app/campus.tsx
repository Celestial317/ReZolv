import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import BottomNav from "@/components/BottomNav";
import CampusMap, { type MapMarker } from "@/components/CampusMap";
import { Badge, Card, Chip, Empty, ErrorBox, Txt } from "@/components/ui";
import { ApiError, api, type Issue } from "@/lib/api";
import { CATEGORIES, cap, promiseLine } from "@/lib/issue";
import { catOf, color, pinColor, tone } from "@/lib/theme";
import { useApi } from "@/lib/useApi";

export default function Campus() {
  const router = useRouter();
  const data = useApi<Issue[]>("/issues/nearby");
  const [cat, setCat] = useState<string>("all");
  const [added, setAdded] = useState<Record<string, number>>({});
  const [active, setActive] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const list = useMemo(() => (data.data ?? []).filter((i) => cat === "all" || i.category === cat), [data.data, cat]);
  const present = useMemo(() => CATEGORIES.filter((c) => (data.data ?? []).some((i) => i.category === c)), [data.data]);
  const markers: MapMarker[] = useMemo(() => list.filter((i) => i.lat != null && i.lng != null).map((i) => (
    { id: i.id, lat: i.lat!, lng: i.lng!, count: i.report_count + (added[i.id] ?? 0), color: pinColor[i.category] ?? pinColor.other }
  )), [list, added]);

  async function meToo(i: Issue) {
    setProblem(null);
    try {
      const r = await api<{ report_count: number }>(`/issues/${i.id}/metoo`, { method: "POST" });
      setAdded((a) => ({ ...a, [i.id]: r.report_count - i.report_count }));
      data.reload();
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 409)) setProblem((e as Error).message);
      data.reload();
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }} edges={["top", "left", "right"]}>
      <CampusMap markers={markers} activeId={active} onMarker={(id) => { setActive(id); router.push(`/issue/${id}`); }} style={{ height: "42%" }} />
      <View style={{ flex: 1, marginTop: -26, backgroundColor: color.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28 }}>
        <View style={{ alignItems: "center", paddingTop: 10 }}><View style={{ width: 54, height: 6, borderRadius: 3, backgroundColor: "#c9dad8" }} /></View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", paddingHorizontal: 18, paddingTop: 10 }}>
          <Txt w="heavy" size={28}>On campus now</Txt>
          <Txt c={color.muted} size={17}>{list.length} issues</Txt>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 18, paddingVertical: 12 }}>
          <Chip label="All" on={cat === "all"} onPress={() => setCat("all")} />
          {present.map((c) => <Chip key={c} label={cap(c)} on={cat === c} tint={catOf(c)} onPress={() => setCat(c)} />)}
        </ScrollView>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 130, gap: 10 }} showsVerticalScrollIndicator={false}>
          {data.error && <ErrorBox message={data.error} retry={data.reload} />}
          {problem && <ErrorBox message={problem} />}
          {!data.error && list.length === 0 && !data.loading && <Empty text="Nothing open here" />}
          {list.map((i) => {
            const line = promiseLine(i);
            const count = i.report_count + (added[i.id] ?? 0);
            const mineNow = i.mine || added[i.id] !== undefined;
            const k = catOf(i.category);
            return (
              <Card key={i.id} style={{ flexDirection: "row", gap: 12, alignItems: "center", padding: 14, borderLeftWidth: 6, borderLeftColor: k.fg }}>
                <Pressable onPress={() => router.push(`/issue/${i.id}`)} style={{ flexDirection: "row", gap: 12, alignItems: "center", flex: 1 }}>
                  <View style={{ width: 62, height: 62, borderRadius: 16, backgroundColor: k.bg, alignItems: "center", justifyContent: "center" }}>
                    <Txt w="heavy" size={23} c={k.fg}>{count}</Txt>
                    <Txt w="bold" size={12} c={k.fg}>reports</Txt>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt w="heavy" size={18}>{i.title}</Txt>
                    <Txt c={color.muted} size={14}>{i.location} · {i.department ?? "Unrouted"}</Txt>
                    <Txt w="heavy" size={14} c={tone[line.tone].fg}>{line.text}</Txt>
                  </View>
                </Pressable>
                {mineNow ? <Badge t="green" label="Added" /> : (
                  <Pressable onPress={() => meToo(i)} style={{ paddingHorizontal: 16, paddingVertical: 11, borderRadius: 14, borderWidth: 1, borderColor: color.line, backgroundColor: color.card }}>
                    <Txt w="heavy" size={15}>Me too</Txt>
                  </Pressable>
                )}
              </Card>
            );
          })}
        </ScrollView>
      </View>
      <BottomNav />
    </SafeAreaView>
  );
}
