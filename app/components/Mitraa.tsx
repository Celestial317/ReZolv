import { useId } from "react";

export type Mood =
  | "happy" | "listening" | "cheerful" | "thinking" | "concerned" | "determined"
  | "sympathetic" | "proud" | "grateful" | "surprised" | "wink" | "starstruck";

export type Pose =
  | "wave" | "listen" | "think" | "phone" | "cheer"
  | "thumbsup" | "heart" | "hips" | "point" | "idle";

type Props = {
  pose?: Pose;
  mood?: Mood;
  /** show pose effects (confetti, stars, sound arcs). Off for sensitive moments. */
  fx?: boolean;
  crop?: "full" | "bust" | "face";
  size?: number | string;
  className?: string;
  title?: string;
};

const VIEW = { full: "0 0 220 330", bust: "28 18 164 164", face: "42 26 136 136" } as const;

const SKIN = "#e0a27a";
const SLEEVE = "#4169e1";
const DEEP = "#1b3594";
const GOLD = "#ffd166";
const INK = "#2a1a24";

/** Campus Mitraa. Inline SVG only: royal-blue hoodie, gold lanyard, no logo anywhere. */
export default function Mitraa({ pose = "idle", mood = "happy", fx = true, crop = "full", size, className, title }: Props) {
  const uid = useId().replace(/:/g, "");
  const hood = `hood${uid}`, skin = `skin${uid}`, hair = `hair${uid}`;
  const jump = pose === "cheer" ? -10 : 0;

  return (
    <svg
      viewBox={VIEW[crop]}
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={title ?? "Campus Mitraa"}
      style={{ display: "block", overflow: "visible" }}
    >
      <defs>
        <linearGradient id={hood} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5b82f2" /><stop offset="1" stopColor="#2343b8" />
        </linearGradient>
        <linearGradient id={skin} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f3c8a4" /><stop offset="1" stopColor="#d9966c" />
        </linearGradient>
        <linearGradient id={hair} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3a2a35" /><stop offset="1" stopColor="#120b12" />
        </linearGradient>
      </defs>

      {crop === "full" && <ellipse cx="110" cy="318" rx="52" ry="8" fill="#14232a" opacity="0.14" />}

      <g transform={`translate(0 ${jump})`}>
        {/* ponytail (behind) */}
        <path d="M138 52C196 30 214 118 178 176c-4-30-12-60-40-78z" fill={`url(#${hair})`} stroke="#0c070c" strokeWidth="3" strokeLinejoin="round" />

        {/* legs + shoes */}
        <rect x="86" y="236" width="20" height="58" rx="8" fill="#1d2540" />
        <rect x="114" y="236" width="20" height="58" rx="8" fill="#1d2540" />
        <path d="M80 296h30v10a4 4 0 0 1-4 4H84a4 4 0 0 1-4-4z" fill="#fff" stroke={DEEP} strokeWidth="2.5" />
        <path d="M110 296h30v10a4 4 0 0 1-4 4h-22a4 4 0 0 1-4-4z" fill="#fff" stroke={DEEP} strokeWidth="2.5" />
        <path d="M80 304h30M110 304h30" stroke="#2e55d6" strokeWidth="4" />

        {/* back arm(s) drawn before body so the hoodie overlaps */}
        {Arms(pose, "back")}

        {/* hoodie body */}
        <path d="M70 168c0-16 16-24 40-24s40 8 40 24v78c0 6-6 10-12 10H82c-6 0-12-4-12-10z" fill={`url(#${hood})`} stroke={DEEP} strokeWidth="3" strokeLinejoin="round" />
        <path d="M92 150c6 14 30 14 36 0" fill="none" stroke={DEEP} strokeWidth="3" strokeLinecap="round" />
        <path d="M84 238h52" stroke={DEEP} strokeWidth="3" strokeLinecap="round" opacity="0.5" />

        {/* neck */}
        <rect x="100" y="132" width="20" height="18" rx="6" fill={SKIN} />

        {/* lanyard + plain ID (no logo) */}
        <path d="M94 150 110 196M126 150 110 196" stroke={GOLD} strokeWidth="3.5" strokeLinecap="round" />
        <rect x="98" y="192" width="24" height="32" rx="4" fill="#fff" stroke={DEEP} strokeWidth="2" />
        <rect x="98" y="192" width="24" height="7" rx="3" fill="#2e55d6" />
        <circle cx="110" cy="208" r="4.5" fill="#f4b183" />
        <path d="M103 218h14" stroke="#c7d2f5" strokeWidth="2" strokeLinecap="round" />

        {/* front arm(s) */}
        {Arms(pose, "front")}

        {/* ears + earrings */}
        <circle cx="60" cy="100" r="9" fill={SKIN} /><circle cx="160" cy="100" r="9" fill={SKIN} />
        <circle cx="59" cy="113" r="3.4" fill={GOLD} /><circle cx="161" cy="113" r="3.4" fill={GOLD} />

        {/* head */}
        <ellipse cx="110" cy="96" rx="51" ry="48" fill={`url(#${skin})`} />

        {/* hair cap + fringe */}
        <path d="M58 96C50 40 168 28 162 96c-8-24-20-34-34-38-14 12-38 22-70 38z" fill={`url(#${hair})`} stroke="#0c070c" strokeWidth="3" strokeLinejoin="round" />
        <path d="M58 96c6 4 12-6 14-22M162 96c-6 4-10-8-10-22" stroke="#0c070c" strokeWidth="3" fill="none" strokeLinecap="round" />
        {/* scrunchie */}
        <ellipse cx="126" cy="44" rx="17" ry="9" transform="rotate(-18 126 44)" fill="#2e55d6" stroke={DEEP} strokeWidth="2.5" />
        <ellipse cx="122" cy="41" rx="7" ry="3" transform="rotate(-18 122 41)" fill="#7e9bf5" />

        {/* cheeks */}
        <ellipse cx="78" cy="114" rx="10" ry="6.5" fill="#ff7e95" opacity="0.7" />
        <ellipse cx="142" cy="114" rx="10" ry="6.5" fill="#ff7e95" opacity="0.7" />
        {/* nose */}
        <path d="M108 110q2 3 5 0" stroke="#a8643c" strokeWidth="2" fill="none" strokeLinecap="round" />

        <Face mood={mood} />

        {fx && <Effects pose={pose} />}
      </g>
    </svg>
  );
}

