"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, MapPin, X } from "lucide-react";
import type { LivedHistory, LivedPhoto } from "@/lib/brain/lived-history-types";

export const TRAVEL_NAVIGATION_EVENT = "synergetic:travel-navigation";
export const TRAVEL_NAVIGATION_KEY = "synergetic.travel-navigation";

export interface TravelNavigationIntent {
  destination: "atlas" | "photos";
  visitId?: string | null;
  photoId?: string | null;
}

export function sendTravelNavigation(intent: TravelNavigationIntent) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(TRAVEL_NAVIGATION_KEY, JSON.stringify(intent));
  window.dispatchEvent(new CustomEvent(TRAVEL_NAVIGATION_EVENT, { detail: intent }));
}

export function readTravelNavigation(destination: TravelNavigationIntent["destination"]) {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(sessionStorage.getItem(TRAVEL_NAVIGATION_KEY) || "null") as TravelNavigationIntent | null;
    return value?.destination === destination ? value : null;
  } catch { return null; }
}

export function useLivedHistory() {
  const [history, setHistory] = useState<LivedHistory | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    fetch("/api/brain/travel-photos").then((response) => {
      if (!response.ok) throw new Error("The lived-history archive is unavailable.");
      return response.json();
    }).then((value) => active && setHistory(value)).catch((reason) => active && setError(reason.message));
    return () => { active = false; };
  }, []);
  return { history, error };
}

const dateFormatter = new Intl.DateTimeFormat("en", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export function photoDate(photo: LivedPhoto) {
  if (photo.captureDate) return dateFormatter.format(new Date(`${photo.captureDate}T12:00:00Z`));
  if (photo.capturedYear && photo.capturedMonth) return new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(new Date(photo.capturedYear, photo.capturedMonth - 1));
  return "Date unavailable";
}

export function TravelPhotoViewer({ photos, photoId, onClose, onChange, onShowMap }: {
  photos: LivedPhoto[];
  photoId: string;
  onClose: () => void;
  onChange: (photoId: string) => void;
  onShowMap?: (photo: LivedPhoto) => void;
}) {
  const [imageState, setImageState] = useState<"loading" | "loaded" | "failed">("loading");
  const index = useMemo(() => Math.max(0, photos.findIndex((photo) => photo.id === photoId)), [photos, photoId]);
  const photo = photos[index];
  const move = useCallback((delta: number) => {
    if (!photos.length) return;
    onChange(photos[(index + delta + photos.length) % photos.length].id);
  }, [photos, index, onChange]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") move(-1);
      if (event.key === "ArrowRight") move(1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [move, onClose]);
  useEffect(() => setImageState("loading"), [photo?.id]);
  if (!photo || typeof document === "undefined") return null;
  const place = [photo.displayPlace || photo.visitPlace, photo.country].filter(Boolean).join(", ");
  return createPortal(<div className="travel-viewer travel-viewer--portal" role="dialog" aria-modal="true" aria-label="Photo viewer">
    <button className="travel-viewer__close" onClick={onClose} aria-label="Close photo"><X /></button>
    {photos.length > 1 && <><button className="travel-viewer__previous" onClick={() => move(-1)} aria-label="Previous photo"><ChevronLeft /></button><button className="travel-viewer__next" onClick={() => move(1)} aria-label="Next photo"><ChevronRight /></button></>}
    <div className={`travel-viewer__image is-${imageState}`}><img src={photo.derivatives.large.url} alt={place ? `Travel photograph from ${place}` : "Travel photograph"} onLoad={() => setImageState("loaded")} onError={() => setImageState("failed")} />{imageState !== "loaded" && <span>{imageState === "failed" ? "This photograph could not be loaded." : "Loading photograph…"}</span>}</div>
    <footer><div><strong>{place || "Somewhere along the way"}</strong><span>{photoDate(photo)}{photo.hasPrivateMotion ? " · Live Photo still" : ""}</span></div>{onShowMap && photo.visitId && <button onClick={() => onShowMap(photo)}><MapPin /> Show on Map</button>}</footer>
  </div>, document.body);
}
