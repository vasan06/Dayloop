export type BannerPreset = { id: string; name: string; category: string; background: string };

const legacy: BannerPreset[] = [
  ["aurora", "Aurora"], ["ocean", "Ocean"], ["sunset", "Sunset"], ["forest", "Forest"],
  ["violet", "Violet"], ["graphite", "Graphite"], ["citrus", "Citrus"], ["skyline", "Skyline"],
  ["coral", "Coral"], ["indigo", "Indigo"], ["mint", "Mint"], ["mono", "Mono"],
  ["grid", "Grid"], ["dots", "Dots"], ["orbit", "Orbit"],
].map(([id, name]) => ({ id, name, category: "Classic", background: "" }));

const generated: BannerPreset[] = [
  ...Array.from({ length: 12 }, (_, i) => ({ id: `solid-${i + 1}`, name: `Solid ${i + 1}`, category: "Solid colors", background: `hsl(${i * 30} 65% 43%)` })),
  ...Array.from({ length: 15 }, (_, i) => ({ id: `gradient-${i + 1}`, name: `Gradient ${i + 1}`, category: "Gradients", background: `linear-gradient(${110 + i * 17}deg,hsl(${i * 24} 75% 48%),hsl(${(i * 24 + 70) % 360} 78% 66%))` })),
  ...Array.from({ length: 10 }, (_, i) => ({ id: `dark-${i + 1}`, name: `Dark ${i + 1}`, category: "Dark themes", background: `linear-gradient(135deg,hsl(${i * 36} 30% 8%),hsl(${i * 36} 58% 28%))` })),
  ...Array.from({ length: 12 }, (_, i) => ({ id: `pastel-${i + 1}`, name: `Pastel ${i + 1}`, category: "Pastels", background: `linear-gradient(135deg,hsl(${i * 30} 72% 83%),hsl(${(i * 30 + 45) % 360} 70% 72%))` })),
  ...Array.from({ length: 15 }, (_, i) => ({ id: `pattern-${i + 1}`, name: `Pattern ${i + 1}`, category: "Patterns", background: `repeating-linear-gradient(${i * 12}deg,transparent 0 12px,rgba(255,255,255,.25) 12px 15px),hsl(${i * 24} 58% 40%)` })),
  ...Array.from({ length: 10 }, (_, i) => ({ id: `abstract-${i + 1}`, name: `Abstract ${i + 1}`, category: "Abstract", background: `radial-gradient(circle at ${15 + i * 7}% 24%,hsl(${i * 36} 90% 76%) 0 13%,transparent 36%),radial-gradient(circle at 80% 80%,hsl(${(i * 36 + 100) % 360} 90% 70%) 0 11%,transparent 38%),hsl(${(i * 36 + 210) % 360} 60% 35%)` })),
];

export const BANNER_PRESETS = [...legacy, ...generated];
export const bannerBackground = (key: string) => BANNER_PRESETS.find((preset) => preset.id === key)?.background || undefined;

export const PROJECT_ICONS: Array<[string, string]> = [
  ["briefcase", "Career · Briefcase"], ["graduation", "Education · Graduation"], ["code", "Software · Code"],
  ["wallet", "Finance · Wallet"], ["building", "Business · Building"], ["check", "Productivity · Check"],
  ["target", "Growth · Target"], ["heart", "Fitness · Heart"], ["palette", "Creative · Palette"],
  ["book", "Education · Book"], ["chart", "Business · Chart"], ["lightbulb", "Ideas · Lightbulb"],
  ["emoji:🚀", "Emoji · Rocket"], ["emoji:📚", "Emoji · Books"], ["emoji:💰", "Emoji · Money"],
  ["emoji:💪", "Emoji · Strength"], ["emoji:🎨", "Emoji · Art"], ["emoji:🌱", "Emoji · Growth"],
  ["emoji:🧭", "Emoji · Compass"], ["emoji:🎯", "Emoji · Target"],
];
