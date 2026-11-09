import { useMemo, useState } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import { Card, ConfirmModal, Empty, ErrorBox, FormModal, PageHead, Check22, Skeleton, confetti, type FieldDef } from "../components/ui";
import { useCreateTask, useDeleteTask, useProjects, useTasks, useUpdateTask } from "../hooks/data";
import { useNewParam } from "../hooks/useNewParam";
import { isOpen, isOverdue, isToday } from "../lib/derive";
import { isoDate, priorityLabel, shortDate, statusLabel } from "../lib/format";
import type { Task, TaskPriority, TaskStatus } from "../lib/types";

type Tab = "open" | "today" | "overdue" | "done" | "all";
const PRI_CLASS: Record<TaskPriority, string> = { urgent: "hi", high: "hi", normal: "md", low: "lo" };
const toInput = (iso: string | null) => (iso ? isoDate(new Date(iso)) : "");
const toIso = (date: string) => (date ? new Date(`${date}T18:00:00`).toISOString() : null);

export default function Tasks() {
  const tasks = useTasks();
  const projects = useProjects();
  const create = useCreateTask();
  const update = useUpdateTask();
  const remove = useDeleteTask();
  const [isNew, closeNew, showNew] = useNewParam();
  const [tab, setTab] = useState<Tab>("open");
  const [q, setQ] = useState("");
  const [project, setProject] = useState("");
  const [editing, setEditing] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);

  const all = (tasks.data ?? []).filter((t) => !t.parent_task_id);
  const counts = { open: all.filter(isOpen).length, today: all.filter(isToday).length, overdue: all.filter(isOverdue).length, done: all.filter((t) => t.status === "completed").length, all: all.length };
  const shown = useMemo(() => all.filter((t) => {
    if (tab === "open" && !isOpen(t)) return false;
    if (tab === "today" && !isToday(t)) return false;
    if (tab === "overdue" && !isOverdue(t)) return false;
    if (tab === "done" && t.status !== "completed") return false;
    if (project && t.project_id !== project) return false;
    return !q || t.title.toLowerCase().includes(q.toLowerCase());
  }).sort((a, b) => (a.due_at ?? "9").localeCompare(b.due_at ?? "9")), [all, tab, project, q]);

  const projectName = (id: string | null) => projects.data?.find((p) => p.id === id)?.name;
  const fields = (): FieldDef[] => [
    { name: "title", label: "Title", required: true, placeholder: "What needs doing?" },
    { name: "description", label: "Notes", type: "textarea" },
    { name: "project_id", label: "Project", type: "select", options: [["", "No project"], ...(projects.data ?? []).map((p) => [p.id, p.name] as [string, string])], half: true },
    { name: "priority", label: "Priority", type: "select", options: Object.entries(priorityLabel), half: true },
    { name: "due", label: "Due date", type: "date", half: true },
    { name: "status", label: "Status", type: "select", options: Object.entries(statusLabel), half: true },
  ];
  const payload = (v: Record<string, string>) => ({ title: v.title.trim(), description: v.description, project_id: v.project_id || null, priority: v.priority as TaskPriority, status: v.status as TaskStatus, due_at: toIso(v.due) });

  return (
    <>
      <PageHead title="Tasks" sub={`${counts.open} open · ${counts.done} completed`}>
        <button className="btn pri" onClick={showNew}><Plus className="ic" />New task</button>
      </PageHead>
      <Card>
        <div className="row wrap" style={{ marginBottom: 12 }}>
          <div className="tabs" style={{ margin: 0 }}>{(["open", "today", "overdue", "done", "all"] as Tab[]).map((k) => <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{k[0].toUpperCase() + k.slice(1)} <span className="num">{counts[k]}</span></button>)}</div>
          <div style={{ flex: 1 }} />
          <select className="btn" aria-label="Filter by project" value={project} onChange={(e) => setProject(e.target.value)}><option value="">All projects</option>{(projects.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <label className="search"><Search className="ic" /><input placeholder="Filter tasks" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter tasks" /></label>
        </div>
        {tasks.isLoading ? <Skeleton rows={5} /> : tasks.isError ? <ErrorBox error={tasks.error} retry={() => void tasks.refetch()} /> : shown.length === 0 ? (
          <Empty title={all.length ? "Nothing here" : "No tasks yet"} hint={all.length ? "Try another filter." : "Capture your first task — it takes two seconds."} />
        ) : <div className="list">{shown.map((t) => (
          <div key={t.id} className={`li ${t.status === "completed" ? "done" : ""}`}>
            <Check22 on={t.status === "completed"} label={`Toggle ${t.title}`} onClick={() => { update.mutate({ id: t.id, status: t.status === "completed" ? "not_started" : "completed" }); if (t.status !== "completed") confetti(); }} />
            <button className="t" style={{ background: "none", border: 0, textAlign: "left", cursor: "pointer", padding: 0 }} onClick={() => setEditing(t)}><b>{t.title}</b>{projectName(t.project_id) && <span className="mute sm"> · {projectName(t.project_id)}</span>}</button>
            <span className={`pill ${PRI_CLASS[t.priority]}`}>{priorityLabel[t.priority]}</span>
            {t.due_at && <span className={`pill ${isOverdue(t) ? "hi" : ""}`}>{shortDate(t.due_at)}</span>}
            <button className="iconbtn" style={{ width: 32, height: 32 }} aria-label={`Delete ${t.title}`} onClick={() => setDeleting(t)}><Trash2 className="ic" style={{ width: 15, height: 15 }} /></button>
          </div>
        ))}</div>}
      </Card>

      {isNew && <FormModal title="New task" fields={fields()} initial={{ priority: "normal", status: "not_started", project_id: project }} busy={create.isPending} onClose={closeNew} onSubmit={(v) => create.mutate(payload(v), { onSuccess: closeNew })} />}
      {editing && (
        <FormModal title="Edit task" submit="Save changes" fields={fields()} busy={update.isPending} onClose={() => setEditing(null)}
          initial={{ title: editing.title, description: editing.description, project_id: editing.project_id ?? "", priority: editing.priority, status: editing.status, due: toInput(editing.due_at) }}
          onSubmit={(v) => update.mutate({ id: editing.id, ...payload(v) }, { onSuccess: () => setEditing(null) })} />
      )}
      {deleting && <ConfirmModal title="Delete task?" body={`“${deleting.title}” and its subtasks will be removed.`} onConfirm={() => remove.mutate(deleting.id)} onClose={() => setDeleting(null)} />}
    </>
  );
}
