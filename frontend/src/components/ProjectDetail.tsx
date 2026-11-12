import { useState, type FormEvent } from "react";
import { Modal, Check22, Progress } from "./ui";
import { useCreateTask, useTasks, useUpdateTask } from "../hooks/data";
import { shortDate } from "../lib/format";
import type { Project } from "../lib/types";

export function ProjectDetail({ project, onClose, onEdit }: { project: Project; onClose: () => void; onEdit: () => void }) {
  const tasks = useTasks();
  const create = useCreateTask();
  const update = useUpdateTask();
  const [title, setTitle] = useState("");
  const list = (tasks.data ?? []).filter((t) => t.project_id === project.id && !t.parent_task_id && t.status !== "cancelled");
  const done = list.filter((t) => t.status === "completed").length;
  const add = (e: FormEvent) => {
    e.preventDefault();
    if (title.trim()) create.mutate({ title: title.trim(), project_id: project.id }, { onSuccess: () => setTitle("") });
  };
  return (
    <Modal title={project.name} onClose={onClose}>
      <p className="mute" style={{ marginTop: 0 }}>{project.description || "No description."}</p>
      <div className="row sb sm mute"><span>{done}/{list.length} tasks done</span><span>{project.due_date ? `Due ${shortDate(project.due_date)}` : "No deadline"}</span></div>
      <div style={{ margin: "8px 0" }}><Progress value={list.length ? (done / list.length) * 100 : 0} /></div>
      <div className="list">
        {list.map((t) => <div key={t.id} className={`li ${t.status === "completed" ? "done" : ""}`}><Check22 on={t.status === "completed"} label={`Toggle ${t.title}`} onClick={() => update.mutate({ id: t.id, status: t.status === "completed" ? "not_started" : "completed" })} /><span className="t">{t.title}</span>{t.due_at && <span className="pill">{shortDate(t.due_at)}</span>}</div>)}
        {list.length === 0 && <div className="mute sm" style={{ padding: "8px 0" }}>No tasks in this project yet.</div>}
      </div>
      <form className="row" onSubmit={add} style={{ marginTop: 8 }}>
        <div className="field" style={{ flex: 1, margin: 0 }}><input aria-label="Add task to project" placeholder="Add a task to this project" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <button className="btn" disabled={create.isPending}>Add</button>
      </form>
      <div className="row" style={{ justifyContent: "flex-end", marginTop: 16 }}><button className="btn" onClick={onEdit}>Edit project</button><button className="btn pri" onClick={onClose}>Done</button></div>
    </Modal>
  );
}
