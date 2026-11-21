import { useMemo, useState } from "react";

type Series = { name: string; values: number[]; color: string };

const niceMax = (max: number) => {
  if (max <= 1) return 1;
  const rough = max / 4;
  const power = 10 ** Math.floor(Math.log10(rough));
  const normalized = rough / power;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * power * 4;
};

export function AxisLineChart({
  labels, series, height = 220, format = (value: number) => String(value),
  yLabel = "Value", xLabel = "Date",
}: {
  labels: string[]; series: Series[]; height?: number; format?: (value: number) => string;
  yLabel?: string; xLabel?: string;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const W = 720, H = height, L = 58, R = 18, T = 38, B = 42;
  const max = niceMax(Math.max(1, ...series.flatMap((item) => item.values)));
  const x = (index: number) => L + index * (W - L - R) / Math.max(1, labels.length - 1);
  const y = (value: number) => T + (1 - value / max) * (H - T - B);
  const every = Math.max(1, Math.ceil(labels.length / 8));
  const paths = useMemo(() => series.map((item) => item.values.map((value, index) =>
    `${index ? "L" : "M"}${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(" ")), [labels, series, max, height]);

  return <div className="interactive-chart">
    <div className="chart-legend">{series.map((item) => <span key={item.name}><i style={{ background: item.color }} />{item.name}</span>)}</div>
    <svg className="chart axis-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${yLabel} by ${xLabel}`}>
      {[0,1,2,3,4].map((step) => {
        const value = max - max * step / 4;
        const py = y(value);
        return <g key={step}><line className="gl" x1={L} x2={W-R} y1={py} y2={py}/><text className="axis-y" x={L-10} y={py+4} textAnchor="end">{format(value)}</text></g>;
      })}
      <text className="axis-title" transform={`translate(13 ${T+(H-T-B)/2}) rotate(-90)`} textAnchor="middle">{yLabel}</text>
      <text className="axis-title" x={(L+W-R)/2} y={H-3} textAnchor="middle">{xLabel}</text>
      {labels.map((label,index) => index % every === 0 || index === labels.length-1 ? <text key={index} className={`axis-x ${selected===index?"selected":""}`} x={x(index)} y={H-21} textAnchor="middle" onClick={() => setSelected(index)}>{label}</text> : null)}
      {series.map((item,si) => <g key={item.name}>
        <path d={paths[si]} fill="none" stroke={item.color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"/>
        {item.values.map((value,index) => <g key={index} className="chart-hit" onClick={() => setSelected(index)}>
          <title>{`${labels[index]} · ${item.name}: ${format(value)}`}</title>
          <circle cx={x(index)} cy={y(value)} r={selected===index?5:3} fill={item.color} stroke="var(--card)" strokeWidth={2}/>
          <rect x={x(index)-10} y={T} width={20} height={H-T-B} fill="transparent"/>
        </g>)}
      </g>)}
      {selected !== null && <line className="chart-select-line" x1={x(selected)} x2={x(selected)} y1={T} y2={H-B}/>}
    </svg>
    {selected !== null && <div className="chart-filter-summary"><b>{labels[selected]}</b>{series.map((item) => <span key={item.name}>{item.name}: {format(item.values[selected] ?? 0)}</span>)}<button type="button" onClick={() => setSelected(null)}>Clear</button></div>}
  </div>;
}

export function AxisBars({
  labels, values, color = "var(--acc)", height = 210, format = (value: number) => String(value),
  yLabel = "Count", xLabel = "Date",
}: {
  labels: string[]; values: number[]; color?: string; height?: number; format?: (value: number) => string;
  yLabel?: string; xLabel?: string;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const W=520,H=height,L=52,R=14,T=24,B=42;
  const max=niceMax(Math.max(1,...values));
  const y=(value:number)=>T+(1-value/max)*(H-T-B);
  const slot=(W-L-R)/Math.max(1,values.length);
  const bw=Math.min(24,slot*.56);
  const every=Math.max(1,Math.ceil(labels.length/8));
  return <div className="interactive-chart">
    <div className="chart-legend"><span><i style={{background:color}} />{yLabel}</span></div>
    <svg className="chart axis-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${yLabel} by ${xLabel}`}>
      {[0,1,2,3,4].map((step)=>{const value=max-max*step/4;const py=y(value);return <g key={step}><line className="gl" x1={L} x2={W-R} y1={py} y2={py}/><text className="axis-y" x={L-8} y={py+4} textAnchor="end">{format(value)}</text></g>})}
      <text className="axis-title" transform={`translate(12 ${T+(H-T-B)/2}) rotate(-90)`} textAnchor="middle">{yLabel}</text>
      <text className="axis-title" x={(L+W-R)/2} y={H-3} textAnchor="middle">{xLabel}</text>
      {values.map((value,index)=>{const cx=L+slot*(index+.5);const top=y(value);return <g key={index} className={`chart-hit ${selected===index?"selected":""}`} onClick={()=>setSelected(index)}>
        <title>{`${labels[index]} · ${format(value)}`}</title>
        <rect x={cx-bw/2} y={top} width={bw} height={Math.max(0,H-B-top)} rx={6} fill={color} opacity={selected===null||selected===index?1:.35}/>
        {(index%every===0||index===labels.length-1)&&<text className={`axis-x ${selected===index?"selected":""}`} x={cx} y={H-21} textAnchor="middle">{labels[index]}</text>}
      </g>})}
    </svg>
    {selected !== null && <div className="chart-filter-summary"><b>{labels[selected]}</b><span>{yLabel}: {format(values[selected] ?? 0)}</span><button type="button" onClick={()=>setSelected(null)}>Clear</button></div>}
  </div>;
}
