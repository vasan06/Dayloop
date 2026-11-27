import { useState } from "react";
import { Check } from "lucide-react";
import { bannerBackground } from "../lib/projectPresets";
import { ProjectIcon } from "./ProjectIcon";
import "../styles/project-appearance.css";

type Props = { id: string; options: [string, string][]; value: string; onChange: (v: string) => void };
const category = (label: string) => label.split(" · ")[0];
const title = (label: string) => label.split(" · ")[1] || label;
const categories = (options: Props["options"]) => ["All", ...new Set(options.map(([,label]) => category(label)))];

export function ProjectBannerPicker({ id, options, value, onChange }: Props) {
  const [filter, setFilter] = useState("All");
  const selected = options.find(([key]) => key === value);
  const visible = options.filter(([,label]) => filter === "All" || category(label) === filter);
  return <div id={id} className="project-appearance">
    {value && <div className={`project-cover-current banner-${value}`} style={{background: bannerBackground(value)}}><span>{selected ? title(selected[1]) : "Current cover"}</span></div>}
    <div className="project-picker-tabs" role="group" aria-label="Cover categories">{categories(options).map(c => <button type="button" className="project-picker-tab" key={c} aria-pressed={filter === c} onClick={() => setFilter(c)}>{c}</button>)}</div>
    <div className="project-cover-grid">{visible.map(([key,label]) => <button type="button" className="project-cover-choice" key={key} aria-pressed={value === key} onClick={() => onChange(key)}>
      <span className="project-cover-sample" style={{background: bannerBackground(key)}}>{value === key && <Check size={16} className="project-choice-check"/>}</span><span>{title(label)}</span>
    </button>)}</div>
  </div>;
}

export function ProjectIconPicker({ id, options, value, onChange }: Props) {
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const shown = options.filter(([key,label]) => (filter === "All" || category(label) === filter) && (key+" "+label).toLowerCase().includes(search.trim().toLowerCase()));
  return <div id={id} className="project-appearance">
    <div className="project-icon-current"><ProjectIcon iconKey={value}/><span>{title(options.find(([key]) => key === value)?.[1] || "Current icon")}</span></div>
    <input aria-label="Search project icons" placeholder="Search icons…" value={search} onChange={e => setSearch(e.target.value)}/>
    <div className="project-picker-tabs" role="group" aria-label="Icon categories">{categories(options).map(c => <button type="button" className="project-picker-tab" key={c} aria-pressed={filter === c} onClick={() => setFilter(c)}>{c}</button>)}</div>
    <div className="project-icon-grid">{shown.map(([key,label]) => <button type="button" className="project-icon-tile" key={key} aria-label={title(label)} title={title(label)} aria-pressed={value === key} onClick={() => onChange(key)}><ProjectIcon iconKey={key} size={22}/><span>{title(label)}</span></button>)}</div>
    {!shown.length && <p className="mute sm">No matching icons.</p>}
  </div>;
}
