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


// Original vector compositions, not remotely hosted images. Each cover uses a
// deliberate palette and motif; the same art is used in the picker and project.
const art = (base: string, shapes: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 320"><path fill="${base}" d="M0 0h800v320H0z"/>${shapes}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") center / cover no-repeat ${base}`;
};
const tile = (base: string, w: number, h: number, shapes: string) => art(base,
  `<defs><pattern id="p" width="${w}" height="${h}" patternUnits="userSpaceOnUse">${shapes}</pattern></defs><path fill="url(#p)" d="M0 0h800v320H0z"/>`);
const contour = (base: string, ink: string) => art(base, Array.from({length: 15}, (_, i) =>
  `<path d="M${-190+i*25} 340Q${90+i*30} 230 ${230+i*24} 275T${460+i*25} 130T${780+i*25} -40" fill="none" stroke="${ink}" stroke-width="1.5"/>`).join(""));
const covers: BannerPreset[] = [
  {id:"studio-bauhaus",name:"Bauhaus No. 01",category:"Editorial",background:art("#e9e1d0",'<path fill="#263c49" d="M0 0h230v320H0z"/><circle cx="230" cy="160" r="160" fill="#c95137"/><path fill="#e7b94f" d="M390 0h190v320H390z"/><path fill="#263c49" d="M580 0h220v320H580z"/><circle cx="690" cy="160" r="105" fill="#e9e1d0"/><path d="M580 160h220" stroke="#263c49" stroke-width="5"/>')},
  {id:"studio-print",name:"Print House",category:"Editorial",background:tile("#e8e2d5",160,160,'<path d="M0 0h80v80H0zM80 80h80v80H80z" fill="#283b35"/><path d="M80 0a80 80 0 0 1 80 80H80zM0 80a80 80 0 0 1 80 80H0z" fill="#b86e43"/>')},
  {id:"studio-deco",name:"Deco Theatre",category:"Editorial",background:tile("#182b30",112,112,'<path d="M0 112V56a56 56 0 0 1 112 0v56M16 112V56a40 40 0 0 1 80 0v56M32 112V56a24 24 0 0 1 48 0v56M48 112V56a8 8 0 0 1 16 0v56" fill="none" stroke="#c49b65" stroke-width="2"/>')},
  {id:"studio-night",name:"Midnight Atlas",category:"Dark",background:contour("#101b29","#345870")},
  {id:"studio-observatory",name:"Observatory",category:"Dark",background:art("#171c28",Array.from({length:9},(_,i)=>`<circle cx="555" cy="160" r="${32+i*26}" fill="none" stroke="#53617c" stroke-width="1.4"/>`).join("")+'<circle cx="555" cy="160" r="24" fill="#c6ab7b"/><path d="M0 160h800M555 0v320" stroke="#6c7184" stroke-dasharray="4 9"/>')},
  {id:"studio-carbon",name:"Carbon Weave",category:"Dark",background:tile("#1e2426",80,80,'<path d="M0 0h40v80H0z" fill="#303b3e"/><path d="M0 0l40 40L0 80M40 0l40 40-40 40" fill="none" stroke="#657473" stroke-width="1.2"/>')},
  {id:"studio-paper",name:"Ivory Grid",category:"Light",background:tile("#f1eee5",64,64,'<path d="M0 0h64v64" fill="none" stroke="#c2c8bf" stroke-width="1"/><circle cx="32" cy="32" r="2" fill="#8b9b91"/>')},
  {id:"studio-ceramic",name:"Porcelain",category:"Light",background:tile("#f3eee3",100,100,'<path d="M50 0Q100 0 100 50Q50 50 50 0M0 50Q0 0 50 0Q50 50 0 50M50 100Q0 100 0 50Q50 50 50 100M100 50Q100 100 50 100Q50 50 100 50" fill="#b1c7cd"/><circle cx="50" cy="50" r="5" fill="#527989"/>')},
  {id:"studio-linen",name:"Linen Study",category:"Light",background:tile("#e8ddca",48,48,'<path d="M0 8h48M0 16h48M0 24h48M0 32h48M0 40h48M8 0v48M16 0v48M24 0v48M32 0v48M40 0v48" stroke="#ad9b82" stroke-width=".65" opacity=".5"/>')},
  {id:"studio-desert",name:"Desert Dusk",category:"Aesthetic",background:art("#e8c6a2",'<circle cx="590" cy="95" r="64" fill="#ba624a"/><path d="M0 220Q160 100 350 225T800 165V320H0z" fill="#bd8c71"/><path d="M0 265Q240 145 450 275T800 235V320H0z" fill="#815c51"/><path d="M0 300Q250 225 520 310T800 285V320H0z" fill="#493f42"/>')},
  {id:"studio-garden",name:"Quiet Garden",category:"Aesthetic",background:tile("#d8dfc8",130,130,'<path d="M65 130V12M65 90Q0 85 14 25Q65 29 65 90M65 65Q130 60 116 0Q65 4 65 65" fill="#73907b" stroke="#456b58" stroke-width="2"/><circle cx="25" cy="110" r="6" fill="#d2a276"/>')},
  {id:"studio-tide",name:"Pacific Tide",category:"Aesthetic",background:tile("#c3d5d5",160,80,'<path d="M-40 40Q0 0 40 40T120 40T200 40M-40 60Q0 20 40 60T120 60T200 60M-40 80Q0 40 40 80T120 80T200 80" fill="none" stroke="#527d86" stroke-width="3"/>')},
  {id:"studio-topo",name:"Terrain Survey",category:"Patterns",background:contour("#24483e","#83a98b")},
  {id:"studio-truchet",name:"Interlock",category:"Patterns",background:tile("#d6bda6",120,120,'<path d="M0 0a60 60 0 0 1 60 60M60 60a60 60 0 0 1 60 60M120 0a60 60 0 0 0-60 60M60 60a60 60 0 0 0-60 60" stroke="#884b43" stroke-width="22" fill="none"/>')},
  {id:"studio-check",name:"Checker Studio",category:"Patterns",background:tile("#d9d0bb",100,100,'<path d="M0 0h50v50H0zM50 50h50v50H50z" fill="#567069"/><path d="M0 50h50v50H0zM50 0h50v50H50z" fill="#e9dfcb"/><circle cx="25" cy="25" r="8" fill="#d9d0bb"/><circle cx="75" cy="75" r="8" fill="#d9d0bb"/>')},
  {id:"studio-blueprint",name:"Blueprint",category:"Technical",background:tile("#254764",120,120,'<path d="M0 0h120v120H0zM60 0v120M0 60h120" stroke="#587a93" stroke-width="1" fill="none"/><circle cx="60" cy="60" r="45" stroke="#9eb9c9" fill="none"/><path d="M15 15l90 90M105 15l-90 90" stroke="#9eb9c9" stroke-width=".7"/>')},
  {id:"studio-circuit",name:"Circuit Board",category:"Technical",background:tile("#193f37",140,100,'<path d="M0 20h45l25 25h70M0 75h65l25-25h50M35 0v35l20 20v45" fill="none" stroke="#77a68b" stroke-width="2"/><circle cx="70" cy="45" r="4" fill="#c4ab73"/><circle cx="55" cy="55" r="4" fill="#c4ab73"/>')},
  {id:"studio-architecture",name:"Concrete Forms",category:"Technical",background:art("#aeb5b2",'<path d="M0 320V80L220 0v320M220 0l230 90v230H220" fill="#5c6b6d"/><path d="M450 320V90L640 0v320M640 0l160 80v240H640" fill="#d7d6cc"/><path d="M220 0v320M450 90v230M640 0v320" stroke="#3f4a4d" stroke-width="4"/>')},

  {id:"studio-solid-ink",name:"Ink Blue",category:"Solids",background:"#233b57"},
  {id:"studio-solid-olive",name:"Olive Grove",category:"Solids",background:"#626b42"},
  {id:"studio-solid-clay",name:"Burnt Clay",category:"Solids",background:"#a4513e"},
  {id:"studio-solid-plum",name:"Mulberry",category:"Solids",background:"#69475f"},
  {id:"studio-solid-sand",name:"Warm Sand",category:"Solids",background:"#d6c2a3"},
  {id:"studio-solid-sage",name:"Silver Sage",category:"Solids",background:"#a6b6a7"},
  {id:"studio-noir",name:"Noir Facets",category:"Dark",background:art("#181a22",'<path d="M0 320L260 0h210L170 320z" fill="#252936"/><path d="M470 0h330L520 320H170z" fill="#313543"/><path d="M660 0L380 320" stroke="#777b8c" stroke-width="1"/>')},
  {id:"studio-eclipse",name:"Eclipse",category:"Dark",background:art("#141923",'<circle cx="550" cy="160" r="130" fill="#29374a"/><circle cx="570" cy="145" r="125" fill="#141923"/><circle cx="720" cy="62" r="3" fill="#cbb98d"/>')},
  {id:"studio-night-grid",name:"Night Matrix",category:"Dark",background:tile("#141c24",72,72,'<path d="M0 0h72v72" fill="none" stroke="#354959"/><circle cx="36" cy="36" r="2" fill="#719c99"/><path d="M0 36h72M36 0v72" stroke="#293743" stroke-dasharray="3 5"/>')},
  {id:"studio-gradient-dawn",name:"Dawn Layers",category:"Gradients",background:"linear-gradient(145deg,transparent 40%,rgba(244,191,154,.35) 40% 58%,transparent 58%),linear-gradient(115deg,#555779,#ba7d83 57%,#f2c9a0)"},
  {id:"studio-gradient-lagoon",name:"Lagoon Glass",category:"Gradients",background:"repeating-linear-gradient(115deg,transparent 0 45px,rgba(225,250,232,.13) 46px 47px,transparent 48px 90px),linear-gradient(130deg,#17394a,#427e81 55%,#acd5bb)"},
  {id:"studio-gradient-ink",name:"Indigo Current",category:"Gradients",background:"radial-gradient(ellipse at 85% 120%,#d5a8c1 0%,transparent 55%),linear-gradient(120deg,#202847,#4b5492 60%,#8d86bc)"},
  {id:"studio-gradient-amber",name:"Amber Horizon",category:"Gradients",background:"linear-gradient(0deg,rgba(29,23,42,.28) 0 20%,transparent 20% 36%,rgba(255,225,169,.16) 36% 38%,transparent 38%),linear-gradient(120deg,#7b3b4b,#c67753,#f0c47a)"},
  {id:"studio-gradient-frost",name:"Frosted Arc",category:"Gradients",background:"radial-gradient(circle at 80% 130%,transparent 45%,rgba(255,255,255,.55) 45% 46%,transparent 46% 58%,rgba(255,255,255,.45) 58% 59%,transparent 59%),linear-gradient(135deg,#d7e4e9,#9fbbd4,#c1b7db)"},

  {id:"studio-solid-oxblood",name:"Oxblood",category:"Solids",background:"#783b46"},
  {id:"studio-solid-cobalt",name:"Cobalt Studio",category:"Solids",background:"#3456a3"},
  {id:"studio-dark-engraving",name:"Midnight Engraving",category:"Dark",background:tile("#20232b",120,120,'<path d="M-60 120L120 -60M-30 120L120 -30M0 120L120 0M30 120L120 30M60 120L120 60M90 120L120 90" stroke="#4b515e" stroke-width="1.4"/><path d="M0 60L60 0L120 60L60 120Z" fill="none" stroke="#a08e6d" stroke-width="1"/>')},
  {id:"studio-gradient-violet",name:"Violet Refraction",category:"Gradients",background:"linear-gradient(120deg,transparent 30%,rgba(229,204,245,.22) 30% 42%,transparent 42% 59%,rgba(215,220,255,.16) 59% 61%,transparent 61%),linear-gradient(135deg,#292b59,#695490 56%,#b9a1cd)"},
  {id:"studio-riso",name:"Risograph Bloom",category:"Aesthetic",background:art("#f1dfc8",'<g fill="#b95b5c"><circle cx="585" cy="160" r="70"/><circle cx="515" cy="160" r="70"/><circle cx="550" cy="100" r="70"/><circle cx="550" cy="220" r="70"/></g><circle cx="550" cy="160" r="38" fill="#e8b45e"/><path d="M0 270Q220 90 470 260" fill="none" stroke="#5c796b" stroke-width="12"/>')},
  {id:"studio-herringbone",name:"Herringbone Press",category:"Patterns",background:tile("#ded8c8",120,80,'<path d="M0 0L60 40L120 0M0 20L60 60L120 20M0 40L60 80L120 40" fill="none" stroke="#59736d" stroke-width="7"/><path d="M60 0V80" stroke="#f3ebd8" stroke-width="3"/>')},
  {id:"studio-minimal-offset",name:"Offset",category:"Minimal",background:art("#ede9df",'<rect x="510" y="0" width="290" height="320" fill="#b3b9ad"/><circle cx="510" cy="160" r="110" fill="#383f3b"/><path d="M510 0V320" stroke="#ede9df" stroke-width="2"/>')},
  {id:"studio-modern-signal",name:"Signal",category:"Modern",background:art("#192d48",'<path d="M430 0H800V320H430Z" fill="#29466b"/><path d="M450 250L560 140L620 200L800 20" fill="none" stroke="#8fbdba" stroke-width="14"/><path d="M450 285L560 175L620 235L800 55" fill="none" stroke="#d0a46c" stroke-width="3"/><circle cx="560" cy="140" r="13" fill="#e7dec9"/>')},
];
export const BANNER_PRESETS = covers;
export const bannerBackground = (key: string) => [...covers, ...legacy, ...generated].find(p => p.id === key)?.background || undefined;
export { PROJECT_ICONS } from "./projectIcons";
