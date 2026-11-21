import { useState, type SetStateAction } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Edit3,
  FolderKanban,
  RotateCcw,
  Trash2,
} from "lucide-react";
import {
  Card,
  CardHead,
  ConfirmModal,
  Empty,
  ErrorBox,
  FormModal,
  Skeleton,
  confetti,
  type FieldDef,
} from "../components/ui";
import { useDeleteTask, useProjects, useSaveTaskNotes, useTaskNotes, useTasks, useUpdateTask } from "../hooks/data";
import { isOverdue } from "../lib/derive";
import { isoDate, priorityLabel, relative, shortDate, statusLabel, timeOf } from "../lib/format";
import type { TaskNoteBlock, TaskPriority, TaskStatus } from "../lib/types";

const PRI_CLASS: Record<TaskPriority, string> = { urgent: "hi", high: "hi", normal: "md", low: "lo" };

const STATUS_PILL: Record<TaskStatus, { label: string; cls: string }> = {
  completed: { label: "Completed", cls: "ok" },
  in_progress: { label: "In progress", cls: "blue" },
  not_started: { label: "To do", cls: "lo" },
  waiting: { label: "Waiting", cls: "md" },
  cancelled: { label: "Cancelled", cls: "hi" },
  inbox: { label: "Inbox", cls: "" },
};

