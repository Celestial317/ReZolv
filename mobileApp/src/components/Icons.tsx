import Svg, { Circle, Path, Rect } from "react-native-svg";

type P = { size?: number; color?: string };

function Base({ size = 26, color = "#14232a", width = 2, children }: P & { width?: number; children: React.ReactNode }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </Svg>
  );
}

export const HomeIcon = (p: P) => <Base {...p}><Path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" /></Base>;
export const PinIcon = (p: P) => <Base {...p}><Path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" /><Circle cx="12" cy="9.5" r="2.5" /></Base>;
export const ClipboardIcon = (p: P) => <Base {...p}><Rect x="5" y="4" width="14" height="17" rx="2" /><Path d="M9 4h6v3H9zM9 12h6M9 16h4" /></Base>;
export const UserIcon = (p: P) => <Base {...p}><Circle cx="12" cy="8" r="4" /><Path d="M4 21a8 8 0 0 1 16 0" /></Base>;
export const MicIcon = (p: P) => <Base {...p}><Rect x="9" y="3" width="6" height="11" rx="3" /><Path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></Base>;
export const ArrowUpIcon = (p: P) => <Base {...p}><Path d="M12 19V5M5 12l7-7 7 7" /></Base>;
export const ChevronIcon = (p: P) => <Base {...p}><Path d="m9 5 7 7-7 7" /></Base>;
export const BackIcon = (p: P) => <Base {...p}><Path d="m15 5-7 7 7 7" /></Base>;
export const CloseIcon = (p: P) => <Base {...p}><Path d="M6 6l12 12M18 6 6 18" /></Base>;
export const CheckIcon = (p: P) => <Base {...p} width={3}><Path d="m5 12.5 4.5 4.5L19 7" /></Base>;
export const MinusIcon = (p: P) => <Base {...p}><Path d="M6 12h12" /></Base>;
export const DropIcon = (p: P) => <Base {...p}><Path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" /></Base>;
export const SendIcon = (p: P) => <Base {...p}><Path d="M21 3 10 14M21 3l-7 18-4-7-7-4z" /></Base>;
export const CameraIcon = (p: P) => <Base {...p}><Path d="M4 8h3l2-3h6l2 3h3v11H4z" /><Circle cx="12" cy="13" r="3.5" /></Base>;
export const NavIcon = (p: P) => <Base {...p}><Path d="m12 3 7 17-7-4-7 4z" /></Base>;
export const BoltIcon = (p: P) => <Base {...p}><Path d="M13 3 5 13h6l-1 8 8-10h-6z" /></Base>;
export const WifiIcon = (p: P) => <Base {...p}><Path d="M3 9a14 14 0 0 1 18 0M6 12.5a9 9 0 0 1 12 0M9 16a4 4 0 0 1 6 0" /><Circle cx="12" cy="19" r="0.8" /></Base>;
export const FoodIcon = (p: P) => <Base {...p}><Path d="M6 3v7a2 2 0 0 0 4 0V3M8 3v18M17 3c-2 2-3 5-3 8h3v10" /></Base>;
export const ShieldIcon = (p: P) => <Base {...p}><Path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z" /></Base>;
export const DotsIcon = (p: P) => <Base {...p}><Circle cx="12" cy="12" r="1" /><Circle cx="6" cy="12" r="1" /><Circle cx="18" cy="12" r="1" /></Base>;

import type { ComponentType } from "react";
export const categoryIcon: Record<string, ComponentType<P>> = {
  water: DropIcon, electricity: BoltIcon, internet: WifiIcon, food: FoodIcon, safety: ShieldIcon, other: DotsIcon,
};
