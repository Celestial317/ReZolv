import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Image, View } from "react-native";
import { ChevronIcon, PinIcon } from "@/components/Icons";
import { Badge, Button, Card, Empty, ErrorBox, Loading, Screen, Segmented, TopBar, Txt } from "@/components/ui";
import { currentServer, type Asset } from "@/lib/api";
import { catOf, color } from "@/lib/theme";
import { useApi } from "@/lib/useApi";

export default function Equipment() {
  const router = useRouter();
  const data = useApi<Asset[]>("/assets");
  const [tab, setTab] = useState<"all" | "mine">("all");

  const rows = useMemo(() => (data.data ?? []).filter((a) => (tab === "mine" ? a.mine : a.status === "approved")), [data.data, tab]);
  const waiting = (data.data ?? []).filter((a) => a.mine && a.status === "proposed").length;

  return (
    <Screen>
      <TopBar title="Equipment" />
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Button label="Scan a sticker" style={{ flex: 1 }} small onPress={() => router.push("/assets/scan")} />
        <Button label="Add equipment" ghost style={{ flex: 1 }} small onPress={() => router.push("/assets/new")} />
      </View>
      <Segmented value={tab} onChange={setTab} options={[{ key: "all", label: "Registered" }, { key: "mine", label: `Mine${waiting ? ` · ${waiting} waiting` : ""}` }]} />

      {data.error && <ErrorBox message={data.error} retry={data.reload} />}
      {data.loading && !data.data && <Loading />}
      {data.data && rows.length === 0 && <Empty text={tab === "mine" ? "You have not added any equipment" : "No equipment registered yet"} />}

      {rows.map((a) => {
        const k = catOf(a.category);
        return (
          <Card key={a.id} onPress={() => router.push(`/a/${a.code}`)} style={{ flexDirection: "row", gap: 14, alignItems: "center", padding: 12, borderLeftWidth: 6, borderLeftColor: k.fg }}>
            {a.photo_url ? (
              <Image source={{ uri: `${currentServer()}${a.photo_url}` }} style={{ width: 66, height: 66, borderRadius: 14, backgroundColor: color.grey }} />
            ) : <View style={{ width: 66, height: 66, borderRadius: 14, backgroundColor: k.bg }} />}
            <View style={{ flex: 1, gap: 2 }}>
              <Txt w="heavy" size={18}>{a.name}</Txt>
              <Txt c={color.muted} size={14}>{a.type_label} · {a.location ?? "On campus"}{a.floor ? ` · ${a.floor}` : ""}</Txt>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Txt w="mono" size={12} c={k.fg}>{a.code}</Txt>
                {a.status === "proposed" && <Badge t="amber" label="Waiting for approval" />}
              </View>
            </View>
            <ChevronIcon color={color.muted} />
          </Card>
        );
      })}
    </Screen>
  );
}
