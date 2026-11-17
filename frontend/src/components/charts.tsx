import { useId, type CSSProperties } from "react";

/** Smooth path through points (Catmull-Rom → cubic Bézier). */
export function smooth(points: [number, number][]): string {
  if (points.length < 2) return points.length ? `M${points[0][0]},${points[0][1]}` : "";
  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

export type Series = { name: string; values: number[]; color: string };

export function LineChart({ labels, series, height = 200, format = (v: number) => String(v) }: {
  labels: string[]; series: Series[]; height?: number; format?: (v: number) => string;
}) {
  const W = 640, H = height, L = 34, R = 10, T = 12, B = 24;
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const nice = Math.ceil(max / 4) * 4 || 4;
  const x = (i: number) => L + (i * (W - L - R)) / Math.max(1, labels.length - 1);
  const y = (v: number) => T + (1 - v / nice) * (H - T - B);
  const every = Math.max(1, Math.ceil(labels.length / 7));
  const uid = useId().replace(/:/g, "");
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Line chart">
      {[0, 1, 2, 3, 4].map((g) => {
        const v = (nice * g) / 4;
        return <g key={g}><line className="gl" x1={L} x2={W - R} y1={y(v)} y2={y(v)} /><text x={L - 8} y={y(v) + 3} textAnchor="end">{format(Math.round(v))}</text></g>;
      })}
      {labels.map((l, i) => (i % every === 0 ? <text key={i} x={x(i)} y={H - 6} textAnchor="middle">{l}</text> : null))}
      {series.map((s, si) => {
        const pts = s.values.map((v, i) => [x(i), y(v)] as [number, number]);
        const line = smooth(pts);
        return (
          <g key={s.name}>
            <defs><linearGradient id={`${uid}${si}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={s.color} stopOpacity=".22" /><stop offset="1" stopColor={s.color} stopOpacity="0" /></linearGradient></defs>
            {si === 0 && pts.length > 1 && <path className="ar" d={`${line} L${pts[pts.length - 1][0]},${H - B} L${pts[0][0]},${H - B}Z`} fill={`url(#${uid}${si})`} />}
            <path className="ln" pathLength={1} d={line} fill="none" stroke={s.color} strokeWidth={2.5} strokeLinecap="round" />
            {pts.map(([px, py], i) => (
              <g className="pt" key={i} data-tip={`${labels[i]}\n${s.name}: ${format(s.values[i])}`}>
                <line className="cx" x1={px} x2={px} y1={T} y2={H - B} />
                <circle className="hd" cx={px} cy={py} r={4.5} fill={s.color} stroke="var(--card)" strokeWidth={2} />
                <rect x={px - 10} y={T} width={20} height={H - T - B} fill="transparent" />
              </g>
            ))}
          </g>
        );
      })}
    </svg>
  );
}

export function Bars({ labels, values, color = "var(--acc)", height = 150, format = (v: number) => String(v) }: {
  labels: string[]; values: number[]; color?: string; height?: number; format?: (v: number) => string;
}) {
  const W = 320, H = height, T = 10, B = 22;
  const max = Math.max(1, ...values);
  const bw = Math.min(28, (W / values.length) * 0.58);
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Bar chart">
      {values.map((v, i) => {
        const cx = (W / values.length) * (i + 0.5);
        const h = (v / max) * (H - T - B);
        return (
          <g key={i} data-tip={`${labels[i]}: ${format(v)}`}>
            <rect className="bar" style={{ "--k": i } as CSSProperties} x={cx - bw / 2} y={H - B - h} width={bw} height={Math.max(h, v ? 3 : 0)} rx={bw / 2.4} fill={color} />
            <text x={cx} y={H - 6} textAnchor="middle" fontSize="9">{labels[i]}</text>
          </g>
        );
      })}
    </svg>
  );
}

export type HabitActivityChartPoint = {
  day: string; completed: number; skipped: number; scheduled: number; active: number; streaking: number; completion_rate: number;
};

/** Daily completion volume with a percentage trend and clear summary metrics. */
export function HabitProgressChart({ points, height = 360 }: { points: HabitActivityChartPoint[]; height?: number }) {
  const W = 1120, H = height, L = 64, R = 62, T = 34, B = 52;
  const maxCount = Math.max(1, ...points.map(p => Math.max(p.scheduled, p.completed + p.skipped)));
  const countStep = Math.max(1, Math.ceil(maxCount / 4));
  const countMax = countStep * 4;
  const x = (i:number) => L + (i * (W-L-R)) / Math.max(1,points.length-1);
  const yCount = (v:number) => T + (1-Math.max(0,v)/countMax)*(H-T-B);
  const yRate = (v:number) => T + (1-Math.max(0,Math.min(100,v))/100)*(H-T-B);
  const linePath = (values:number[], scale:(value:number)=>number) => values.map((value,i)=>(i?"L":"M")+x(i)+","+scale(value)).join(" ");
  const ratePath = linePath(points.map(p=>p.completion_rate),yRate);
  const activePath = linePath(points.map(p=>p.active),yCount);
  const every = Math.max(1,Math.ceil(points.length/9));
  const totalCompleted = points.reduce((sum,p)=>sum+p.completed,0);
  const totalScheduled = points.reduce((sum,p)=>sum+Math.max(p.scheduled,p.completed+p.skipped),0);
  const averageRate = totalScheduled ? Math.round(totalCompleted/totalScheduled*100) : 0;
  const latest = points[points.length-1];
  const bestDay = points.reduce((best,p)=>p.completion_rate>best.completion_rate?p:best,points[0]);
  const bestLabel = bestDay ? new Date(bestDay.day+"T00:00:00").toLocaleDateString("en",{day:"numeric",month:"short"}) : "—";
  return <div className="habit-analytics">
    <div className="habit-chart-topline"><div><span className="habit-chart-eyebrow">LAST {points.length} DAYS</span><p>Daily check-ins and consistency, together.</p></div><span className="habit-chart-period">Daily view</span></div>
    <div className="habit-chart-legend">
      <span><i className="completed" />Completed</span><span><i className="skipped" />Skipped</span><span><i className="rate" />Completion rate</span><span><i className="active" />Logged habits</span>
    </div>
    <div className="habit-chart-scroll">
      <svg className="chart habit-progress-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Daily completed and skipped habits as stacked bars, with completion rate and active habits as trend lines">
        {[0,1,2,3,4].map(step=>{const y=T+step*(H-T-B)/4;return <g key={step}><line className="gl" x1={L} x2={W-R} y1={y} y2={y}/><text className="habit-axis-count" x={L-12} y={y+4} textAnchor="end">{countMax-step*countStep}</text><text className="habit-axis-rate" x={W-R+12} y={y+4}>{100-step*25}%</text></g>})}
        {points.map((p,i)=>{const bw=Math.max(5,Math.min(18,((W-L-R)/Math.max(1,points.length))*.62));const completed=Math.max(0,p.completed),skipped=Math.max(0,p.skipped);const yCompleted=yCount(completed);const yTotal=yCount(completed+skipped);const bottom=yCount(0);const rate=Math.max(0,Math.min(100,p.completion_rate));return <g key={p.day} data-tip={new Date(p.day+"T00:00:00").toLocaleDateString("en",{weekday:"long",day:"numeric",month:"long"})+" · "+completed+" completed · "+skipped+" skipped · "+Math.round(rate)+"% completion · "+p.active+" logged habits"}>
          <rect x={x(i)-bw/2} y={yCompleted} width={bw} height={Math.max(0,bottom-yCompleted)} rx={2} fill="var(--green)" opacity=".9"/>
          <rect x={x(i)-bw/2} y={yTotal} width={bw} height={Math.max(0,yCompleted-yTotal)} rx={2} fill="var(--rose)" opacity=".72"/>
          {i%every===0&&<text x={x(i)} y={H-16} textAnchor="middle" className="habit-axis-date">{new Date(p.day+"T00:00:00").toLocaleDateString("en",{day:"numeric",month:"short"})}</text>}
        </g>})}
        <path d={activePath} fill="none" stroke="var(--amber)" strokeWidth="2.5" strokeDasharray="5 5" strokeLinecap="round" />
        <path d={ratePath} fill="none" stroke="var(--acc)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p,i)=><g key={p.day+"-points"}><circle cx={x(i)} cy={yRate(p.completion_rate)} r={points.length>24?2.3:3.8} fill="var(--acc)" stroke="var(--card)" strokeWidth="2"/><circle cx={x(i)} cy={yCount(p.active)} r={points.length>24?1.8:2.8} fill="var(--amber)" stroke="var(--card)" strokeWidth="1.5"/></g>)}
      </svg>
    </div>
    <div className="habit-chart-stats">
      <div><span>COMPLETED CHECK-INS</span><b>{totalCompleted}</b><small>Across the selected period</small></div>
      <div><span>AVERAGE COMPLETION</span><b>{averageRate}%</b><small>Completed vs scheduled</small></div>
      <div><span>LOGGED TODAY</span><b>{latest?.active ?? 0}</b><small>{latest?.streaking ?? 0} completed today</small></div>
      <div><span>BEST DAY</span><b>{bestDay?Math.round(bestDay.completion_rate)+"%":"—"}</b><small>{bestLabel} · completion rate</small></div>
    </div>
  </div>;
}

export type Slice = { label: string; value: number; color: string };

export function Donut({ slices, center, sub, size = 170 }: { slices: Slice[]; center: string; sub: string; size?: number }) {
  const total = slices.reduce((a, s) => a + s.value, 0);
  const r = 62, c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg className="dn" width={size} height={size} viewBox="0 0 170 170" role="img" aria-label="Donut chart">
      <circle cx="85" cy="85" r={r} fill="none" stroke="var(--track)" strokeWidth={14} />
      {total > 0 && slices.map((s) => {
        const len = (s.value / total) * c;
        const el = (
          <circle key={s.label} className="seg" cx="85" cy="85" r={r} fill="none" stroke={s.color} strokeWidth={14}
            strokeDasharray={`${Math.max(0, len - 3)} ${c}`} strokeDashoffset={-offset} strokeLinecap="round"
            transform="rotate(-90 85 85)" data-tip={`${s.label}\n${Math.round((s.value / total) * 100)}%`} />
        );
        offset += len;
        return el;
      })}
      <text x="85" y="84" textAnchor="middle" fontSize="20" fontWeight="600" fill="var(--ink)">{center}</text>
      <text x="85" y="102" textAnchor="middle" fontSize="9" fill="var(--mute)" style={{ fontFamily: "var(--f-m)", textTransform: "uppercase", letterSpacing: ".06em" }}>{sub}</text>
    </svg>
  );
}

