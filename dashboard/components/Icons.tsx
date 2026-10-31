// Small stroke icons (24px grid, 1.8 stroke) used across the dashboard.
type P = { size?: number; className?: string };

function Svg({ size = 18, className, children }: P & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      {children}
    </svg>
  );
}

export const IconOverview = (p: P) => <Svg {...p}><rect x="3" y="3" width="7.5" height="9" rx="1.5" /><rect x="13.5" y="3" width="7.5" height="5" rx="1.5" /><rect x="13.5" y="11" width="7.5" height="10" rx="1.5" /><rect x="3" y="15" width="7.5" height="6" rx="1.5" /></Svg>;
export const IconIssues = (p: P) => <Svg {...p}><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3" /></Svg>;
export const IconLock = (p: P) => <Svg {...p}><rect x="4.5" y="10.5" width="15" height="10.5" rx="2" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3M12 15v2" /></Svg>;
export const IconPromise = (p: P) => <Svg {...p}><rect x="4" y="4" width="16" height="16" rx="2.5" /><path d="m8.5 12 2.5 2.5 5-5" /></Svg>;
export const IconPin = (p: P) => <Svg {...p}><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21Z" /><circle cx="12" cy="10" r="2.3" /></Svg>;
export const IconRoot = (p: P) => <Svg {...p}><circle cx="6" cy="5" r="2" /><circle cx="18" cy="5" r="2" /><circle cx="12" cy="19" r="2" /><path d="M6 7c0 5 6 5 6 10M18 7c0 5-6 5-6 10" /></Svg>;
export const IconScore = (p: P) => <Svg {...p}><path d="M4 20h16M7 17V9M12 17V5M17 17v-5" /></Svg>;
export const IconSwarm = (p: P) => <Svg {...p}><circle cx="12" cy="6" r="2.3" /><circle cx="5" cy="17" r="2.3" /><circle cx="19" cy="17" r="2.3" /><path d="M12 8.3V13M7 16l5-3 5 3" /></Svg>;
export const IconSearch = (p: P) => <Svg {...p}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4-4" /></Svg>;
export const IconBell = (p: P) => <Svg {...p}><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16ZM10 20.5a2 2 0 0 0 4 0" /></Svg>;
export const IconChevron = (p: P) => <Svg {...p}><path d="m7 10 5 5 5-5" /></Svg>;
export const IconArrowUpRight = (p: P) => <Svg {...p}><path d="M8 16 16 8M9 8h7v7" /></Svg>;
export const IconArrowRight = (p: P) => <Svg {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>;
export const IconLocate = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="4" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3" /></Svg>;
export const IconMic = (p: P) => <Svg {...p}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M6 11a6 6 0 0 0 12 0M12 17v4" /></Svg>;
export const IconPhoto = (p: P) => <Svg {...p}><rect x="3.5" y="5" width="17" height="14" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="m4 18 5-5 4 4 3-3 4 4" /></Svg>;
export const IconCheck = (p: P) => <Svg {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></Svg>;
export const IconX = (p: P) => <Svg {...p}><path d="M6 6l12 12M18 6 6 18" /></Svg>;
export const IconDownload = (p: P) => <Svg {...p}><path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" /></Svg>;
