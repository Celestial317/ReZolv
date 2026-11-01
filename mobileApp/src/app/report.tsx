import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Image, Pressable, ScrollView, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import CampusMap from "@/components/CampusMap";
import { BackIcon, CameraIcon, CloseIcon, MicIcon, PinIcon, SendIcon } from "@/components/Icons";
import Mitraa from "@/components/Mitraa";
import { Button, Card, Chip, ErrorBox, IconButton, Notice, Segmented, Txt } from "@/components/ui";
import { api, uploadMedia, type Issue, type Place } from "@/lib/api";
import { CAMPUS_CENTER } from "@/lib/campus";
import { clock } from "@/lib/format";
import { color, font } from "@/lib/theme";

const FLOORS = ["Ground", "1st", "2nd", "3rd"];
const BARS = 23;

function metres(aLat: number, aLng: number, bLat: number, bLng: number) {
  const dy = (bLat - aLat) * 111320;
  const dx = (bLng - aLng) * 111320 * Math.cos((aLat * Math.PI) / 180);
  return Math.sqrt(dx * dx + dy * dy);
}

function Waveform({ live }: { live: boolean }) {
  const bars = useRef(Array.from({ length: BARS }, () => new Animated.Value(0.25))).current;
  useEffect(() => {
    if (!live) { bars.forEach((b) => b.setValue(0.25)); return; }
    const loops = bars.map((b, n) => Animated.loop(Animated.sequence([
      Animated.timing(b, { toValue: 1, duration: 420 + (n % 5) * 90, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(b, { toValue: 0.25, duration: 420 + (n % 5) * 90, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ])));
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [live, bars]);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 72 }}>
      {bars.map((b, n) => <Animated.View key={n} style={{ width: 8, height: 64, borderRadius: 4, backgroundColor: color.aqua, transform: [{ scaleY: b }] }} />)}
    </View>
  );
}

export default function Report() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<"speak" | "type">(params.mode === "type" ? "type" : "speak");
  const [text, setText] = useState("");
  const [voice, setVoice] = useState<{ uri: string; secs: number } | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [floor, setFloor] = useState("Ground");
  const [center, setCenter] = useState<[number, number]>(CAMPUS_CENTER);
  const [places, setPlaces] = useState<Place[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const rec = useAudioRecorderState(recorder);

  useEffect(() => {
    api<Place[]>("/locations").then(setPlaces).catch(() => {});
    api<Issue[]>("/issues/nearby").then(setIssues).catch(() => {});
  }, []);

  useEffect(() => {
    if (params.mode === "photo") pickPhoto(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // the named place under the pin (within 35 m), otherwise open ground
  const place = useMemo(() => {
    let best: Place | null = null, d = 35;
    for (const p of places) {
      const m = metres(center[0], center[1], p.lat, p.lng);
      if (m < d) { d = m; best = p; }
    }
    return best;
  }, [center, places]);
  const here = place ? issues.find((i) => i.location === place.name && i.category !== "sensitive") : undefined;

  async function toggleRecording() {
    setError(null);
    try {
      if (rec.isRecording) {
        const secs = Math.max(1, Math.round(rec.durationMillis / 1000));
        await recorder.stop();
        if (recorder.uri) setVoice({ uri: recorder.uri, secs });
        return;
      }
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) { setError("Allow the microphone to record a voice note, or type the report instead."); return; }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      setVoice(null);
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function pickPhoto(camera: boolean) {
    setError(null);
    try {
      if (camera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { setError("Allow the camera to take a photo."); return; }
      }
      const r = camera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.6 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.6 });
      if (!r.canceled) setPhoto(r.assets[0].uri);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const hasInput = mode === "speak" ? !!voice : text.trim().length >= 4;

  async function send() {
    setBusy(true);
    setError(null);
    try {
      let reportId: string | undefined;
      let voiceKey: string | undefined;
      let photoKey: string | undefined;
      if (mode === "speak" && voice) {
        const up = await uploadMedia("voice", voice.uri, "audio/mp4");
        reportId = up.report_id;
        voiceKey = up.key;
      }
      if (photo) {
        const up = await uploadMedia("photo", photo, "image/jpeg", reportId);
        reportId = up.report_id;
        photoKey = up.key;
      }
      const body = {
        report_id: reportId,
        text: mode === "type" ? text.trim() : undefined,
        voice_key: voiceKey,
        photo_key: photoKey,
        floor: floor === "Ground" ? "Ground" : floor,
        ...(place ? { location_id: place.id } : { lat: center[0], lng: center[1] }),
      };
      const r = await api<{ report_id: string; receipt_code: string }>("/reports", { method: "POST", body });
      router.replace(`/sent?id=${r.report_id}&code=${r.receipt_code}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const back = () => (step === 1 ? router.back() : setStep(step - 1));
  const titles = ["What happened?", "Where is it?", "Check and send"];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }} edges={["top", "left", "right", "bottom"]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 18, paddingTop: 10 }}>
        <IconButton label={step === 1 ? "Close" : "Back"} onPress={back}>{step === 1 ? <CloseIcon /> : <BackIcon />}</IconButton>
        <Txt w="heavy" size={24} style={{ flex: 1 }}>{titles[step - 1]}</Txt>
        <Txt c={color.muted} size={18}>{step} / 3</Txt>
      </View>
      <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 18, paddingVertical: 14 }}>
        {[1, 2, 3].map((n) => <View key={n} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: n <= step ? color.green : "#d3e4e2" }} />)}
      </View>

      {step === 1 && (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          <View style={{ paddingHorizontal: 18, gap: 14 }}>
            <Segmented value={mode} onChange={setMode} options={[{ key: "speak", label: "Speak" }, { key: "type", label: "Type" }]} />
            {mode === "speak" ? (
              <View style={{ backgroundColor: color.ink, borderRadius: 28, padding: 22, alignItems: "center", gap: 6 }}>
                <View style={{ width: 68, height: 68, borderRadius: 20, backgroundColor: color.ink2, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
                  <Mitraa crop="face" mood={rec.isRecording ? "listening" : voice ? "cheerful" : "happy"} fx={false} size={68} />
                </View>
                <Waveform live={rec.isRecording} />
                <Txt w="mono" size={38} c="#fff">{clock(rec.isRecording ? Math.round(rec.durationMillis / 1000) : voice?.secs ?? 0)}</Txt>
                <Pressable onPress={toggleRecording} accessibilityLabel={rec.isRecording ? "Stop recording" : "Start recording"} style={{ width: 88, height: 88, borderRadius: 28, backgroundColor: "#2c3f46", alignItems: "center", justifyContent: "center", marginTop: 6 }}>
                  <View style={{ width: 74, height: 74, borderRadius: 22, backgroundColor: rec.isRecording ? "#ff8c8c" : color.aqua, alignItems: "center", justifyContent: "center" }}>
                    {rec.isRecording ? <View style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: color.ink }} /> : <MicIcon size={36} />}
                  </View>
                </Pressable>
                <Txt c="#cfe6e6" size={17}>{rec.isRecording ? "Listening. Tap to stop." : voice ? "Recorded. Tap to record again." : "Tap to record, in any language"}</Txt>
              </View>
            ) : (
              <TextInput
                multiline value={text} onChangeText={setText} placeholder="What is wrong?" placeholderTextColor="#8aa09e" textAlignVertical="top"
                style={{ minHeight: 170, borderWidth: 1, borderColor: color.line, borderRadius: 20, backgroundColor: "#fff", padding: 16, fontFamily: font.regular, fontSize: 18, color: color.ink }}
              />
            )}

            <View style={{ gap: 10 }}>
              <Txt w="heavy" size={19}>Photo <Txt c={color.muted} size={17}>(optional)</Txt></Txt>
              {photo ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <Image source={{ uri: photo }} style={{ width: 84, height: 84, borderRadius: 16 }} />
                  <Button small ghost label="Remove" onPress={() => setPhoto(null)} style={{ paddingHorizontal: 20 }} />
                </View>
              ) : (
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Button small ghost label="Camera" icon={<CameraIcon size={20} />} onPress={() => pickPhoto(true)} style={{ flex: 1 }} />
                  <Button small ghost label="Gallery" onPress={() => pickPhoto(false)} style={{ flex: 1 }} />
                </View>
              )}
            </View>
            {error && <ErrorBox message={error} />}
          </View>
        </ScrollView>
      )}

      {step === 2 && (
        <View style={{ flex: 1 }}>
          <View style={{ flex: 1 }}>
            <CampusMap mode="pin" zoom={19} onCenter={(lat, lng) => setCenter([lat, lng])} style={{ flex: 1 }} />
            <View style={{ position: "absolute", top: 12, left: 12, right: 12, backgroundColor: "#fff", borderRadius: 18, borderWidth: 1, borderColor: color.line, padding: 12, flexDirection: "row", gap: 12, alignItems: "center" }}>
              <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: color.mint, alignItems: "center", justifyContent: "center" }}><PinIcon color={color.green} /></View>
              <View style={{ flex: 1 }}>
                <Txt w="mono" size={12} c={color.muted} style={{ letterSpacing: 1.5 }}>PIN IS ON</Txt>
                <Txt w="heavy" size={21}>{place ? `${place.name} · ${floor}` : "Open ground"}</Txt>
              </View>
            </View>
          </View>
          <View style={{ padding: 18, gap: 12 }}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {FLOORS.map((f) => <Chip key={f} label={f} on={floor === f} onPress={() => setFloor(f)} style={{ flex: 1, alignItems: "center" }} />)}
            </View>
            {here && <Notice text={`${here.report_count} students already reported "${here.title}" here. Yours joins it.`} />}
          </View>
        </View>
      )}

      {step === 3 && (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          <View style={{ paddingHorizontal: 18, gap: 14 }}>
            <Card>
              {[
                [mode === "speak" ? "Voice note" : "Typed report", mode === "speak" ? clock(voice?.secs ?? 0) : `${text.trim().length} characters`],
                ["Place", `${place ? place.name : "Open ground"} · ${floor}`],
                ["Photo", photo ? "Attached" : "None"],
              ].map(([k, v], n) => (
                <View key={k} style={{ flexDirection: "row", justifyContent: "space-between", padding: 16, borderTopWidth: n ? 1 : 0, borderTopColor: color.line }}>
                  <Txt c={color.muted} size={18}>{k}</Txt>
                  <Txt w="heavy" size={18}>{v}</Txt>
                </View>
              ))}
            </Card>
            {mode === "type" && <Card style={{ padding: 16 }}><Txt size={17}>{text.trim()}</Txt></Card>}
            <Txt c={color.muted} size={16}>Staff see the issue and your pseudonym, never your name.</Txt>
            {error && <ErrorBox message={error} />}
          </View>
        </ScrollView>
      )}

      <View style={{ padding: 18, borderTopWidth: 1, borderTopColor: color.line, backgroundColor: color.bg }}>
        {step < 3 ? (
          <Button label={step === 1 ? "Next · pin the place" : "Confirm place"} disabled={step === 1 && !hasInput || rec.isRecording} onPress={() => setStep(step + 1)} />
        ) : (
          <Button label="Send report" icon={<SendIcon color="#fff" />} loading={busy} onPress={send} />
        )}
      </View>
    </SafeAreaView>
  );
}