/* ---------------- face ---------------- */

function Eye({ x, y, look = 0, up = 0, r = 1 }: { x: number; y: number; look?: number; up?: number; r?: number }) {
  return (
    <g>
      <ellipse cx={x} cy={y} rx={11 * r} ry={12 * r} fill="#fff" stroke={INK} strokeWidth="2.5" />
      <circle cx={x + look} cy={y + 1 - up} r={7 * r} fill="#6b3a24" />
      <circle cx={x + look} cy={y + 1 - up} r={3.6 * r} fill="#1c0f0a" />
      <circle cx={x + look + 2.5} cy={y - 3 - up} r={2.4 * r} fill="#fff" />
    </g>
  );
}
const ArcEye = ({ x, y }: { x: number; y: number }) => (
  <path d={`M${x - 11} ${y + 3}q11 -14 22 0`} stroke={INK} strokeWidth="3.4" fill="none" strokeLinecap="round" />
);
const Heart = ({ x, y, s = 1, fill = "#ff4d6d" }: { x: number; y: number; s?: number; fill?: string }) => (
  <path transform={`translate(${x} ${y}) scale(${s})`} d="M0 6C-12 -4 -6 -12 0 -6 6 -12 12 -4 0 6z" fill={fill} />
);
const Star = ({ x, y, s = 1, fill = GOLD }: { x: number; y: number; s?: number; fill?: string }) => (
  <path transform={`translate(${x} ${y}) scale(${s})`} d="M0 -9 2.6 -2.8 9.4 -2.4 4.2 1.8 5.8 8.4 0 4.8 -5.8 8.4 -4.2 1.8 -9.4 -2.4 -2.6 -2.8z" fill={fill} />
);
const smile = (open: boolean) =>
  open ? (
    <g>
      <path d="M92 122q18 22 36 0z" fill="#8c2b3d" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M99 129q11 7 22 0q-11 -4 -22 0z" fill="#ff7e95" />
      <path d="M96 123h28" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
    </g>
  ) : (
    <path d="M96 122q14 11 28 0" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />
  );

