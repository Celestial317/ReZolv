import { JetBrainsMono_700Bold } from "@expo-google-fonts/jetbrains-mono";
import { Urbanist_400Regular, Urbanist_600SemiBold, Urbanist_700Bold, Urbanist_800ExtraBold, useFonts } from "@expo-google-fonts/urbanist";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "@/lib/auth";
import { color } from "@/lib/theme";

SplashScreen.preventAutoHideAsync();

function Gate() {
  const { ready, user } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const onLogin = segments[0] === "login";

  useEffect(() => {
    if (!ready) return;
    if (!user && !onLogin) router.replace("/login");
    else if (user && onLogin) router.replace("/");
  }, [ready, user, onLogin, router]);

  return <Stack screenOptions={{ headerShown: false, animation: "fade", contentStyle: { backgroundColor: color.bg } }} />;
}

export default function RootLayout() {
  const [fontsReady] = useFonts({ Urbanist_400Regular, Urbanist_600SemiBold, Urbanist_700Bold, Urbanist_800ExtraBold, JetBrainsMono_700Bold });

  useEffect(() => {
    if (fontsReady) SplashScreen.hideAsync();
  }, [fontsReady]);

  if (!fontsReady) return null;
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <Gate />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
