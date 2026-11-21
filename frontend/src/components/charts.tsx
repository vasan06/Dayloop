import { useState, type CSSProperties, type MouseEvent } from "react";
import { ChartDetail, ChartLegend, changeText, chartPosition, useChartSelection } from "./InteractiveCharts";
import { money, shortDate } from "../lib/format";
export { AxisBars as Bars, AxisLineChart as LineChart, Spark } from "./InteractiveCharts";
export type { Series } from "./InteractiveCharts";

export type HabitActivityChartPoint = {
  day: string; completed: number; skipped: number; scheduled: number; active: number; streaking: number; completion_rate: number;
};
const habitSeries = [
  { field: "completed", name: "Completed", color: "var(--green)" },
  { field: "skipped", name: "Skipped", color: "var(--rose)" },
  { field: "completion_rate", name: "Completion rate", color: "var(--acc)" },
  { field: "active", name: "Logged habits", color: "var(--amber)" },
] as const;

export function HabitProgressChart({ points, height = 310 }: { points: HabitActivityChartPoint[]; height?: number }) {
  const labels = points.map(p => shortDate(p.day));
  const state = useChartSelection(labels, habitSeries.map(s => s.name));
  const W = 900, L = 36, R = 45, T = 16, B = 28;
  const plotHeight = height - T - B;
  const maxCount = Math.max(1, ...points.map(p => Math.max(p.scheduled, p.active, p.completed + p.skipped)));
  const countStep = Math.max(1, Math.ceil(maxCount / 4));
  const slot = (W - L - R) / Math.max(1, points.length);
  const x = (i: number) => L + (i + 0.5) * slot;
  const countY = (n: number) => height - B - n / (countStep * 4) * plotHeight;
  const rateY = (n: number) => height - B - n / 100 * plotHeight;
  const alpha = (name: string) => !state.active || state.active === name ? 1 : 0.16;
  const every = Math.max(1, Math.ceil(points.length / 8));
  const totalCompleted = points.reduce((sum, p) => sum + p.completed, 0);
  const totalScheduled = points.reduce((sum, p) => sum + p.scheduled, 0);
  const latest = points[points.length - 1];
  const best = points.reduce<HabitActivityChartPoint | undefined>((prev, p) => !prev || p.completion_rate > prev.completion_rate ? p : prev, undefined);
  const index = state.selected;
  const selected = index === null ? null : points[index];

  function pick(event: MouseEvent<SVGSVGElement>) {
    const pos = chartPosition(event);
    if (!pos || !points.length) return;
    const i = Math.max(0, Math.min(points.length - 1, Math.floor((pos.x - L) / slot)));
    const target = event.target as SVGElement;
    const name = target.closest("[data-series]")?.getAttribute("data-series");
    state.select(i, name || state.active || undefined);
  }
  return <div className="habit-analytics">
    <div className="habit-chart-topline"><span className="habit-chart-eyebrow">Last {points.length} days</span></div>
    <ChartLegend items={[...habitSeries]} active={state.active} onToggle={state.toggle} />
    <svg className="chart habit-progress-chart" viewBox={`0 0 ${W} ${height}`} role="slider" tabIndex={0}
      aria-label="Daily habit activity. Use arrow keys to explore." aria-valuemin={1} aria-valuemax={Math.max(1, points.length)}
      aria-valuenow={(index ?? 0) + 1} aria-valuetext={selected ? selected.day : "Select a day"} onClick={pick} onKeyDown={state.keyDown}>
      {[0, 1, 2, 3, 4].map(tick => { const py = countY(tick * countStep); return <g key={tick}>
        <line className="gl" x1={L} x2={W - R} y1={py} y2={py} />
        <text x={L - 8} y={py + 4} textAnchor="end">{tick * countStep}</text><text x={W - R + 6} y={py + 4}>{tick * 25}%</text>
      </g>; })}
      {points.map((p, i) => {
        const bw = Math.min(18, slot * 0.64);
        return <g key={p.day}>
          <rect data-series="Completed" x={x(i) - bw / 2} y={countY(p.completed)} width={bw} height={countY(0) - countY(p.completed)}
            rx={2} fill="var(--green)" opacity={alpha("Completed")} />
          <rect data-series="Skipped" x={x(i) - bw / 2} y={countY(p.completed + p.skipped)} width={bw} height={countY(0) - countY(p.skipped)}
            rx={2} fill="var(--rose)" opacity={alpha("Skipped")} />
          {i % every === 0 && <text x={x(i)} y={height - 7} textAnchor="middle">{labels[i]}</text>}
        </g>;
      })}
      {habitSeries.slice(2).map(s => {
        const y = s.field === "active" ? countY : rateY;
        const d = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p[s.field])}`).join(" ");
        return <g key={s.name} data-series={s.name} opacity={alpha(s.name)}>
          <path d={d} fill="none" stroke="transparent" strokeWidth={12} />
          <path d={d} fill="none" stroke={s.color} strokeWidth={2.8} strokeDasharray={s.field === "active" ? "5 5" : undefined} />
          {index !== null && selected && <circle cx={x(index)} cy={y(selected[s.field])} r={4} fill={s.color} />}
        </g>;
      })}
      {index !== null && <line pointerEvents="none" className="chart-select-line" x1={x(index)} x2={x(index)} y1={T} y2={height-B} />}
    </svg>
    {selected && index !== null && <ChartDetail title={labels[index]} clear={state.clear}>
      {habitSeries.filter(s => !state.active || state.active === s.name).map(s => {
        const rate = s.field === "completion_rate";
        const prev = points[index - 1];
        const delta = prev ? selected.completion_rate - prev.completion_rate : 0;
        const change = rate && prev ? (delta ? `${delta > 0 ? "Up" : "Down"} ${Math.abs(delta)} percentage points from ${prev.completion_rate}% on ${labels[index - 1]}.` : `Unchanged since ${labels[index - 1]}.`) : changeText(points.map(p => p[s.field]), index, labels);
        return <p key={s.field}><b>{s.name} · {selected[s.field]}{rate ? "%" : ""}</b><span>{change}</span></p>;
      })}
      <p>{selected.completed} completed out of {selected.scheduled} scheduled.</p>
    </ChartDetail>}
    <div className="habit-chart-stats">
      <div><span>Completed check-ins</span><b>{totalCompleted}</b><small>Across the selected period</small></div>
      <div><span>Average completion</span><b>{totalScheduled ? Math.round(totalCompleted / totalScheduled * 100) : 0}%</b><small>Completed vs scheduled</small></div>
      <div><span>Logged today</span><b>{latest?.active ?? 0}</b><small>{latest?.completed ?? 0} completed today</small></div>
      <div><span>Best day</span><b>{best ? best.completion_rate + "%" : "—"}</b><small>{best && shortDate(best.day)}</small></div>
    </div>
  </div>;
}

export type Slice = { label: string; value: number; color: string };
export function Donut({ slices, center, sub, size = 170 }: { slices: Slice[]; center: string; sub: string; size?: number }) {
  const [label, setLabel] = useState<string | null>(null);
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const selected = slices.find(s => s.label === label);
  const percent = (v: number) => total ? Math.round(v / total * 100) : 0;
  const toggle = (name: string) => setLabel(label === name ? null : name);
  let offset = 0;
  return <div className="plot">
    <div className="plot-breakdown"><svg className="dn" width={size} height={size} viewBox="0 0 170 170" role="img" aria-label="Spending by category">
      <circle cx="85" cy="85" r="62" fill="none" stroke="var(--track)" strokeWidth={14} />
      {total > 0 && slices.map(s => {
        const len = s.value / total * 100, start = offset;
        offset += len;
        return s.value > 0 && <circle key={s.label} data-series={s.label} onClick={() => toggle(s.label)} cx="85" cy="85" r="62" pathLength={100}
          fill="none" stroke={s.color} strokeWidth={selected?.label === s.label ? 18 : 14}
          strokeDasharray={`${len} ${100 - len}`} strokeDashoffset={-start} opacity={!selected || selected.label === s.label ? 1 : 0.18}
          transform="rotate(-90 85 85)"><title>{s.label} · {money(s.value)}</title></circle>;
      })}
      <text x="85" y="84" textAnchor="middle" fontSize="18" fontWeight="600" fill="var(--ink)">{selected ? percent(selected.value) + "%" : center}</text>
      <text x="85" y="102" textAnchor="middle" fontSize="10" fill="var(--mute)">{selected ? "of spending" : sub}</text>
    </svg><ChartLegend active={selected?.label ?? null} onToggle={toggle} items={slices.map(s => ({ name: s.label, value: money(s.value), color: s.color }))} /></div>
    {selected && <ChartDetail title={selected.label} clear={() => setLabel(null)}><p>{money(selected.value)} of {center} spent this month ({percent(selected.value)}%).</p></ChartDetail>}
  </div>;
}

export function Gauge({ value, label, detail = label }: { value: number; label: string; detail?: string }) {
  const pct = Math.min(100, Math.max(0, Math.round(value)));
  const [open, setOpen] = useState(false);
  return <div className="plot">
    <button type="button" className="gauge-button" aria-label={`Inspect ${label}, ${pct}%`} aria-expanded={open} onClick={() => setOpen(!open)}>
      <svg className="gg" viewBox="0 0 200 120" aria-hidden="true">
        <path d="M20,100 A80,80 0 0 1 180,100" fill="none" stroke="var(--track)" strokeWidth={16} strokeLinecap="round" />
        {pct > 0 && <path className="arc" d="M20,100 A80,80 0 0 1 180,100" pathLength={100} fill="none" stroke="var(--acc)" strokeWidth={16} strokeLinecap="round" strokeDasharray={`${pct} 100`} />}
        <text x="100" y="88" textAnchor="middle" fontSize="30" fontWeight="500" fill="var(--ink)">{pct}%</text>
        <text x="100" y="108" textAnchor="middle" fontSize="9" fill="var(--mute)">{label}</text>
      </svg>
    </button>
    {open && <ChartDetail title={pct + "% complete"} clear={() => setOpen(false)}><p>{detail}</p></ChartDetail>}
  </div>;
}

export function Rings({ rings, size = 130 }: { rings: { value: number; color: string; label: string; detail: string }[]; size?: number }) {
  const [active, setActive] = useState<string | null>(null);
  const toggle = (name: string) => setActive(active === name ? null : name);
  const selected = rings.find(r => r.label === active);
  return <div className="plot plot-rings"><div className="plot-breakdown">
    <svg width={size} height={size} viewBox="0 0 130 130" role="img" aria-label="Activity rings">
      {rings.map((ring, i) => {
        const r = 56 - i * 14;
        return <g key={ring.label} data-series={ring.label} opacity={!selected || selected.label === ring.label ? 1 : 0.25} onClick={() => toggle(ring.label)}>
          <circle cx="65" cy="65" r={r} fill="none" stroke="rgba(255,255,255,.14)" strokeWidth={10} />
          {ring.value > 0 && <circle cx="65" cy="65" r={r} fill="none" stroke={ring.color} strokeWidth={10} strokeLinecap="round"
            pathLength={100} strokeDasharray={`${Math.min(100, ring.value)} 100`} transform="rotate(-90 65 65)" />}
        </g>;
      })}
    </svg><ChartLegend items={rings.map(r => ({ name: r.label, color: r.color }))} active={active} onToggle={toggle} /></div>
    {selected && <ChartDetail title={selected.label} clear={() => setActive(null)}><p>{Math.round(selected.value)}% · {selected.detail}</p></ChartDetail>}
  </div>;
}

export function Heatmap({ cells, startWeekday, tips, values, name = "Habit check-ins" }: {
  cells: number[]; startWeekday: number; tips: string[]; values?: number[]; name?: string;
}) {
  const labels = tips.map(t => t.split("\n")[0]);
  const state = useChartSelection(labels, [name]);
  const lead = (startWeekday + 6) % 7;
  const index = state.selected;
  return <div className="plot">
    <div><div className="hmh">{["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <span key={i}>{d}</span>)}</div>
      <div className="hm">{Array.from({ length: lead }, (_, i) => <i key={`g${i}`} className="gh" />)}
        {cells.map((level, i) => <button key={i} type="button" className="heat-cell" aria-label={`${name}, ${tips[i].replace("\n", ", ")}`}
          title={tips[i]} aria-pressed={i === index} onClick={() => i === index ? state.clear() : state.select(i)}>
          <i className={level ? `l${level}` : ""} /></button>)}
      </div></div>
    {index !== null && <ChartDetail title={name + " · " + labels[index]} clear={state.clear}><p>{tips[index].split("\n").slice(1).join(" ")}{values && <span>{changeText(values, index, labels)}</span>}</p></ChartDetail>}
  </div>;
}

export function Progress({ value, color, label = "Progress", detail }: { value: number; color?: string; label?: string; detail?: string }) {
  const [open, setOpen] = useState(false);
  const pct = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const bar = <span className="pbar" role="progressbar" aria-label={label} aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
    <i style={{ width: `${pct}%`, background: color }} /></span>;
  if (!detail) return bar;
  return <div className="plot"><button type="button" className="progress-inspect" aria-expanded={open} aria-label={`Inspect ${label}`} onClick={() => setOpen(!open)}>{bar}</button>
    {open && <ChartDetail title={label} clear={() => setOpen(false)}><p>{detail}</p></ChartDetail>}</div>;
}

export type FlowSource = { label: string; value: number; color: string };
export type FlowTarget = { label: string; value: number; color: string };

export function FlowChart({ sources, targets, height = 230 }: {
  sources: FlowSource[]; targets: FlowTarget[]; height?: number;
}) {
  const [selectedPath, setSelectedPath] = useState<number | null>(null);
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
  const paths: { d: string; color: string; source: string; target: string; share: number }[] = [];

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
      paths.push({ d, color: s.color, source: s.label, target: t.label, share });
    });
  });
  const selected = selectedPath === null ? null : paths[selectedPath];

  return <div className="plot">
    <svg className="chart flow-chart" viewBox={`0 0 ${W + 40} ${H}`} role="img" aria-label="Income flowing into spending categories and savings">
      {paths.map((p, i) => (
        <path key={i} className="fl" d={p.d} fill={p.color}
          fillOpacity={selectedPath === null || selectedPath === i ? 0.42 : 0.08}
          onClick={() => setSelectedPath(selectedPath === i ? null : i)}
          style={{ transition: "fill-opacity .2s", cursor: "pointer" }}>
          <title>{p.source} to {p.target}: ₹{Math.round(p.share).toLocaleString("en-IN")}</title>
        </path>
      ))}
      {srcNodes.map((s) => (
        <g key={s.label} opacity={!selected || selected.source === s.label ? 1 : 0.28}>
          <rect x={x0 - 8} y={s.y} width={8} height={s.h} rx={4} fill={s.color} />
          <text x={x0 - 14} y={s.y + s.h / 2 + 3} textAnchor="end" fontSize="11" fill="var(--ink)">{s.label}</text>
        </g>
      ))}
      {tgtNodes.map((t) => (
        <g key={t.label} opacity={!selected || selected.target === t.label ? 1 : 0.28}>
          <rect x={x1} y={t.y} width={8} height={t.h} rx={4} fill={t.color} />
          <text x={x1 + 14} y={t.y + t.h / 2 + 3} fontSize="11" fill="var(--ink)">{t.label} ₹{Math.round(t.value).toLocaleString("en-IN")}</text>
        </g>
      ))}
    </svg>
    {selected && <ChartDetail title={`${selected.source} → ${selected.target}`} clear={() => setSelectedPath(null)}>
      <p><b>₹{Math.round(selected.share).toLocaleString("en-IN")}</b><span>This band represents the proportional share flowing from {selected.source} into {selected.target}. Other flows are faded while this selection is active.</span></p>
    </ChartDetail>}
  </div>;
}

export function CashflowHeatmap({ days }: { days: { date: string; net: number }[] }) {
  const [selected, setSelected] = useState<number | null>(null);
  const cap = 15000;
  const lead = days[0] ? new Date(days[0].date + "T00:00:00Z").getUTCDay() : 0;
  const labels = days.map(c => new Date(c.date + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "short" }));
  const selectedDay = selected === null ? null : days[selected];
  return <div className="plot">
    <div>
      <div className="hmh">{["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <span key={i}>{d}</span>)}</div>
      <div className="hm">
        {Array.from({ length: lead }, (_, i) => <i key={`cg${i}`} className="gh" />)}
        {days.map((c, i) => {
          const m = Math.min(1, Math.sqrt(Math.abs(c.net) / cap));
          const col = c.net >= 0 ? "var(--green)" : "var(--rose)";
          const bg = c.net !== 0 ? `color-mix(in srgb, ${col} ${Math.round(25 + m * 70)}%, var(--track))` : undefined;
          return <button key={c.date} type="button" className="heat-cell"
            aria-pressed={selected === i}
            aria-label={`${labels[i]}, net cash ${c.net >= 0 ? "positive" : "negative"} ₹${Math.abs(Math.round(c.net)).toLocaleString("en-IN")}`}
            onClick={() => setSelected(selected === i ? null : i)}
            style={{ opacity: selected === null || selected === i ? 1 : 0.2 }}>
            <i style={{ "--k": i, background: bg } as CSSProperties} />
          </button>;
        })}
      </div>
    </div>
    <div className="row sm mute" style={{ gap: 14 }}>
      <span className="row" style={{ gap: 6 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: "var(--green)", display: "block" }} />Net inflow</span>
      <span className="row" style={{ gap: 6 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: "var(--rose)", display: "block" }} />Net outflow</span>
    </div>
    {selectedDay && <ChartDetail title={`Cash flow · ${labels[selected!]}`} clear={() => setSelected(null)}>
      <p><b>{selectedDay.net >= 0 ? "+" : "-"}₹{Math.abs(Math.round(selectedDay.net)).toLocaleString("en-IN")}</b>
        <span>{selectedDay.net > 0 ? "Positive because recorded inflows exceeded outflows on this day." : selectedDay.net < 0 ? "Negative because recorded outflows exceeded inflows on this day." : "Inflows and outflows were balanced, or there was no net movement."}</span>
        {selected! > 0 && <span>{changeText(days.map(d => d.net), selected!, labels, value => `${value >= 0 ? "+" : "-"}₹${Math.abs(Math.round(value)).toLocaleString("en-IN")}`)}</span>}
      </p>
    </ChartDetail>}
  </div>;
}