export function Gauge({ value, label }: { value: number; label: string }) {
  const pct = Math.max(0, Math.min(100, value));
  
  return (
    <svg className="gg" viewBox="0 0 200 120" role="img" aria-label={`${pct}% ${label}`}>
      <path d="M20,100 A80,80 0 0 1 180,100" fill="none" stroke="var(--track)" strokeWidth={16} strokeLinecap="round" />
      <path className="arc" d="M20,100 A80,80 0 0 1 180,100" pathLength={100} fill="none" stroke="var(--acc)" strokeWidth={16} strokeLinecap="round" strokeDasharray={`${pct} 100`} style={{ strokeDashoffset: 0 }} />
      <text x="100" y="88" textAnchor="middle" fontSize="30" fontWeight="500" fill="var(--ink)" style={{ fontFamily: "var(--f-d)" }}>{Math.round(pct)}%</text>
      <text x="100" y="108" textAnchor="middle" fontSize="9" fill="var(--mute)" style={{ fontFamily: "var(--f-m)", textTransform: "uppercase", letterSpacing: ".06em" }}>{label}</text>
      
    </svg>
  );
}

export function Rings({ rings, size = 130 }: { rings: { value: number; color: string; label: string }[]; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 130 130" role="img" aria-label="Activity rings">
      {rings.map((ring, i) => {
        const r = 56 - i * 14;
        return (
          <g key={ring.label} data-tip={`${ring.label}: ${Math.round(ring.value)}%`}>
            <circle cx="65" cy="65" r={r} fill="none" stroke="rgba(255,255,255,.14)" strokeWidth={9} />
            <circle className="arc" cx="65" cy="65" r={r} fill="none" stroke={ring.color} strokeWidth={9} strokeLinecap="round"
              pathLength={100} strokeDasharray={`${Math.max(1, Math.min(100, ring.value))} 100`} transform="rotate(-90 65 65)" />
          </g>
        );
      })}
    </svg>
  );
}

