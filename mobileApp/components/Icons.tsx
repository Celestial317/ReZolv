type P = { size?: number; color?: string };

const base = (size: number, color: string) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: color,
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export const Home = ({ size = 28, color = "currentColor" }: P) => (
  <svg {...base(size, color)}><path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" /></svg>
);
export const Pin = ({ size = 28, color = "currentColor" }: P) => (
  <svg {...base(size, color)}><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
);
export const Clipboard = ({ size = 28, color = "currentColor" }: P) => (
  <svg {...base(size, color)}><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4h6v3H9zM9 12h6M9 16h4" /></svg>
);
export const User = ({ size = 28, color = "currentColor" }: P) => (
  <svg {...base(size, color)}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
);
export const Mic = ({ size = 30, color = "currentColor" }: P) => (
  <svg {...base(size, color)}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
);
export const Bell = ({ size = 28, color = "currentColor" }: P) => (
  <svg {...base(size, color)}><path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15zM10 21h4" /></svg>
);
export const ArrowUp = ({ size = 28, color = "currentColor" }: P) => (
  <svg {...base(size, color)}><path d="M12 19V5M5 12l7-7 7 7" /></svg>
);
export const Chevron = ({ size = 24, color = "currentColor" }: P) => (
  <svg {...base(size, color)}><path d="m9 5 7 7-7 7" /></svg>
);
export const Back = ({ size = 26, color = "currentColor" }: P) => (
  <svg {...base(size, color)}><path d="m15 5-7 7 7 7" /></svg>
);
export const Close = ({ size = 26, color = "currentColor" }: P) => (
  <svg {...base(size, color)}><path d="M6 6l12 12M18 6 6 18" /></svg>
);
export const Check = ({ size = 22, color = "currentColor" }: P) => (
  <svg {...base(size, color)} strokeWidth={3}><path d="m5 12.5 4.5 4.5L19 7" /></svg>
);
export const Minus = ({ size = 26, color = "currentColor" }: P) => (
  <svg {...base(size, color)}><path d="M6 12h12" /></svg>
);
export const Drop = ({ size = 28, color = "currentColor" }: P) => (
  <svg {...base(size, color)}><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" /></svg>
);
export const Send = ({ size = 26, color = "currentColor" }: P) => (
  <svg {...base(size, color)}><path d="M21 3 10 14M21 3l-7 18-4-7-7-4z" /></svg>
);
export const Play = ({ size = 22, color = "currentColor" }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden><path d="M8 5v14l11-7z" /></svg>
);
export const Camera = ({ size = 22, color = "currentColor" }: P) => (
  <svg {...base(size, color)}><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
);
export const Nav = ({ size = 28, color = "currentColor" }: P) => (
  <svg {...base(size, color)}><path d="m12 3 7 17-7-4-7 4z" /></svg>
);
export const Building = ({ size = 28, color = "currentColor" }: P) => (
  <svg {...base(size, color)}><path d="M4 21V10l8-6 8 6v11M9 21v-6h6v6" /></svg>
);
