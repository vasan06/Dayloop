import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3, Bell, CalendarDays, CheckSquare, ChevronsLeft, FolderKanban, Flame, LayoutDashboard, LogOut, Moon,
  NotebookPen, Plus, Repeat, Search, Settings, Sun, Wallet, ArrowUpRight, Command,
} from "lucide-react";
import { useHabits, useMarkNotificationRead, useNotifications, useProfile, useSearch, useTasks, useEvents } from "../hooks/data";
import { initials } from "../lib/format";
import { Toaster } from "./ui";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/tasks", label: "Tasks", icon: CheckSquare },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/habits", label: "Habits", icon: Repeat },
  { to: "/finance", label: "Finance", icon: Wallet },
  { to: "/notes", label: "Notes", icon: NotebookPen },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

const safeGet = (k: string) => { try { return window.localStorage.getItem(k); } catch { return null; } };
const safeSet = (k: string, v: string) => { try { window.localStorage.setItem(k, v); } catch { /* storage unavailable */ } };

export function applyTheme(theme: string): void {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme"); else root.setAttribute("data-theme", theme);
}

export function Logo({ light = true }: { light?: boolean }) {
  return (
    <span className="logo" style={light ? undefined : { color: "var(--ink)" }}>
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="16" r="12.5" fill="none" stroke="var(--acc)" strokeWidth="4.5" />
        <path d="M16 3.5a12.5 12.5 0 0 1 12.5 12.5" fill="none" stroke="var(--amber)" strokeWidth="4.5" strokeLinecap="round" />
        <circle cx="16" cy="16" r="3.5" fill="#fff" />
      </svg>
      <span className="lab">dayloop</span>
    </span>
  );
}

