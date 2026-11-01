import { Text, type TextProps } from "react-native";
import { color, font } from "@/lib/theme";

type Weight = "regular" | "medium" | "bold" | "heavy" | "mono";

export function Txt({ w = "regular", size = 16, c = color.ink, style, ...rest }: TextProps & { w?: Weight; size?: number; c?: string }) {
  return <Text {...rest} style={[{ fontFamily: font[w], fontSize: size, color: c, lineHeight: Math.round(size * 1.3) }, style]} />;
}
