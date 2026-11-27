import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import "../styles/guided-tour.css";
export type TourStep = { title: string; body: string; target: string };
type Rect = { x: number; y: number; w: number; h: number };
type Props = { step: TourStep; index: number; total: number; busy: boolean; error: string; onNext: () => void; onBack: () => void; onSkip: () => void };
const clamp = (n:number, lo:number, hi:number) => Math.max(lo, Math.min(n, Math.max(lo,hi)));
export function placeTour(t:Rect|null,w:number,h:number,vw:number,vh:number) {
  const m=12,gap=20;
  if(!t)return {x:Math.max(m,(vw-w)/2),y:Math.max(m,(vh-h)/2)};
  const cx=clamp(t.x+(t.w-w)/2,m,vw-w-m),cy=clamp(t.y+(t.h-h)/2,m,vh-h-m);
  const candidates=[{x:t.x+t.w+gap,y:cy},{x:t.x-w-gap,y:cy},{x:cx,y:t.y+t.h+gap},{x:cx,y:t.y-h-gap}];
  return candidates.find(p=>p.x>=m&&p.y>=m&&p.x+w<=vw-m&&p.y+h<=vh-m)??{x:cx,y:t.y+t.h/2<vh/2?Math.max(m,vh-h-m):m};
}
function visible(el:HTMLElement) {
  const r=el.getBoundingClientRect();
  return el.getClientRects().length>0&&r.width>0&&r.height>0&&getComputedStyle(el).visibility!=="hidden";
}
export default function GuidedTour({step,index,total,busy,error,onNext,onBack,onSkip}:Props) {
  const card=useRef<HTMLElement>(null);
  const [layout,setLayout]=useState<{target:Rect|null;fallback:boolean;w:number;h:number;vw:number;vh:number}>({target:null,fallback:false,w:320,h:220,vw:window.innerWidth,vh:window.innerHeight});
  useLayoutEffect(()=>{
    let frame=0,disposed=false,lastTarget:HTMLElement|undefined,browseRequested=false;
    const update=()=>{
      if(disposed)return;
      const matches=Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${step.target}"]`));
      const primary=matches.find(el=>visible(el)&&!el.closest(".dl-tour-browse-panel"));
      const inBrowse=matches.find(el=>visible(el)&&!!el.closest(".dl-tour-browse-panel"));
      const backup=Array.from(document.querySelectorAll<HTMLElement>('[data-tour="browse"]')).find(visible);
      const wantsBrowse=!!backup&&(!primary)&&step.target!=="sidebar";
      if(wantsBrowse!==browseRequested){
        browseRequested=wantsBrowse;
        window.dispatchEvent(new CustomEvent("dayloop:tour-browse",{detail:wantsBrowse}));
      }
      const actual=primary??(wantsBrowse?inBrowse:undefined);
      const el=actual??backup;
      if(el!==lastTarget){lastTarget=el;el?.scrollIntoView({block:"nearest",inline:"nearest",behavior:"instant"});}
      const r=el?.getBoundingClientRect(),vw=window.innerWidth,vh=window.innerHeight;
      const x=r?Math.max(4,r.left-5):0,y=r?Math.max(4,r.top-5):0;
      const target=r&&r.bottom>0&&r.top<vh&&r.right>0&&r.left<vw?{x,y,w:Math.min(vw-4,r.right+5)-x,h:Math.min(vh-4,r.bottom+5)-y}:null;
      const measured=card.current?.getBoundingClientRect();
      const next={target,fallback:!actual&&!!backup,w:measured?.width??320,h:measured?.height??220,vw,vh};
      setLayout(old=>JSON.stringify(old)===JSON.stringify(next)?old:next);
      frame=requestAnimationFrame(update);
    };
    update();return()=>{disposed=true;cancelAnimationFrame(frame);window.dispatchEvent(new CustomEvent("dayloop:tour-browse",{detail:false}));};
  },[step.target]);
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null;
    const root=document.getElementById("root"),prior=root?.inert;
    if(root)root.inert=true;
    card.current?.focus();
    return()=>{if(root)root.inert=prior??false;previous?.focus();};
  },[]);
  const pos=placeTour(layout.target,layout.w,layout.h,layout.vw,layout.vh),t=layout.target;
  const direction=t?(pos.y>=t.y+t.h?"↑":pos.y+layout.h<=t.y?"↓":pos.x>=t.x+t.w?"←":pos.x+layout.w<=t.x?"→":""):"";
  return createPortal(<div className="dl-tour" role="dialog" aria-modal="true" aria-labelledby="dl-tour-title" onKeyDown={e=>{
    if(e.key==="Escape"&&!busy){e.preventDefault();onSkip();}
    if(e.key==="Tab"){const buttons=Array.from(card.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")??[]);if(!buttons.length){e.preventDefault();return;}const first=buttons[0],last=buttons[buttons.length-1];if(e.shiftKey&&(document.activeElement===first||document.activeElement===card.current)){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
  }}>
    <svg className="dl-tour-shade" width="100%" height="100%" aria-hidden="true">
      <defs><mask id="dl-tour-mask"><rect width="100%" height="100%" fill="white"/>{t&&<rect x={t.x} y={t.y} width={t.w} height={t.h} rx="12" fill="black"/>}</mask></defs>
      <rect width="100%" height="100%" fill="rgba(8,12,24,.72)" mask="url(#dl-tour-mask)"/>
      {t&&<rect className="dl-tour-ring" x={t.x} y={t.y} width={t.w} height={t.h} rx="12" fill="none"/>}
    </svg>
    <section ref={card} tabIndex={-1} className="dl-tour-card" style={{left:pos.x,top:pos.y}}>
      <div className="dl-tour-head"><img src="/dayloop-mark.svg" alt="" width="24" height="24"/><span>DAYLOOP TOUR · {index+1}/{total}</span>{direction&&<span className="dl-tour-direction" aria-hidden="true">{direction}</span>}<button className="dl-tour-close" aria-label="Skip tour" disabled={busy} onClick={onSkip}><X size={18}/></button></div>
      <div className="dl-tour-progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={index+1}><i style={{width:`${(index+1)/total*100}%`}}/></div>
      <div key={step.target} className="dl-tour-copy" aria-live="polite"><h2 id="dl-tour-title">{step.title}</h2><p>{layout.fallback?(step.target==="sidebar"?"On smaller screens, use Browse to access the workspace.":`Open Browse to find ${step.title}. ${step.body}`):step.body}</p></div>
      {error&&<p role="alert" className="err">{error}</p>}
      <div className="dl-tour-actions"><button className="btn" onClick={onBack} disabled={busy||index===0}><ArrowLeft size={16}/> Back</button><button className="btn pri" onClick={onNext} disabled={busy}>{index===total-1?"Finish":"Next"}{index===total-1?<Check size={16}/>:<ArrowRight size={16}/>}</button></div>
    </section>
  </div>,document.body);
}
