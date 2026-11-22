import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  Edit3,
  FileText,
  Plus,
  Trash2,
} from "lucide-react";
import {
  Card,
  CardHead,
  Check22,
  ConfirmModal,
  Empty,
  ErrorBox,
  FormModal,
  Progress,
  Skeleton,
  confetti,
  type FieldDef,
} from "../components/ui";
import { Gauge } from "../components/charts";
import {
  useCreateNote,
  useCreateTask,
  useDeleteProject,
  useDeleteTask,
  useNotes,
  useProjects,
  useTasks,
  useUpdateProject,
  useUpdateTask,
} from "../hooks/data";
import { isOverdue } from "../lib/derive";
import { priorityLabel, shortDate } from "../lib/format";
import type { Project, Task, TaskPriority, TaskStatus } from "../lib/types";
import { BANNER_PRESETS, PROJECT_ICONS, bannerBackground } from "../lib/projectPresets";
import { ProjectIcon } from "../components/ProjectIcon";

const STATUS_OPTIONS: [string, string][] = [
  ["active", "Active"],
  ["on_hold", "On hold"],
  ["completed", "Completed"],
];
const BANNER_OPTIONS: [string,string][] = BANNER_PRESETS.map((preset) => [preset.id, `${preset.category} · ${preset.name}`]);

