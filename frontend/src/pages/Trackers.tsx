import { useState } from "react";
import { Plus } from "lucide-react";
import { Card, Empty, ErrorBox, FormModal, PageHead, Skeleton } from "../components/ui";
import { Spark } from "../components/charts";
import { useAddTrackerEntry, useCreateTracker, useTrackerEntries, useTrackers } from "../hooks/data";
import { useNewParam } from "../hooks/useNewParam";
import { num, shortDate } from "../lib/format";
import type { Tracker } from "../lib/types";

function TrackerCard({ tracker, i, onRecord }: { tracker: Tracker; i: number; onRecord: () => void }) {
  const entries = useTrackerEntries(tracker.id);
  const list = [...(entries.data ?? [])].reverse();
  const values = list.slice(-14).map((e) => num(e.numeric_value));
  const last = entries.data?.[0];
  return (
    <Card i={i}>
      <div className="row sb"><h3>{tracker.name}</h3><span className="pill">{tracker.frequency}</span></div>
      <div className="big" style={{ margin: "10px 0 4px" }}>{last ? num(last.numeric_value) : "—"}<span className="mute sm"> {tracker.unit ?? ""}</span></div>
      <div className="mono">{last ? `Last: ${shortDate(last.recorded_at)}` : "No entries yet"}{tracker.target_value ? ` · target ${num(tracker.target_value)}` : ""}</div>
      <div style={{ margin: "12px 0", color: "var(--acc)" }}>{values.length > 1 ? <Spark values={values} w={220} h={44} /> : <div className="mute sm">Record two entries to see a trend.</div>}</div>
      <button className="btn sm pri" onClick={onRecord}>Record entry</button>
    </Card>
  );
}

export default function Trackers() {
  const trackers = useTrackers();
  const create = useCreateTracker();
  const add = useAddTrackerEntry();
  const [isNew, closeNew, showNew] = useNewParam();
  const [recording, setRecording] = useState<Tracker | null>(null);
  const list = trackers.data ?? [];
  return (
    <>
      <PageHead title="Trackers" sub="Numbers worth noticing — weight, water, spend, study hours"><button className="btn pri" onClick={showNew}><Plus className="ic" />New tracker</button></PageHead>
      {trackers.isLoading ? <Card><Skeleton rows={4} /></Card> : trackers.isError ? <ErrorBox error={trackers.error} retry={() => void trackers.refetch()} /> : list.length === 0 ? <Card><Empty title="No trackers yet" hint="Create a tracker for any number you want to understand." action={<button className="btn pri sm" onClick={showNew}>Create tracker</button>} /></Card> : <div className="pc">{list.map((t, i) => <TrackerCard key={t.id} tracker={t} i={i} onRecord={() => setRecording(t)} />)}</div>}
      {isNew && <FormModal title="New tracker" busy={create.isPending} onClose={closeNew} fields={[{ name: "name", label: "Name", required: true }, { name: "metric_type", label: "Type", type: "select", options: [["number", "Number"], ["duration", "Duration"], ["boolean", "Yes / No"]], half: true }, { name: "frequency", label: "Frequency", type: "select", options: [["daily", "Daily"], ["weekly", "Weekly"], ["monthly", "Monthly"]], half: true }, { name: "unit", label: "Unit", placeholder: "kg, L, hrs", half: true }, { name: "target_value", label: "Target", type: "number", step: "any", half: true }]} onSubmit={(v) => create.mutate({ name: v.name.trim(), metric_type: v.metric_type, frequency: v.frequency, unit: v.unit || null, target_value: v.target_value ? Number(v.target_value) : null }, { onSuccess: closeNew })} />}
      {recording && <FormModal title={`Record · ${recording.name}`} submit="Record" busy={add.isPending} onClose={() => setRecording(null)} fields={[{ name: "value", label: `Value${recording.unit ? ` (${recording.unit})` : ""}`, type: "number", step: "any", required: true }, { name: "notes", label: "Note", type: "textarea" }]} onSubmit={(v) => add.mutate({ id: recording.id, numeric_value: Number(v.value), notes: v.notes }, { onSuccess: () => setRecording(null) })} />}
    </>
  );
}
