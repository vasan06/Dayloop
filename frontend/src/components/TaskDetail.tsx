import { useState, type FormEvent } from "react";
import { Modal, Check22, Progress } from "./ui";
import { useCreateTask, useProjects, useTasks, useUpdateTask } from "../hooks/data";
import { priorityLabel, shortDate, statusLabel } from "../lib/format";
import type { Task } from "../lib/types";

export function TaskDetail({ task, onClose, onEdit }: { task: Task; onClose: () => void; onEdit: () => void }) {
  const tasks = useTasks();
  const projects = useProjects();
  const create = useCreateTask();
  const update = useUpdateTask();
  const [title, setTitle] = useState("");
  const subs = (tasks.data ?? []).filter((t) => t.parent_task_id === task.id);
  const done = subs.filter((s) => s.status === "completed").length;
  const live = (tasks.data ?? []).find((t) => t.id === task.id) ?? task;
  const project = projects.data?.find((p) => p.id === live.project_id)?.name;

  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    create.mutate({ title: title.trim(), parent_task_id: task.id, project_id: task.project_id }, { onSuccess: () => setTitle("") });
  };

  return (
    <Modal title={live.title} onClose={onClose}>
      <div className="row wrap" style={{ marginBottom: 12 }}>
        <span className="pill blue">{statusLabel[live.status]}</span><span className="pill">{priorityLabel[live.priority]}</span>
        {live.due_at && <span className="pill">Due {shortDate(live.due_at)}</span>}{project && <span className="pill">{project}</span>}
      </div>
      <p className="mute" style={{ marginTop: 0 }}>{live.description || "No description."}</p>
      <div className="row sb" style={{ margin: "16px 0 6px" }}><h3>Subtasks</h3><span className="mono">{done}/{subs.length}</span></div>
      <Progress value={subs.length ? (done / subs.length) * 100 : 0} />
      <div className="list" style={{ margin: "8px 0" }}>
        {subs.map((s) => (
          <div key={s.id} className={`li ${s.status === "completed" ? "done" : ""}`}>
            <Check22 on={s.status === "completed"} label={`Toggle ${s.title}`} onClick={() => update.mutate({ id: s.id, status: s.status === "completed" ? "not_started" : "completed" })} />
            <span className="t">{s.title}</span>
          </div>
        ))}
        {subs.length === 0 && <div className="mute sm" style={{ padding: "8px 0" }}>Break this task into smaller steps.</div>}
      </div>
      <form className="row" onSubmit={add}>
        <div className="field" style={{ flex: 1, margin: 0 }}><input aria-label="New subtask" placeholder="Add a subtask" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <button className="btn" disabled={create.isPending}>Add</button>
      </form>
      <div className="row" style={{ justifyContent: "flex-end", marginTop: 16 }}>
        <button className="btn" onClick={onEdit}>Edit task</button><button className="btn pri" onClick={onClose}>Done</button>
      </div>
    </Modal>
  );
}
