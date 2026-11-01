import { useState } from "react";
import { View } from "react-native";
import { Button, Card, ErrorBox, Field, Loading, Notice, Screen, Txt } from "@/components/ui";
import { type Profile as ProfileData, type ScoreRow } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { color } from "@/lib/theme";
import { useApi } from "@/lib/useApi";

export default function Profile() {
  const { user, server, signOut, changeServer } = useAuth();
  const me = useApi<ProfileData>("/me");
  const score = useApi<ScoreRow[]>("/scorecard");
  const [address, setAddress] = useState(server);
  const [saved, setSaved] = useState(false);
  const short = (user?.pseudonym ?? "").replace("Student #", "");

  return (
    <Screen nav>
      <Txt w="heavy" size={34}>Profile</Txt>

      <Card dark style={{ padding: 20, borderRadius: 30, gap: 16 }}>
        <View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}>
          <View style={{ width: 78, height: 78, borderRadius: 24, backgroundColor: color.aqua, alignItems: "center", justifyContent: "center" }}>
            <Txt w="mono" size={22}>{short}</Txt>
          </View>
          <View style={{ flex: 1 }}>
            <Txt w="mono" size={22} c="#fff">{user?.pseudonym}</Txt>
            <Txt c="#cfe6e6" size={15}>{user?.email}</Txt>
          </View>
        </View>
        {me.data && (
          <View style={{ flexDirection: "row", gap: 10 }}>
            {([["reports", me.data.reports, "#7fb4ff"], ["fixed", me.data.fixed, "#6ee7a1"], ["me too", me.data.me_too, "#ffb37a"]] as const).map(([label, n, c]) => (
              <View key={label} style={{ flex: 1, backgroundColor: color.ink2, borderRadius: 16, padding: 12 }}>
                <Txt w="heavy" size={28} c={c}>{n}</Txt>
                <Txt c="#cfe6e6" size={16}>{label}</Txt>
              </View>
            ))}
          </View>
        )}
      </Card>
      {me.error && <ErrorBox message={me.error} retry={me.reload} />}
      {me.loading && !me.data && <Loading />}

      <Card style={{ padding: 20, gap: 12 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
          <Txt w="heavy" size={22}>Campus scorecard</Txt>
          <Txt c={color.muted} size={16}>promises kept</Txt>
        </View>
        {(score.data ?? []).map((d) => (
          <View key={d.name} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Txt size={17} style={{ width: 120 }} numberOfLines={1}>{d.name}</Txt>
            <View style={{ flex: 1, height: 12, borderRadius: 6, backgroundColor: "#e8f0ef", overflow: "hidden" }}>
              <View style={{ width: `${d.kept_pct}%`, height: "100%", backgroundColor: d.kept_pct >= 80 ? color.leaf : d.kept_pct >= 60 ? color.teal : color.red, borderRadius: 6 }} />
            </View>
            <Txt w="heavy" size={17} style={{ width: 48, textAlign: "right" }}>{d.kept_pct}%</Txt>
          </View>
        ))}
        {score.error && <ErrorBox message={score.error} retry={score.reload} />}
      </Card>

      <Card style={{ padding: 20, gap: 12 }}>
        <Field label="Server address" value={address} onChangeText={(t) => { setAddress(t); setSaved(false); }} keyboardType="url" autoCorrect={false} />
        {saved && <Notice text="Saved" />}
        <Button small ghost label="Save address" disabled={address.trim() === server} onPress={async () => { await changeServer(address); setSaved(true); me.reload(); score.reload(); }} />
      </Card>

      <Button ghost label="Log out" onPress={signOut} />
    </Screen>
  );
}
