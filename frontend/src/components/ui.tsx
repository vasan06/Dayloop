import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { Check, CircleAlert, X } from "lucide-react";
import type { ToastDetail } from "../lib/toast";

export function Card({ tone, className = "", i = 0, children, ...rest }: {
  tone?: "butter" | "mint" | "sky" | "blush" | "lilac" | "acc"; className?: string; i?: number; children: ReactNode;
} & React.HTMLAttributes<HTMLElement>) {
  return <section {...rest} className={`card ${tone ? `tn-${tone}` : ""} ${className}`} style={{ "--i": i, ...rest.style } as CSSProperties}>{children}</section>;
}

export function CardHead({ title, mono, right }: { title?: string; mono?: string; right?: ReactNode }) {
  return <div className="hd"><div>{mono && <div className="mono">{mono}</div>}{title && <h2>{title}</h2>}</div>{right}</div>;
}

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return <div className="seg" role="tablist">{options.map(([v, l]) => <button key={v} role="tab" aria-selected={v === value} className={v === value ? "on" : ""} onClick={() => onChange(v)}>{l}</button>)}</div>;
}

export function PageHead({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return <div className="ph"><div><h1>{title}</h1>{sub && <p className="mute">{sub}</p>}</div><div className="row wrap">{children}</div></div>;
}

export function Skeleton({ rows = 3 }: { rows?: number }) {
  return <div role="status" aria-label="Loading" style={{ display: "grid", gap: 14 }}>{Array.from({ length: rows }, (_, i) => <div key={i} className="skel" style={{ width: `${90 - i * 14}%` }} />)}</div>;
}

export function Empty({ title, hint, action }: { title: string; hint: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <svg viewBox="0 0 130 90" aria-hidden="true"><rect x="10" y="18" width="110" height="62" rx="16" fill="var(--track)" /><circle cx="42" cy="46" r="10" fill="var(--t-butter)" /><rect x="60" y="38" width="46" height="7" rx="3.5" fill="var(--line)" /><rect x="60" y="52" width="30" height="7" rx="3.5" fill="var(--line)" /></svg>
      <h3>{title}</h3><p className="mute" style={{ margin: "4px 0 14px" }}>{hint}</p>{action}
    </div>
  );
}

export function ErrorBox({ error, retry }: { error: unknown; retry?: () => void }) {
  return <div className="err" role="alert"><div className="row"><CircleAlert className="ic" /><b>Something went wrong</b></div><p className="sm" style={{ margin: "6px 0 10px" }}>{error instanceof Error ? error.message : "Please try again."}</p>{retry && <button className="btn sm" onClick={retry}>Retry</button>}</div>;
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    ref.current?.querySelector<HTMLElement>("input,select,textarea,button")?.focus();
    return () => { window.removeEventListener("keydown", onKey); prev?.focus(); };
  }, [onClose]);
  return (
    <div className="ov" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="row sb" style={{ marginBottom: 14 }}><h2 style={{ fontSize: 18 }}>{title}</h2><button className="iconbtn" aria-label="Close" onClick={onClose} style={{ width: 34, height: 34 }}><X className="ic" /></button></div>
        {children}
      </div>
    </div>
  );
}

export type FieldDef = {
  name: string; label: string; type?: "text" | "number" | "date" | "datetime-local" | "textarea" | "select";
  required?: boolean; options?: [string, string][]; placeholder?: string; half?: boolean; step?: string; min?: number;
};

/** Generic form modal: renders fields, collects values, submits as strings. */
export function FormModal({ title, fields, initial = {}, submit = "Save", busy, onSubmit, onClose }: {
  title: string; fields: FieldDef[]; initial?: Record<string, string>; submit?: string; busy?: boolean;
  onSubmit: (values: Record<string, string>) => void; onClose: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f.name, initial[f.name] ?? (f.type === "select" ? f.options?.[0]?.[0] ?? "" : "")])));
  const set = (name: string, v: string) => setValues((cur) => ({ ...cur, [name]: v }));
  const handle = (e: FormEvent) => { e.preventDefault(); onSubmit(values); };
  const rows: FieldDef[][] = [];
  for (const f of fields) {
    const last = rows[rows.length - 1];
    if (f.half && last && last.length === 1 && last[0].half) last.push(f); else rows.push([f]);
  }
  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={handle}>
        {rows.map((row) => (
          <div key={row[0].name} className={row.length > 1 ? "fr" : ""}>
            {row.map((f) => (
              <div className="field" key={f.name}>
                <label htmlFor={`f-${f.name}`}>{f.label}{f.required ? " *" : ""}</label>
                {f.type === "textarea" ? <textarea id={`f-${f.name}`} required={f.required} placeholder={f.placeholder} value={values[f.name]} onChange={(e) => set(f.name, e.target.value)} />
                  : f.type === "select" ? <select id={`f-${f.name}`} value={values[f.name]} onChange={(e) => set(f.name, e.target.value)}>{f.options?.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                  : <input id={`f-${f.name}`} type={f.type ?? "text"} required={f.required} placeholder={f.placeholder} step={f.step} min={f.min} value={values[f.name]} onChange={(e) => set(f.name, e.target.value)} />}
              </div>
            ))}
          </div>
        ))}
        <div className="row" style={{ justifyContent: "flex-end", marginTop: 6 }}>
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn pri" disabled={busy}>{busy ? "Saving…" : submit}</button>
        </div>
      </form>
    </Modal>
  );
}

