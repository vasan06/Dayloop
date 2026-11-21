import { Suspense, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3, Bell, CalendarDays, CheckSquare, ChevronsLeft, FolderKanban, Flame, LayoutDashboard, LogOut, Moon,
  NotebookPen, Plus, Repeat, Search, Sun, Wallet, ArrowUpRight, Command, UserCircle, PanelsTopLeft, Activity, Settings, TimerReset, CheckCheck, MessageSquare,
} from "lucide-react";
import { useDismissNotification, useMarkAllNotificationsRead, useNotificationCenter, useProfile, useSearch, useStreakOverview } from "../hooks/data";
import { toast } from "../lib/toast";
import { initials } from "../lib/format";
import { setTheme, useTheme } from "../hooks/useTheme";
import { Modal, Toaster } from "./ui";
import { AxisBars } from "./InteractiveCharts";
import { apiRequest } from "../lib/api";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/tasks", label: "Tasks", icon: CheckSquare },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/habits", label: "Habits", icon: Repeat },
  { to: "/focus", label: "Focus", icon: TimerReset },
  { to: "/trackers", label: "Trackers", icon: Activity },
  { to: "/finance", label: "Finance", icon: Wallet },
  { to: "/notes", label: "Notes", icon: NotebookPen },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
] as const;

const mobileShortcuts = new Set<string>(["/", "/tasks", "/habits", "/calendar"]);

const safeGet = (k: string) => { try { return window.localStorage.getItem(k); } catch { return null; } };
const safeSet = (k: string, v: string) => { try { window.localStorage.setItem(k, v); } catch { /* storage unavailable */ } };

export function Logo({ light = true }: { light?: boolean }) {
  return (
    <span className="logo" style={light ? undefined : { color: "var(--ink)" }}>
      <img src="/dayloop-mark.svg" alt="" width="28" height="28" />
      <span className="lab">dayloop</span>
    </span>
  );
}

