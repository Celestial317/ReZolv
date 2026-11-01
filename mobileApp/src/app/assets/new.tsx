import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Image, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import CampusMap from "@/components/CampusMap";
import { CameraIcon, PinIcon } from "@/components/Icons";
import { Button, Chip, ErrorBox, Field, Notice, TopBar, Txt } from "@/components/ui";
import { api, uploadMedia, type Asset, type AssetType } from "@/lib/api";
import { CAMPUS_CENTER } from "@/lib/campus";
import { catOf, color } from "@/lib/theme";

const FLOORS = ["Ground", "1st", "2nd", "3rd"];

export default function AddEquipment() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoKey, setPhotoKey] = useState<string | null>(null);
  const [types, setTypes] = useState<AssetType[]>([]);
  const [type, setType] = useState<string | null>(null);
  const [suggested, setSuggested] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [floor, setFloor] = useState("Ground");
  const [center, setCenter] = useState<[number, number]>(CAMPUS_CENTER);
  const [similar, setSimilar] = useState<Asset[]>([]);
  const [force, setForce] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"photo" | "send" | null>(null);

  useEffect(() => { api<AssetType[]>("/assets/types").then(setTypes).catch((e: Error) => setError(e.message)); }, []);

  async function takePhoto() {
    setError(null);
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) { setError("Allow the camera to photograph the equipment."); return; }
      const r = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.6 });
      if (r.canceled) return;
      const uri = r.assets[0].uri;
      setPhoto(uri);
      setBusy("photo");
      const up = await uploadMedia("asset", uri, "image/jpeg");
      setPhotoKey(up.key);
      const guess = await api<{ type: string | null }>("/assets/suggest-type", { method: "POST", body: { photo_key: up.key } });
      if (guess.type) { setType((t) => t ?? guess.type); setSuggested(guess.type); }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  // look for the same kind of item within a few metres whenever the pin or the floor changes
  useEffect(() => {
    if (step !== 2 || !type) return;
    const t = setTimeout(() => {
      api<{ similar: Asset[] }>("/assets/check", { method: "POST", body: { type, lat: center[0], lng: center[1], floor } })
        .then((r) => { setSimilar(r.similar); setForce(false); })
        .catch(() => {});
    }, 500);
    return () => clearTimeout(t);
  }, [step, type, center, floor]);

  async function submit() {
    if (!type || !photoKey) return;
    setBusy("send");
    setError(null);
    try {
      await api("/assets", { method: "POST", body: { name, type, photo_key: photoKey, lat: center[0], lng: center[1], floor } });
      router.replace("/assets");
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  const ready = !!photoKey && !!type && name.trim().length >= 3;
  const pick = types.find((t) => t.key === type);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }} edges={["top", "left", "right", "bottom"]}>
      <View style={{ padding: 18, paddingBottom: 6 }}><TopBar title={step === 1 ? "Add equipment" : "Where is it?"} sub={`${step} / 2`} /></View>

      {step === 1 ? (
        <ScrollView contentContainerStyle={{ padding: 18, gap: 16 }} keyboardShouldPersistTaps="handled">
          {photo ? (
            <View style={{ gap: 10 }}>
              <Image source={{ uri: photo }} style={{ width: "100%", height: 220, borderRadius: 22 }} />
              <Button small ghost label="Retake photo" icon={<CameraIcon size={20} />} onPress={takePhoto} />
            </View>
          ) : (
            <Button label="Take a photo of it" icon={<CameraIcon color="#fff" />} onPress={takePhoto} />
          )}
          {busy === "photo" && <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}><ActivityIndicator color={color.green} /><Txt c={color.muted}>Looking at the photo</Txt></View>}

          <View style={{ gap: 10 }}>
            <Txt w="heavy" size={19}>What is it?</Txt>
            {suggested && <Txt c={color.muted} size={15}>Suggested from your photo: {types.find((t) => t.key === suggested)?.label}</Txt>}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {types.map((t) => <Chip key={t.key} label={t.label} on={type === t.key} tint={catOf(t.category)} onPress={() => setType(t.key)} />)}
            </View>
          </View>

          <Field label="Name" value={name} onChangeText={setName} placeholder="Cooler near the library entrance" autoCapitalize="sentences" />
          {error && <ErrorBox message={error} />}
          <Button label="Next, pin the place" disabled={!ready || busy !== null} onPress={() => { setError(null); setStep(2); }} />
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>
          <View style={{ flex: 1 }}>
            <CampusMap mode="pin" zoom={20} onCenter={(lat, lng) => setCenter([lat, lng])} style={{ flex: 1 }} />
            <View style={{ position: "absolute", top: 10, left: 12, right: 12, backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: color.line, padding: 12, flexDirection: "row", gap: 10, alignItems: "center" }}>
              <PinIcon color={color.green} />
              <Txt w="heavy" size={17} style={{ flex: 1 }}>Drag the map until the pin is on the {pick?.label.toLowerCase() ?? "item"}</Txt>
            </View>
          </View>
          <View style={{ padding: 18, gap: 12 }}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {FLOORS.map((f) => <Chip key={f} label={f} on={floor === f} onPress={() => setFloor(f)} style={{ flex: 1, alignItems: "center" }} />)}
            </View>
            {similar.length > 0 && !force && (
              <View style={{ gap: 10 }}>
                <Notice text={`${similar[0].name} (${similar[0].code}) is already registered ${similar[0].distance_m ?? 0} m away on this floor. Is it the same one?`} error />
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Button small ghost label="It is the same" style={{ flex: 1 }} onPress={() => router.replace(`/a/${similar[0].code}`)} />
                  <Button small label="No, a different one" style={{ flex: 1 }} onPress={() => setForce(true)} />
                </View>
              </View>
            )}
            {error && <ErrorBox message={error} />}
            {(similar.length === 0 || force) && <Button label="Send for approval" loading={busy === "send"} onPress={submit} />}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