export function Spark({ values, color = "currentColor", w = 90, h = 28 }: { values: number[]; color?: string; w?: number; h?: number }) {
  const max = Math.max(1, ...values), min = Math.min(0, ...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i * (w - 4)) / Math.max(1, values.length - 1) + 2, h - 3 - ((v - min) / span) * (h - 6)] as [number, number]);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <path className="ln" pathLength={1} d={smooth(pts)} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}

/** GitHub-style activity grid; `cells` are 0–4 intensity levels, oldest first, aligned to the weekday of the first date. */
export function Heatmap({ cells, startWeekday, tips }: { cells: number[]; startWeekday: number; tips: string[] }) {
  const lead = (startWeekday + 6) % 7; // Monday first
  return (
    <div>
      <div className="hmh">{["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <span key={i}>{d}</span>)}</div>
      <div className="hm">
        {Array.from({ length: lead }, (_, i) => <i key={`g${i}`} className="gh" />)}
        {cells.map((level, i) => <i key={i} className={level ? `l${level}` : ""} style={{ "--k": i } as CSSProperties} data-tip={tips[i]} />)}
      </div>
    </div>
  );
}

export function Progress({ value, color }: { value: number; color?: string }) {
  return <div className="pbar" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} /></div>;
}

export type FlowSource = { label: string; value: number; color: string };
export type FlowTarget = { label: string; value: number; color: string };

export function FlowChart({ sources, targets, height = 230 }: {
  sources: FlowSource[]; targets: FlowTarget[]; height?: number;
}) {
  const total = Math.max(1, sources.reduce((a, s) => a + s.value, 0));
  const targetTotal = Math.max(1, targets.reduce((a, t) => a + t.value, 0));
  const W = 520, H = height;
  const sc = (H - 30) / Math.max(total, targetTotal);
  const x0 = 92, x1 = W - 92;

  let sy = 8;
  const srcNodes = sources.map((s) => {
    const h = Math.max(8, s.value * sc);
    const node = { ...s, y: sy, h };
    sy += h + 10;
    return node;
  });

  let ty = 6;
  const tgtNodes = targets.map((t) => {
    const h = Math.max(8, t.value * sc);
    const node = { ...t, y: ty, h };
    ty += h + 8;
    return node;
  });

  const sourceOffsets = sources.map(() => 0);
  const paths: { d: string; color: string; tip: string }[] = [];

  tgtNodes.forEach((t) => {
    let targetOffset = 0;
    srcNodes.forEach((s, k) => {
      const share = total > 0 ? (s.value * t.value) / (total * targetTotal) * total : 0;
      const h = Math.max(2, share * sc);
      const ya = s.y + sourceOffsets[k];
      const yb = t.y + targetOffset;
      sourceOffsets[k] += h;
      targetOffset += h;
      const xm = (x0 + x1) / 2;
      const d = `M${x0},${ya} C${xm},${ya} ${xm},${yb} ${x1},${yb} L${x1},${yb + h} C${xm},${yb + h} ${xm},${ya + h} ${x0},${ya + h} Z`;
      paths.push({
        d,
        color: s.color,
        tip: `${s.label} → ${t.label}\n₹${Math.round(share).toLocaleString("en-IN")}`,
      });
    });
  });

  return (
    <svg className="chart" viewBox={`0 0 ${W + 40} ${H}`} role="img" aria-label="Income flowing into spending categories and savings">
      {paths.map((p, i) => (
        <path key={i} className="fl" data-tip={p.tip} d={p.d} fill={p.color} fillOpacity={0.32} style={{ transition: "fill-opacity .2s" }} />
      ))}
      {srcNodes.map((s) => (
        <g key={s.label}>
          <rect x={x0 - 8} y={s.y} width={8} height={s.h} rx={4} fill={s.color} />
          <text x={x0 - 14} y={s.y + s.h / 2 + 3} textAnchor="end" fontSize="11" fill="var(--ink)">{s.label}</text>
        </g>
      ))}
      {tgtNodes.map((t) => (
        <g key={t.label}>
          <rect x={x1} y={t.y} width={8} height={t.h} rx={4} fill={t.color} />
          <text x={x1 + 14} y={t.y + t.h / 2 + 3} fontSize="11" fill="var(--ink)">{t.label} ₹{Math.round(t.value).toLocaleString("en-IN")}</text>
        </g>
      ))}
    </svg>
  );
}

export function CashflowHeatmap({ days }: { days: { date: string; net: number }[] }) {
  const cap = 15000;
  const lead = days[0] ? new Date(days[0].date + "T00:00:00Z").getUTCDay() : 0;
  return (
    <div>
      <div className="hmh">{["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <span key={i}>{d}</span>)}</div>
      <div className="hm">
        {Array.from({ length: lead }, (_, i) => <i key={`cg${i}`} className="gh" />)}
        {days.map((c, i) => {
          const m = Math.min(1, Math.sqrt(Math.abs(c.net) / cap));
          const col = c.net >= 0 ? "var(--green)" : "var(--rose)";
          const bg = c.net !== 0 ? `color-mix(in srgb, ${col} ${Math.round(25 + m * 70)}%, var(--track))` : undefined;
          return (
            <i
              key={c.date}
              style={{ "--k": i, background: bg } as CSSProperties}
              data-tip={`${new Date(c.date + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}\n${c.net >= 0 ? "+" : ""}₹${Math.round(c.net).toLocaleString("en-IN")}`}
            />
          );
        })}
      </div>
      <div className="row sm mute" style={{ marginTop: 10, gap: 14 }}>
        <span className="row" style={{ gap: 6 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: "var(--green)", display: "block" }} />Net inflow</span>
        <span className="row" style={{ gap: 6 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: "var(--rose)", display: "block" }} />Net outflow</span>
      </div>
    </div>
  );
}
