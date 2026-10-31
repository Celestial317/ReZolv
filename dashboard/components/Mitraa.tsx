import { useId } from "react";

// Campus Mitraa: inline SVG mascot (see architecture.md §8 and the character sheet).
// Royal-blue hoodie, high ponytail with a blue scrunchie, gold lanyard, plain ID. No logo on her.

export type MitraaMood =
  | "happy" | "cheerful" | "listening" | "thinking" | "concerned" | "determined"
  | "proud" | "sympathetic" | "surprised" | "grateful" | "wink" | "starstruck";
export type MitraaPose = "wave" | "listen" | "think" | "cheer" | "thumbsup" | "heart" | "hips" | "point" | "phone" | "idle";
export type MitraaFx = "none" | "sparkles" | "confetti" | "stars" | "hearts";

type Props = {
  mood?: MitraaMood;
  pose?: MitraaPose;
  fx?: MitraaFx;
  crop?: "full" | "head";
  size?: number;
  className?: string;
};

const C = {
  hair: "#241c2a", hairHi: "#4b4358", skin: "#e2a979", skinDark: "#b9784f", cheek: "#f58ea0",
  hoodie: "#3a64e0", hoodieDark: "#2446be", hood: "#1b3594", scrunchie: "#2e5ad8", gold: "#f7c948",
  pants: "#1e2a44", eye: "#1a1015", iris: "#6b3a1f", mouth: "#7a2630", tongue: "#f08a96",
};

const EYE_L = { x: 82, y: 100 };
const EYE_R = { x: 118, y: 100 };

function heartPath(x: number, y: number, s: number) {
  return `M${x},${y + s * 0.9} C${x - s * 1.6},${y - s * 0.1} ${x - s * 0.8},${y - s * 1.2} ${x},${y - s * 0.35} C${x + s * 0.8},${y - s * 1.2} ${x + s * 1.6},${y - s * 0.1} ${x},${y + s * 0.9} Z`;
}

function starPath(x: number, y: number, r: number) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    pts.push(`${(x + rr * Math.cos(a)).toFixed(1)},${(y + rr * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join("L")}Z`;
}

function sparkle(x: number, y: number, r: number) {
  return `M${x},${y - r} Q${x + r * 0.18},${y - r * 0.18} ${x + r},${y} Q${x + r * 0.18},${y + r * 0.18} ${x},${y + r} Q${x - r * 0.18},${y + r * 0.18} ${x - r},${y} Q${x - r * 0.18},${y - r * 0.18} ${x},${y - r}Z`;
}

function OpenEye({ x, y, look = [0, 0], big = false }: { x: number; y: number; look?: [number, number]; big?: boolean }) {
  const rx = big ? 9.5 : 8.5, ry = big ? 11 : 9.5;
  return (
    <g>
      <ellipse cx={x} cy={y} rx={rx} ry={ry} fill="#fff" />
      <circle cx={x + look[0]} cy={y + 1 + look[1]} r={big ? 5 : 6} fill={C.iris} />
      <circle cx={x + look[0]} cy={y + 1 + look[1]} r={big ? 2.6 : 3.2} fill={C.eye} />
      <circle cx={x + look[0] + 2} cy={y - 2 + look[1]} r={1.8} fill="#fff" />
      <path d={`M${x - rx - 1},${y - 3} Q${x},${y - ry - 5} ${x + rx + 1},${y - 3}`} stroke={C.eye} strokeWidth={2.6} fill="none" strokeLinecap="round" />
      <path d={x < 100 ? `M${x - rx},${y - 4} l-4,-3` : `M${x + rx},${y - 4} l4,-3`} stroke={C.eye} strokeWidth={2} strokeLinecap="round" />
    </g>
  );
}

const ClosedEye = ({ x, y }: { x: number; y: number }) => (
  <path d={`M${x - 8},${y + 2} Q${x},${y - 7} ${x + 8},${y + 2}`} stroke={C.eye} strokeWidth={3} fill="none" strokeLinecap="round" />
);