const toInput = (iso: string | null) => (iso ? isoDate(new Date(iso)) : "");
const toIso = (date: string, time = "18:00") => (date ? new Date(`${date}T${time || "18:00"}:00`).toISOString() : null);

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const tasks = useTasks();
  const projects = useProjects();
  const update = useUpdateTask();
  const remove = useDeleteTask();
  const taskNotes = useTaskNotes(id ?? null);
  const saveTaskNotes = useSaveTaskNotes();
  const [draft, setDraft] = useState<{ id: string; blocks: TaskNoteBlock[] } | null>(null);
  const taskBlocks = draft?.id === id && draft ? draft.blocks : taskNotes.data?.items ?? [];
  function setTaskBlocks(change: SetStateAction<TaskNoteBlock[]>) {
    if (!id) return;
    setDraft((previous) => {
      const blocks = previous?.id === id ? previous.blocks : taskNotes.data?.items ?? [];
      return { id, blocks: typeof change === "function" ? change(blocks) : change };
    });
  }

  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (tasks.isLoading || projects.isLoading) {
    return (
      <div style={{ display: "grid", gap: 14 }}>
        <Card><Skeleton rows={4} /></Card>
      </div>
    );
  }

  if (tasks.isError) {
    return <ErrorBox error={tasks.error} retry={() => void tasks.refetch()} />;
  }

  const task = tasks.data?.find((t) => t.id === id);

  if (!task) {
    return (
      <Card>
        <Empty
          title="Task not found"
          hint="This task may have been removed or does not exist."
          action={
            <button className="btn pri sm" onClick={() => navigate("/tasks")}>
              <ArrowLeft className="ic" style={{ width: 14, height: 14 }} />
              Back to tasks
            </button>
          }
        />
      </Card>
    );
  }

  const isDone = task.status === "completed";
  const overdue = isOverdue(task);
  const project = projects.data?.find((p) => p.id === task.project_id);

  const toggleComplete = () => {
    const nextStatus: TaskStatus = isDone ? "not_started" : "completed";
    update.mutate({
      id: task.id,
      status: nextStatus,
      completed_at: isDone ? null : new Date().toISOString(),
    });
    if (!isDone) confetti();
  };

  const fields: FieldDef[] = [
    { name: "title", label: "Title", required: true, placeholder: "Task title" },
    {
      name: "project_id",
      label: "Project",
      type: "select",
      options: [["", "No project"], ...(projects.data ?? []).map((p) => [p.id, p.name] as [string, string])],
      half: true,
    },
    {
      name: "priority",
      label: "Priority",
      type: "select",
      options: Object.entries(priorityLabel),
      half: true,
    },
    { name: "due", label: "Due date", type: "date", half: true },
    { name: "due_time", label: "Due time", type: "time", half: true },
    {
      name: "status",
      label: "Status",
      type: "select",
      options: Object.entries(statusLabel),
      half: true,
    },
  ];

  const handleEditSubmit = (v: Record<string, string>) => {
    update.mutate(
      {
        id: task.id,
        title: v.title.trim(),
        project_id: v.project_id || null,
        priority: v.priority as TaskPriority,
        status: v.status as TaskStatus,
        due_at: toIso(v.due, v.due_time),
        completed_at: v.status === "completed" && !task.completed_at ? new Date().toISOString() : v.status !== "completed" ? null : task.completed_at,
      },
      {
        onSuccess: () => setIsEditing(false),
      }
    );
  };

  const handleDelete = () => {
    remove.mutate(task.id, {
      onSuccess: () => navigate("/tasks"),
    });
  };

  return (
    <>
      <div className="row sb wrap" style={{ marginBottom: 16 }}>
        <div className="row wrap" style={{ gap: 8 }}>
          <button className={`btn ${isDone ? "ghost" : "pri"}`} onClick={toggleComplete} disabled={update.isPending}>
            {isDone ? (
              <>
                <RotateCcw className="ic" style={{ width: 15, height: 15 }} />
                Reopen task
              </>
            ) : (
              <>
                <CheckCircle2 className="ic" style={{ width: 15, height: 15 }} />
                Mark complete
              </>
            )}
          </button>
          <button className="btn" onClick={() => setIsEditing(true)}>
            <Edit3 className="ic" style={{ width: 15, height: 15 }} />
            Edit task
          </button>
          <button className="btn bad ghost" onClick={() => setIsDeleting(true)} aria-label="Delete task">
            <Trash2 className="ic" style={{ width: 15, height: 15 }} />
            Delete
          </button>
        </div>
      </div>

      {/* Main Bento Grid */}
      <div className="g">
        {/* Left Column (s8) - Task Details */}
        <div className="s8" style={{ display: "grid", gap: 14 }}>
          <Card>
            <div className="row sb wrap" style={{ marginBottom: 14, gap: 10 }}>
              <div className="row wrap" style={{ gap: 8 }}>
                <span className={`pill ${STATUS_PILL[task.status]?.cls ?? ""}`}>
                  {STATUS_PILL[task.status]?.label ?? task.status}
                </span>
                <span className={`pill ${PRI_CLASS[task.priority]}`}>
                  {priorityLabel[task.priority]} priority
                </span>
                {overdue && (
                  <span className="pill hi">
                    <AlertTriangle className="ic" style={{ width: 13, height: 13 }} />
                    Overdue
                  </span>
                )}
              </div>
              <span className="mono sm mute">ID: {task.id.slice(0, 8)}</span>
            </div>

            <h1
              style={{
                fontFamily: "var(--f-d)",
                fontSize: "clamp(22px, 3vw, 30px)",
                lineHeight: 1.2,
                margin: "0 0 16px",
                textDecoration: isDone ? "line-through" : "none",
                opacity: isDone ? 0.7 : 1,
              }}
            >
              {task.title}
            </h1>

            <Card className="task-notes-card" style={{ marginBottom: 24 }}>
              <CardHead mono="Task notes" title="Points" />
              {taskNotes.isError ? <ErrorBox error={taskNotes.error} retry={() => void taskNotes.refetch()} /> : !taskNotes.data ? <Skeleton rows={2} /> : <div className="task-notes-editor">
                {taskBlocks.map((block, index) => <div className="task-note-block" key={index}>
                  <select aria-label={`Block ${index + 1} type`} value={block.type} onChange={(event) => setTaskBlocks((blocks) => blocks.map((item, itemIndex) => itemIndex === index ? { ...item, type: event.target.value } : item))}>
                    <option value="paragraph">Paragraph</option><option value="heading_1">Heading 1</option><option value="heading_2">Heading 2</option><option value="heading_3">Heading 3</option><option value="bulleted_list">Bullets</option><option value="numbered_list">Numbered list</option><option value="todo">To-do</option><option value="code">Code</option><option value="quote">Quote</option>
                  </select>
                  <textarea aria-label={`Task note block ${index + 1}`} value={block.content.text ?? ""} placeholder="Type or use / for a block" onChange={(event) => {
                    const text = event.target.value;
                    const command = text.trim().match(/^\/(heading 1|heading 2|heading 3|bullets|todo|code|quote|text)$/i)?.[1].toLowerCase();
                    const types: Record<string, string> = { "heading 1": "heading_1", "heading 2": "heading_2", "heading 3": "heading_3", bullets: "bulleted_list", todo: "todo", code: "code", quote: "quote", text: "paragraph" };
                    setTaskBlocks((blocks) => blocks.map((item, itemIndex) => itemIndex === index ? { type: command ? types[command] : item.type, content: { ...item.content, text: command ? "" : text } } : item));
                  }} />
                  <button type="button" className="iconbtn" aria-label={`Delete task note block ${index + 1}`} onClick={() => setTaskBlocks((blocks) => blocks.filter((_, itemIndex) => itemIndex !== index))}>×</button>
                </div>)}
                {taskBlocks.length === 0 && <button type="button" className="btn ghost" onClick={() => setTaskBlocks([{ type: "paragraph", content: { text: "" } }])}>Add notes</button>}
                {taskBlocks.length > 0 && <button type="button" className="btn sm ghost" onClick={() => setTaskBlocks((blocks) => [...blocks, { type: "paragraph", content: { text: "" } }])}>+ Add block</button>}
                <button type="button" className="btn pri sm" disabled={saveTaskNotes.isPending || draft?.id !== task.id} onClick={() => {
                  saveTaskNotes.mutate({ id: task.id, blocks: taskBlocks }, {
                    onSuccess: () => setDraft((current) => current?.blocks === taskBlocks ? null : current),
                  });
                }}>{saveTaskNotes.isPending ? "Saving…" : "Save notes"}</button>
              </div>}
            </Card>

            {/* Key Metadata Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 12,
                paddingTop: 16,
                borderTop: "1px solid var(--line)",
              }}
            >
              <div>
                <div className="mono" style={{ marginBottom: 4 }}>Project</div>
                {project ? (
                  <Link
                    to={`/projects/${project.id}`}
                    className="row lnk acc"
                    style={{ gap: 6, fontWeight: 500 }}
                  >
                    <FolderKanban className="ic" style={{ width: 16, height: 16 }} />
                    {project.name}
                  </Link>
                ) : (
                  <span className="mute sm">No project linked</span>
                )}
              </div>

              <div>
                <div className="mono" style={{ marginBottom: 4 }}>Due Date</div>
                <div className="row" style={{ gap: 6 }}>
                  <Calendar className="ic mute" style={{ width: 16, height: 16 }} />
                  <span style={{ color: overdue ? "var(--rose)" : "inherit", fontWeight: overdue ? 600 : 400 }}>
                    {task.due_at ? shortDate(task.due_at) : "No due date"}
                  </span>
                </div>
              </div>

              <div>
                <div className="mono" style={{ marginBottom: 4 }}>Status</div>
                <span className="sm" style={{ fontWeight: 500 }}>
                  {statusLabel[task.status]}
                </span>
              </div>

              <div>
                <div className="mono" style={{ marginBottom: 4 }}>Priority</div>
                <span className="sm" style={{ fontWeight: 500 }}>
                  {priorityLabel[task.priority]}
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column (s4) - Activity Timeline */}
        <div className="s4">
          <Card>
            <CardHead title="Activity & Timeline" mono="Audit trail" />
            <div className="tl" style={{ marginTop: 8 }}>
              {task.completed_at && (
                <div className="ev">
                  <div className="sm mono" style={{ color: "var(--green)" }}>Completed</div>
                  <div><b>Marked as done</b></div>
                  <div className="sm mute">
                    {shortDate(task.completed_at)} at {timeOf(task.completed_at)} ({relative(task.completed_at)})
                  </div>
                </div>
              )}

              {task.due_at && (
                <div className="ev">
                  <div className="sm mono" style={{ color: overdue ? "var(--rose)" : "var(--mute)" }}>
                    {overdue ? "Deadline passed" : "Scheduled due date"}
                  </div>
                  <div>
                    <b>Due {shortDate(task.due_at)}</b>
                  </div>
                  <div className="sm mute">
                    {overdue ? "Was due " + relative(task.due_at) : relative(task.due_at)}
                  </div>
                </div>
              )}

              <div className="ev">
                <div className="sm mono">Priority setting</div>
                <div><b>Set to {priorityLabel[task.priority]}</b></div>
                <div className="sm mute">
                  {task.updated_at ? `Updated ${relative(task.updated_at)}` : "At task creation"}
                </div>
              </div>

              <div className="ev">
                <div className="sm mono">Creation</div>
                <div><b>Task created</b></div>
                <div className="sm mute">
                  {shortDate(task.created_at)} at {timeOf(task.created_at)}
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Edit Form Modal */}
      {isEditing && (
        <FormModal
          title="Edit task"
          submit="Save changes"
          fields={fields}
          busy={update.isPending}
          onClose={() => setIsEditing(false)}
          initial={{
            title: task.title,
            project_id: task.project_id ?? "",
            priority: task.priority,
            status: task.status,
            due: toInput(task.due_at),
            due_time: task.due_at ? new Date(task.due_at).toTimeString().slice(0,5) : "",
          }}
          onSubmit={handleEditSubmit}
        />
      )}

      {/* Delete Confirmation Modal */}
      {isDeleting && (
        <ConfirmModal
          title="Delete task?"
          body={`“${task.title}” will be permanently deleted.`}
          confirm="Delete task"
          onConfirm={handleDelete}
          onClose={() => setIsDeleting(false)}
        />
      )}
    </>
  );
}
