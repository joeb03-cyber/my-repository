import type { AppId } from "@/data/prototype";

export type AppIconName =
  | "finder"
  | "books"
  | "maps"
  | "messages"
  | "notes"
  | "photos"
  | "human"
  | "browser"
  | "settings"
  | "trash"
  | "practice";

export const iconForApp: Partial<Record<AppId, AppIconName>> = {
  finder: "finder",
  library: "books",
  atlas: "maps",
  messages: "messages",
  journal: "notes",
  photos: "photos",
  laboratory: "human",
  browser: "browser",
  about: "settings",
  trash: "trash",
  practice: "practice",
};

export default function AppIcon({ name }: { name: AppIconName }) {
  return <span className={`app-icon app-icon--${name}`} aria-hidden="true"><IconArtwork name={name} /></span>;
}

function IconArtwork({ name }: { name: AppIconName }) {
  if (name === "finder") return <svg viewBox="0 0 48 48"><path className="finder-fold" d="M24 2v44"/><path d="M13.5 18.5c1.8-2 4-3 6.5-3M28 15.5c2.8 0 5 1 6.6 3M16 29c2.2 3.4 5 5 8 5s5.8-1.6 8-5"/><circle cx="19" cy="22" r="1.2"/><circle cx="30" cy="22" r="1.2"/></svg>;
  if (name === "books") return <svg viewBox="0 0 48 48"><path className="book-page" d="M8 11c6-2 11-.7 16 3v25c-5-3.5-10-4.4-16-2.2z"/><path className="book-page book-page--right" d="M40 11c-6-2-11-.7-16 3v25c5-3.5 10-4.4 16-2.2z"/><path d="M24 14v25M12 16.5c3.6-.5 6.5.2 9 2M36 16.5c-3.6-.5-6.5.2-9 2"/></svg>;
  if (name === "maps") return <svg viewBox="0 0 48 48"><path className="map-sheet map-sheet--left" d="M5 9l12-4v34L5 43z"/><path className="map-sheet map-sheet--middle" d="M17 5l14 5v34l-14-5z"/><path className="map-sheet map-sheet--right" d="M31 10l12-4v34l-12 4z"/><path className="map-route" d="M9 31c8-13 13 5 21-8 4-6 7-3 10-8"/><circle className="map-pin" cx="30" cy="23" r="3"/></svg>;
  if (name === "messages") return <svg viewBox="0 0 48 48"><path className="bubble bubble--back" d="M9 11h24a8 8 0 018 8v7a8 8 0 01-8 8H21l-8 6 1.6-7.2A8 8 0 019 26z"/><path className="bubble bubble--front" d="M6 9h25a8 8 0 018 8v6a8 8 0 01-8 8H18l-8 6 1.7-7.4A8 8 0 016 23z"/><circle cx="16" cy="20" r="1.6"/><circle cx="23" cy="20" r="1.6"/><circle cx="30" cy="20" r="1.6"/></svg>;
  if (name === "notes") return <svg viewBox="0 0 48 48"><path className="note-paper" d="M9 6h30v37H9z"/><path className="note-cap" d="M9 6h30v9H9z"/><path d="M15 21h18M15 26h18M15 31h13M15 36h9"/></svg>;
  if (name === "photos") return <svg viewBox="0 0 48 48"><g className="photo-petals"><ellipse cx="24" cy="11" rx="5" ry="9"/><ellipse cx="24" cy="37" rx="5" ry="9"/><ellipse cx="11" cy="24" rx="9" ry="5"/><ellipse cx="37" cy="24" rx="9" ry="5"/><ellipse transform="rotate(45 15 15)" cx="15" cy="15" rx="5" ry="9"/><ellipse transform="rotate(45 33 33)" cx="33" cy="33" rx="5" ry="9"/><ellipse transform="rotate(-45 33 15)" cx="33" cy="15" rx="5" ry="9"/><ellipse transform="rotate(-45 15 33)" cx="15" cy="33" rx="5" ry="9"/></g><circle className="photo-core" cx="24" cy="24" r="5"/></svg>;
  if (name === "human") return <svg viewBox="0 0 48 48"><circle className="human-head" cx="24" cy="11" r="5"/><path className="human-body" d="M16 20c2.7-3 5.3-4.5 8-4.5s5.3 1.5 8 4.5l4 8-5 2-2-5v17H19V25l-2 5-5-2z"/><path className="human-pulse" d="M15 27h6l2-4 3 8 2-4h6"/></svg>;
  if (name === "browser") return <svg viewBox="0 0 48 48"><circle className="browser-orbit" cx="24" cy="24" r="17"/><circle className="browser-ring" cx="24" cy="24" r="13"/><path className="browser-needle" d="M28.5 18.5l-3 8-8 3 3-8z"/><circle cx="24" cy="24" r="1.8"/></svg>;
  if (name === "settings") return <svg viewBox="0 0 48 48"><circle className="setting-ring" cx="24" cy="24" r="15"/><circle className="setting-ring setting-ring--inner" cx="24" cy="24" r="8"/><path d="M24 5v7M24 36v7M5 24h7M36 24h7M10.5 10.5l5 5M32.5 32.5l5 5M37.5 10.5l-5 5M15.5 32.5l-5 5"/><circle className="setting-core" cx="24" cy="24" r="3"/></svg>;
  if (name === "trash") return <svg viewBox="0 0 48 48"><path className="trash-lid" d="M12 13h24M19 9h10"/><path className="trash-bin" d="M14 16l2 26h16l2-26z"/><path d="M20 21l1 15M28 21l-1 15"/><path className="trash-paper" d="M18 7l4 4 4-5 5 5"/></svg>;
  return <svg viewBox="0 0 48 48"><circle className="practice-ring" cx="24" cy="24" r="16"/><path d="M24 13c-5 6-7 10-7 14a7 7 0 0014 0c0-4-2-8-7-14z"/></svg>;
}