function Eyes({ mood }: { mood: MitraaMood }) {
  switch (mood) {
    case "cheerful":
    case "proud":
      return <><ClosedEye {...EYE_L} /><ClosedEye {...EYE_R} /></>;
    case "wink":
      return <><OpenEye {...EYE_L} /><ClosedEye {...EYE_R} /></>;
    case "grateful":
      return <><path d={heartPath(EYE_L.x, EYE_L.y, 7)} fill="#f2557a" /><path d={heartPath(EYE_R.x, EYE_R.y, 7)} fill="#f2557a" /></>;
    case "starstruck":
      return <><path d={starPath(EYE_L.x, EYE_L.y, 9)} fill={C.gold} stroke="#d99a14" strokeWidth={1} /><path d={starPath(EYE_R.x, EYE_R.y, 9)} fill={C.gold} stroke="#d99a14" strokeWidth={1} /></>;
    case "thinking":
      return <><OpenEye {...EYE_L} look={[2.5, -3]} /><OpenEye {...EYE_R} look={[2.5, -3]} /></>;
    case "surprised":
      return <><OpenEye {...EYE_L} big /><OpenEye {...EYE_R} big /></>;
    case "concerned":
    case "sympathetic":
      return <><OpenEye {...EYE_L} look={[0, 1]} /><OpenEye {...EYE_R} look={[0, 1]} /></>;
    default:
      return <><OpenEye {...EYE_L} /><OpenEye {...EYE_R} /></>;
  }
}

function Brows({ mood }: { mood: MitraaMood }) {
  let l = "M72,84 Q82,79 92,83", r = "M108,83 Q118,79 128,84";
  if (mood === "concerned" || mood === "sympathetic") { l = "M72,85 Q82,84 91,79"; r = "M109,79 Q118,84 128,85"; }
  if (mood === "determined") { l = "M72,80 Q82,80 92,86"; r = "M108,86 Q118,80 128,80"; }
  if (mood === "surprised") { l = "M72,79 Q82,72 92,77"; r = "M108,77 Q118,72 128,79"; }
  if (mood === "thinking") { r = "M108,80 Q118,75 128,80"; }
  return <g stroke={C.hair} strokeWidth={3} strokeLinecap="round" fill="none"><path d={l} /><path d={r} /></g>;
}

function Mouth({ mood }: { mood: MitraaMood }) {
  switch (mood) {
    case "cheerful":
    case "starstruck":
      return (
        <g>
          <path d="M86,116 Q100,138 114,116 Z" fill={C.mouth} />
          <path d="M88,117 Q100,120 112,117 L111,120.5 Q100,123 89,120.5 Z" fill="#fff" />
          <ellipse cx={100} cy={127} rx={6} ry={3.5} fill={C.tongue} />
        </g>
      );
    case "surprised":
      return <ellipse cx={100} cy={123} rx={4.5} ry={6} fill={C.mouth} />;
    case "concerned":
      return <path d="M92,124 Q100,118 108,124" stroke={C.mouth} strokeWidth={2.6} fill="none" strokeLinecap="round" />;
    case "sympathetic":
      return <path d="M91,122 q4.5,-3.5 9,0 q4.5,3.5 9,0" stroke={C.mouth} strokeWidth={2.6} fill="none" strokeLinecap="round" />;
    case "determined":
      return <path d="M92,121 Q100,124 108,121" stroke={C.mouth} strokeWidth={3} fill="none" strokeLinecap="round" />;
    case "thinking":
      return <path d="M94,122 Q101,125 108,119" stroke={C.mouth} strokeWidth={2.6} fill="none" strokeLinecap="round" />;
    case "proud":
      return <path d="M87,117 Q100,131 113,117 Q100,122 87,117 Z" fill={C.mouth} />;
    default:
      return <path d="M89,118 Q100,129 111,118 Q100,122 89,118 Z" fill={C.mouth} />;
  }
}

