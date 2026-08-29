"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Image as ImageIcon, Map as MapIcon, Play } from "lucide-react";
import type { AppId } from "@/data/prototype";
import type { LivedPhoto } from "@/lib/brain/lived-history-types";
import { readTravelNavigation, sendTravelNavigation, TravelPhotoViewer, useLivedHistory } from "./lived-history";

const monthName = new Intl.DateTimeFormat("en", { month: "long" });

export default function PhotosApp({ onOpenApp }: { onOpenApp: (appId: AppId) => void }) {
  const { history, error } = useLivedHistory();
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [view, setView] = useState<"journey" | "places">("journey");
  const [visibleSections, setVisibleSections] = useState(6);
  useEffect(() => setVisibleSections(6), [view]);
  useEffect(() => {
    if (!history) return;
    const intent = readTravelNavigation("photos");
    if (intent?.photoId && history.photos.some((photo) => photo.id === intent.photoId)) setSelectedPhotoId(intent.photoId);
  }, [history]);
  const chapters = useMemo(() => {
    if (!history) return [];
    const values = new Map<string, { key: string; year: number | null; month: number | null; title: string; places: Set<string>; photos: LivedPhoto[] }>();
    history.photos.forEach((photo) => {
      const key = photo.capturedYear && photo.capturedMonth ? `${photo.capturedYear}-${String(photo.capturedMonth).padStart(2, "0")}` : "undated";
      if (!values.has(key)) values.set(key, { key, year: photo.capturedYear, month: photo.capturedMonth, title: photo.capturedYear && photo.capturedMonth ? `${monthName.format(new Date(2020, photo.capturedMonth - 1))} ${photo.capturedYear}` : "Undated", places: new Set(), photos: [] });
      const chapter = values.get(key)!;
      chapter.photos.push(photo);
      if (photo.displayPlace || photo.visitPlace) chapter.places.add(photo.displayPlace || photo.visitPlace!);
    });
    return Array.from(values.values()).sort((a, b) => a.key === "undated" ? 1 : b.key === "undated" ? -1 : b.key.localeCompare(a.key));
  }, [history]);
  const placeGroups = useMemo(() => {
    if (!history) return [];
    const values = new Map<string, { key: string; place: string; country: string; photos: LivedPhoto[] }>();
    history.photos.forEach((photo) => {
      const place = photo.displayPlace || photo.visitPlace || "Unplaced";
      const key = `${photo.country || ""}:${place}`;
      if (!values.has(key)) values.set(key, { key, place, country: photo.country || "", photos: [] });
      values.get(key)!.photos.push(photo);
    });
    return Array.from(values.values()).sort((a, b) => b.photos.length - a.photos.length || a.place.localeCompare(b.place));
  }, [history]);
  if (error) return <div className="travel-state"><ImageIcon /><strong>Photos could not be opened.</strong><span>{error}</span></div>;
  if (!history) return <div className="travel-state"><span className="travel-spinner"/><strong>Developing the journey…</strong></div>;
  const viewerPhotos = history.photos;
  const sections = view === "journey" ? chapters : placeGroups;
  const hasMore = sections.length > visibleSections;
  return <div className="journey-photos system-app">
    <header className="journey-photos__toolbar"><div><strong>Photos</strong><span>{history.stats.photos} photographs from the road</span></div><div className="os-segment"><button className={view === "journey" ? "is-selected" : ""} onClick={() => setView("journey")}><CalendarDays /> Journey</button><button className={view === "places" ? "is-selected" : ""} onClick={() => setView("places")}><MapIcon /> Places</button></div></header>
    <main className="journey-photos__scroll">
      <section className="journey-photos__intro"><span>SEPTEMBER 2023 — NOW</span><h1>A life in motion.</h1><p>A chronological record of slow travel.</p></section>
      {view === "journey" ? chapters.slice(0, visibleSections).map((chapter) => <section className="photo-chapter" key={chapter.key}><header><div><h2>{chapter.title}</h2><p>{Array.from(chapter.places).slice(0, 4).join(" · ")}{chapter.places.size > 4 ? ` + ${chapter.places.size - 4} more` : ""}</p></div><span>{chapter.photos.length}</span></header><PhotoMosaic photos={chapter.photos} onOpen={setSelectedPhotoId}/></section>) : placeGroups.slice(0, visibleSections).map((group) => <section className="photo-chapter" key={group.key}><header><div><h2>{group.place}</h2><p>{group.country}</p></div><span>{group.photos.length}</span></header><PhotoMosaic photos={group.photos} onOpen={setSelectedPhotoId}/></section>)}
      {hasMore && <button className="photo-load-more" onClick={()=>setVisibleSections((count)=>count+6)}>Show more {view === "journey" ? "of the journey" : "places"} <span>{sections.length-visibleSections} remaining</span></button>}
    </main>
    {selectedPhotoId && <TravelPhotoViewer photos={viewerPhotos} photoId={selectedPhotoId} onChange={setSelectedPhotoId} onClose={() => setSelectedPhotoId(null)} onShowMap={(photo) => { sendTravelNavigation({ destination: "atlas", visitId: photo.visitId, photoId: photo.id }); onOpenApp("atlas"); }} />}
  </div>;
}

function PhotoMosaic({ photos, onOpen }: { photos: LivedPhoto[]; onOpen: (id: string) => void }) {
  return <div className="photo-mosaic">{photos.map((photo) => {
    const place = [photo.displayPlace || photo.visitPlace, photo.country].filter(Boolean).join(", ");
    return <button key={photo.id} className={`photo-mosaic__item is-${photo.orientation}`} style={{ aspectRatio: photo.width && photo.height ? `${photo.width}/${photo.height}` : "4/3" }} onClick={() => onOpen(photo.id)} aria-label={`Open photograph${place ? ` from ${place}` : ""}`}><img src={photo.derivatives.small.url} alt="" loading="lazy"/>{photo.hasPrivateMotion && <i title="Live Photo"><Play /></i>}<span>{photo.displayPlace || photo.visitPlace || "Unplaced"}</span></button>;
  })}</div>;
}