function Face({ mood }: { mood: Mood }) {
  const L = 90, R = 130, Y = 98;
  const brow = (dl: string, dr: string) => (
    <>
      <path d={dl} stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d={dr} stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />
    </>
  );
  switch (mood) {
    case "cheerful":
      return <g><ArcEye x={L} y={Y} /><ArcEye x={R} y={Y} />{smile(true)}</g>;
    case "proud":
      return <g><ArcEye x={L} y={Y} /><ArcEye x={R} y={Y} />{smile(false)}</g>;
    case "listening":
      return <g><Eye x={L} y={Y} look={2} /><Eye x={R} y={Y} look={2} />{brow("M78 80q10 -5 22 -1", "M120 79q12 -4 22 1")}<path d="M100 123q10 6 20 0" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" /></g>;
    case "thinking":
      return <g><Eye x={L} y={Y} look={4} up={3} /><Eye x={R} y={Y} look={4} up={3} />{brow("M78 82q10 -4 22 0", "M120 76q12 -6 22 0")}<path d="M102 124q8 -3 18 1" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" /></g>;
    case "concerned":
      return <g><Eye x={L} y={Y} /><Eye x={R} y={Y} />{brow("M78 84l22 -6", "M120 78l22 6")}<path d="M99 127q11 -8 22 0" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" /></g>;
    case "determined":
      return <g><Eye x={L} y={Y} /><Eye x={R} y={Y} />{brow("M76 78l24 6", "M120 84l24 -6")}<path d="M99 123h22" stroke={INK} strokeWidth="3.4" strokeLinecap="round" /></g>;
    case "sympathetic":
      return <g><Eye x={L} y={Y + 1} /><Eye x={R} y={Y + 1} />{brow("M78 86q10 -9 22 -6", "M120 80q12 -3 22 6")}<path d="M99 125q11 -6 22 0" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" /></g>;
    case "grateful":
      return <g><ellipse cx={L} cy={Y} rx="11" ry="12" fill="#fff" stroke={INK} strokeWidth="2.5" /><ellipse cx={R} cy={Y} rx="11" ry="12" fill="#fff" stroke={INK} strokeWidth="2.5" /><Heart x={L} y={Y} s={1.1} /><Heart x={R} y={Y} s={1.1} />{smile(true)}</g>;
    case "starstruck":
      return <g><ellipse cx={L} cy={Y} rx="11" ry="12" fill="#fff" stroke={INK} strokeWidth="2.5" /><ellipse cx={R} cy={Y} rx="11" ry="12" fill="#fff" stroke={INK} strokeWidth="2.5" /><Star x={L} y={Y} s={1.15} /><Star x={R} y={Y} s={1.15} />{smile(true)}</g>;
    case "surprised":
      return <g><Eye x={L} y={Y} r={1.12} /><Eye x={R} y={Y} r={1.12} />{brow("M78 76q10 -8 22 -2", "M120 74q12 -6 22 2")}<ellipse cx="110" cy="126" rx="6" ry="8" fill="#8c2b3d" stroke={INK} strokeWidth="2.5" /></g>;
    case "wink":
      return <g><Eye x={L} y={Y} /><ArcEye x={R} y={Y} />{smile(false)}</g>;
    case "happy":
    default:
      return <g><Eye x={L} y={Y} /><Eye x={R} y={Y} />{brow("M78 82q10 -6 22 -1", "M120 81q12 -5 22 1")}{smile(true)}</g>;
  }
}

/* ---------------- arms ---------------- */

const Hand = ({ x, y }: { x: number; y: number }) => <circle cx={x} cy={y} r="10" fill={SKIN} stroke="#b9784f" strokeWidth="2" />;
const Limb = ({ d }: { d: string }) => (
  <g fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} stroke={DEEP} strokeWidth="23" />
    <path d={d} stroke={SLEEVE} strokeWidth="17" />
  </g>
);

