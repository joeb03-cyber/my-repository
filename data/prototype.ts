export type AppId =
  | "library"
  | "atlas"
  | "laboratory"
  | "reality"
  | "journal"
  | "archive"
  | "practice"
  | "about";

export const wallpapers = [
  { id: "sarajevo-dusk", className: "wallpaper--sarajevo-photo", label: "Sarajevo at dusk", location: "Bosnia & Herzegovina", credit: "Sporisevic Photography · Unsplash" },
] as const;
