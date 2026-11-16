import { useQuery } from "@tanstack/react-query";
import { Activity } from "lucide-react";
import { apiRequest } from "../lib/api";
import { TrackerAnalytics } from "./Analytics";

type Tracker = { id: string; name: string; unit?: string; metric_type: string };

export default function TrackerCard({ tracker, onRecord }: { tracker: Tracker; onRecord: () => void }) {
  const entriesQuery = useQuery({
    queryKey: ["tracker-entries", tracker.id],
    queryFn: () => apiRequest<{ items: { id: string; recorded_at: string; numeric_value?: number | string | null; text_value?: string | null; notes?: string }[] }>("/trackers/" + tracker.id + "/entries"),
  });
  return <article className="project-tile tracker-tile">
    <span className="project-symbol symbol-lilac"><Activity size={16} /></span>
    <h3>{tracker.name}</h3>
    <p>{tracker.metric_type}{tracker.unit ? " · " + tracker.unit : ""}</p>
    <TrackerAnalytics entries={entriesQuery.data?.items ?? []} unit={tracker.unit} />
    <button className="quiet-button" onClick={onRecord}>Record 1</button>
  </article>;
}