function Arms(pose: Pose, layer: "back" | "front") {
  // [left arm path, left hand, right arm path, right hand, layer for each]
  const down = { l: "M80 168Q62 196 74 228", lh: [74, 232], r: "M140 168Q158 196 146 228", rh: [146, 232] };
  const A: Record<Pose, { l: string; lh: number[]; r: string; rh: number[]; front?: "l" | "r" | "both" }> = {
    idle: { ...down },
    wave: { ...down, r: "M140 168Q172 152 164 112", rh: [164, 104] },
    listen: { ...down, r: "M140 168Q172 150 160 112", rh: [158, 106] },
    think: { l: "M80 172Q92 206 134 192", lh: [138, 190], r: "M140 172Q156 146 126 128", rh: [124, 126], front: "both" },
    phone: { l: "M80 172Q80 206 102 202", lh: [104, 202], r: "M140 172Q140 206 118 202", rh: [116, 202], front: "both" },
    cheer: { l: "M80 166Q46 142 50 100", lh: [50, 92], r: "M140 166Q174 142 170 100", rh: [170, 92] },
    thumbsup: { ...down, r: "M140 170Q176 176 164 146", rh: [164, 140] },
    heart: { l: "M80 172Q86 208 128 198", lh: [130, 196], r: "M140 172Q134 208 92 198", rh: [90, 196], front: "both" },
    hips: { l: "M80 166Q50 192 82 218", lh: [86, 218], r: "M140 166Q170 192 138 218", rh: [134, 218] },
    point: { ...down, r: "M140 170Q176 176 196 166", rh: [200, 164] },
  };
  const a = A[pose];
  const front = a.front === "both";
  if ((layer === "front") !== front) return null;
  return (
    <g>
      <Limb d={a.l} /><Hand x={a.lh[0]} y={a.lh[1]} />
      <Limb d={a.r} /><Hand x={a.rh[0]} y={a.rh[1]} />
      {pose === "thumbsup" && <rect x="161" y="124" width="7" height="14" rx="3.5" fill={SKIN} stroke="#b9784f" strokeWidth="1.5" />}
      {pose === "phone" && <rect x="100" y="188" width="22" height="30" rx="4" fill="#14232a" stroke="#7e9bf5" strokeWidth="2" />}
      {pose === "heart" && <Heart x={110} y={186} s={1.2} />}
    </g>
  );
}

/* ---------------- pose effects ---------------- */

function Effects({ pose }: { pose: Pose }) {
  switch (pose) {
    case "wave":
      return <g stroke={GOLD} strokeWidth="3.5" fill="none" strokeLinecap="round"><path d="M178 90q9 10 0 22" /><path d="M186 84q14 16 0 34" opacity="0.6" /></g>;
    case "listen":
      return <g stroke="#2e55d6" strokeWidth="3.5" fill="none" strokeLinecap="round"><path d="M176 94q8 12 0 24" /><path d="M184 88q13 18 0 36" opacity="0.6" /></g>;
    case "think":
      return (
        <g>
          <circle cx="182" cy="34" r="9" fill={GOLD} />
          <g stroke={GOLD} strokeWidth="3" strokeLinecap="round">
            <path d="M182 16v6M182 46v6M164 34h6M194 34h6M169 21l4 4M195 47l4 4M195 21l-4 4M169 47l4-4" />
          </g>
        </g>
      );
    case "cheer":
      return (
        <g>
          <rect x="30" y="40" width="6" height="12" rx="2" fill="#2e55d6" transform="rotate(-30 30 40)" />
          <rect x="192" y="70" width="6" height="12" rx="2" fill="#ff7e95" transform="rotate(30 192 70)" />
          <circle cx="24" cy="90" r="4" fill={GOLD} /><circle cx="198" cy="28" r="4" fill={GOLD} />
          <rect x="176" y="120" width="6" height="12" rx="2" fill="#2e55d6" transform="rotate(50 176 120)" />
          <circle cx="40" cy="130" r="4" fill="#ff7e95" />
        </g>
      );
    case "thumbsup":
      return <g><Star x={84} y={16} s={0.9} /><Star x={100} y={8} s={0.9} /><Star x={116} y={4} s={1} /><Star x={132} y={8} s={0.9} /><Star x={148} y={16} s={0.9} /></g>;
    default:
      return null;
  }
}