export default function Shell({ onSignOut }: { onSignOut: () => void }) {
  const [collapsed, setCollapsed] = useState(() => safeGet("dl-rail") === "1");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [theme, setTheme] = useState(() => safeGet("dl-theme") ?? "light");
  const [entered, setEntered] = useState(true);
  const [booting, setBooting] = useState(true);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const profile = useProfile();
  const habits = useHabits();
  const tasks = useTasks();
  const events = useEvents();
  const notifications = useNotifications(true);
  const markNotificationRead = useMarkNotificationRead();

  useEffect(() => { applyTheme(theme); safeSet("dl-theme", theme); }, [theme]);
  useEffect(() => { safeSet("dl-rail", collapsed ? "1" : "0"); }, [collapsed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPaletteOpen((o) => !o); }
      else if (e.key === "/" && !typing) { e.preventDefault(); setPaletteOpen(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const today = new Date();
    const due = (tasks.data ?? []).filter((task) => task.status !== "completed" && task.status !== "cancelled" && task.due_at && new Date(task.due_at) <= today).map((task) => `task:${task.id}`);
    const eventsDue = (events.data ?? []).filter((event) => new Date(event.start_at) <= today && new Date(event.end_at) >= today).map((event) => `event:${event.id}`);
    const seenKey = "dayloop:notified";
    let seen: string[] = [];
    try { seen = JSON.parse(localStorage.getItem(seenKey) || "[]") as string[]; } catch { /* ignore */ }
    const fresh = [...due, ...eventsDue].filter((key) => !seen.includes(key));
    fresh.forEach((key) => {
      const [kind, id] = key.split(":");
      const item = kind === "task" ? (tasks.data ?? []).find((task) => task.id === id) : (events.data ?? []).find((event) => event.id === id);
      if (item) new Notification(kind === "task" ? "Task due" : "Event now", { body: item.title });
    });
    if (fresh.length) {
      try {
        const context = new AudioContext();
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.frequency.value = 660; gain.gain.setValueAtTime(0.04, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.22);
        oscillator.connect(gain).connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + 0.22);
      } catch { /* browser autoplay/audio policy */ }
    }
    try { localStorage.setItem(seenKey, JSON.stringify([...new Set([...seen, ...due, ...eventsDue])].slice(-200))); } catch { /* ignore */ }
  }, [tasks.data, events.data]);

  // Entry animations replay on route change only.
  useEffect(() => {
    setEntered(true);
    const t = window.setTimeout(() => setEntered(false), 1800);
    window.scrollTo({ top: 0 });
    return () => window.clearTimeout(t);
  }, [location.pathname]);

  useEffect(() => {
    const t = window.setTimeout(() => setBooting(false), 1200);
    return () => window.clearTimeout(t);
  }, []);

  const streak = Math.max(0, ...(habits.data ?? []).map((h) => h.current_streak));
  const overdue = (tasks.data ?? []).filter((t) => t.status !== "completed" && t.status !== "cancelled" && t.due_at && new Date(t.due_at) < new Date()).length;
  const name = profile.data?.username || profile.data?.display_name || "You";
  
  // Fixed title lookup with type safety and robust route matching
  const title = NAV.find((n) =>
    "end" in n && n.end
      ? location.pathname === n.to
      : location.pathname === n.to || location.pathname.startsWith(`${n.to}/`)
  )?.label ?? "DayLoop";

  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <div className="app">
      <a className="skip" href="#main" style={{ position: "absolute", left: -999 }}>Skip to content</a>
      <nav className={`rail ${collapsed ? "c" : ""}`} aria-label="Primary">
        <div className="rl">
          <Logo />
          <button className="railbtn" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setCollapsed((c) => !c)}><ChevronsLeft className="ic" /></button>
        </div>
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={"end" in n ? n.end : false} className={({ isActive }) => `nav ${isActive ? "on" : ""}`} title={n.label}>
            <n.icon className="ic" /><span className="lab">{n.label}</span>
            {n.to === "/tasks" && overdue > 0 && <span className="bdg">{overdue}</span>}
          </NavLink>
        ))}
        <div className="sp" />
        <div className="streak hide"><span className="fl"><Flame className="ic" /></span><div><b>{streak}-day streak</b><div className="sm" style={{ opacity: 0.7 }}>{streak ? "Keep the loop going" : "Check in a habit today"}</div></div></div>
        <div className="me"><span className="av">{initials(name)}</span><div className="lab" style={{ minWidth: 0, flex: 1 }}><b style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</b><span className="sm" style={{ opacity: 0.7 }}>{profile.data?.username ? `@${profile.data.username}` : ""}</span></div>
          <button className="rbtn lab" aria-label="Sign out" title="Sign out" onClick={onSignOut}><LogOut className="ic" /></button></div>
      </nav>

      <main className={`main ${entered ? "enter" : ""}`} id="main">
        <div className="bar">
          <div className="mono crumb"><span>DayLoop</span><span>/</span><b style={{ color: "var(--ink)" }}>{title}</b></div>
          <div className="sp2" />
          <button className="kbar" onClick={() => setPaletteOpen(true)} aria-label="Open command palette"><Search className="ic" /><span>Search or jump to…</span><span className="kbd" style={{ flex: "none" }}>⌘K</span></button>
          <button className="iconbtn" aria-label={`Switch to ${nextTheme} theme`} onClick={() => setTheme(nextTheme)}>{theme === "dark" ? <Sun className="ic" /> : <Moon className="ic" />}</button>
          <div style={{ position: "relative" }}><button className="iconbtn" aria-label="Notifications" onClick={async () => { setNotificationsOpen((open) => !open); if (typeof Notification !== "undefined" && Notification.permission === "default") await Notification.requestPermission(); }}><Bell className="ic" />{(notifications.data?.length ?? 0) > 0 && <i className="dot" />}</button>{notificationsOpen && <div className="menu" style={{ right: 0, minWidth: 280 }}><b style={{ display: "block", padding: "8px 12px" }}>Notifications</b>{(notifications.data ?? []).slice(0, 4).map((item) => <button key={item.id} onClick={() => markNotificationRead.mutate(item.id)}><span className="t"><b>{item.title}</b><small className="mute">{item.body}</small></span></button>)}</div>}</div>
          <button className="btn pri" onClick={() => navigate(`${location.pathname === "/" ? "/tasks" : location.pathname}?new=1`)}><Plus className="ic" />New</button>
        </div>
        <Outlet />
      </main>
      {paletteOpen && <Palette onClose={() => setPaletteOpen(false)} />}
      {booting && <div className="boot" role="status" aria-live="polite">
        <div>
          <div className="orbit" aria-hidden="true"><i /><i /><i /></div>
          <div className="bt">Setting up your workspace</div>
          <div className="msgs"><span>Syncing your tasks</span><span>Drawing your charts</span><span>Almost there</span></div>
        </div>
      </div>}
      <Toaster />
    </div>
  );
}

