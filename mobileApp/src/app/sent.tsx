import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import Mitraa from "@/components/Mitraa";
import { Button, Card, Screen, Txt } from "@/components/ui";
import { api, type ReportStatus } from "@/lib/api";
import { color } from "@/lib/theme";

export default function Sent() {
  const { id, code } = useLocalSearchParams<{ id: string; code: string }>();
  const router = useRouter();
  const [status, setStatus] = useState<ReportStatus | null>(null);
  const [copied, setCopied] = useState(false);
  const [gaveUp, setGaveUp] = useState(false);

  // the server merges, classifies and routes the report in the background: poll until it is done
  useEffect(() => {
    let stop = false;
    let tries = 0;
    async function poll() {
      while (!stop && tries < 40) {
        tries += 1;
        try {
          const r = await api<ReportStatus>(`/reports/${id}`);
          if (!r.processing) { setStatus(r); return; }
        } catch {
          // keep trying: the network may blink
        }
        await new Promise((res) => setTimeout(res, 2000));
      }
      if (!stop) setGaveUp(true);
    }
    poll();
    return () => { stop = true; };
  }, [id]);

  const done = !!status && !status.processing;
  const others = status?.joined_others ?? 0;

  async function copy() {
    await Clipboard.setStringAsync(String(code));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Screen>
      <View style={{ alignItems: "center", gap: 12, paddingTop: 10 }}>
        <Mitraa pose={done ? "cheer" : "think"} mood={done ? "cheerful" : "thinking"} size={190} />
        <Txt w="heavy" size={34}>{done ? "Your voice is in" : "Sent"}</Txt>
        <Txt c={color.muted} size={19} style={{ textAlign: "center" }}>
          {done
            ? others > 0 ? `You joined ${others} others on ${status!.title}.` : `Opened ${status!.code}: ${status!.title}.`
            : gaveUp ? "Your report is saved. It is still being sorted." : "Finding who can fix this"}
        </Txt>
      </View>

      <Card dark style={{ padding: 20, borderRadius: 26, gap: 10 }}>
        <Txt w="mono" size={14} c={color.aqua} style={{ letterSpacing: 2 }}>YOUR RECEIPT</Txt>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <Txt w="mono" size={22} c="#fff">{code}</Txt>
          <Button small ghost label={copied ? "Copied" : "Copy"} onPress={copy} style={{ paddingHorizontal: 18, height: 44 }} />
        </View>
        <Txt c="#cfe6e6" size={16}>Use this code to find your report. It does not reveal who you are.</Txt>
      </Card>

      {done && status!.issue_id && <Button label="Track this issue" onPress={() => router.replace(`/issue/${status!.issue_id}`)} />}
      <Button ghost label="Back to home" onPress={() => router.replace("/")} />
    </Screen>
  );
}
