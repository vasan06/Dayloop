import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { Card, ConfirmModal, Empty, ErrorBox, FormModal, PageHead, Progress, Skeleton, confetti } from "../components/ui";
import { Goals } from "../components/Goals";
import { useCreateProject, useDeleteProject, useGoals, useProjects, useTasks, useUpdateProject } from "../hooks/data";
import { useNewParam } from "../hooks/useNewParam";
import { projectProgress } from "../lib/derive";
import { shortDate } from "../lib/format";
import type { Project } from "../lib/types";
import { BANNER_PRESETS, PROJECT_ICONS, bannerBackground } from "../lib/projectPresets";
import { ProjectIcon } from "../components/ProjectIcon";

const STATUS: [string, string][] = [["active", "Active"], ["on_hold", "On hold"], ["completed", "Completed"]];
const BANNERS: [string,string][] = BANNER_PRESETS.map((preset) => [preset.id, `${preset.category} · ${preset.name}`]);

export default function Projects() {
  const projects = useProjects();
  const tasks = useTasks();
  const goals = useGoals();
  const create = useCreateProject();
  const update = useUpdateProject();
  const remove = useDeleteProject();
  const [isNew, closeNew, showNew] = useNewParam();
  const [editing, setEditing] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState<Project | null>(null);
  const [goalOpen, closeGoal, showGoal] = useNewParam("goal");
  const [filter, setFilter] = useState("all");
  const progress = useMemo(() => projectProgress(tasks.data ?? []), [tasks.data]);
  const list = (projects.data ?? []).filter((p) => filter === "all" || p.status === filter);

  const fields = [
    { name: "name", label: "Name", required: true },
    { name: "description", label: "Description", type: "textarea" as const },
    { name: "banner_key", label: "Project banner", type: "banner" as const, options: BANNERS },
    { name: "icon_key", label: "Project icon", type: "icon" as const, options: PROJECT_ICONS },
    { name: "status", label: "Status", type: "select" as const, options: STATUS, half: true },
    { name: "due_date", label: "Deadline", type: "date" as const, half: true },
  ];

  return (
    <>
      <PageHead title="Projects" sub={`${projects.data?.length ?? 0} projects · ${goals.data?.length ?? 0} goals`}>
        <button className="btn" onClick={showGoal}>New goal</button>
        <button className="btn pri" onClick={showNew}><Plus className="ic" />New project</button>
      </PageHead>
      <div className="tabs">{[["all", "All"], ...STATUS].map(([k, l]) => <button key={k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>{l}</button>)}</div>
      {projects.isLoading ? <Card><Skeleton rows={4} /></Card> : projects.isError ? <ErrorBox error={projects.error} retry={() => void projects.refetch()} /> : list.length === 0 ? <Card><Empty title="No projects here" hint="Projects group related tasks and track progress." action={<button className="btn pri sm" onClick={showNew}>Create project</button>} /></Card> : (
        <div className="pc">{list.map((p, i) => {
          const pr = progress.get(p.id); const pct = pr?.total ? (pr.done / pr.total) * 100 : 0;
          return (
            <Card key={p.id} i={i}>
              <Link to={`/projects/${p.id}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
                <div className={`cover project-banner banner-${p.banner_key || "aurora"}`} style={{ background: bannerBackground(p.banner_key) }}><span><ProjectIcon iconKey={p.icon_key} /></span></div>
                <div className="row sb"><h3>{p.name}</h3><span className={`pill ${p.status === "completed" ? "ok" : p.status === "on_hold" ? "md" : "blue"}`}>{STATUS.find(([k]) => k === p.status)?.[1]}</span></div>
                <p className="mute sm" style={{ margin: "4px 0 12px" }}>{p.description || "No description"}</p>
                <Progress value={pct} />
                <div className="row sb sm mute" style={{ marginTop: 8 }}><span>{pr?.done ?? 0}/{pr?.total ?? 0} tasks</span><span>{p.due_date ? `Due ${shortDate(p.due_date)}` : "No deadline"}</span></div>
              </Link>
              <div className="row" style={{ marginTop: 10 }}>
                <Link to={`/projects/${p.id}`} className="btn sm">View</Link>
                <button className="btn sm" onClick={() => setEditing(p)}>Edit</button>
                <button className="btn sm ghost" aria-label={`Archive ${p.name}`} onClick={() => setDeleting(p)}><Trash2 className="ic" style={{ width: 14, height: 14 }} />Archive</button>
              </div>
            </Card>
          );
        })}</div>
      )}

      <Goals creating={goalOpen} closeNew={closeGoal} />

      {isNew && <FormModal title="New project" initial={{banner_key:BANNER_PRESETS[0].id,icon_key:"briefcase",status:"active"}} fields={fields} busy={create.isPending} onClose={closeNew} onSubmit={(v) => create.mutate({ name: v.name.trim(), description: v.description, banner_key: v.banner_key || "aurora", icon_key: v.icon_key || "briefcase", status: v.status as Project["status"], ...(v.due_date ? { due_date: v.due_date } : {}) }, { onSuccess: () => { if (v.status === "completed") confetti(); closeNew(); } })} />}
      {editing && <FormModal title="Edit project" submit="Save changes" fields={fields} busy={update.isPending} onClose={() => setEditing(null)} initial={{ name: editing.name, description: editing.description, banner_key: editing.banner_key || "aurora", icon_key: editing.icon_key || "briefcase", status: editing.status, due_date: editing.due_date?.slice(0, 10) ?? "" }} onSubmit={(v) => update.mutate({ id: editing.id, name: v.name.trim(), description: v.description, banner_key: v.banner_key || "aurora", icon_key: v.icon_key || "briefcase", status: v.status as Project["status"], ...(v.due_date ? { due_date: v.due_date } : {}) }, { onSuccess: () => { if (editing.status !== "completed" && v.status === "completed") confetti(); setEditing(null); } })} />}
      {deleting && <ConfirmModal title="Archive project?" body={`“${deleting.name}” will be hidden. Its tasks stay in your task list.`} confirm="Archive" onConfirm={() => remove.mutate(deleting.id)} onClose={() => setDeleting(null)} />}
    </>
  );
}