const PRI_CLASS: Record<TaskPriority, string> = { urgent: "hi", high: "hi", normal: "md", low: "lo" };

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const projects = useProjects();
  const tasks = useTasks();
  const notes = useNotes();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const createNote = useCreateNote();

  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);

  const project = projects.data?.find((p) => p.id === id);
  const scopedTasks = useMemo(
    () => (tasks.data ?? []).filter((t) => t.project_id === id),
    [tasks.data, id]
  );

  const totalTasks = scopedTasks.length;
  const doneTasks = scopedTasks.filter((t) => t.status === "completed").length;
  const pendingTasks = totalTasks - doneTasks;
  const pct = totalTasks ? (doneTasks / totalTasks) * 100 : project?.status === "completed" ? 100 : 0;

  // Notes referencing this project by title
  const linkedNotes = useMemo(() => {
    if (!project || !notes.data) return [];
    const q = project.name.toLowerCase();
    return notes.data.filter((n) => n.title.toLowerCase().includes(q));
  }, [notes.data, project]);

  if (projects.isLoading || tasks.isLoading) {
    return <Card><Skeleton rows={5} /></Card>;
  }

  if (projects.isError) {
    return <ErrorBox error={projects.error} retry={() => void projects.refetch()} />;
  }

  if (!project) {
    return (
      <Card>
        <Empty
          title="Project not found"
          hint="This project may have been deleted or archived."
          action={
            <button className="btn pri sm" onClick={() => navigate("/projects")}>
              <ArrowLeft className="ic" style={{ width: 14, height: 14 }} />
              Back to projects
            </button>
          }
        />
      </Card>
    );
  }

  const projectFields: FieldDef[] = [
    { name: "name", label: "Project name", required: true },
    { name: "description", label: "Description", type: "textarea" },
    { name: "banner_key", label: "Project banner", type: "banner", options: BANNER_OPTIONS },
    { name: "icon_key", label: "Project icon", type: "icon", options: PROJECT_ICONS },
    { name: "status", label: "Status", type: "select", options: STATUS_OPTIONS, half: true },
    { name: "due_date", label: "Deadline", type: "date", half: true },
  ];

  const taskFields: FieldDef[] = [
    { name: "title", label: "Task title", required: true, placeholder: "What needs doing?" },
    { name: "description", label: "Details / Notes", type: "textarea" },
    {
      name: "priority",
      label: "Priority",
      type: "select",
      options: Object.entries(priorityLabel),
      half: true,
    },
    { name: "due", label: "Due date", type: "date", half: true },
  ];

  const handleEditProject = (v: Record<string, string>) => {
    updateProject.mutate(
      {
        id: project.id,
        name: v.name.trim(),
        description: v.description,
        banner_key: v.banner_key || "aurora",
        icon_key: v.icon_key || "briefcase",
        status: v.status as Project["status"],
        due_date: v.due_date ? v.due_date : null,
      },
      {
        onSuccess: () => { if (project.status !== "completed" && v.status === "completed") confetti(); setIsEditing(false); },
      }
    );
  };

  const handleArchiveProject = () => {
    deleteProject.mutate(project.id, {
      onSuccess: () => navigate("/projects"),
    });
  };

  const handleCreateTask = (v: Record<string, string>) => {
    createTask.mutate(
      {
        project_id: project.id,
        title: v.title.trim(),
        description: v.description,
        priority: (v.priority as TaskPriority) || "normal",
        status: "not_started",
        due_at: v.due ? new Date(`${v.due}T18:00:00`).toISOString() : null,
      },
      {
        onSuccess: () => setIsNewTaskOpen(false),
      }
    );
  };

  const handleCreateLinkedNote = () => {
    createNote.mutate(
      { title: `${project.name} - Project Notes` },
      {
        onSuccess: () => void notes.refetch(),
      }
    );
  };

  return (
    <>

      {/* Gradient Hero Banner */}
      <div
        className={`hero project-detail-hero banner-${project.banner_key || "aurora"}`}
        style={{
          borderRadius: 28,
          border: "1px solid rgba(255,255,255,0.1)",
          marginBottom: 20,
          background: bannerBackground(project.banner_key),
        }}
      >
        <div style={{ zIndex: 1 }}>
          <div className="row wrap" style={{ gap: 8, marginBottom: 8 }}>
            <span
              className={`pill ${
                project.status === "completed" ? "ok" : project.status === "on_hold" ? "md" : "blue"
              }`}
            >
              {STATUS_OPTIONS.find(([k]) => k === project.status)?.[1] ?? project.status}
            </span>
            {project.due_date && (
              <span className="pill" style={{ background: "rgba(255,255,255,0.12)", color: "#fff" }}>
                <Calendar className="ic" style={{ width: 12, height: 12 }} />
                Deadline: {shortDate(project.due_date)}
              </span>
            )}
          </div>

          <h1 className="hh" style={{ margin: "6px 0 10px", color: "#fff" }}>
            <ProjectIcon iconKey={project.icon_key} /> {project.name}
          </h1>

          <p style={{ maxWidth: "56ch", color: "rgba(255,255,255,0.85)", margin: "0 0 18px", fontSize: 15 }}>
            {project.description || "Track tasks, progress, notes, and milestones for this project."}
          </p>

          <div className="row wrap" style={{ gap: 10 }}>
            <button
              className="btn"
              style={{ background: "rgba(255,255,255,0.16)", color: "#fff", border: 0 }}
              onClick={() => setIsEditing(true)}
            >
              <Edit3 className="ic" style={{ width: 14, height: 14 }} />
              Edit project
            </button>
            <button
              className="btn ghost"
              style={{ color: "rgba(255,255,255,0.8)" }}
              onClick={() => setIsDeleting(true)}
            >
              <Trash2 className="ic" style={{ width: 14, height: 14 }} />
              Archive
            </button>
          </div>
        </div>

        {/* Hero Right - Glass Gauge */}
        <div className="glass" style={{ minWidth: 200, textAlign: "center", justifySelf: "end" }}>
          <div className="mono" style={{ color: "rgba(255,255,255,0.7)", marginBottom: 4 }}>
            Project Progress
          </div>
          <div style={{ maxWidth: 170, margin: "0 auto" }}>
            <Gauge value={pct} label="Completed" detail={totalTasks ? `${doneTasks} of ${totalTasks} project tasks completed.` : `No tasks. Project status is ${project.status}.`} />
          </div>
          <div className="row sb sm" style={{ color: "rgba(255,255,255,0.85)", marginTop: 6 }}>
            <span>
              <b>{doneTasks}</b> / {totalTasks} tasks done
            </span>
            <span>{project.due_date ? shortDate(project.due_date) : "Open"}</span>
          </div>
        </div>
      </div>

      {/* Bento Layout */}
      <div className="g">
        {/* Left Column (s8): Scoped Tasks */}
        <div className="s8">
          <Card>
            <CardHead
              title="Project Tasks"
              mono={`${scopedTasks.length} total · ${doneTasks} completed`}
              right={
                <button className="btn pri sm" onClick={() => setIsNewTaskOpen(true)}>
                  <Plus className="ic" style={{ width: 14, height: 14 }} />
                  Add task
                </button>
              }
            />

            {scopedTasks.length === 0 ? (
              <Empty
                title="No tasks in this project"
                hint="Add your first task to start tracking work for this project."
                action={
                  <button className="btn pri sm" onClick={() => setIsNewTaskOpen(true)}>
                    <Plus className="ic" style={{ width: 14, height: 14 }} />
                    Add first task
                  </button>
                }
              />
            ) : (
              <div className="list">
                {scopedTasks.map((t) => {
                  const isDone = t.status === "completed";
                  const overdue = isOverdue(t);
                  return (
                    <div key={t.id} className={`li ${isDone ? "done" : ""}`}>
                      <Check22
                        on={isDone}
                        label={`Toggle ${t.title}`}
                        onClick={() => {
                          const nextStatus: TaskStatus = isDone ? "not_started" : "completed";
                          updateTask.mutate({
                            id: t.id,
                            status: nextStatus,
                            completed_at: isDone ? null : new Date().toISOString(),
                          }, { onSuccess: () => { if (!isDone) confetti(); } });
                        }}
                      />

                      <div className="t" style={{ minWidth: 0 }}>
                        <Link
                          to={`/tasks/${t.id}`}
                          className="lnk"
                          style={{
                            fontWeight: 600,
                            display: "inline-block",
                            textDecoration: isDone ? "line-through" : "none",
                          }}
                        >
                          {t.title}
                        </Link>
                        {t.description && (
                          <div className="mute sm" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {t.description}
                          </div>
                        )}
                      </div>

                      <span className={`pill ${PRI_CLASS[t.priority]}`}>
                        {priorityLabel[t.priority]}
                      </span>

                      {t.due_at && (
                        <span className={`pill ${overdue ? "hi" : ""}`}>
                          {shortDate(t.due_at)}
                        </span>
                      )}

                      <button
                        className="iconbtn"
                        style={{ width: 30, height: 30 }}
                        aria-label={`Delete ${t.title}`}
                        onClick={() => setDeletingTask(t)}
                      >
                        <Trash2 className="ic" style={{ width: 14, height: 14 }} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Right Column (s4): Progress, Linked Notes, Activity */}
        <div className="s4" style={{ display: "grid", gap: 14, alignContent: "start" }}>
          {/* Progress Card */}
          <Card>
            <CardHead title="Status & Metrics" mono="Overview" />
            <div style={{ marginBottom: 12 }}>
              <div className="row sb sm" style={{ marginBottom: 6 }}>
                <span className="mute">Overall Completion</span>
                <b className="mono">{Math.round(pct)}%</b>
              </div>
              <Progress value={pct} label={project.name} detail={totalTasks ? `${doneTasks} of ${totalTasks} project tasks completed.` : `No tasks. Project status is ${project.status}.`} />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
                padding: "10px 0",
                borderTop: "1px solid var(--line)",
              }}
            >
              <div>
                <div className="mono sm mute">Completed</div>
                <div style={{ fontSize: 20, fontWeight: 600, color: "var(--green)" }}>{doneTasks}</div>
              </div>
              <div>
                <div className="mono sm mute">Pending</div>
                <div style={{ fontSize: 20, fontWeight: 600, color: "var(--ink)" }}>{pendingTasks}</div>
              </div>
            </div>
          </Card>

          {/* Linked Notes Card */}
          <Card>
            <CardHead
              title="Linked Notes"
              mono="Documentation"
              right={
                <button
                  className="btn sm ghost"
                  onClick={handleCreateLinkedNote}
                  aria-label="Add project note"
                >
                  <Plus className="ic" style={{ width: 13, height: 13 }} />
                  Note
                </button>
              }
            />

            {linkedNotes.length === 0 ? (
              <div style={{ padding: "10px 0", textAlign: "center" }}>
                <p className="mute sm" style={{ margin: "0 0 10px" }}>
                  No notes linked to this project yet.
                </p>
                <button className="btn sm" onClick={handleCreateLinkedNote}>
                  <FileText className="ic" style={{ width: 14, height: 14 }} />
                  Create project notes
                </button>
              </div>
            ) : (
              <div className="list">
                {linkedNotes.map((note) => (
                  <Link
                    key={note.id}
                    to="/notes"
                    className="li"
                    style={{ textDecoration: "none" }}
                  >
                    <FileText className="ic mute" style={{ width: 16, height: 16 }} />
                    <div className="t">
                      <b>{note.title}</b>
                      <div className="sm mute">Updated {shortDate(note.updated_at)}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          {/* Activity Timeline Card */}
          <Card>
            <CardHead title="Project Activity" mono="Timeline" />
            <div className="tl" style={{ marginTop: 8 }}>
              {project.due_date && (
                <div className="ev">
                  <div className="sm mono" style={{ color: "var(--amber)" }}>Target Deadline</div>
                  <div><b>Due date set</b></div>
                  <div className="sm mute">{shortDate(project.due_date)}</div>
                </div>
              )}
              {scopedTasks.find((t) => t.completed_at) && (
                <div className="ev">
                  <div className="sm mono" style={{ color: "var(--green)" }}>Latest completion</div>
                  <div>
                    <b>
                      Task completed:{" "}
                      {scopedTasks.filter((t) => t.completed_at)[0]?.title ?? "Task"}
                    </b>
                  </div>
                  <div className="sm mute">
                    {shortDate(scopedTasks.filter((t) => t.completed_at)[0]?.completed_at)}
                  </div>
                </div>
              )}
              <div className="ev">
                <div className="sm mono">Project Status</div>
                <div><b>Currently {project.status}</b></div>
                <div className="sm mute">Last active {shortDate(project.updated_at)}</div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Edit Project Modal */}
      {isEditing && (
        <FormModal
          title="Edit project"
          submit="Save changes"
          fields={projectFields}
          busy={updateProject.isPending}
          onClose={() => setIsEditing(false)}
          initial={{
            name: project.name,
            description: project.description,
            banner_key: project.banner_key || "aurora",
            icon_key: project.icon_key || "briefcase",
            status: project.status,
            due_date: project.due_date?.slice(0, 10) ?? "",
          }}
          onSubmit={handleEditProject}
        />
      )}

      {/* Archive / Delete Project Modal */}
      {isDeleting && (
        <ConfirmModal
          title="Archive project?"
          body={`“${project.name}” will be archived. Its tasks will remain in your workspace.`}
          confirm="Archive project"
          onConfirm={handleArchiveProject}
          onClose={() => setIsDeleting(false)}
        />
      )}

      {/* Scoped Add Task Modal */}
      {isNewTaskOpen && (
        <FormModal
          title={`Add task to ${project.name}`}
          submit="Add task"
          fields={taskFields}
          busy={createTask.isPending}
          onClose={() => setIsNewTaskOpen(false)}
          initial={{ priority: "normal" }}
          onSubmit={handleCreateTask}
        />
      )}

      {/* Delete Task Modal */}
      {deletingTask && (
        <ConfirmModal
          title="Delete task?"
          body={`“${deletingTask.title}” will be removed.`}
          onConfirm={() => {
            deleteTask.mutate(deletingTask.id);
            setDeletingTask(null);
          }}
          onClose={() => setDeletingTask(null)}
        />
      )}
    </>
  );
}
