import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Mitraa from "@/components/Mitraa";
import { Button, Card, Field, Notice, Txt } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { color } from "@/lib/theme";

export default function Login() {
  const { signIn, server, changeServer } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [editServer, setEditServer] = useState(false);
  const [address, setAddress] = useState(server);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (address.trim() !== server) await changeServer(address);
      await signIn(email, password);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#e3f2f1" }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 18, gap: 18, flexGrow: 1, justifyContent: "center" }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
            <Mitraa pose="wave" mood="cheerful" size={118} />
            <View style={{ flex: 1, paddingBottom: 54, gap: 8 }}>
              <View style={{ backgroundColor: color.blue, padding: 14, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomRightRadius: 20, borderBottomLeftRadius: 6 }}>
                <Txt w="bold" size={17} c="#fff">Hi! I am Campus Mitraa. Bol do, main hoon na.</Txt>
              </View>
              <Txt w="heavy" size={38}>ReZolv</Txt>
            </View>
          </View>

          <Card style={{ padding: 20, gap: 16 }}>
            <Txt w="heavy" size={30} style={{ textAlign: "center" }}>Log in</Txt>
            <Field label="College email" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" textContentType="username" />
            <View style={{ gap: 8 }}>
              <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry={!show} autoComplete="password" textContentType="password" onSubmitEditing={submit} />
              <Pressable onPress={() => setShow((v) => !v)} style={{ alignSelf: "flex-end" }}>
                <Txt w="heavy" size={15} c={color.green}>{show ? "Hide password" : "Show password"}</Txt>
              </Pressable>
            </View>

            {editServer && (
              <Field label="Server address" value={address} onChangeText={setAddress} keyboardType="url" autoCorrect={false} />
            )}
            {error && <Notice text={error} error />}
            <Button label="Log in" onPress={submit} loading={busy} disabled={!email || !password} />
            <Pressable onPress={() => setEditServer((v) => !v)}>
              <Txt c={color.muted} size={14} style={{ textAlign: "center" }}>
                {editServer ? "Hide server address" : `Server: ${server}`}
              </Txt>
            </Pressable>
          </Card>

          <Txt c={color.muted} size={15} style={{ textAlign: "center" }}>Staff only ever see your pseudonym, never your name.</Txt>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
