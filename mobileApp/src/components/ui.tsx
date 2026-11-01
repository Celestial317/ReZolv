import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BackIcon } from "./Icons";
import BottomNav from "./BottomNav";
import { Txt } from "./Txt";
import { color, font, tone, type Tone } from "@/lib/theme";

export { Txt };

export function Card({ children, style, dark, onPress }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; dark?: boolean; onPress?: () => void }) {
  const base: ViewStyle = { backgroundColor: dark ? color.ink : color.card, borderRadius: 22, borderWidth: 1, borderColor: dark ? color.ink : color.line };
  return onPress ? <Pressable onPress={onPress} style={[base, style]}>{children}</Pressable> : <View style={[base, style]}>{children}</View>;
}

export function Button({ label, onPress, ghost, disabled, loading, icon, small, style }: {
  label: string; onPress: () => void; ghost?: boolean; disabled?: boolean; loading?: boolean; icon?: React.ReactNode; small?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        s.btn,
        small && { height: 46, borderRadius: 14 },
        { backgroundColor: off ? "#c7dbd9" : ghost ? color.card : color.green, borderColor: ghost ? color.line : "transparent", opacity: pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={ghost ? color.ink : "#fff"} /> : (
        <>
          {icon}
          <Txt w="heavy" size={small ? 16 : 18} c={ghost ? color.ink : "#fff"}>{label}</Txt>
        </>
      )}
    </Pressable>
  );
}

export function Chip({ label, on, onPress, style, tint }: { label: string; on?: boolean; onPress: () => void; style?: StyleProp<ViewStyle>; tint?: { fg: string; bg: string } }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, tint && !on && { backgroundColor: tint.bg, borderColor: tint.bg }, on && { backgroundColor: tint?.fg ?? color.ink, borderColor: tint?.fg ?? color.ink }, style]}>
      <Txt w="bold" size={15} c={on ? "#fff" : tint?.fg ?? color.ink}>{label}</Txt>
    </Pressable>
  );
}

export function Badge({ label, t = "grey" }: { label: string; t?: Tone }) {
  return (
    <View style={{ backgroundColor: tone[t].bg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 }}>
      <Txt w="heavy" size={14} c={tone[t].fg}>{label}</Txt>
    </View>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { key: T; label: string }[]; value: T; onChange: (k: T) => void }) {
  return (
    <View style={s.seg}>
      {options.map((o) => (
        <Pressable key={o.key} onPress={() => onChange(o.key)} style={[s.segItem, value === o.key && { backgroundColor: color.ink }]}>
          <Txt w="heavy" size={16} c={value === o.key ? "#fff" : color.ink}>{o.label}</Txt>
        </Pressable>
      ))}
    </View>
  );
}

export function Field({ label, ...props }: React.ComponentProps<typeof TextInput> & { label: string }) {
  return (
    <View style={{ gap: 8 }}>
      <Txt w="heavy" size={16}>{label}</Txt>
      <TextInput placeholderTextColor="#8aa09e" autoCapitalize="none" {...props} style={[s.input, props.style as TextStyle]} />
    </View>
  );
}

export function IconButton({ children, onPress, label }: { children: React.ReactNode; onPress: () => void; label: string }) {
  return <Pressable accessibilityLabel={label} onPress={onPress} style={s.iconBtn}>{children}</Pressable>;
}

export function Notice({ text, error }: { text: string; error?: boolean }) {
  return (
    <View style={{ backgroundColor: error ? color.redBg : color.mint, borderRadius: 14, padding: 14 }}>
      <Txt w="bold" size={15} c={error ? color.redInk : color.green}>{text}</Txt>
    </View>
  );
}

/** Safe-area page with an optional bottom navigation. */
export function Screen({ children, nav, scroll = true, pad = true }: { children: React.ReactNode; nav?: boolean; scroll?: boolean; pad?: boolean }) {
  const body = scroll ? (
    <ScrollView contentContainerStyle={{ padding: pad ? 18 : 0, paddingBottom: nav ? 130 : 40, gap: 14 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  ) : <View style={{ flex: 1, padding: pad ? 18 : 0 }}>{children}</View>;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }} edges={["top", "left", "right"]}>
      {body}
      {nav && <BottomNav />}
    </SafeAreaView>
  );
}

export function TopBar({ title, right, sub }: { title: string; right?: React.ReactNode; sub?: string }) {
  const router = useRouter();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
      <IconButton label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}><BackIcon /></IconButton>
      <View style={{ flex: 1 }}>
        <Txt w="heavy" size={sub ? 22 : 24}>{title}</Txt>
        {sub ? <Txt c={color.muted} size={14}>{sub}</Txt> : null}
      </View>
      {right}
    </View>
  );
}

export function Loading() {
  return <View style={{ padding: 40 }}><ActivityIndicator color={color.green} /></View>;
}

export function ErrorBox({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <View style={{ gap: 12 }}>
      <Notice text={message} error />
      {retry && <Button small ghost label="Try again" onPress={retry} />}
    </View>
  );
}

export function Empty({ text }: { text: string }) {
  return <View style={{ padding: 28, alignItems: "center" }}><Txt c={color.muted}>{text}</Txt></View>;
}

const s = StyleSheet.create({
  btn: { height: 56, borderRadius: 18, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10, borderWidth: 1 },
  chip: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: color.line, backgroundColor: color.card },
  seg: { flexDirection: "row", padding: 4, gap: 4, backgroundColor: color.card, borderWidth: 1, borderColor: color.line, borderRadius: 18 },
  segItem: { flex: 1, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  input: { height: 56, borderWidth: 1, borderColor: color.line, borderRadius: 16, backgroundColor: "#fff", paddingHorizontal: 16, fontFamily: font.regular, fontSize: 17, color: color.ink },
  iconBtn: { width: 52, height: 52, borderRadius: 16, backgroundColor: color.card, borderWidth: 1, borderColor: color.line, alignItems: "center", justifyContent: "center" },
});
