import { useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import "../styles/charts.css";

export type Series = { name: string; values: number[]; color: string; details?: string[] };
type Format = (value: number) => string;
const numberFormat: Format = value => value.toLocaleString(undefined, { maximumFractionDigits: 3 });
const clamp = (value: number, max: number) => Math.max(0, Math.min(max, value));

export function chartPosition(event: MouseEvent<SVGSVGElement>) {
  const svg = event.currentTarget;
  const matrix = svg.getScreenCTM();
  if (!matrix) return null;
  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  return point.matrixTransform(matrix.inverse());
}

export function useChartSelection(labels: string[], names: string[]) {
  const [point, setPoint] = useState<{ index: number; label: string } | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const selected = point && labels[point.index] === point.label ? point.index : null;
  const active = focus && names.includes(focus) ? focus : null;
  function select(index: number, name?: string) {
    if (index < 0 || index >= labels.length) return;
    setPoint({ index, label: labels[index] });
    if (name) setFocus(name);
  }
  function toggle(name: string) { setFocus(active === name ? null : name); }
  function clear() { setPoint(null); setFocus(null); }
  function keyDown(event: KeyboardEvent<SVGSVGElement>) {
    const last = labels.length - 1;
    if (last < 0) return;
    switch (event.key) {
      case "ArrowLeft": select(clamp((selected ?? last + 1) - 1, last)); break;
      case "ArrowRight": select(clamp((selected ?? -1) + 1, last)); break;
      case "Home": select(0); break;
      case "End": select(last); break;
      case "Enter": case " ": select(selected ?? last); break;
      case "Escape": clear(); break;
      default: return;
    }
    event.preventDefault();
  }
  return { active, selected, select, toggle, clear, keyDown };
}

export function ChartLegend({ items, active, onToggle }: {
  items: { name: string; color: string; value?: string }[]; active: string | null; onToggle: (name: string) => void;
}) {
  return <div className="plot-legend" aria-label="Chart legend">{items.map(item =>
    <button key={item.name} type="button" aria-pressed={active === item.name} onClick={() => onToggle(item.name)}>
      <i style={{ background: item.color }} />{item.name}{item.value && <b>{item.value}</b>}
    </button>)}</div>;
}

export function ChartDetail({ title, children, clear }: { title: string; children: ReactNode; clear: () => void }) {
  return <div className="plot-detail"><div role="status"><strong>{title}</strong>{children}</div><button type="button" onClick={clear} aria-label="Clear chart selection">Clear</button></div>;
}

export function changeText(values: number[], index: number, labels: string[], format = numberFormat) {
  if (index === 0) return "First observation in this view.";
  const delta = values[index] - values[index - 1];
  if (delta === 0) return `Unchanged since ${labels[index - 1]}.`;
  return `${delta > 0 ? "Up" : "Down"} ${format(Math.abs(delta))} from ${format(values[index - 1])} on ${labels[index - 1]}.`;
}

type TrendProps = {
  labels: string[]; series: Series[]; height?: number; format?: Format; axisFormat?: Format;
  yLabel?: string; xLabel?: string; compare?: boolean; bar?: boolean;
  spark?: boolean; width?: number; details?: (string | null | undefined)[];
};

function TrendChart({ labels, series, height = 210, width = 620, format = numberFormat, axisFormat = format,
  yLabel = "Completions", xLabel = "Date", compare = true, bar = false, spark = false, details }: TrendProps) {
  const names = series.map(item => item.name);
  const state = useChartSelection(labels, names);
  if (!labels.length || !series.length) return <span className="sm mute">No observations yet.</span>;
  const left = spark ? 4 : 62, right = spark ? 4 : 26, top = spark ? 5 : 14, bottom = spark ? 5 : 43;
  const plotW = width - left - right, plotH = height - top - bottom;
  const values = series.flatMap(item => item.values);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const rough = (max - min || 1) / 4;
  const base = 10 ** Math.floor(Math.log10(rough));
  const rawStep = [1, 2, 5, 10].find(v => v * base >= rough)! * base;
  const step = values.every(Number.isInteger) ? Math.max(1, rawStep) : rawStep;
  const floor = spark ? min : Math.floor(min / step) * step;
  const ceiling = (spark ? max : Math.ceil(max / step) * step) || (min < 0 ? 0 : step);
  const slots = bar ? labels.length : Math.max(1, labels.length - 1);
  const offset = bar || labels.length === 1 ? plotW / (bar ? slots : 1) / 2 : 0;
  const x = (i: number) => left + offset + i * plotW / slots;
  const y = (v: number) => top + (ceiling - v) / (ceiling - floor || 1) * plotH;
  const interval = Math.max(1, Math.ceil(labels.length / (width < 400 ? 5 : 7)));
  const selected = state.selected;
  const focus = state.active;
  const show = series.filter(item => !focus || item.name === focus);

  function pick(event: MouseEvent<SVGSVGElement>) {
    const pos = chartPosition(event);
    if (!pos) return;
    const fraction = clamp((pos.x - left - offset) / plotW * slots, labels.length - 1);
    const index = Math.round(fraction);
    // Measure distance to the actual segment, even between two widely spaced observations.
    const distance = (item: Series) => {
      const a = Math.floor(fraction), b = Math.ceil(fraction);
      return Math.abs(pos.y - y(item.values[a] + (item.values[b] - item.values[a]) * (fraction - a)));
    };
    const nearest = show.reduce((best, item) => distance(item) < distance(best) ? item : best);
    const hit = (event.target as SVGElement).closest("[data-series]")?.getAttribute("data-series");
    state.select(index, hit || nearest.name);
  }

  return <div className={spark ? "plot plot-spark" : "plot"}>
    {!spark && <ChartLegend items={series} active={focus} onToggle={state.toggle} />}
    <svg className={spark ? "spark-plot" : "chart axis-chart"} viewBox={`0 0 ${width} ${height}`}
      width={spark ? width : undefined} height={spark ? height : undefined}
      role="slider" tabIndex={0} aria-label={`${names.join(" and ")} by ${xLabel}. Use left and right arrows to explore.`}
      aria-valuemin={1} aria-valuemax={labels.length} aria-valuenow={(selected ?? 0) + 1}
      aria-valuetext={selected === null ? "Select an observation" : `${labels[selected]}, ${show.map(s => s.name + " " + format(s.values[selected])).join(", ")}`}
      onClick={pick} onKeyDown={state.keyDown}>
      {!spark && Array.from({ length: Math.round((ceiling - floor) / step) + 1 }, (_, i) => {
        const v = floor + step * i;
        return <g key={i}><line className="gl" x1={left} x2={width - right} y1={y(v)} y2={y(v)} />
          <text x={left - 6} y={y(v) + 3} textAnchor="end">{axisFormat(v)}</text></g>;
      })}
      {!spark && labels.map((label, i) => i % interval === 0 || i === labels.length - 1 && (i % interval > interval / 2) ?
        <text key={i} x={x(i)} y={height - 22} textAnchor="middle">{label}</text> : null)}
      {!spark && <text className="axis-title" x={left + plotW / 2} y={height - 4} textAnchor="middle">{xLabel}</text>}
      {!spark && <text className="axis-title" x={12} y={top + plotH / 2} textAnchor="middle" transform={`rotate(-90 12 ${top + plotH / 2})`}>{yLabel}</text>}
      {selected !== null && <line className="chart-select-line" x1={x(selected)} x2={x(selected)} y1={top} y2={height - bottom} />}
      {series.map(item => <g key={item.name} data-series={item.name} opacity={!focus || item.name === focus ? 1 : 0.16}>
        {bar ? item.values.map((v, i) => {
          const bw = Math.min(26, plotW / slots * 0.6);
          return <rect key={i} x={x(i) - bw / 2} y={Math.min(y(v), y(0))} width={bw} height={Math.abs(y(v) - y(0))} rx={3}
            fill={item.color} opacity={selected === null || selected === i ? 1 : 0.3} />;
        }) : <>
          <path d={item.values.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(" ")} fill="none"
            stroke={item.color} strokeWidth={spark ? 1.8 : 2.7} strokeLinecap="round" strokeLinejoin="round" />
          {(selected !== null || item.values.length === 1) && <circle cx={x(selected ?? 0)} cy={y(item.values[selected ?? 0])}
            r={spark ? 2.5 : 4} fill={item.color} stroke="var(--card)" strokeWidth={1} />}
        </>}
      </g>)}
    </svg>
    {selected !== null && <ChartDetail title={labels[selected]} clear={state.clear}>
      {show.map(item => <p key={item.name}><b>{item.name} · {format(item.values[selected])}</b>
        {compare && <span>{changeText(item.values, selected, labels, format)}</span>}{item.details?.[selected] && <span>{item.details[selected]}</span>}</p>)}
      {details?.[selected] && <p>{details[selected]}</p>}
    </ChartDetail>}
  </div>;
}

export function AxisLineChart(props: TrendProps) { return <TrendChart {...props} />; }
export function AxisBars({ values, color = "var(--acc)", yLabel = "Count", ...props }: Omit<TrendProps, "series"> & { values: number[]; color?: string }) {
  return <TrendChart {...props} width={420} bar yLabel={yLabel} series={[{ name: yLabel, values, color }]} />;
}
export function Spark({ values, labels, name, color = "currentColor", w = 90, h = 28, format, details, compare }: {
  values: number[]; labels: string[]; name: string; color?: string; w?: number; h?: number; format?: Format; details?: (string | null | undefined)[]; compare?: boolean;
}) {
  return <TrendChart spark labels={labels} series={[{ name, values, color }]} width={w} height={h} format={format} details={details} compare={compare} />;
}
