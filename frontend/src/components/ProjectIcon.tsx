import { BriefcaseBusiness } from "lucide-react";
import { projectIconMap } from "../lib/projectIcons";

export function ProjectIcon({ iconKey, size = 22 }: { iconKey?: string | null; size?: number }) {
  if (iconKey?.startsWith("emoji:")) return <span className="legacy-project-emoji" aria-hidden="true">{iconKey.slice(6)}</span>;
  const Icon = projectIconMap[iconKey || "briefcase"] || BriefcaseBusiness;
  return <Icon size={size} aria-hidden="true" />;
}
