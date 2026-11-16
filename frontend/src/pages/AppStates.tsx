import { useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Layers,
  MessageSquare,
  Sparkles,
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
  PageHead,
  Progress,
  Seg,
  Skeleton,
  confetti,
  type FieldDef,
} from "../components/ui";
import { toast } from "../lib/toast";

type ModuleType = "tasks" | "projects" | "habits" | "finance" | "notes" | "calendar";
type StateType = "empty" | "loading" | "error" | "success" | "done";

export default function AppStates() {
  const [currentModule, setCurrentModule] = useState<ModuleType>("tasks");
  const [currentState, setCurrentState] = useState<StateType>("empty");

  // Modal showcase state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [createFormOpen, setCreateFormOpen] = useState(false);
  const [editFormOpen, setEditFormOpen] = useState(false);

  const sampleFields: FieldDef[] = [
    { name: "title", label: "Title", required: true, placeholder: "e.g. Redesign landing hero" },
    { name: "description", label: "Description", type: "textarea", placeholder: "Add supporting details…" },
    {
      name: "priority",
      label: "Priority",
      type: "select",
      options: [
        ["low", "Low"],
        ["normal", "Normal"],
        ["high", "High"],
        ["urgent", "Urgent"],
      ],
      half: true,
    },
    { name: "due_date", label: "Due Date", type: "date", half: true },
  ];

  const renderModuleContent = () => {
    switch (currentState) {
      case "loading":
        return (
          <div style={{ display: "grid", gap: 14 }}>
            <Skeleton rows={5} />
          </div>
        );

      case "error":
        return (
          <ErrorBox
            error={new Error(`Failed to load ${currentModule} data. Backend connection timed out (HTTP 504).`)}
            retry={() => toast("Retrying query request…")}
          />
        );

      case "empty":
        switch (currentModule) {
          case "tasks":
            return (
              <Empty
                title="No tasks found"
                hint="Your task inbox is clear. Create a task or pick an onboarding action."
                action={
                  <button className="btn pri sm" onClick={() => toast("New task modal opened")}>
                    Add your first task
                  </button>
                }
              />
            );
          case "projects":
            return (
              <Empty
                title="No active projects"
                hint="Projects group related tasks, deadlines, and linked notes together."
                action={
                  <button className="btn pri sm" onClick={() => toast("New project modal opened")}>
                    Create a project
                  </button>
                }
              />
            );
          case "habits":
            return (
              <Empty
                title="No habits established yet"
                hint="Daily habits build compounding momentum. Choose positive routines to track."
                action={
                  <button className="btn pri sm" onClick={() => toast("New habit modal opened")}>
                    Track your first habit
                  </button>
                }
              />
            );
          case "finance":
            return (
              <Empty
                title="No financial records found"
                hint="Log daily income, expenses, and envelope budgets to get cash flow clarity."
                action={
                  <button className="btn pri sm" onClick={() => toast("Add transaction modal opened")}>
                    Log a transaction
                  </button>
                }
              />
            );
          case "notes":
            return (
              <Empty
                title="Knowledge base is empty"
                hint="Capture thoughts, project documentation, meeting summaries, and daily logs."
                action={
                  <button className="btn pri sm" onClick={() => toast("New note page created")}>
                    Create first note
                  </button>
                }
              />
            );
          case "calendar":
            return (
              <Empty
                title="No scheduled events"
                hint="Your calendar is open today. Sync deadlines or schedule a deep work block."
                action={
                  <button className="btn pri sm" onClick={() => toast("Add calendar event")}>
                    Schedule event
                  </button>
                }
              />
            );
        }
        break;

      case "success":
        return (
          <div>
            <div className="row sb" style={{ marginBottom: 14 }}>
              <div className="row" style={{ gap: 8 }}>
                <span className="pill ok">
                  <CheckCircle2 className="ic" style={{ width: 13, height: 13 }} />
                  Synced & Active
                </span>
                <span className="mute sm">3 items loaded</span>
              </div>
              <button
                className="btn sm ghost"
                onClick={() => {
                  confetti();
                  toast("Celebration triggered!");
                }}
              >
                <Sparkles className="ic" style={{ width: 14, height: 14 }} />
                Trigger Confetti
              </button>
            </div>

            <div className="list">
              <div className="li">
                <Check22 on={false} label="Task 1" onClick={() => confetti()} />
                <div className="t">
                  <b>Refactor authentication session tokens</b>
                  <div className="mute sm">Project: Core Infrastructure · Due today</div>
                </div>
                <span className="pill hi">Urgent</span>
              </div>
              <div className="li">
                <Check22 on={false} label="Task 2" onClick={() => confetti()} />
                <div className="t">
                  <b>Review quarterly financial cash flow</b>
                  <div className="mute sm">Category: Operating Expenses · Due Friday</div>
                </div>
                <span className="pill md">Normal</span>
              </div>
              <div className="li">
                <Check22 on={false} label="Task 3" onClick={() => confetti()} />
                <div className="t">
                  <b>Drink 2.5L water and morning walk</b>
                  <div className="mute sm">Habit: 14-day continuous streak</div>
                </div>
                <span className="pill ok">Streak active</span>
              </div>
            </div>
          </div>
        );

      case "done":
        return (
          <div>
            <div className="row sb" style={{ marginBottom: 14 }}>
              <div className="row" style={{ gap: 8 }}>
                <span className="pill ok">
                  <Check className="ic" style={{ width: 13, height: 13 }} />
                  100% Completed
                </span>
                <span className="mute sm">All scheduled milestones satisfied</span>
              </div>
              <button className="btn sm pri" onClick={() => confetti()}>
                Celebrate Done
              </button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <Progress value={100} color="var(--green)" />
            </div>

            <div className="list">
              <div className="li done">
                <Check22 on={true} label="Completed 1" onClick={() => {}} />
                <div className="t">
                  <b>Ship PostgreSQL database migration schema v3</b>
                  <div className="mute sm">Completed 2 hours ago</div>
                </div>
                <span className="pill ok">Done</span>
              </div>
              <div className="li done">
                <Check22 on={true} label="Completed 2" onClick={() => {}} />
                <div className="t">
                  <b>Design responsive device showcase mockups</b>
                  <div className="mute sm">Completed today at 4:30 PM</div>
                </div>
                <span className="pill ok">Done</span>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <>
      <PageHead
        title="Application States Matrix"
        sub="Test and inspect Empty, Loading, Error, Success, and Done states across every module"
      />

      {/* State Switcher Bento Card */}
      <Card style={{ marginBottom: 20 }}>
        <CardHead title="Interactive States Playground" mono="Component testbed" />

        <div className="row wrap" style={{ gap: 12, marginBottom: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="mono sm mute">Select Module:</span>
            <Seg
              value={currentModule}
              options={[
                ["tasks", "Tasks"],
                ["projects", "Projects"],
                ["habits", "Habits"],
                ["finance", "Finance"],
                ["notes", "Notes"],
                ["calendar", "Calendar"],
              ]}
              onChange={(v) => setCurrentModule(v as ModuleType)}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="mono sm mute">Select UI State:</span>
            <Seg
              value={currentState}
              options={[
                ["empty", "Empty"],
                ["loading", "Loading"],
                ["error", "Error"],
                ["success", "Success"],
                ["done", "Done"],
              ]}
              onChange={(v) => setCurrentState(v as StateType)}
            />
          </div>
        </div>

        {/* Live State Sandbox Container */}
        <div
          style={{
            background: "var(--bg)",
            borderRadius: 18,
            padding: 20,
            border: "1px dashed var(--line)",
            minHeight: 220,
          }}
        >
          {renderModuleContent()}
        </div>
      </Card>

      {/* Loaders & Spinners Showcase */}
      <h2 style={{ fontSize: 18, margin: "24px 0 12px" }}>Loaders & Activity Indicators</h2>
      <div className="g" style={{ marginBottom: 24 }}>
        <Card className="s4" style={{ textAlign: "center", padding: "28px 18px" }}>
          <div className="orbit" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <h3 style={{ margin: "0 0 4px", fontSize: 16 }}>Workspace Boot</h3>
          <p className="mute sm" style={{ margin: 0 }}>
            Concentric orbital spinner initializing local cache
          </p>
        </Card>

        <Card className="s4" style={{ textAlign: "center", padding: "28px 18px" }}>
          <div
            style={{
              height: 84,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 22,
            }}
          >
            <div className="dots">
              <i />
              <i />
              <i />
            </div>
          </div>
          <h3 style={{ margin: "0 0 4px", fontSize: 16 }}>Bouncing Dots</h3>
          <p className="mute sm" style={{ margin: 0 }}>
            Micro-interaction saving active note block mutations
          </p>
        </Card>

        <Card className="s4" style={{ textAlign: "center", padding: "28px 18px" }}>
          <div
            style={{
              height: 84,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              padding: "0 12px",
              marginBottom: 22,
            }}
          >
            <div className="row sb sm mute" style={{ marginBottom: 8 }}>
              <span>Importing backup</span>
              <b className="mono" style={{ color: "var(--ink)" }}>68%</b>
            </div>
            <Progress value={68} />
          </div>
          <h3 style={{ margin: "0 0 4px", fontSize: 16 }}>Import Progress Bar</h3>
          <p className="mute sm" style={{ margin: 0 }}>
            Shimmer gradient progress indicator for batch tasks
          </p>
        </Card>
      </div>

      {/* Dialogs & Feedback Modals Showcase */}
      <h2 style={{ fontSize: 18, margin: "24px 0 12px" }}>Modals & Feedback Triggers</h2>
      <Card>
        <CardHead
          title="Modal Dialog Testbed"
          mono="Interactivity"
          right={
            <span className="mute sm">Click any button below to mount the corresponding dialog</span>
          }
        />

        <div className="row wrap" style={{ gap: 10, marginTop: 10 }}>
          <button className="btn bad" onClick={() => setConfirmOpen(true)}>
            <Trash2 className="ic" style={{ width: 14, height: 14 }} />
            Test Delete Confirmation Modal
          </button>

          <button className="btn pri" onClick={() => setCreateFormOpen(true)}>
            <Layers className="ic" style={{ width: 14, height: 14 }} />
            Test Create Form Modal
          </button>

          <button className="btn" onClick={() => setEditFormOpen(true)}>
            <Layers className="ic" style={{ width: 14, height: 14 }} />
            Test Edit Form Modal
          </button>

          <button
            className="btn ghost"
            onClick={() => toast("Profile settings updated successfully!")}
          >
            <MessageSquare className="ic" style={{ width: 14, height: 14 }} />
            Trigger Success Toast
          </button>

          <button
            className="btn ghost"
            onClick={() => toast("Network timeout — checking offline queue…", "error")}
          >
            <AlertTriangle className="ic" style={{ width: 14, height: 14 }} />
            Trigger Warning Toast
          </button>
        </div>
      </Card>

      {/* Modals Mounting */}
      {confirmOpen && (
        <ConfirmModal
          title="Delete selected item?"
          body="This action is permanent and cannot be undone. All linked history and analytics records will be voided."
          confirm="Yes, delete it"
          onConfirm={() => {
            setConfirmOpen(false);
            toast("Item was deleted successfully.");
          }}
          onClose={() => setConfirmOpen(false)}
        />
      )}

      {createFormOpen && (
        <FormModal
          title="Create New Item"
          submit="Create item"
          fields={sampleFields}
          onClose={() => setCreateFormOpen(false)}
          initial={{ priority: "normal" }}
          onSubmit={(v) => {
            setCreateFormOpen(false);
            toast(`Created: ${v.title}`);
          }}
        />
      )}

      {editFormOpen && (
        <FormModal
          title="Edit Item Details"
          submit="Save changes"
          fields={sampleFields}
          onClose={() => setEditFormOpen(false)}
          initial={{
            title: "DayLoop Brand Identity Refresh",
            description: "Update design tokens, font hierarchy, and color contrast.",
            priority: "high",
            due_date: "2026-12-01",
          }}
          onSubmit={(v) => {
            setEditFormOpen(false);
            toast(`Updated: ${v.title}`);
          }}
        />
      )}
    </>
  );
}
