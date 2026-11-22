import { BookOpen, BriefcaseBusiness, Building2, ChartNoAxesCombined, Check, Code2, GraduationCap, HeartPulse, Lightbulb, Palette, Target, Wallet } from "lucide-react";

const icons = {
  briefcase: BriefcaseBusiness, graduation: GraduationCap, code: Code2, wallet: Wallet,
  building: Building2, check: Check, target: Target, heart: HeartPulse,
  palette: Palette, book: BookOpen, chart: ChartNoAxesCombined, lightbulb: Lightbulb,
};

export function ProjectIcon({ iconKey, size = 22 }: { iconKey?: string | null; size?: number }) {
  if (iconKey?.startsWith("emoji:")) return <span aria-hidden="true">{iconKey.slice(6)}</span>;
  const Icon = icons[(iconKey || "briefcase") as keyof typeof icons] || BriefcaseBusiness;
  return <Icon size={size} aria-hidden="true" />;
}
