import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card, ConfirmModal, Empty, ErrorBox, FormModal, PageHead, Progress, Skeleton } from "../components/ui";
import { useCreateGoal, useCreateProject, useDeleteProject, useGoals, useProjects, useTasks, useUpdateGoal, useUpdateProject } from "../hooks/data";
import { useNewParam } from "../hooks/useNewParam";
import { projectProgress } from "../lib/derive";
import { num, shortDate, toneOf } from "../lib/format";
import type { Project } from "../lib/types";

const STATUS: [string, string][] = [["active", "Active"], ["on_hold", "On hold"], ["completed", "Completed"]];

export default function Projects() {
  const projects = useProjects();
  const tasks = useTasks();
  const goals = useGoals();
  const create = useCreateProject();
  const update = useUpdateProject();
  const remove = useDeleteProject();
  const createGoal = useCreateGoal();
  const updateGoal = useUpdateGoal();
  const [isNew, closeNew, showNew] = useNewParam();
  const [editing, setEditing] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState<Project | null>(null);
  const [goalOpen, setGoalOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const progress = useMemo(() => projectProgress(tasks.data ?? []), [tasks.data]);
  const list = (projects.data ?? []).filter((p) => filter === "all" || p.status === filter);

  const fields = [
    { name: "name", label: "Name", required: true },
    { name: "description", label: "Description", type: "textarea" as const },
    { name: "status", label: "Status", type: "select" as const, options: STATUS, half: true },
    { name: "due_date", label: "Deadline", type: "date" as const, half: true },
  ];

  return (
    <>
      <PageHead title="Projects" sub={`${projects.data?.length ?? 0} projects · ${goals.data?.length ?? 0} goals`}>
        <button className="btn" onClick={() => setGoalOpen(true)}>New goal</button>
        <button className="btn pri" onClick={showNew}><Plus className="ic" />New project</button>
      </PageHead>
      <div className="tabs">{[["all", "All"], ...STATUS].map(([k, l]) => <button key={k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>{l}</button>)}</div>
      {projects.isLoading ? <Card><Skeleton rows={4} /></Card> : projects.isError ? <ErrorBox error={projects.error} retry={() => void projects.refetch()} /> : list.length === 0 ? <Card><Empty title="No projects here" hint="Projects group related tasks and track progress." action={<button className="btn pri sm" onClick={showNew}>Create project</button>} /></Card> : (
        <div className="pc">{list.map((p, i) => {
          const pr = progress.get(p.id); const pct = pr?.total ? (pr.done / pr.total) * 100 : 0;
          return (
            <Card key={p.id} i={i}>
              <div className={`cover tn-${toneOf(p.id)}`} />
              <div className="row sb"><h3 style={{ cursor: "pointer" }} onClick={() => setEditing(p)}>{p.name}</h3><span className={`pill ${p.status === "completed" ? "ok" : p.status === "on_hold" ? "md" : "blue"}`}>{STATUS.find(([k]) => k === p.status)?.[1]}</span></div>
              <p className="mute sm" style={{ margin: "4px 0 12px" }}>{p.description || "No description"}</p>
              <Progress value={pct} />
              <div className="row sb sm mute" style={{ marginTop: 8 }}><span>{pr?.done ?? 0}/{pr?.total ?? 0} tasks</span><span>{p.due_date ? `Due ${shortDate(p.due_date)}` : "No deadline"}</span></div>
              <div className="row" style={{ marginTop: 10 }}>
                <button className="btn sm" onClick={() => setEditing(p)}>Edit</button>
                <button className="btn sm ghost" aria-label={`Archive ${p.name}`} onClick={() => setDeleting(p)}><Trash2 className="ic" style={{ width: 14, height: 14 }} />Archive</button>
              </div>
            </Card>
          );
        })}</div>
      )}

      <Card style={{ marginTop: 14 }}>
        <div className="hd"><h2>Goals</h2></div>
        {(goals.data ?? []).length === 0 ? <Empty title="No goals yet" hint="Set a target and track progress toward it." /> : <div className="list">{goals.data!.map((g) => {
          const target = num(g.target_value); const cur = num(g.current_value); const pct = target ? (cur / target) * 100 : g.status === "completed" ? 100 : 0;
          return <div key={g.id} className="li" style={{ display: "block" }}>
            <div className="row sb"><b>{g.title}</b><span className="mono">{target ? `${cur}/${target} ${g.unit ?? ""}` : g.status}</span></div>
            <Progress value={pct} />
            {target > 0 && g.status === "active" && <div className="row" style={{ marginTop: 8 }}><button className="btn sm" onClick={() => updateGoal.mutate({ id: g.id, current_value: cur + 1, ...(cur + 1 >= target ? { status: "completed" } : {}) })}>+1 progress</button></div>}
          </div>;
        })}</div>}
      </Card>

      {isNew && <FormModal title="New project" fields={fields} busy={create.isPending} onClose={closeNew} onSubmit={(v) => create.mutate({ name: v.name.trim(), description: v.description, status: v.status as Project["status"], ...(v.due_date ? { due_date: v.due_date } : {}) }, { onSuccess: closeNew })} />}
      {editing && <FormModal title="Edit project" submit="Save changes" fields={fields} busy={update.isPending} onClose={() => setEditing(null)} initial={{ name: editing.name, description: editing.description, status: editing.status, due_date: editing.due_date?.slice(0, 10) ?? "" }} onSubmit={(v) => update.mutate({ id: editing.id, name: v.name.trim(), description: v.description, status: v.status as Project["status"], ...(v.due_date ? { due_date: v.due_date } : {}) }, { onSuccess: () => setEditing(null) })} />}
      {deleting && <ConfirmModal title="Archive project?" body={`“${deleting.name}” will be hidden. Its tasks stay in your task list.`} confirm="Archive" onConfirm={() => remove.mutate(deleting.id)} onClose={() => setDeleting(null)} />}
      {goalOpen && <FormModal title="New goal" busy={createGoal.isPending} onClose={() => setGoalOpen(false)} fields={[{ name: "title", label: "Goal", required: true }, { name: "goal_type", label: "Type", type: "select", options: ["personal", "learning", "health", "finance", "career"].map((x) => [x, x[0].toUpperCase() + x.slice(1)] as [string, string]), half: true }, { name: "target_date", label: "Target date", type: "date", half: true }, { name: "target_value", label: "Target", type: "number", step: "any", half: true }, { name: "unit", label: "Unit", half: true }]} onSubmit={(v) => createGoal.mutate({ title: v.title.trim(), goal_type: v.goal_type, target_value: v.target_value ? Number(v.target_value) : null, unit: v.unit || null, target_date: v.target_date || null }, { onSuccess: () => setGoalOpen(false) })} />}
    </>
  );
}