export function ConfirmModal({ title, body, confirm = "Delete", onConfirm, onClose }: { title: string; body: string; confirm?: string; onConfirm: () => void; onClose: () => void }) {
  return <Modal title={title} onClose={onClose}><p className="mute" style={{ marginTop: 0 }}>{body}</p><div className="row" style={{ justifyContent: "flex-end" }}><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn bad" onClick={() => { onConfirm(); onClose(); }}>{confirm}</button></div></Modal>;
}

export function Check22({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return <button className={`chk ${on ? "on" : ""}`} aria-label={label} aria-pressed={on} onClick={onClick}><Check className="ic" /></button>;
}

export function Toaster() {
  const [list, setList] = useState<(ToastDetail & { id: number })[]>([]);
  useEffect(() => {
    let n = 0;
    const on = (e: Event) => {
      const detail = (e as CustomEvent<ToastDetail>).detail;
      const id = ++n;
      setList((cur) => [...cur.slice(-2), { ...detail, id }]);
      window.setTimeout(() => setList((cur) => cur.filter((t) => t.id !== id)), 3200);
    };
    window.addEventListener("dl-toast", on);
    return () => window.removeEventListener("dl-toast", on);
  }, []);
  return <div aria-live="polite">{list.map((t, i) => <div key={t.id} className="toast" style={{ bottom: `calc(${24 + i * 54}px + env(safe-area-inset-bottom,0px))` }}>{t.kind === "ok" ? <Check className="ic" /> : <CircleAlert className="ic" style={{ background: "var(--rose)", color: "#fff", borderRadius: "50%", padding: 3 }} />}{t.message}</div>)}</div>;
}

/** Delegated tooltips (data-tip) and card spotlight, mounted once. */
export function GlobalFx() {
  const tip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const target = (e.target as HTMLElement | null)?.closest?.("[data-tip]") as HTMLElement | null;
      const el = tip.current;
      if (el) {
        if (target) { el.textContent = target.getAttribute("data-tip"); el.style.left = `${e.clientX}px`; el.style.top = `${e.clientY}px`; el.style.opacity = "1"; }
        else el.style.opacity = "0";
      }
      const card = (e.target as HTMLElement | null)?.closest?.(".card") as HTMLElement | null;
      if (card) { const r = card.getBoundingClientRect(); card.style.setProperty("--mx", `${e.clientX - r.left}px`); card.style.setProperty("--my", `${e.clientY - r.top}px`); }
    };
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, []);
  return <div className="tip" ref={tip} role="tooltip" />;
}

export function confetti(origin?: HTMLElement | null) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const rect = origin?.getBoundingClientRect();
  const cx = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
  const cy = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
  const colors = ["#2B4CFF", "#F29A1F", "#12A366", "#E5484D", "#8B5CF6", "#FFEEB0"];
  for (let i = 0; i < 26; i++) {
    const p = document.createElement("i");
    const angle = Math.random() * Math.PI * 2, dist = 60 + Math.random() * 90;
    Object.assign(p.style, { position: "fixed", left: `${cx}px`, top: `${cy}px`, width: "7px", height: "7px", borderRadius: i % 2 ? "50%" : "2px", background: colors[i % colors.length], zIndex: "600", pointerEvents: "none" });
    document.body.appendChild(p);
    const anim = p.animate([{ transform: "translate(0,0) scale(1)", opacity: 1 }, { transform: `translate(${Math.cos(angle) * dist}px,${Math.sin(angle) * dist + 60}px) rotate(${Math.random() * 540}deg) scale(.5)`, opacity: 0 }], { duration: 800 + Math.random() * 400, easing: "cubic-bezier(.2,.8,.3,1)" });
    anim.onfinish = () => p.remove();
  }
}

export function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setValue(target); return; }
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      setValue(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}
