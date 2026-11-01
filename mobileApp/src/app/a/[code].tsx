import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Image, View } from "react-native";
import Mitraa from "@/components/Mitraa";
import { Badge, Button, Card, ErrorBox, Loading, Notice, Screen, TopBar, Txt } from "@/components/ui";
import { ApiError, api, currentServer, type Asset } from "@/lib/api";
import { catOf, color } from "@/lib/theme";

/** Opened by scanning a sticker (rezolv://a/RZV-A-014) or from the equipment list. */
export default function AssetLanding() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [error, setError] = useState<{ text: string; waiting?: boolean } | null>(null);

  useEffect(() => {
    api<Asset>(`/assets/by-code/${code}`)
      .then(setAsset)
      .catch((e: Error) => setError({ text: e.message, waiting: e instanceof ApiError && e.status === 409 }));
  }, [code]);

  if (!asset) {
    return (
      <Screen>
        <TopBar title={String(code)} />
        {error ? (
          <View style={{ gap: 14, alignItems: "center", paddingTop: 20 }}>
            <Mitraa pose="idle" mood="concerned" size={150} />
            <Txt w="heavy" size={22} style={{ textAlign: "center" }}>{error.waiting ? "Not approved yet" : "Sticker not recognised"}</Txt>
            <Txt c={color.muted} size={17} style={{ textAlign: "center" }}>{error.text}</Txt>
            <Button label="Report it without the sticker" ghost onPress={() => router.replace("/report")} style={{ alignSelf: "stretch" }} />
          </View>
        ) : <Loading />}
      </Screen>
    );
  }

  const k = catOf(asset.category);
  const pending = asset.status === "proposed";

  return (
    <Screen>
      <TopBar title={asset.code} sub={asset.type_label} right={pending ? <Badge t="amber" label="Waiting" /> : undefined} />
      {asset.photo_url && (
        <Image source={{ uri: `${currentServer()}${asset.photo_url}` }} style={{ width: "100%", height: 240, borderRadius: 22, backgroundColor: color.grey }} resizeMode="cover" />
      )}
      <View style={{ gap: 4 }}>
        <Txt w="heavy" size={28} style={{ lineHeight: 32 }}>{asset.name}</Txt>
        <Txt c={color.muted} size={17}>{asset.location ?? "On campus"}{asset.floor ? ` · ${asset.floor}` : ""}</Txt>
      </View>

      {pending ? (
        <Notice text="Staff have not approved this yet. It can be reported once it is approved." />
      ) : (
        <>
          <Card style={{ padding: 16, gap: 6, borderLeftWidth: 6, borderLeftColor: k.fg }}>
            <Txt w="heavy" size={19}>Is this the one in front of you?</Txt>
            <Txt c={color.muted} size={16}>
              {asset.open_issues ? `${asset.open_issues} open ${asset.open_issues === 1 ? "problem" : "problems"} already on this item.` : asset.issues ? "No open problems. It has been fixed before." : "No problems reported on this item yet."}
            </Txt>
          </Card>
          <Button label="Yes, report a problem" onPress={() => router.replace(`/report?asset=${asset.code}`)} />
          <Button label="No, this is a different one" ghost onPress={() => router.replace("/report")} />
        </>
      )}
    </Screen>
  );
}