// Arms are thick round-capped strokes; hands are skin circles.
function Arms({ pose }: { pose: MitraaPose }) {
  const arm = (d: string, k: string) => (
    <g key={k}>
      <path d={d} stroke={C.hoodieDark} strokeWidth={17} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} stroke={C.hoodie} strokeWidth={13} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
  const hand = (x: number, y: number, k: string, r = 8) => <circle key={k} cx={x} cy={y} r={r} fill={C.skin} stroke={C.skinDark} strokeWidth={1} />;
  const leftDown = [arm("M66,160 Q57,184 60,204", "la"), hand(60, 210, "lh")];
  const rightDown = [arm("M134,160 Q143,184 140,204", "ra"), hand(140, 210, "rh")];

  switch (pose) {
    case "wave":
      return (
        <g>
          {leftDown}
          {arm("M134,162 Q156,146 154,114", "ra")}
          <rect x={144} y={88} width={19} height={22} rx={8} fill={C.skin} stroke={C.skinDark} strokeWidth={1} />
          <path d="M149,90 v-6 M154,89 v-7 M159,90 v-6" stroke={C.skin} strokeWidth={4.5} strokeLinecap="round" />
          <path d="M170,84 q7,10 0,21 M177,79 q11,15 0,31" stroke={C.gold} strokeWidth={3} fill="none" strokeLinecap="round" />
        </g>
      );
    case "listen":
      return <g>{leftDown}{arm("M134,162 Q158,150 150,116", "ra")}{hand(148, 108, "rh", 8.5)}</g>;
    case "think":
      return <g>{leftDown}{arm("M134,162 Q146,156 120,140", "ra")}{hand(114, 138, "rh")}</g>;
    case "cheer":
      return <g>{arm("M66,160 Q46,134 48,106", "la")}{hand(48, 98, "lh")}{arm("M134,160 Q154,134 152,106", "ra")}{hand(152, 98, "rh")}</g>;
    case "thumbsup":
      return (
        <g>
          {leftDown}
          {arm("M134,162 Q152,182 132,188", "ra")}
          <rect x={121} y={167} width={7} height={15} rx={3.5} fill={C.skin} stroke={C.skinDark} strokeWidth={1} />
          {hand(126, 186, "rh", 8.5)}
        </g>
      );
    case "heart":
      return (
        <g>
          {arm("M66,160 Q68,190 90,188", "la")}{arm("M134,160 Q132,190 110,188", "ra")}
          <path d={heartPath(100, 180, 11)} fill="#f2557a" stroke="#d63f63" strokeWidth={1} />
          {hand(91, 188, "lh", 7)}{hand(109, 188, "rh", 7)}
        </g>
      );
    case "hips":
      return <g>{arm("M66,160 L46,184 L64,204", "la")}{hand(64, 205, "lh", 7)}{arm("M134,160 L154,184 L136,204", "ra")}{hand(136, 205, "rh", 7)}</g>;
    case "point":
      return (
        <g>
          {leftDown}
          {arm("M134,162 L170,152", "ra")}
          {hand(176, 150, "rh")}
          <path d="M182,149 h8" stroke={C.skin} strokeWidth={4.5} strokeLinecap="round" />
        </g>
      );
    case "phone":
      return (
        <g>
          {leftDown}
          {arm("M134,162 Q142,190 120,190", "ra")}
          <rect x={108} y={164} width={17} height={27} rx={3.5} fill={C.pants} />
          <rect x={110.5} y={167} width={12} height={19} rx={1.5} fill="#8fb2f7" />
          {hand(118, 190, "rh", 7.5)}
        </g>
      );
    default:
      return <g>{leftDown}{rightDown}</g>;
  }
}

function Fx({ fx }: { fx: MitraaFx }) {
  if (fx === "sparkles")
    return <g>{[[30, 64, 8, C.gold], [172, 34, 7, "#5b84f0"], [182, 150, 6, C.gold], [22, 176, 6, "#5b84f0"]].map(([x, y, r, c], i) => <path key={i} d={sparkle(+x, +y, +r)} fill={String(c)} />)}</g>;
  if (fx === "stars")
    return <g>{[60, 80, 100, 120, 140].map((x, i) => <path key={i} d={starPath(x, i % 2 ? 24 : 18, 6)} fill={C.gold} />)}</g>;
  if (fx === "hearts")
    return <g>{[[28, 90, 7], [176, 70, 6], [170, 168, 8], [32, 180, 5]].map(([x, y, s], i) => <path key={i} d={heartPath(x, y, s)} fill="#f2557a" opacity={0.85} />)}</g>;
  if (fx === "confetti") {
    const colors = ["#3a64e0", C.gold, "#f2557a", "#15a397", "#7b3aec"];
    const bits = [[24, 40, 20], [48, 22, -30], [160, 20, 40], [184, 52, -15], [16, 120, 60], [186, 116, 10], [34, 200, -40], [176, 210, 25], [100, 14, 15], [140, 30, -50]];
    return <g>{bits.map(([x, y, a], i) => <rect key={i} x={x} y={y} width={7} height={3.5} rx={1} fill={colors[i % colors.length]} transform={`rotate(${a} ${x} ${y})`} />)}</g>;
  }
  return null;
}

