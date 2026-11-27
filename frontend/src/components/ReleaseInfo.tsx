import { useState } from "react";
import { ArrowUpRight, ChevronDown, GitCommitHorizontal, History, Sparkles } from "lucide-react";
import { Modal } from "./ui";
import release from "../../../release.json";
import "../styles/release-info.css";

function ReleaseMark({size = 28}: {size?: number}) { return <svg className="release-logo-mark" viewBox="0 0 32 32" width={size} height={size} aria-hidden="true"><circle className="release-logo-core" cx="16" cy="16" r="12"/><g className="release-logo-ring"><circle cx="16" cy="16" r="12.5" fill="none" stroke="#2B4CFF" strokeWidth="4.5"/><path d="M16 3.5a12.5 12.5 0 0 1 12.5 12.5" fill="none" stroke="#F29A1F" strokeWidth="4.5" strokeLinecap="round"/></g><circle cx="16" cy="16" r="3.5" fill="#FFFFFF"/></svg>; }

export default function ReleaseInfo({ about = false, compact = false, iconOnly = false, logo = false }: { about?: boolean; compact?: boolean; iconOnly?: boolean; logo?: boolean }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string[]>([release.version]);
  return <>
    <button type="button" className={`release-trigger ${compact ? "release-trigger-compact" : ""} ${iconOnly ? "release-trigger-icon" : ""} ${logo ? "release-trigger-logo" : ""}`} title="Release notes" onClick={() => setOpen(true)} aria-label={`DayLoop version ${release.version}, release history`}>
      {logo ? <ReleaseMark /> : iconOnly ? <History size={18} aria-hidden="true"/> : <GitCommitHorizontal size={15} className="release-trigger-symbol" aria-hidden="true"/>}<span className="release-trigger-label">{compact ? "DayLoop v" : about ? "App version · " : "DayLoop v"}{release.version}</span><ArrowUpRight size={13} className="release-trigger-arrow" aria-hidden="true"/>
    </button>
    {open && <Modal title="What's new in DayLoop" onClose={() => setOpen(false)}>
      <div className="release-history">
        <section className="release-hero">
          <div className="release-brand"><ReleaseMark size={32} /><span>DAYLOOP / RELEASE NOTES</span></div>
          <div className="release-version-line"><strong>v{release.version}</strong><Sparkles size={24} aria-hidden="true"/></div>
          <div className="release-meta"><span>Build {release.build}</span><span>Update test build</span><span>{release.releases.find(item=>item.version===release.version)?.status ?? "Current build"}</span></div>
        </section>
        <div className="release-history-label"><History size={16}/><h3>Release history</h3></div>
        <div className="release-timeline">
          {release.releases.map(item=>{
            const current=item.version===release.version, active=expanded.includes(item.version);
            return <section className={`release-entry ${current?"release-entry-current":""}`} key={item.version}>
              <button className="release-entry-head" aria-expanded={active} aria-controls={`release-notes-${item.version}`} onClick={()=>setExpanded(old=>active?old.filter(v=>v!==item.version):[...old,item.version])}>
                <span><b>Version {item.version}</b><small>{item.status}</small></span><ChevronDown size={17} className={active?"release-chevron-open":""}/>
              </button>
              {active&&<ul id={`release-notes-${item.version}`} className="release-changes">{item.changes.map(change=><li key={change}><span aria-hidden="true"/>{change}</li>)}</ul>}
            </section>;
          })}
        </div>
        <p className="release-footer">One workspace. Better with every loop.</p>
      </div>
    </Modal>}
  </>;
}
