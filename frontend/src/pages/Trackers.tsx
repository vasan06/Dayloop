import { useState } from "react";
import { Plus } from "lucide-react";
import { Card, ConfirmModal, Empty, ErrorBox, FormModal, PageHead, Skeleton, type FieldDef } from "../components/ui";
import { Spark } from "../components/charts";
import { useAddTrackerEntry, useArchiveTracker, useCreateTracker, useTrackerEntries, useTrackers, useUpdateTracker } from "../hooks/data";
import { useNewParam } from "../hooks/useNewParam";
import { num, shortDate, timeOf } from "../lib/format";
import type { Tracker } from "../lib/types";

const typeLabels = { number: "Number", boolean: "Yes / No", duration: "Duration" };
const fields: FieldDef[] = [
  { name: "name", label: "Name", required: true },
  { name: "metric_type", label: "Type", type: "select", options: Object.entries(typeLabels), half: true },
  { name: "frequency", label: "Frequency", type: "select", options: [["daily", "Daily"], ["weekly", "Weekly"], ["monthly", "Monthly"]], half: true },
  { name: "unit", label: "Unit", placeholder: "kg, L, hrs", half: true },
  { name: "target_value", label: "Target", type: "number", step: "0.001", half: true },
];

type TrackerActions = { onEdit: (canChangeType: boolean) => void; onArchive: () => void; onRecord: () => void };

function TrackerCard({ tracker, i, onEdit, onArchive, onRecord }: TrackerActions & { tracker: Tracker; i: number }) {
  const entries = useTrackerEntries(tracker.id);
  const points = (entries.data ?? []).filter((entry) => entry.numeric_value != null).slice(0, 14).reverse();
  const last = points[points.length - 1];
  const format = (value: number) => tracker.metric_type === "boolean" ? (value ? "Yes" : "No") : [value, tracker.unit].filter((part) => part != null).join(" ");
  return <Card i={i}>
    <div className="row sb wrap"><h3>{tracker.name}</h3><span className="pill">{tracker.frequency}</span></div>
    <span className="mute sm">{typeLabels[tracker.metric_type]}{tracker.target_value != null && ` · Target ${format(num(tracker.target_value))}`}</span>
    {entries.isLoading ? <Skeleton rows={2} /> : entries.isError ? <ErrorBox error={entries.error} retry={() => void entries.refetch()} /> : <>
      <div className="big" style={{ margin: "10px 0 4px" }}>{last ? format(num(last.numeric_value)) : "—"}</div>
      <div className="mono">{last ? `Last recorded ${shortDate(last.recorded_at)}` : "No entries yet"}</div>
      <div style={{ margin: "12px 0", color: "var(--acc)" }}>{points.length > 1
        ? <Spark values={points.map((entry) => num(entry.numeric_value))} labels={points.map((entry) => `${shortDate(entry.recorded_at)}, ${timeOf(entry.recorded_at)}`)}
            name={tracker.name} format={format} compare={tracker.metric_type !== "boolean"} details={points.map((entry) => entry.notes)} w={220} h={44} />
        : <span className="mute sm">Record two entries to see a trend.</span>}</div>
    </>}
    <div className="row wrap" style={{ marginTop: 12 }}>
      <button className="btn sm pri" onClick={onRecord}>Record entry</button>
      <button className="btn sm" aria-label={`Edit ${tracker.name}`} onClick={() => onEdit(entries.isSuccess && entries.data.length === 0)}>Edit</button>
      <button className="btn sm ghost" aria-label={`Archive ${tracker.name}`} onClick={onArchive}>Archive</button>
    </div>
  </Card>;
}

export default function Trackers() {
  const trackers = useTrackers();
  const create = useCreateTracker();
  const update = useUpdateTracker();
  const archive = useArchiveTracker();
  const add = useAddTrackerEntry();
  const [isNew, closeNew, showNew] = useNewParam();
  const [editing, setEditing] = useState<{ tracker: Tracker; canChangeType: boolean } | null>(null);
  const [archiving, setArchiving] = useState<Tracker | null>(null);
  const [recording, setRecording] = useState<Tracker | null>(null);
  const list = trackers.data ?? [];
  const closeForm = () => { create.reset(); update.reset(); if (editing) setEditing(null); else closeNew(); };
  const closeArchive = () => { archive.reset(); setArchiving(null); };
  const closeRecord = () => { add.reset(); setRecording(null); };
  const submit = (values: Record<string, string>) => {
    const data = {
      name: values.name.trim(), metric_type: values.metric_type ?? editing?.tracker.metric_type ?? "number",
      frequency: values.frequency, unit: values.unit.trim() || null, target_value: values.target_value || null,
    };
    if (editing) update.mutate({ id: editing.tracker.id, ...data }, { onSuccess: closeForm });
    else create.mutate(data, { onSuccess: closeForm });
  };
  return <>
    <PageHead title="Trackers" sub="Weight, water, spending and other measurements"><button className="btn pri" onClick={showNew}><Plus className="ic" />New tracker</button></PageHead>
    {trackers.isLoading ? <Card><Skeleton rows={4} /></Card> : trackers.isError ? <ErrorBox error={trackers.error} retry={() => void trackers.refetch()} />
      : list.length === 0 ? <Card><Empty title="No trackers yet" hint="Create a tracker to start recording measurements." action={<button className="btn pri sm" onClick={showNew}>Create tracker</button>} /></Card>
      : <div className="pc">{list.map((tracker, i) => <TrackerCard key={tracker.id} tracker={tracker} i={i}
          onRecord={() => setRecording(tracker)} onArchive={() => setArchiving(tracker)} onEdit={(canChangeType) => setEditing({ tracker, canChangeType })} />)}</div>}
    {(isNew || editing) && <FormModal title={editing ? "Edit tracker" : "New tracker"} submit={editing ? "Save changes" : "Create tracker"}
      fields={editing && !editing.canChangeType ? fields.filter((field) => field.name !== "metric_type") : fields}
      initial={editing ? Object.fromEntries(fields.map(({ name }) => [name, String(editing.tracker[name as keyof Tracker] ?? "")])) : {}}
      busy={create.isPending || update.isPending} error={editing ? update.error : create.error} onClose={closeForm} onSubmit={submit} />}
    {archiving && <ConfirmModal title="Archive tracker?" body={`“${archiving.name}” will be removed from this list. Its existing entries will be retained.`}
      confirm="Archive" busy={archive.isPending} error={archive.error} onConfirm={() => archive.mutate(archiving.id, { onSuccess: closeArchive })} onClose={closeArchive} />}
    {recording && <FormModal title={`Record · ${recording.name}`} submit="Record" busy={add.isPending} error={add.error} onClose={closeRecord}
      fields={[recording.metric_type === "boolean" ? { name: "value", label: "Value", type: "select", options: [["1", "Yes"], ["0", "No"]] }
        : { name: "value", label: `Value${recording.unit ? ` (${recording.unit})` : ""}`, type: "number", min: recording.metric_type === "duration" ? 0 : undefined, step: "0.001", required: true },
        { name: "notes", label: "Note", type: "textarea" }]}
      onSubmit={(values) => add.mutate({ id: recording.id, numeric_value: Number(values.value), notes: values.notes }, { onSuccess: closeRecord })} />}
  </>;
}