type Cmd = { id: string; label: string; hint: string; icon: ReactNode; run: () => void };

function Palette({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const navigate = useNavigate();
  const search = useSearch(q.trim());
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);

  const go = (to: string) => () => { navigate(to); onClose(); };
  const base: Cmd[] = useMemo(() => [
    ...NAV.map((n) => ({ id: n.to, label: `Go to ${n.label}`, hint: "Page", icon: <n.icon className="ic" />, run: go(n.to) })),
    { id: "tx", label: "Go to Transactions", hint: "Finance", icon: <Wallet className="ic" />, run: go("/transactions") },
    { id: "bg", label: "Go to Budgets", hint: "Finance", icon: <Wallet className="ic" />, run: go("/budgets") },
    { id: "st", label: "Go to Application States", hint: "Testbed", icon: <ArrowUpRight className="ic" />, run: go("/states") },
    { id: "rs", label: "Go to Responsive Showcase", hint: "Showcase", icon: <ArrowUpRight className="ic" />, run: go("/responsive") },
    { id: "nt", label: "Create task", hint: "Create", icon: <Plus className="ic" />, run: go("/tasks?new=1") },
    { id: "np", label: "Create project", hint: "Create", icon: <Plus className="ic" />, run: go("/projects?new=1") },
    { id: "nh", label: "Create habit", hint: "Create", icon: <Plus className="ic" />, run: go("/habits?new=1") },
    { id: "nn", label: "Create note", hint: "Create", icon: <Plus className="ic" />, run: go("/notes?new=1") },
    { id: "nf", label: "Add transaction", hint: "Create", icon: <Plus className="ic" />, run: go("/finance?new=1") },
    { id: "ne", label: "Add event", hint: "Create", icon: <Plus className="ic" />, run: go("/calendar?new=1") },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], []);
  const getRoute = (type: string, id: string) => {
    if (type === "task") return `/tasks/${id}`;
    if (type === "project") return `/projects/${id}`;
    if (type === "note") return `/notes?open=${id}`;
    if (type === "habit") return "/habits";
    return "/analytics";
  };
  const found: Cmd[] = (search.data ?? []).map((r) => ({ id: r.entity_type + r.id, label: r.title, hint: r.entity_type, icon: <ArrowUpRight className="ic" />, run: go(getRoute(r.entity_type, r.id)) }));
  const filtered = [...base.filter((c) => c.label.toLowerCase().includes(q.toLowerCase())), ...found].slice(0, 12);
  useEffect(() => setIdx(0), [q]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(filtered.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter") filtered[idx]?.run();
    else if (e.key === "Escape") onClose();
  };
  return (
    <div className="pal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="box" role="dialog" aria-modal="true" aria-label="Command palette" onKeyDown={onKey}>
        <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a command or search your workspace…" aria-label="Search" />
        <ul role="listbox">
          {filtered.map((c, i) => <li key={c.id} role="option" aria-selected={i === idx} className={i === idx ? "on" : ""} onMouseEnter={() => setIdx(i)} onClick={c.run}>{c.icon}<span>{c.label}</span><small>{c.hint}</small></li>)}
          {!filtered.length && <li style={{ cursor: "default" }}><span className="mute">{search.isFetching ? "Searching…" : "No matches"}</span></li>}
        </ul>
        <div className="foot"><span><Command className="ic" style={{ width: 12, height: 12, display: "inline" }} /> ↑↓ navigate</span><span>↵ open</span><span>esc close</span></div>
      </div>
    </div>
  );
}
