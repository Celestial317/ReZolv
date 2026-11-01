import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { useRef } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, TopBar, Txt } from "@/components/ui";
import { assetCodeFrom } from "@/lib/issue";
import { color } from "@/lib/theme";

export default function Scan() {
  const router = useRouter();
  const [permission, ask] = useCameraPermissions();
  const done = useRef(false);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg, padding: 18, gap: 14 }}>
      <TopBar title="Scan a sticker" />
      {!permission ? null : !permission.granted ? (
        <View style={{ gap: 14, paddingTop: 20 }}>
          <Txt size={18}>Allow the camera to scan the QR sticker on the equipment.</Txt>
          <Button label="Allow camera" onPress={ask} />
        </View>
      ) : (
        <View style={{ flex: 1, borderRadius: 24, overflow: "hidden", backgroundColor: "#000" }}>
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={({ data }) => {
              const code = assetCodeFrom(data);
              if (!code || done.current) return;
              done.current = true;
              router.replace(`/a/${code}`);
            }}
          />
          <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: 20, alignItems: "center" }}>
            <View style={{ backgroundColor: "rgba(20,35,42,0.8)", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14 }}>
              <Txt w="bold" size={16} c="#fff">Point at the ReZolv QR sticker</Txt>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
