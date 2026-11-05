import { useMemo, useState } from "react";
import { Activity, ArrowRight, BookOpen, CalendarDays, Check, ChevronDown, CircleHelp, Flame, FolderKanban, LayoutDashboard, ListTodo, Plus, Search, Settings2, Sparkles, Wallet, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../lib/api";
import AuthGate from "./AuthGate";
import TrackerCard from "./TrackerCard";
import {
  CalendarAnalytics,
  FinanceAnalytics,
  GoalAnalytics,
  HabitAnalytics,
  NotesAnalytics,
  OverviewAnalytics,
  ProjectAnalytics,
  TaskAnalytics,
} from "./Analytics";

type Task = { id: string; title: string; status: string; priority: string; project_id?: string | null; due_at?: string | null; created_at?: string; completed_at?: string | null };
type Subtask = { id: string; title: string; status: string; priority: string };
type Project = { id: string; name: string; task_count: number; status: string };
type Habit = { id: string; name: string; schedule_type?: string; current_streak: number; completed_today: boolean; consistency_30d: number };
type Note = { id: string; title: string; updated_at: string };
type NoteBlock = { type: string; text: string };
type FinanceSummary = { income: string | number; expenses: string | number; net: string | number; month: string };
type FinanceTransaction = { id: string; transaction_type: string; amount: string | number; currency: string; description: string; transaction_date: string };
type Goal = { id: string; title: string; current_value: number; target_value?: number; unit?: string; status: string };
type Tracker = { id: string; name: string; unit?: string; metric_type: string };
type CalendarEvent = { id: string; title: string; start_at: string; end_at: string };
type Profile = { email: string | null; display_name: string | null; username: string | null; role: string | null };
type SearchResult = { id: string; title: string; entity_type: string; detail: string };
type View = "Overview" | "My tasks" | "Projects" | "Notes" | "Habits" | "Goals" | "Finance" | "Trackers" | "Calendar";

const nav = [
  { label: "Overview" as View, icon: LayoutDashboard },
  { label: "My tasks" as View, icon: ListTodo },
  { label: "Projects" as View, icon: FolderKanban },
  { label: "Notes" as View, icon: BookOpen },
  { label: "Habits" as View, icon: Flame },
];

function formatMoney(value: number | string, currency = "INR"): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(value || 0));
}

