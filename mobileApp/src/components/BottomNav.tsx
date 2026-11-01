import { usePathname, useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ClipboardIcon, HomeIcon, MicIcon, PinIcon, UserIcon } from "./Icons";
import { Txt } from "./Txt";
import { color } from "@/lib/theme";

const TABS = [
  { path: "/", label: "Home", Icon: HomeIcon },
  { path: "/campus", label: "Campus", Icon: PinIcon },
  null,
  { path: "/reports", label: "My reports", Icon: ClipboardIcon },
  { path: "/profile", label: "Profile", Icon: UserIcon },
] as const;

export default function BottomNav() {
  const router = useRouter();
  const here = usePathname();
  const insets = useSafeAreaInsets();

  return (
    <View style={[s.wrap, { bottom: Math.max(insets.bottom, 12) }]}>
      <View style={s.bar}>
        {TABS.map((t, n) =>
          t ? (
            <Pressable key={t.path} style={s.item} onPress={() => here !== t.path && router.replace(t.path)} accessibilityRole="tab">
              <t.Icon color={here === t.path ? color.green : "#3b5254"} />
              <Txt w={here === t.path ? "heavy" : "medium"} size={13} c={here === t.path ? color.green : "#3b5254"}>{t.label}</Txt>
            </Pressable>
          ) : (
            <View key={`gap${n}`} style={s.item} />
          ),
        )}
      </View>
      <Pressable style={s.mic} onPress={() => router.push("/report")} accessibilityLabel="Report a problem">
        <MicIcon color={color.aqua} size={32} />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { position: "absolute", left: 14, right: 14, alignItems: "center" },
  bar: {
    flexDirection: "row", alignSelf: "stretch", height: 74, backgroundColor: color.card, borderRadius: 30, borderWidth: 1,
    borderColor: color.line, alignItems: "center", elevation: 8, shadowColor: "#14232a", shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
  },
  item: { flex: 1, alignItems: "center", gap: 3 },
  mic: {
    position: "absolute", top: -26, width: 66, height: 66, borderRadius: 22, backgroundColor: color.ink, alignItems: "center", justifyContent: "center",
    borderWidth: 6, borderColor: "#eef6f5",
  },
});