export default function Mitraa({ mood = "happy", pose = "idle", fx = "none", crop = "full", size, className }: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const skinId = `mskin${uid}`, hoodId = `mhood${uid}`;
  const head = crop === "head";
  const viewBox = head ? "42 26 124 124" : "0 0 200 300";
  const style = size ? (head ? { width: size, height: size } : { width: size, height: size * 1.5 }) : undefined;

  return (
    <svg viewBox={viewBox} role="img" aria-label={`Campus Mitraa, ${mood}`} className={className} style={style}>
      <defs>
        <radialGradient id={skinId} cx="45%" cy="40%" r="65%">
          <stop offset="0%" stopColor="#efc095" />
          <stop offset="100%" stopColor={C.skin} />
        </radialGradient>
        <linearGradient id={hoodId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.hoodie} />
          <stop offset="100%" stopColor={C.hoodieDark} />
        </linearGradient>
      </defs>

      {!head && <ellipse cx={100} cy={288} rx={44} ry={6} fill="#13242b" opacity={0.12} />}

      {/* ponytail */}
      <path d="M126,50 C138,22 178,20 186,48 C194,76 180,106 170,126 C166,135 160,141 153,144 C162,128 168,108 168,88 C168,66 156,54 138,60 Z" fill={C.hair} />
      <path d="M146,34 C166,30 180,44 180,64" stroke={C.hairHi} strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.7} />

      {!head && (
        <g>
          {/* legs + shoes */}
          <rect x={80} y={228} width={16} height={42} rx={3} fill={C.pants} />
          <rect x={104} y={228} width={16} height={42} rx={3} fill={C.pants} />
          <rect x={71} y={266} width={29} height={11} rx={5.5} fill="#fff" stroke="#d6def0" />
          <rect x={100} y={266} width={29} height={11} rx={5.5} fill="#fff" stroke="#d6def0" />
          <path d="M73,276 h25 M102,276 h25" stroke={C.scrunchie} strokeWidth={2.5} strokeLinecap="round" />
          <path d="M82,270 h8 M110,270 h8" stroke={C.scrunchie} strokeWidth={1.8} strokeLinecap="round" />
          {/* hoodie */}
          <path d="M64,162 C64,150 78,144 100,144 C122,144 136,150 136,162 L140,222 C140,230 134,234 126,234 L74,234 C66,234 60,230 60,222 Z" fill={`url(#${hoodId})`} />
          <path d="M78,202 L122,202 L127,228 L73,228 Z" fill={C.hood} opacity={0.22} />
        </g>
      )}

      {/* hair behind the head */}
      <ellipse cx={100} cy={92} rx={51} ry={50} fill={C.hair} />

      {/* neck, hood, lanyard */}
      <rect x={92} y={128} width={16} height={20} rx={4} fill={C.skinDark} />
      <path d="M72,150 C80,158 120,158 128,150 C124,142 112,139 100,139 C88,139 76,142 72,150 Z" fill={C.hood} />
      {!head && (
        <g>
          <path d="M88,150 L95,196 M112,150 L105,196" stroke={C.gold} strokeWidth={2.6} strokeLinecap="round" />
          <rect x={88} y={194} width={24} height={29} rx={3.5} fill="#fff" stroke="#c9d6f5" />
          <rect x={88} y={194} width={24} height={5} rx={2} fill={C.scrunchie} />
          <circle cx={100} cy={207} r={4} fill={C.skin} />
          <path d="M93,216 h14" stroke="#9fb3e8" strokeWidth={2} strokeLinecap="round" />
        </g>
      )}

      {/* ears + earring */}
      <circle cx={56} cy={101} r={8} fill={C.skin} />
      <circle cx={144} cy={101} r={8} fill={C.skin} />
      <circle cx={56} cy={111} r={2.8} fill={C.gold} />

      {/* face */}
      <ellipse cx={100} cy={97} rx={44} ry={42} fill={`url(#${skinId})`} />
      <ellipse cx={72} cy={115} rx={7} ry={4.5} fill={C.cheek} opacity={mood === "grateful" ? 0.85 : 0.55} />
      <ellipse cx={128} cy={115} rx={7} ry={4.5} fill={C.cheek} opacity={mood === "grateful" ? 0.85 : 0.55} />
      <Eyes mood={mood} />
      <Brows mood={mood} />
      <path d="M99.5,106 q2.5,3 -0.5,5.5" stroke={C.skinDark} strokeWidth={1.8} fill="none" strokeLinecap="round" />
      <Mouth mood={mood} />
      {mood === "sympathetic" && <path d="M126,108 q-3,5 0,7 q3,-2 0,-7Z" fill="#7cc3f2" />}

      {/* bangs */}
      <path d="M54,102 C47,60 74,40 100,40 C128,40 153,56 146,102 C143,86 137,76 127,70 C118,79 104,81 93,74 C85,70 81,77 69,81 C61,85 57,93 54,102 Z" fill={C.hair} />
      <path d="M72,54 C86,46 108,44 124,50" stroke={C.hairHi} strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.6} />

      {/* scrunchie */}
      <g>
        <circle cx={123} cy={47} r={8.5} fill={C.scrunchie} />
        <circle cx={133} cy={41} r={8.5} fill={C.scrunchie} />
        <circle cx={139} cy={50} r={8} fill="#2347b8" />
        <ellipse cx={130} cy={40} rx={4} ry={2.2} fill="#fff" opacity={0.45} />
      </g>

      {!head && <Arms pose={pose} />}
      {!head && <Fx fx={fx} />}
    </svg>
  );
}