export default function Shell({ onSignOut, identity }: { onSignOut: () => void; identity: string }) {
  const [collapsed, setCollapsed] = useState(() => safeGet("dl-rail") === "1");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [browseOpen, setBrowseOpen] = useState(false);
  const theme = useTheme();
  const [entered, setEntered] = useState(true);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const [permission, setPermission] = useState(() => typeof Notification === "undefined" ? "denied" : Notification.permission);
  const delivered = useRef(new Set<string>());
  const [streakOpen, setStreakOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const profile = useProfile();
  const notificationCenter = useNotificationCenter();
  const markAllRead = useMarkAllNotificationsRead();
  const dismissNotification = useDismissNotification();
  const streakOverview = useStreakOverview();

  useEffect(() => {
    if (theme === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);
  useEffect(() => { safeSet("dl-rail", collapsed ? "1" : "0"); }, [collapsed]);
  useEffect(() => {
    setProfileOpen(false);
    setBrowseOpen(false);
    setNotificationsOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    if (!profileOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      const trigger = Array.from(document.querySelectorAll(".profile-trigger")).some((node) => node.contains(target));
      if (!profileMenuRef.current?.contains(target) && !trigger) setProfileOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setProfileOpen(false); };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("pointerdown", onPointerDown); document.removeEventListener("keydown", onKeyDown); };
  }, [profileOpen]);

  useEffect(() => {
    if (!notificationsOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!notificationRef.current?.contains(event.target as Node)) setNotificationsOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setNotificationsOpen(false); };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("pointerdown", onPointerDown); document.removeEventListener("keydown", onKeyDown); };
  }, [notificationsOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing || document.querySelector('[aria-modal="true"]')) return;
      const target = e.target as HTMLElement;
      const typing = target.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(target.tagName);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPaletteOpen((o) => !o); }
      else if (e.key === "/" && !typing) { e.preventDefault(); setPaletteOpen(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const notifyFocus = async (title: string, body: string) => {
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        try {
          if ("serviceWorker" in navigator) {
            const registration = await navigator.serviceWorker.getRegistration("/");
            if (registration) {
              await registration.showNotification(title, { body, tag: "dayloop-focus", requireInteraction: true });
              return;
            }
          }
          new Notification(title, { body, tag: "dayloop-focus" });
          return;
        } catch { /* fall through to in-app toast */ }
      }
      toast(`${title}: ${body}`);
    };
    const tick = () => {
      const now = Date.now();
      const focusEnd = Number(safeGet("dayloop:focus:end") || 0);
      if (focusEnd && now >= focusEnd) {
        const mins = Number(safeGet("dayloop:focus:minutes") || 25);
        safeSet("dayloop:focus:end", "");
        try { localStorage.removeItem("dayloop:focus:end"); } catch {}
        const totalKey = `dayloop:focus:total:${new Date().toISOString().slice(0, 10)}`;
        const total = Number(safeGet(totalKey) || 0);
        safeSet(totalKey, String(total + mins * 60));
        void notifyFocus("Focus complete", `${mins} focused minutes finished.`);
      }
      const snooze = Number(safeGet("dayloop:focus:snooze") || 0);
      if (snooze && now >= snooze) {
        try { localStorage.removeItem("dayloop:focus:snooze"); } catch {}
        void notifyFocus("Snoozed reminder", "Your DayLoop reminder is due now.");
      }
      if (safeGet("dayloop:focus:alarm-armed") === "1") {
        const alarmTime = safeGet("dayloop:focus:alarm-time") || "";
        const current = new Date();
        const hhmm = `${String(current.getHours()).padStart(2, "0")}:${String(current.getMinutes()).padStart(2, "0")}`;
        const firedKey = `dayloop:focus:alarm-fired:${current.toISOString().slice(0, 10)}:${alarmTime}`;
        if (alarmTime && hhmm === alarmTime && safeGet(firedKey) !== "1") {
          safeSet(firedKey, "1");
          try { localStorage.removeItem("dayloop:focus:alarm-armed"); } catch {}
          void notifyFocus("DayLoop alarm", `Alarm for ${alarmTime}`);
        }
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (permission !== "granted") return;
    const storageKey = `dayloop:notified:${identity}`;
    try {
      const previous: unknown = JSON.parse(safeGet(storageKey) ?? "[]");
      if (Array.isArray(previous)) previous.forEach((key) => {
        if (typeof key === "string") delivered.current.add(key);
      });
    } catch { /* Start with the reminders seen in this session. */ }

    function deliver(key: string, label: string, title: string) {
      if (delivered.current.has(key)) return;
      delivered.current.add(key);
      try { new Notification(label, { body: title, tag: key }); }
      catch { toast(`${label}: ${title}`); }
    }
    function checkDue() {
      const now = Date.now();
      const previousSize = delivered.current.size;
      for (const task of notificationCenter.data?.tasks ?? []) {
        if (task.due_at && task.status !== "completed" && task.status !== "cancelled" && Date.parse(task.due_at) <= now) {
          deliver(`task:${task.id}:${task.due_at}`, "Task due", task.title);
        }
      }
      for (const event of notificationCenter.data?.events ?? []) {
        if (Date.parse(event.start_at) <= now && now < Date.parse(event.end_at)) {
          deliver(`event:${event.id}:${event.start_at}`, "Event now", event.title);
        }
      }
      if (previousSize !== delivered.current.size) safeSet(storageKey, JSON.stringify([...delivered.current]));
    }
    checkDue();
    const timer = window.setInterval(checkDue, 30_000);
    return () => window.clearInterval(timer);
  }, [identity, notificationCenter.data, permission]);

  async function enableAlerts() {
    try { setPermission(await Notification.requestPermission()); }
    catch { toast("This browser could not enable notifications.", "error"); }
  }

  async function submitFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = feedbackText.trim();
    if (!message) return;
    setFeedbackBusy(true);
    try {
      await apiRequest("/feedback", { method: "POST", body: JSON.stringify({ message, page: location.pathname }) });
      setFeedbackText("");
      setFeedbackOpen(false);
      toast("Thanks — your feedback was sent.");
    } catch (reason) {
      toast(reason instanceof Error ? reason.message : "Could not send feedback.", "error");
    } finally {
      setFeedbackBusy(false);
    }
  }

  // Entry animations replay on route change only.
  useEffect(() => {
    setEntered(true);
    const t = window.setTimeout(() => setEntered(false), 1800);
    window.scrollTo({ top: 0 });
    return () => window.clearTimeout(t);
  }, [location.pathname]);


  const streak = streakOverview.data?.combined.current ?? 0;
  const overdue = (notificationCenter.data?.tasks ?? []).filter((t) => t.status !== "completed" && t.status !== "cancelled" && t.due_at && new Date(t.due_at) < new Date()).length;
  const unreadCount = (notificationCenter.data?.items ?? []).filter((item) => !item.read_at).length;
  const name = profile.data?.username || profile.data?.display_name || "You";
  
  // Fixed title lookup with type safety and robust route matching
  const routeTitles = [
    ...NAV.map((item) => ({ path: item.to, label: item.label })),
    { path: "/transactions", label: "Transactions" },
    { path: "/budgets", label: "Budgets" },
    { path: "/profile", label: "Profile" },
    { path: "/settings", label: "Settings" },
    { path: "/states", label: "Application states" },
    { path: "/responsive", label: "Responsive showcase" },
  ];
  const title = location.pathname.startsWith("/tasks/") ? "Task details"
    : location.pathname.startsWith("/projects/") ? "Project details"
      : routeTitles.find((item) => location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(`${item.path}/`)))?.label ?? "DayLoop";

  const dark = theme === "system" ? window.matchMedia("(prefers-color-scheme: dark)").matches : theme === "dark";
  const nextTheme = dark ? "light" : "dark";

  useEffect(() => { document.title = `${title} · DayLoop`; }, [title]);

  return (
    <div className="app">
      <a className="skip" href="#main">Skip to content</a>
      <nav className={`rail ${collapsed ? "c" : ""}`} aria-label="Primary">
        <div className="rl">
          <Logo />
          <button className="railbtn" data-tour="sidebar" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setCollapsed((c) => !c)}><ChevronsLeft className="ic" /></button>
        </div>
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} data-tour={n.label.toLowerCase()} end={"end" in n ? n.end : false} className={({ isActive }) => `nav ${mobileShortcuts.has(n.to) ? "shortcut" : "secondary"} ${isActive ? "on" : ""}`} title={n.label}>
            <n.icon className="ic" /><span className="lab">{n.label}</span>
            {n.to === "/tasks" && overdue > 0 && <span className="bdg" aria-label={`${overdue} overdue tasks`}>{overdue > 99 ? "99+" : overdue}</span>}

          </NavLink>
        ))}
        <button type="button" className={`nav browse-trigger ${mobileShortcuts.has("/" + location.pathname.split("/")[1]) ? "" : "on"}`} aria-haspopup="dialog" aria-expanded={browseOpen} onClick={() => setBrowseOpen(true)}>
          <PanelsTopLeft className="ic" /><span className="lab">Browse</span>
        </button>
        <div className="sp" />
        <button type="button" className="streak" data-tour="streaks" onClick={() => setStreakOpen(true)} aria-label={`Open streak panel. Combined streak ${streak} days`}>
          <span className="fl"><Flame className="ic" /></span>
          {collapsed ? <b className="streak-collapsed-count">{streak}</b> : <div><b>{streak}-day streak</b><div className="sm" style={{ opacity: 0.7 }}>{streak ? "Keep the loop going" : "Check in a habit today"}</div></div>}
        </button>
        <div className="me">
          <button className="av profile-avatar profile-trigger" aria-label="Open profile menu" aria-expanded={profileOpen} onClick={() => setProfileOpen((open) => !open)}>{initials(name)}</button>
          <button className="profile-identity lab" onClick={() => navigate("/profile")} style={{ minWidth: 0, flex: 1 }}><b style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</b><span className="sm" style={{ opacity: 0.7 }}>{profile.data?.username ? `@${profile.data.username}` : "Your profile"}</span></button>
          {profileOpen && createPortal(
            <div ref={profileMenuRef} className="profile-menu profile-menu-portal" role="group" aria-label="Account menu" style={{ left: collapsed ? 78 : 18 }}>
              <div className="profile-menu-heading"><span className="profile-menu-avatar">{initials(name)}</span><span><b>{name}</b><small>{profile.data?.username ? "@"+profile.data.username : "Personal workspace"}</small></span></div>
              <button onClick={() => { setProfileOpen(false); navigate("/profile"); }}><UserCircle className="ic" />Profile</button>
              <button onClick={() => { setProfileOpen(false); navigate("/settings"); }}><Settings className="ic" />Settings</button>
              <button onClick={() => { setProfileOpen(false); onSignOut(); }}><LogOut className="ic" />Log out</button>
            </div>,
            document.body
          )}
        </div>
      </nav>

      <main className={`main ${entered ? "enter" : ""}`} id="main" tabIndex={-1}>
        <div className="bar">
          <div className="sp2" />
          <button className="kbar" onClick={() => setPaletteOpen(true)} aria-label="Open command palette"><Search className="ic" /><span>Search or jump to…</span><span className="kbd" style={{ flex: "none" }}>⌘K</span></button>
          <button className="iconbtn" data-tour="feedback" aria-label="Send feedback" onClick={() => setFeedbackOpen(true)}><MessageSquare className="ic" /></button>
          <button className="iconbtn mobile-profile-trigger profile-trigger" aria-label="Open profile menu" aria-expanded={profileOpen} onClick={() => setProfileOpen((open) => !open)}><UserCircle className="ic" /></button>
          <button className="iconbtn" aria-label={`Switch to ${nextTheme} theme`} onClick={() => setTheme(nextTheme)}>{dark ? <Sun className="ic" /> : <Moon className="ic" />}</button>
          <div ref={notificationRef} style={{ position: "relative" }}>
            <button className="iconbtn" data-tour="notifications" aria-label={`Notifications, ${unreadCount} unread`} onClick={() => setNotificationsOpen((open) => !open)}>
              <Bell className="ic" />
              {unreadCount > 0 && <span className="dot badge-count" aria-label={`${unreadCount} unread notifications`}>{unreadCount > 99 ? "99+" : unreadCount}</span>}
            </button>
            {notificationsOpen && <div className="notification-center" role="dialog" aria-label="Notification center">
              <div className="notification-center-head"><b>Notifications</b><button className="notification-read-all" onClick={() => markAllRead.mutate(undefined as never)} disabled={markAllRead.isPending || unreadCount === 0}><CheckCheck className="ic" />{unreadCount ? "Mark all read" : "All caught up"}</button></div>
              {permission === "default" && <button className="btn sm" onClick={() => void enableAlerts()}>Enable browser alerts</button>}
              <div className="notification-section"><b>Now</b>
                {(notificationCenter.data?.tasks ?? []).filter((task) => task.due_at && new Date(task.due_at) <= new Date()).slice(0, 8).map((task) => <button key={`task-${task.id}`} className="notification-row is-overdue" onClick={() => navigate(`/tasks/${task.id}`)}><span className="notification-kind">Due</span><span><b>{task.title}</b><small>{task.due_at ? `Overdue · ${new Date(task.due_at).toLocaleString()}` : "Due now"}</small></span></button>)}
              </div>
              <div className="notification-section"><b>Today</b>
                {(notificationCenter.data?.events ?? []).filter((event) => new Date(event.start_at).toDateString() === new Date().toDateString()).map((event) => <button key={`event-${event.id}`} className="notification-row" onClick={() => navigate("/calendar")}><span className="notification-kind">Event</span><span><b>{event.title}</b><small>{new Date(event.start_at).toLocaleTimeString()}</small></span></button>)}
                {(notificationCenter.data?.items ?? []).filter((item) => !item.read_at).slice(0, 6).map((item) => <button key={item.id} className="notification-row" onClick={() => navigate(item.click_path ?? "/")}><span className="notification-kind">Update</span><span><b>{item.title}</b><small>{item.body}</small></span><span className="notification-dismiss" role="button" aria-label={`Dismiss ${item.title}`} onClick={(event) => { event.stopPropagation(); dismissNotification.mutate(item.id); }}>×</span></button>)}
              </div>
              <div className="notification-section"><b>Upcoming</b>
                {(notificationCenter.data?.events ?? []).filter((event) => new Date(event.start_at) > new Date()).slice(0, 8).map((event) => <button key={`upcoming-${event.id}`} className="notification-row" onClick={() => navigate("/calendar")}><span className="notification-kind">Event</span><span><b>{event.title}</b><small>{new Date(event.start_at).toLocaleString()}</small></span></button>)}
              </div>
            </div>}
          </div>
        </div>
        <Suspense fallback={<div className="route-loading" role="status"><span className="orbit" aria-hidden="true"><i /><i /><i /></span><span>Loading page…</span></div>}>
          <Outlet />
        </Suspense>
      </main>
      {feedbackOpen && <Modal title="Send feedback" onClose={() => setFeedbackOpen(false)}>
        <form className="feedback-form" onSubmit={submitFeedback}>
          <p className="mute">Tell us what feels confusing, missing or harder than it should be. The current page is attached automatically.</p>
          <div className="field"><label htmlFor="feedback-message">Feedback</label><textarea id="feedback-message" rows={6} maxLength={4000} required autoFocus value={feedbackText} onChange={(event) => setFeedbackText(event.target.value)} placeholder="What should DayLoop improve?" /></div>
          <div className="row sb"><span className="mono">{location.pathname}</span><button className="btn pri" disabled={feedbackBusy || feedbackText.trim().length < 3}><MessageSquare className="ic" />{feedbackBusy ? "Sending…" : "Send feedback"}</button></div>
        </form>
      </Modal>}
      {browseOpen && <Modal title="Browse workspace" onClose={() => setBrowseOpen(false)}>
        <nav className="browse-list" aria-label="Workspace sections">
          {NAV.filter(item => !mobileShortcuts.has(item.to)).map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} onClick={() => setBrowseOpen(false)}><Icon className="ic" />{label}</NavLink>
          ))}
          <button onClick={() => { setBrowseOpen(false); setStreakOpen(true); }}><Flame className="ic" />Streak history</button>
        </nav>
      </Modal>}
      {streakOpen && <Modal title="Streak history" onClose={() => setStreakOpen(false)}>
          <p>{streak}-day combined streak</p>
          <div className="streak-summary"><div><small>Longest streak</small><b>{streakOverview.data?.longest ?? streak} days</b></div><div><small>Combined update</small><b>{streakOverview.data?.combined.last_update ?? "Today"}</b></div></div>
          {(streakOverview.data?.habits?.length ?? 0) > 0 && <div className="streak-chart"><b>Individual habit streaks</b><AxisBars labels={(streakOverview.data?.habits ?? []).map((habit) => habit.name)} values={(streakOverview.data?.habits ?? []).map((habit) => habit.current)} color="var(--amber)" height={210} yLabel="Days" xLabel="Habit" /></div>}
          <div className="streak-habit-list">
            {(streakOverview.data?.habits ?? []).map((habit) => <div className="streak-habit-row" key={habit.habit_id}><span className="fl"><Flame className="ic" /></span><div><b>{habit.name}</b><small>{habit.current} consecutive days · updated {habit.last_update}</small>{habit.break_date && <small>Last break: {habit.break_date}</small>}</div><strong>{habit.current}</strong></div>)}
            {!streakOverview.data?.habits.length && <div className="streak-empty">Create a habit to start your first streak.</div>}
          </div>
          <div className="streak-timeline"><b>Streak timeline</b>{(streakOverview.data?.events ?? []).map((event) => <div className="streak-event" key={`${event.habit_id}-${event.event_date}`}><i /><div><b>{event.event_type}</b><small>{event.event_date} · {event.reason || "Updated"}</small></div></div>)}{!streakOverview.data?.events.length && <small>No streak breaks or resumes recorded yet.</small>}</div>
      </Modal>}
      {paletteOpen && <Palette onClose={() => setPaletteOpen(false)} />}
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

  const go = (to: string) => () => { navigate(to); onClose(); };
  const base: Cmd[] = useMemo(() => [
    ...NAV.map((n) => ({ id: n.to, label: `Go to ${n.label}`, hint: "Page", icon: <n.icon className="ic" />, run: go(n.to) })),
    { id: "settings", label: "Go to Settings", hint: "Account", icon: <Settings className="ic" />, run: go("/settings") },
    { id: "tx", label: "Go to Transactions", hint: "Finance", icon: <Wallet className="ic" />, run: go("/transactions") },
    { id: "bg", label: "Go to Budgets", hint: "Finance", icon: <Wallet className="ic" />, run: go("/budgets") },
    ...(import.meta.env.DEV ? [
      { id: "st", label: "Go to Application States", hint: "Testbed", icon: <ArrowUpRight className="ic" />, run: go("/states") },
      { id: "rs", label: "Go to Responsive Showcase", hint: "Showcase", icon: <ArrowUpRight className="ic" />, run: go("/responsive") },
    ] : []),
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
    return "/projects";
  };
  const found: Cmd[] = (search.data ?? []).map((r) => ({ id: r.entity_type + r.id, label: r.title, hint: r.entity_type, icon: <ArrowUpRight className="ic" />, run: go(getRoute(r.entity_type, r.id)) }));
  const filtered = [...base.filter((c) => c.label.toLowerCase().includes(q.toLowerCase())), ...found].slice(0, 12);
  useEffect(() => setIdx(0), [q]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(filtered.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter") filtered[idx]?.run();
  };
  return (
    <Modal title="Search workspace" onClose={onClose}>
      <div className="command-list">
        <input data-initial-focus role="combobox" aria-expanded="true" aria-controls="command-results" aria-autocomplete="list" aria-activedescendant={filtered[idx] ? `command-${idx}` : undefined} onKeyDown={onKey} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search commands, tasks, notes…" aria-label="Search" />
        <ul role="listbox" id="command-results" aria-label="Search results">
          {filtered.map((c, i) => <li key={c.id} id={`command-${i}`} role="option" aria-selected={i === idx} className={i === idx ? "on" : ""} onMouseEnter={() => setIdx(i)} onClick={c.run}>{c.icon}<span>{c.label}</span><small>{c.hint}</small></li>)}
        </ul>
        {!filtered.length && <p role="status">{search.isFetching ? "Searching…" : "No matches"}</p>}
        <div className="foot"><span><Command className="ic" style={{ width: 12, height: 12, display: "inline" }} /> ↑↓ navigate</span><span>↵ open</span><span>esc close</span></div>
      </div>
    </Modal>
  );
}
