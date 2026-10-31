"use client";

import { useState } from "react";

// Single-series bar chart with an optional dashed reference line and per-bar hover tooltip.
export type BarDatum = { label: string; value: number; ref?: number; color: string; note?: string };

export default function BarChart({
  data, max, ticks, unit = "", refLabel, height = 190, ariaLabel,
}: {
  data: BarDatum[]; max: number; ticks: number[]; unit?: string; refLabel?: string; height?: number; ariaLabel: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 560, H = height, L = 36, R = 8, T = 10, B = 24;
  const plotW = W - L - R, plotH = H - T - B;
  const step = plotW / data.length;
  const barW = Math.min(46, step - 14);
  const y = (v: number) => T + plotH - (v / max) * plotH;
  const refPts = data.filter((d) => d.ref != null).map((d, i) => `${L + step * i + step / 2},${y(d.ref!)}`);
  const h = hover != null ? data[hover] : null;

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
        {ticks.map((t) => (
          <g key={t}>
            <line className="gridline" x1={L} x2={W - R} y1={y(t)} y2={y(t)} />
            <text className="axis" x={L - 8} y={y(t) + 3} textAnchor="end">{t}{unit}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = L + step * i + (step - barW) / 2;
          const top = y(d.value);
          return (
            <g key={d.label} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
              <rect x={L + step * i} y={T} width={step} height={plotH} fill="transparent" />
              {/* 4px rounded data end, square at the baseline */}
              <path
                d={`M${x},${T + plotH} V${top + 4} Q${x},${top} ${x + 4},${top} H${x + barW - 4} Q${x + barW},${top} ${x + barW},${top + 4} V${T + plotH} Z`}
                fill={d.color} opacity={hover == null || hover === i ? 1 : 0.55}
              />
              <text className="axis" x={L + step * i + step / 2} y={H - 6} textAnchor="middle">{d.label}</text>
            </g>
          );
        })}
        {refPts.length > 1 && (
          <polyline points={refPts.join(" ")} fill="none" stroke="#13242b" strokeWidth={1.6} strokeDasharray="4 4" opacity={0.75} pointerEvents="none" />
        )}
      </svg>
      {h && hover != null && (
        <div className="chart-tip" style={{ left: `${((L + step * hover + step / 2) / W) * 100}%`, top: `${(y(h.value) / H) * 100}%` }}>
          <b>{h.label}: {h.value}{unit}</b>
          {h.ref != null && <> · {refLabel ?? "usual"} {h.ref}{unit}</>}
          {h.note && <div style={{ opacity: 0.8 }}>{h.note}</div>}
        </div>
      )}
    </div>
  );
}
