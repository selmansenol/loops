/**
 * Tiny dependency-free SVG charts for the admin dashboard. Responsive via
 * viewBox; styled with the app's CSS tokens.
 */

type Pt = { day: string; value: number };

/** Smooth-ish area + line chart. Hover shows the day/value via <title>. */
export function AreaChart({
  data,
  height = 120,
  color = "var(--color-primary, #7c9cff)",
}: {
  data: Pt[];
  height?: number;
  color?: string;
}) {
  const W = 600;
  const H = height;
  const pad = 6;
  const max = Math.max(1, ...data.map((d) => d.value));
  const n = Math.max(1, data.length - 1);
  const x = (i: number) => pad + (i * (W - pad * 2)) / n;
  const y = (v: number) => H - pad - (v / max) * (H - pad * 2);
  const line = data
    .map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`)
    .join(" ");
  const area = `${line} L${x(data.length - 1).toFixed(1)},${H - pad} L${x(0).toFixed(1)},${H - pad} Z`;
  const gid = `g${Math.round(max)}_${data.length}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.22" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {data.map((d, i) => (
        <circle key={i} cx={x(i)} cy={y(d.value)} r="6" fill="transparent">
          <title>{`${d.day}: ${d.value}`}</title>
        </circle>
      ))}
    </svg>
  );
}

/** Compact vertical bars. */
export function Bars({
  data,
  height = 120,
  color = "var(--color-foreground, #1a1a1a)",
}: {
  data: Pt[];
  height?: number;
  color?: string;
}) {
  const W = 600;
  const H = height;
  const pad = 6;
  const max = Math.max(1, ...data.map((d) => d.value));
  const n = data.length || 1;
  const gap = n > 40 ? 1 : 2;
  const bw = (W - pad * 2) / n - gap;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      {data.map((d, i) => {
        const h = (d.value / max) * (H - pad * 2);
        const xx = pad + i * (bw + gap);
        return (
          <rect
            key={i}
            x={xx}
            y={H - pad - h}
            width={Math.max(1, bw)}
            height={Math.max(0, h)}
            rx="1.5"
            fill={color}
            opacity={0.85}
          >
            <title>{`${d.day}: ${d.value}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

/** Horizontal funnel: each step a bar relative to the first. */
export function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
  const max = Math.max(1, ...steps.map((s) => s.value));
  return (
    <div className="space-y-3">
      {steps.map((s, i) => {
        const pct = Math.round((s.value / max) * 100);
        const conv =
          i === 0 || steps[0].value === 0 ? null : Math.round((s.value / steps[0].value) * 100);
        return (
          <div key={s.label}>
            <div className="flex items-baseline justify-between text-sm mb-1">
              <span className="font-medium">{s.label}</span>
              <span className="tabular-nums">
                {s.value.toLocaleString()}
                {conv != null && (
                  <span className="text-muted-foreground text-xs ml-2">{conv}%</span>
                )}
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-accent overflow-hidden">
              <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