function todayLocal(): string {
  const date = new Date();
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function initial(value: string): string {
  return value.trim().slice(0, 1).toUpperCase() || "D";
}

function Sidebar({ view, navigate, profile }: { view: View; navigate: (view: View) => void; profile?: Profile }) {
  const displayName = profile?.display_name || profile?.username || "My space";
  const subtitle = profile?.role?.replaceAll("_", " ") || "Personal workspace";
  return <aside className="sidebar">
    <div className="brand-lockup"><div className="brand-mark"><span /><span /><span /></div><span className="brand-name">dayloop<span>.</span></span></div>
    <button className="workspace-switch"><span className="workspace-avatar">{initial(displayName)}</span><span className="workspace-copy"><strong>{displayName}'s space</strong><small>{subtitle}</small></span><ChevronDown size={15} /></button>
    <div className="side-label">WORKSPACE</div>
    <nav className="primary-nav">{nav.map(({ label, icon: Icon }) => <button key={label} onClick={() => navigate(label)} className={"nav-item " + (view === label ? "selected" : "")}><Icon size={17} /><span>{label}</span></button>)}</nav>
    <div className="side-label side-label-spaced">YOUR LIFE</div>
    <nav className="primary-nav"><button className={"nav-item " + (view === "Goals" ? "selected" : "")} onClick={() => navigate("Goals")}><Sparkles size={17} /><span>Goals & growth</span></button><button className={"nav-item " + (view === "Finance" ? "selected" : "")} onClick={() => navigate("Finance")}><Wallet size={17} /><span>Finances</span></button><button className={"nav-item " + (view === "Trackers" ? "selected" : "")} onClick={() => navigate("Trackers")}><Activity size={17} /><span>Trackers</span></button><button className={"nav-item " + (view === "Calendar" ? "selected" : "")} onClick={() => navigate("Calendar")}><CalendarDays size={17} /><span>Calendar</span></button></nav>
    <div className="sidebar-bottom"><div className="upgrade-note"><Sparkles size={15} /><strong>Your space, your pace</strong><p>Build a routine that works for the life you have.</p></div><button className="nav-item"><Settings2 size={17} /><span>Settings</span></button><div className="profile-row"><span className="profile-avatar">{initial(displayName)}</span><span><strong>{displayName}</strong><small>{profile?.email || subtitle}</small></span></div></div>
  </aside>;
}

function WorkspaceApp() {
  const [view, setView] = useState<View>("Overview");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskProjectId, setTaskProjectId] = useState("");
  const [taskLayout, setTaskLayout] = useState<"list" | "board">("list");
  const [projectName, setProjectName] = useState("");
  const [habitName, setHabitName] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [transactionAmount, setTransactionAmount] = useState("");
  const [transactionDescription, setTransactionDescription] = useState("");
  const [transactionType, setTransactionType] = useState("expense");
  const [goalTitle, setGoalTitle] = useState("");
  const [trackerTitle, setTrackerTitle] = useState("");
  const [eventTitle, setEventTitle] = useState("");
  const [eventStart, setEventStart] = useState("");
  const [eventEnd, setEventEnd] = useState("");
  const [selectedNote, setSelectedNote] = useState<string | null>(null);
  const [noteBlocks, setNoteBlocks] = useState<NoteBlock[]>([{ type: "paragraph", text: "" }]);
  const [notice, setNotice] = useState("");
  const [searchText, setSearchText] = useState("");
  const client = useQueryClient();
  const profileQuery = useQuery({ queryKey: ["profile"], queryFn: () => apiRequest<{ item: Profile }>("/profile") });
  const apiHealthQuery = useQuery({
    queryKey: ["api-health"],
    queryFn: () => apiRequest<{ status: string }>("/health/ready"),
    refetchInterval: 30_000,
    retry: false,
  });
  const tasksQuery = useQuery({ queryKey: ["tasks"], queryFn: () => apiRequest<{ items: Task[] }>("/tasks") });
  const projectsQuery = useQuery({ queryKey: ["projects"], queryFn: () => apiRequest<{ items: Project[] }>("/projects") });
  const habitsQuery = useQuery({ queryKey: ["habits"], queryFn: () => apiRequest<{ items: Habit[] }>("/habits") });
  const notesQuery = useQuery({ queryKey: ["notes"], queryFn: () => apiRequest<{ items: Note[] }>("/notes") });
  const financeQuery = useQuery({ queryKey: ["finance-summary"], queryFn: () => apiRequest<FinanceSummary>("/finance/summary") });
  const transactionsQuery = useQuery({ queryKey: ["transactions"], queryFn: () => apiRequest<{ items: FinanceTransaction[] }>("/finance/transactions") });
  const goalsQuery = useQuery({ queryKey: ["goals"], queryFn: () => apiRequest<{ items: Goal[] }>("/goals") });
  const trackersQuery = useQuery({ queryKey: ["trackers"], queryFn: () => apiRequest<{ items: Tracker[] }>("/trackers") });
  const eventsQuery = useQuery({ queryKey: ["calendar-events"], queryFn: () => apiRequest<{ items: CalendarEvent[] }>("/calendar/events") });
  const searchQuery = useQuery({ queryKey: ["search", searchText], queryFn: () => apiRequest<{ items: SearchResult[] }>("/search?q=" + encodeURIComponent(searchText)), enabled: searchText.trim().length >= 2 });
  const tasks = tasksQuery.data?.items ?? [];
  const projects = projectsQuery.data?.items ?? [];
  const habits = habitsQuery.data?.items ?? [];
  const notes = notesQuery.data?.items ?? [];
  const transactions = transactionsQuery.data?.items ?? [];
  const goals = goalsQuery.data?.items ?? [];
  const trackers = trackersQuery.data?.items ?? [];
  const events = eventsQuery.data?.items ?? [];
  const searchResults = searchQuery.data?.items ?? [];
  const profile = profileQuery.data?.item;
  const displayName = profile?.display_name || profile?.username || "";
  const completed = tasks.filter((task) => task.status === "completed").length;
  const pending = tasks.filter((task) => task.status !== "completed" && task.status !== "cancelled");
  const progress = tasks.length ? Math.round(completed / tasks.length * 100) : 0;
  const refresh = () => Promise.all([client.invalidateQueries({ queryKey: ["tasks"] }), client.invalidateQueries({ queryKey: ["projects"] }), client.invalidateQueries({ queryKey: ["habits"] }), client.invalidateQueries({ queryKey: ["notes"] }), client.invalidateQueries({ queryKey: ["finance-summary"] }), client.invalidateQueries({ queryKey: ["transactions"] }), client.invalidateQueries({ queryKey: ["goals"] }), client.invalidateQueries({ queryKey: ["trackers"] }), client.invalidateQueries({ queryKey: ["calendar-events"] })]);

  const addTask = useMutation({ mutationFn: (input: { title: string; projectId: string }) => apiRequest("/tasks", { method: "POST", body: JSON.stringify({ title: input.title, project_id: input.projectId || null, priority: "normal" }) }), onSuccess: () => { setTaskTitle(""); setTaskProjectId(""); setNotice("Task added"); void refresh(); } });
  const toggleTask = useMutation({ mutationFn: (task: Task) => apiRequest("/tasks/" + task.id, { method: "PATCH", body: JSON.stringify({ status: task.status === "completed" ? "not_started" : "completed" }) }), onSuccess: () => void refresh() });
  const addProject = useMutation({ mutationFn: (name: string) => apiRequest("/projects", { method: "POST", body: JSON.stringify({ name }) }), onSuccess: () => { setProjectName(""); setNotice("Project created"); void refresh(); } });
  const addHabit = useMutation({ mutationFn: (name: string) => apiRequest("/habits", { method: "POST", body: JSON.stringify({ name, schedule_type: "daily" }) }), onSuccess: () => { setHabitName(""); setNotice("Habit created"); void refresh(); } });
  const addNote = useMutation({ mutationFn: (title: string) => apiRequest<{ item: Note }>("/notes", { method: "POST", body: JSON.stringify({ title }) }), onSuccess: async (data) => { setNoteTitle(""); await refresh(); setSelectedNote(data.item.id); setNoteBlocks([{ type: "paragraph", text: "" }]); setView("Notes"); } });
  const saveNote = useMutation({ mutationFn: () => apiRequest("/notes/" + selectedNote + "/blocks", { method: "PUT", body: JSON.stringify({ blocks: noteBlocks.map((block) => ({ type: block.type, content: { text: block.text } })) }) }), onSuccess: () => setNotice("Note saved") });
  const addTransaction = useMutation({ mutationFn: () => apiRequest("/finance/transactions", { method: "POST", body: JSON.stringify({ transaction_type: transactionType, amount: transactionAmount, description: transactionDescription, currency: "INR" }) }), onSuccess: () => { setTransactionAmount(""); setTransactionDescription(""); setNotice("Transaction saved"); void refresh(); } });
  const addGoal = useMutation({ mutationFn: () => apiRequest("/goals", { method: "POST", body: JSON.stringify({ title: goalTitle }) }), onSuccess: () => { setGoalTitle(""); setNotice("Goal created"); void refresh(); } });
  const addTracker = useMutation({ mutationFn: () => apiRequest("/trackers", { method: "POST", body: JSON.stringify({ name: trackerTitle, metric_type: "number" }) }), onSuccess: () => { setTrackerTitle(""); setNotice("Tracker created"); void refresh(); } });
  const addEvent = useMutation({ mutationFn: () => apiRequest("/calendar/events", { method: "POST", body: JSON.stringify({ title: eventTitle, start_at: new Date(eventStart).toISOString(), end_at: new Date(eventEnd).toISOString() }) }), onSuccess: () => { setEventTitle(""); setEventStart(""); setEventEnd(""); setNotice("Calendar event created"); void refresh(); } });
  const selectedPage = useMemo(() => notes.find((note) => note.id === selectedNote), [notes, selectedNote]);

  async function openNote(note: Note) {
    setSelectedNote(note.id);
    const data = await apiRequest<{ item: Note; blocks: { block_type: string; content: { text?: string } }[] }>("/notes/" + note.id);
    setNoteBlocks(data.blocks.length ? data.blocks.map((block) => ({ type: block.block_type, text: block.content?.text ?? "" })) : [{ type: "paragraph", text: "" }]);
  }
  function submit(event: React.FormEvent<HTMLFormElement>, value: string, action: (value: string) => void) {
    event.preventDefault();
    if (value.trim()) action(value.trim());
  }
  function errorText(error: unknown): string {
    return error instanceof Error ? error.message : "Could not connect to DayLoop API.";
  }

  return <div className="app-shell">
    <Sidebar view={view} navigate={setView} profile={profile} />
    <main className="main-area">
      <header className="topbar"><div className="breadcrumb"><span>{displayName ? `${displayName}'s space` : "My space"}</span><span className="crumb-slash">/</span><strong>{view}</strong></div><div className="topbar-actions"><button className={"api-health " + (apiHealthQuery.isSuccess ? "connected" : apiHealthQuery.isError ? "disconnected" : "")} onClick={() => void apiHealthQuery.refetch()} title="Click to check the backend connection"><i />{apiHealthQuery.isSuccess ? "Backend connected" : apiHealthQuery.isError ? "Backend offline" : "Connecting"}</button><div className="search-wrap"><div className="search-trigger"><Search size={16} /><input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search anything" /><kbd>⌘ K</kbd></div>{searchText.trim().length >= 2 && <div className="search-results">{searchResults.map((result) => <button key={result.entity_type + result.id} onClick={() => { setView(result.entity_type === "task" ? "My tasks" : result.entity_type === "project" ? "Projects" : result.entity_type === "note" ? "Notes" : result.entity_type === "habit" ? "Habits" : "Goals"); if (result.entity_type === "note") { const page = notes.find((item) => item.id === result.id); if (page) void openNote(page); } setSearchText(""); }}><span>{result.entity_type}</span><strong>{result.title}</strong><small>{result.detail}</small></button>)}{searchResults.length === 0 && !searchQuery.isFetching && <p>No matching records.</p>}</div>}</div><button className="icon-button" aria-label="Help"><CircleHelp size={18} /></button><div className="top-avatar">{initial(displayName)}</div></div></header>
      <div className="dashboard-content">
        <section className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-dot" /> {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }).toUpperCase()}</div><h1>{view === "Overview" ? <>A little progress<br /><em>goes a long way.</em></> : <>{view}<br /><em>at your pace.</em></>}</h1><p className="welcome-subtitle">{displayName ? `Welcome, ${displayName}. Here’s your workspace today.` : "Make today feel intentional."}</p></div><div className="welcome-actions"><button className="quiet-button"><CalendarDays size={16} /> Today <ChevronDown size={14} /></button><button className="primary-button" onClick={() => document.querySelector<HTMLInputElement>("#quick-create")?.focus()}><Plus size={17} /> Quick add</button></div></section>
        {notice && <div className="notice-line">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss"><X size={14} /></button></div>}
        {(tasksQuery.isError || projectsQuery.isError || habitsQuery.isError || notesQuery.isError || financeQuery.isError || transactionsQuery.isError || goalsQuery.isError || trackersQuery.isError || eventsQuery.isError) && <div className="api-warning"><strong>Couldn’t load all workspace data.</strong> {errorText(tasksQuery.error ?? projectsQuery.error ?? habitsQuery.error ?? notesQuery.error ?? financeQuery.error ?? transactionsQuery.error ?? goalsQuery.error ?? trackersQuery.error ?? eventsQuery.error)} Check the API connection and review the affected module.</div>}
        {view === "Overview" && <>
          <section className="summary-grid">
            <article className="summary-card progress-card"><div className="card-topline"><span>ALL-TIME COMPLETION</span><span className="soft-pill">LIVE DATA</span></div><div className="progress-body"><div className="ring-wrap"><svg viewBox="0 0 112 112"><circle className="ring-track" cx="56" cy="56" r="46" /><circle className="ring-value" cx="56" cy="56" r="46" style={{ strokeDasharray: 289, strokeDashoffset: 289 * (1 - progress / 100) }} /></svg><div className="ring-center"><strong>{progress}%</strong><span>complete</span></div></div><div className="progress-copy"><strong>{completed} of {tasks.length}</strong><span>tasks completed</span><small>Updates as you finish tasks.</small></div></div></article>
            <article className="summary-card habit-card"><div className="card-topline"><span>HABITS</span><span className="card-icon habit-icon"><Flame size={17} /></span></div><div className="metric-value">{String(habits.length).padStart(2, "0")} <span>active</span></div><p className="metric-caption">Small rituals, steady momentum.</p><div className="streak-dots">{habits.slice(0, 7).map((habit) => <div className={"streak-day " + (habit.completed_today ? "filled" : "")} key={habit.id}><span>{habit.name.slice(0, 1).toUpperCase()}</span><i>{habit.completed_today && <Check size={12} />}</i></div>)}</div></article>
            <article className="summary-card focus-card"><div className="card-topline"><span>OPEN TASKS</span><span className="card-icon focus-icon"><Activity size={17} /></span></div><div className="metric-value">{String(pending.length).padStart(2, "0")} <span>to go</span></div><p className="metric-caption">One thing at a time is enough.</p><div className="focus-progress"><span style={{ width: progress + "%" }} /></div><div className="focus-foot"><span>Completion</span><strong>{progress}%</strong></div></article>
          </section>
          <section className="content-grid"><article className="surface-card priorities-card"><div className="section-heading"><div><span className="section-kicker">MAKE IT COUNT</span><h2>Today’s tasks</h2></div><button className="text-action" onClick={() => setView("My tasks")}>View all <ArrowRight size={14} /></button></div><div className="task-list">{pending.slice(0, 5).map((task) => <TaskRow key={task.id} task={task} onToggle={() => toggleTask.mutate(task)} />)}{pending.length === 0 && <p className="empty-state">Your task list is clear. Add one small priority to get started.</p>}</div><TaskForm value={taskTitle} change={setTaskTitle} projects={projects} projectId={taskProjectId} changeProject={setTaskProjectId} submit={(event) => submit(event, taskTitle, (value) => addTask.mutate({ title: value, projectId: taskProjectId }))} /></article>
            <article className="surface-card rhythm-card"><div className="section-heading"><div><span className="section-kicker">YOUR WORKSPACE</span><h2>In your orbit</h2></div><Sparkles size={17} /></div>{projects.slice(0, 4).map((project) => <div className="project-item" key={project.id}><span className="project-symbol symbol-coral">{project.name.slice(0, 1).toUpperCase()}</span><div className="project-info"><strong>{project.name}</strong><span>{project.task_count} tasks · {project.status}</span></div><ArrowRight size={15} /></div>)}{projects.length === 0 && <p className="empty-state">Your projects appear here once created.</p>}</article>
          </section>
          <OverviewAnalytics tasks={tasks} habits={habits} transactions={transactions} goals={goals} />
        </>}
        {view === "My tasks" && <section className="surface-card feature-panel">
          <div className="section-heading"><div><span className="section-kicker">YOUR NEXT STEPS</span><h2>All tasks</h2></div><span className="soft-pill">{tasks.length} TOTAL</span></div>
          <TaskForm value={taskTitle} change={setTaskTitle} projects={projects} projectId={taskProjectId} changeProject={setTaskProjectId} submit={(event) => submit(event, taskTitle, (value) => addTask.mutate({ title: value, projectId: taskProjectId }))} />
          <div className="module-chart"><TaskAnalytics tasks={tasks} /></div>
          <div className="view-toggle"><button className={taskLayout === "list" ? "active" : ""} onClick={() => setTaskLayout("list")}>List</button><button className={taskLayout === "board" ? "active" : ""} onClick={() => setTaskLayout("board")}>Board</button></div>
          {taskLayout === "board" ? <div className="task-board">{["inbox", "not_started", "in_progress", "waiting", "completed"].map((status) => <section className="board-column" key={status}><h3>{status.replace("_", " ")}</h3>{tasks.filter((task) => task.status === status).map((task) => <TaskRow key={task.id} task={task} onToggle={() => toggleTask.mutate(task)} />)}</section>)}</div> : <div className="task-list">{tasks.map((task) => <TaskRow key={task.id} task={task} onToggle={() => toggleTask.mutate(task)} />)}</div>}
          {tasks.length === 0 && <p className="empty-state">No tasks yet. Add your first task above.</p>}
        </section>}
        {view === "Projects" && <section className="surface-card feature-panel">
          <div className="section-heading"><div><span className="section-kicker">PLAN THE BIG PICTURE</span><h2>Your projects</h2></div></div>
          <form className="create-form" onSubmit={(event) => submit(event, projectName, (value) => addProject.mutate(value))}><input id="quick-create" value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="Give your project a name..." /><button className="primary-button"><Plus size={15} /> New project</button></form>
          <div className="module-chart"><ProjectAnalytics projects={projects} tasks={tasks} /></div>
          <div className="project-grid">{projects.map((project) => <article className="project-tile" key={project.id}><span className="project-symbol symbol-coral">{project.name.slice(0, 1).toUpperCase()}</span><h3>{project.name}</h3><p>{project.task_count} tasks · {project.status}</p></article>)}</div>
          {projects.length === 0 && <p className="empty-state">Create a project to group related work.</p>}
        </section>}
        {view === "Notes" && <section className="surface-card feature-panel">
          <div className="section-heading"><div><span className="section-kicker">YOUR SECOND BRAIN</span><h2>Notes & pages</h2></div></div>
          <form className="create-form" onSubmit={(event) => submit(event, noteTitle, (value) => addNote.mutate(value))}><input id="quick-create" value={noteTitle} onChange={(event) => setNoteTitle(event.target.value)} placeholder="Name your new page..." /><button className="primary-button"><Plus size={15} /> New page</button></form>
          <div className="module-chart"><NotesAnalytics notes={notes} /></div>
          <div className="notes-layout"><div className="notes-list">{notes.map((note) => <button key={note.id} className={"note-link " + (selectedNote === note.id ? "active" : "")} onClick={() => void openNote(note)}><BookOpen size={15} />{note.title}</button>)}</div><div className="note-editor">{selectedPage ? <><h3>{selectedPage.title}</h3>{noteBlocks.map((block, index) => <div className="note-block" key={index}><select value={block.type} onChange={(event) => setNoteBlocks((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, type: event.target.value } : item))}><option value="paragraph">Text</option><option value="heading">Heading</option><option value="todo">To-do</option><option value="quote">Quote</option><option value="code">Code</option><option value="callout">Callout</option><option value="divider">Divider</option></select>{block.type === "divider" ? <hr /> : <textarea value={block.text} onChange={(event) => setNoteBlocks((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, text: event.target.value } : item))} placeholder="Write a block..." /> }<button className="row-more" onClick={() => setNoteBlocks((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label="Remove block"><X size={14} /></button></div>)}<div className="note-actions"><button className="quiet-button" onClick={() => setNoteBlocks((current) => [...current, { type: "paragraph", text: "" }])}><Plus size={14} /> Add block</button><button className="primary-button" onClick={() => saveNote.mutate()} disabled={saveNote.isPending}>Save page</button></div></> : <p className="empty-state">Choose a page or create one to start writing.</p>}</div></div>
        </section>}
        {view === "Habits" && <section className="surface-card feature-panel"><div className="section-heading"><div><span className="section-kicker">SHOW UP FOR YOURSELF</span><h2>Habit practice</h2></div><span className="soft-pill">{habits.length} ACTIVE</span></div><form className="create-form" onSubmit={(event) => submit(event, habitName, (value) => addHabit.mutate(value))}><input id="quick-create" value={habitName} onChange={(event) => setHabitName(event.target.value)} placeholder="A habit you want to build..." /><button className="primary-button"><Plus size={15} /> Add habit</button></form><div className="habit-list">{habits.map((habit) => <HabitRow key={habit.id} habit={habit} onDone={async () => { await apiRequest("/habits/" + habit.id + "/entries/" + todayLocal(), { method: "PUT", body: JSON.stringify({ status: "completed" }) }); setNotice("Habit checked in for today"); void refresh(); }} />)}</div><div className="module-chart"><HabitAnalytics habits={habits} /></div>{habits.length === 0 && <p className="empty-state">Start with one habit that makes tomorrow better.</p>}</section>}
        {view === "Finance" && <section className="surface-card feature-panel"><div className="section-heading"><div><span className="section-kicker">A CLEARER VIEW OF MONEY</span><h2>Monthly finances</h2></div><span className="soft-pill">{financeQuery.data?.month ?? "THIS MONTH"}</span></div><div className="finance-summary"><div><small>INCOME</small><strong>{formatMoney(financeQuery.data?.income ?? 0)}</strong></div><div><small>EXPENSES</small><strong>{formatMoney(financeQuery.data?.expenses ?? 0)}</strong></div><div><small>NET</small><strong>{formatMoney(financeQuery.data?.net ?? 0)}</strong></div></div><div className="module-chart"><FinanceAnalytics transactions={transactions} /></div><form className="create-form finance-form" onSubmit={(event) => { event.preventDefault(); if (transactionAmount.trim()) addTransaction.mutate(); }}><select value={transactionType} onChange={(event) => setTransactionType(event.target.value)}><option value="expense">Expense</option><option value="income">Income</option></select><input type="number" min="0.01" step="0.01" value={transactionAmount} onChange={(event) => setTransactionAmount(event.target.value)} placeholder="Amount in INR" required /><input value={transactionDescription} onChange={(event) => setTransactionDescription(event.target.value)} placeholder="What was it for?" /><button className="primary-button"><Plus size={15} /> Add entry</button></form><div className="task-list">{transactions.map((item) => <div className="task-row" key={item.id}><span className={item.transaction_type === "income" ? "money-in" : "money-out"}>{item.transaction_type === "income" ? "+" : "−"}</span><div className="task-main"><strong>{item.description || item.transaction_type}</strong><span>{new Date(item.transaction_date).toLocaleDateString()}</span></div><strong className="money-value">{item.transaction_type === "income" ? "+" : "−"}{formatMoney(item.amount, item.currency)}</strong></div>)}</div>{transactions.length === 0 && <p className="empty-state">Your income and expenses will appear here as you record them.</p>}</section>}
        {view === "Goals" && <section className="surface-card feature-panel"><div className="section-heading"><div><span className="section-kicker">GIVE YOUR EFFORT A DIRECTION</span><h2>Goals & growth</h2></div></div><form className="create-form" onSubmit={(event) => { event.preventDefault(); if (goalTitle.trim()) addGoal.mutate(); }}><input value={goalTitle} onChange={(event) => setGoalTitle(event.target.value)} placeholder="What would you like to work towards?" /><button className="primary-button"><Plus size={15} /> Add goal</button></form><div className="module-chart"><GoalAnalytics goals={goals} /></div><div className="project-grid">{goals.map((goal) => <article className="project-tile" key={goal.id}><span className="section-kicker">{goal.status.toUpperCase()}</span><h3>{goal.title}</h3><div className="mini-progress"><i style={{ width: (goal.target_value ? Math.min(100, Number(goal.current_value) / Number(goal.target_value) * 100) : 0) + "%" }} /></div><p>{goal.current_value}{goal.target_value ? " / " + goal.target_value : ""} {goal.unit ?? ""}</p></article>)}</div>{goals.length === 0 && <p className="empty-state">Set a goal that gives your next steps a direction.</p>}</section>}
        {view === "Trackers" && <section className="surface-card feature-panel"><div className="section-heading"><div><span className="section-kicker">NOTICE YOUR PATTERNS</span><h2>Personal trackers</h2></div></div><form className="create-form" onSubmit={(event) => { event.preventDefault(); if (trackerTitle.trim()) addTracker.mutate(); }}><input value={trackerTitle} onChange={(event) => setTrackerTitle(event.target.value)} placeholder="Name a metric to track..." /><button className="primary-button"><Plus size={15} /> Create tracker</button></form><div className="project-grid">{trackers.map((tracker) => <TrackerCard key={tracker.id} tracker={tracker} onRecord={async () => { await apiRequest("/trackers/" + tracker.id + "/entries", { method: "POST", body: JSON.stringify({ numeric_value: 1 }) }); setNotice("Tracker entry recorded"); void refresh(); }} />)}</div>{trackers.length === 0 && <p className="empty-state">Create a tracker for a number or routine you want to understand.</p>}</section>}
        {view === "Calendar" && <section className="surface-card feature-panel">
          <div className="section-heading"><div><span className="section-kicker">MAKE SPACE FOR WHAT MATTERS</span><h2>Calendar</h2></div></div>
          <form className="create-form calendar-form" onSubmit={(event) => { event.preventDefault(); if (eventTitle.trim() && eventStart && eventEnd) addEvent.mutate(); }}><input value={eventTitle} onChange={(event) => setEventTitle(event.target.value)} placeholder="Event title" /><label>Starts<input type="datetime-local" value={eventStart} onChange={(event) => setEventStart(event.target.value)} required /></label><label>Ends<input type="datetime-local" value={eventEnd} onChange={(event) => setEventEnd(event.target.value)} required /></label><button className="primary-button"><Plus size={15} /> Add event</button></form>
          <div className="module-chart"><CalendarAnalytics events={events} /></div>
          <div className="task-list">{events.map((event) => <div className="task-row" key={event.id}><span className="calendar-mark"><CalendarDays size={16} /></span><div className="task-main"><strong>{event.title}</strong><span>{new Date(event.start_at).toLocaleString()} – {new Date(event.end_at).toLocaleTimeString()}</span></div></div>)}</div>
          {events.length === 0 && <p className="empty-state">Your events and planned time will show here.</p>}
        </section>}
        <footer className="dashboard-footer"><span>Made for the life you’re building.</span><span>DAYLOOP · FIND YOUR FLOW</span></footer>
      </div>
    </main>
  </div>;
}

function TaskForm({ value, change, submit, projects, projectId, changeProject }: { value: string; change: (value: string) => void; submit: (event: React.FormEvent<HTMLFormElement>) => void; projects: Project[]; projectId: string; changeProject: (value: string) => void }) {
  return <form className="create-form" onSubmit={submit}><input id="quick-create" value={value} onChange={(event) => change(event.target.value)} placeholder="What needs your attention?" /><select value={projectId} onChange={(event) => changeProject(event.target.value)}><option value="">No project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select><button className="primary-button"><Plus size={15} /> Add task</button></form>;
}
function TaskRow({ task, onToggle }: { task: Task; onToggle: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const client = useQueryClient();
  const subtasksQuery = useQuery({
    queryKey: ["subtasks", task.id],
    queryFn: () => apiRequest<{ items: Subtask[] }>("/tasks/" + task.id + "/subtasks"),
    enabled: expanded,
  });
  const addSubtask = useMutation({
    mutationFn: (title: string) => apiRequest("/tasks/" + task.id + "/subtasks", {
      method: "POST", body: JSON.stringify({ title }),
    }),
    onSuccess: () => {
      setSubtaskTitle("");
      void client.invalidateQueries({ queryKey: ["subtasks", task.id] });
      void client.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
  async function toggleChild(child: Subtask) {
    await apiRequest("/tasks/" + child.id, {
      method: "PATCH",
      body: JSON.stringify({ status: child.status === "completed" ? "not_started" : "completed" }),
    });
    void client.invalidateQueries({ queryKey: ["subtasks", task.id] });
    void client.invalidateQueries({ queryKey: ["tasks"] });
  }
  return <><div className={"task-row " + (task.status === "completed" ? "task-complete" : "")}>
    <button className={"task-check " + (task.status === "completed" ? "checked" : "")} onClick={onToggle} aria-label="Toggle task completion">{task.status === "completed" && <Check size={13} />}</button>
    <div className="task-main"><strong>{task.title}</strong><span>{task.priority} priority{task.due_at ? " · Due " + new Date(task.due_at).toLocaleDateString() : ""}</span></div>
    <span className="task-tag tag-sage">{task.status.replace("_", " ")}</span>
    <button className="row-more" onClick={() => setExpanded((value) => !value)} aria-label="Show subtasks"><ChevronDown size={15} /></button>
  </div>{expanded && <div className="subtask-panel">
    {(subtasksQuery.data?.items ?? []).map((child) => <div className="subtask-row" key={child.id}><button className={"task-check " + (child.status === "completed" ? "checked" : "")} onClick={() => void toggleChild(child)}>{child.status === "completed" && <Check size={11} />}</button><span className={child.status === "completed" ? "subtask-done" : ""}>{child.title}</span></div>)}
    <form onSubmit={(event) => { event.preventDefault(); if (subtaskTitle.trim()) addSubtask.mutate(subtaskTitle.trim()); }}><input value={subtaskTitle} onChange={(event) => setSubtaskTitle(event.target.value)} placeholder="Add a subtask..." /><button aria-label="Add subtask"><Plus size={13} /></button></form>
  </div>}</>;
}
function HabitRow({ habit, onDone }: { habit: Habit; onDone: () => void }) {
  return <div className="habit-row"><span className="habit-mark"><Flame size={16} /></span><div><strong>{habit.name}</strong><small>{habit.current_streak} day streak · {habit.consistency_30d}% consistency</small></div><button className="quiet-button" onClick={onDone} disabled={habit.completed_today}><Check size={14} /> {habit.completed_today ? "Done today" : "Done today"}</button></div>;
}
function App() {
  return <AuthGate><WorkspaceApp /></AuthGate>;
}

export default App;
