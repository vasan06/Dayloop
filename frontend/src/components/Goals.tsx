import { useState } from "react";
import { useCreateGoal, useDeleteGoal, useGoals, useIncrementGoal, useUpdateGoal } from "../hooks/data";
import { num, shortDate } from "../lib/format";
import type { Goal } from "../lib/types";
import { Card, ConfirmModal, Empty, ErrorBox, FormModal, Progress, Skeleton, confetti, type FieldDef } from "./ui";

const fields: FieldDef[] = [
  { name: "title", label: "Goal", required: true },
  { name: "description", label: "Description", type: "textarea" },
  { name: "goal_type", label: "Type", type: "select", half: true, options: [["personal", "Personal"], ["learning", "Learning"], ["health", "Health"], ["finance", "Finance"], ["career", "Career"]] },
  { name: "status", label: "Status", type: "select", half: true, options: [["active", "Active"], ["paused", "Paused"], ["completed", "Completed"], ["cancelled", "Cancelled"]] },
  { name: "target_value", label: "Target", type: "number", step: "0.001", half: true },
  { name: "current_value", label: "Current progress", type: "number", step: "0.001", half: true },
  { name: "unit", label: "Unit", placeholder: "Books, hours, km" },
  { name: "start_date", label: "Start date", type: "date", half: true },
  { name: "target_date", label: "Target date", type: "date", half: true },
];

export function Goals({ creating, closeNew }: { creating: boolean; closeNew: () => void }) {
  const goals = useGoals();
  const create = useCreateGoal();
  const update = useUpdateGoal();
  const increment = useIncrementGoal();
  const remove = useDeleteGoal();
  const [editing, setEditing] = useState<Goal | null>(null);
  const [deleting, setDeleting] = useState<Goal | null>(null);
  const closeForm = () => { create.reset(); update.reset(); if (editing) setEditing(null); else closeNew(); };
  const closeDelete = () => { remove.reset(); setDeleting(null); };
  const submit = (values: Record<string, string>) => {
    const data = {
      title: values.title.trim(), description: values.description.trim(),
      goal_type: values.goal_type, status: values.status,
      target_value: values.target_value || null, current_value: values.current_value || 0,
      unit: values.unit.trim() || null, start_date: values.start_date || null, target_date: values.target_date || null,
    };
    if (editing) update.mutate({ id: editing.id, ...data }, { onSuccess: () => { if (editing.status !== "completed" && values.status === "completed") confetti(); closeForm(); } });
    else create.mutate(data, { onSuccess: () => { if (values.status === "completed") confetti(); closeForm(); } });
  };
  const initial = editing
    ? Object.fromEntries(fields.map(({ name }) => [name, String(editing[name as keyof Goal] ?? "")]))
    : { current_value: "0" };

  return <>
    <Card style={{ marginTop: 14 }}>
      <div className="hd"><h2>Goals</h2></div>
      {goals.isLoading ? <Skeleton rows={2} /> : goals.isError ? <ErrorBox error={goals.error} retry={() => void goals.refetch()} />
        : !goals.data?.length ? <Empty title="No goals yet" hint="Set a target and track progress toward it." />
        : <div className="list">{goals.data.map((goal) => {
          const current = num(goal.current_value);
          const target = num(goal.target_value);
          const unit = goal.unit ? ` ${goal.unit}` : "";
          return <div key={goal.id} className="li" style={{ display: "block" }}>
            <div className="row sb wrap"><b>{goal.title}</b><span className="pill">{goal.status}</span></div>
            <details>
              <summary style={{ cursor: "pointer", padding: "6px 0" }}>
                <span className="mono">{current}{goal.target_value != null && ` / ${target}`}{unit}</span>
                {target > 0 && <Progress value={current / target * 100} />}
              </summary>
              <p className="mute sm">{goal.description || goal.goal_type}{goal.target_date && ` · Due ${shortDate(goal.target_date)}`}</p>
              {target > 0 && <p className="sm">{current}{unit} recorded toward a target of {target}{unit}.</p>}
            </details>
            <div className="row wrap" style={{ marginTop: 8 }}>
              {target > 0 && goal.status === "active" && <button className="btn sm" disabled={increment.isPending} onClick={() => increment.mutate(goal.id, { onSuccess: () => { if (current + 1 >= target) confetti(); } })}>+1 progress</button>}
              <button className="btn sm" aria-label={`Edit ${goal.title}`} onClick={() => setEditing(goal)}>Edit</button>
              <button className="btn sm ghost" aria-label={`Delete ${goal.title}`} onClick={() => setDeleting(goal)}>Delete</button>
            </div>
          </div>;
        })}</div>}
    </Card>
    {(creating || editing) && <FormModal title={editing ? "Edit goal" : "New goal"} submit={editing ? "Save changes" : "Create goal"}
      fields={fields} initial={initial} busy={create.isPending || update.isPending} error={editing ? update.error : create.error} onClose={closeForm} onSubmit={submit} />}
    {deleting && <ConfirmModal title="Delete goal?" body={`“${deleting.title}” and its progress will be permanently deleted.`}
      busy={remove.isPending} error={remove.error} onConfirm={() => remove.mutate(deleting.id, { onSuccess: closeDelete })} onClose={closeDelete} />}
  </>;
}
