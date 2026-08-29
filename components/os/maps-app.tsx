"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, LocateFixed, MapPin, Search, X } from "lucide-react";
import maplibregl, { type Map as MapLibreMap, type Marker } from "maplibre-gl";
import { feature } from "topojson-client";
import world from "world-atlas/countries-110m.json";
import type { AppId } from "@/data/prototype";
import type { LivedPhoto, LivedVisit } from "@/lib/brain/lived-history-types";
import { readTravelNavigation, TRAVEL_NAVIGATION_EVENT, TravelPhotoViewer, useLivedHistory, type TravelNavigationIntent } from "./lived-history";

const months = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const countryAliases: Record<string, string> = {
  "United States": "United States of America", "Dominican Republic": "Dominican Rep.",
  "Bosnia and Herzegovina": "Bosnia and Herz.", "Czech Republic": "Czechia", "North Macedonia": "Macedonia",
};

function rangeLabel(visit: LivedVisit) {
  const start = `${months[visit.start.month]} ${visit.start.year}`;
  const end = `${months[visit.end.month]} ${visit.end.year}`;
  return start === end ? start : `${start} — ${end}`;
}

function routeGeoJSON(visits: LivedVisit[]) {
  const features: Array<{ type: "Feature"; properties: { from: string; to: string }; geometry: { type: "LineString"; coordinates: number[][] } }> = [];
  for (let index = 1; index < visits.length; index += 1) {
    const previous = visits[index - 1], current = visits[index];
    if (previous.latitude == null || previous.longitude == null || current.latitude == null || current.longitude == null) continue;
    if (Math.abs(previous.longitude - current.longitude) > 180) continue;
    const toRadians = (value: number) => value * Math.PI / 180;
    const toDegrees = (value: number) => value * 180 / Math.PI;
    const a = [toRadians(previous.longitude), toRadians(previous.latitude)];
    const b = [toRadians(current.longitude), toRadians(current.latitude)];
    const angularDistance = Math.acos(Math.min(1, Math.max(-1, Math.sin(a[1]) * Math.sin(b[1]) + Math.cos(a[1]) * Math.cos(b[1]) * Math.cos(b[0] - a[0]))));
    const coordinates = Array.from({ length: 17 }, (_, step) => {
      const amount = step / 16;
      if (angularDistance < 0.000001) return [previous.longitude!, previous.latitude!];
      const scaleA = Math.sin((1 - amount) * angularDistance) / Math.sin(angularDistance);
      const scaleB = Math.sin(amount * angularDistance) / Math.sin(angularDistance);
      const x = scaleA * Math.cos(a[1]) * Math.cos(a[0]) + scaleB * Math.cos(b[1]) * Math.cos(b[0]);
      const y = scaleA * Math.cos(a[1]) * Math.sin(a[0]) + scaleB * Math.cos(b[1]) * Math.sin(b[0]);
      const z = scaleA * Math.sin(a[1]) + scaleB * Math.sin(b[1]);
      return [toDegrees(Math.atan2(y, x)), toDegrees(Math.atan2(z, Math.sqrt(x * x + y * y)))];
    });
    features.push({ type: "Feature", properties: { from: previous.id, to: current.id }, geometry: { type: "LineString", coordinates } });
  }
  return { type: "FeatureCollection" as const, features };
}

export default function MapsApp({ onOpenApp: _onOpenApp }: { onOpenApp?: (appId: AppId) => void }) {
  const { history, error } = useLivedHistory();
  const mapNode = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const [query, setQuery] = useState("");
  const [year, setYear] = useState<number | "all">("all");
  const [selectedVisitId, setSelectedVisitId] = useState<string | null>(null);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);

  const chooseVisit = useCallback((visitId: string, fly = true) => {
    setSelectedVisitId(visitId);
    const visit = history?.visits.find((candidate) => candidate.id === visitId);
    if (fly && visit?.longitude != null && visit.latitude != null) mapRef.current?.easeTo({ center: [visit.longitude, visit.latitude], zoom: Math.max(mapRef.current.getZoom(), 4.4), duration: 850 });
  }, [history]);

  useEffect(() => {
    if (!history) return;
    const apply = (intent: TravelNavigationIntent | null) => {
      if (!intent || intent.destination !== "atlas") return;
      if (intent.visitId) chooseVisit(intent.visitId);
    };
    apply(readTravelNavigation("atlas"));
    setSelectedVisitId((current) => current || history.visits.at(-1)?.id || null);
    const handler = (event: Event) => apply((event as CustomEvent<TravelNavigationIntent>).detail);
    window.addEventListener(TRAVEL_NAVIGATION_EVENT, handler);
    return () => window.removeEventListener(TRAVEL_NAVIGATION_EVENT, handler);
  }, [history, chooseVisit]);

  useEffect(() => {
    if (!history || !mapNode.current || mapRef.current) return;
    const map = new maplibregl.Map({ container: mapNode.current, style: "https://tiles.openfreemap.org/styles/liberty", center: [18, 25], zoom: 1.45, minZoom: 1, attributionControl: false });
    mapRef.current = map;
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(mapNode.current);
    map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: false }), "top-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: "Nomadic journey since Sep 2023 · sequence, not a GPS track" }), "bottom-right");
    map.on("load", () => {
      const countries = feature(world as any, (world as any).objects.countries) as any;
      const visited = new Set(history.lifetimeCountries.map((name) => countryAliases[name] || name));
      const highlighted = { type: "FeatureCollection" as const, features: countries.features.filter((country: any) => visited.has(String(country.properties?.name))) };
      map.addSource("visited-countries", { type: "geojson", data: highlighted });
      map.addLayer({ id: "visited-countries-fill", type: "fill", source: "visited-countries", paint: { "fill-color": "#6ba77b", "fill-opacity": 0.16 } });
      map.addLayer({ id: "visited-countries-line", type: "line", source: "visited-countries", paint: { "line-color": "#45815b", "line-opacity": 0.35, "line-width": 0.7 } });
      map.addSource("journey-route", { type: "geojson", data: routeGeoJSON(history.visits) });
      map.addLayer({ id: "journey-route", type: "line", source: "journey-route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#e05d46", "line-width": 2, "line-opacity": 0.62, "line-dasharray": [2, 2] } });
      setMapReady(true);
    });
    map.on("error", (event) => { if (!event.error?.message?.includes("glyph")) setMapFailed(true); });
    return () => { resizeObserver.disconnect(); markersRef.current.forEach((marker) => marker.remove()); markersRef.current = []; map.remove(); mapRef.current = null; };
  }, [history]);

  useEffect(() => {
    const map = mapRef.current;
    if (!history || !map || !mapReady) return;
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = history.visits.filter((visit) => visit.latitude != null && visit.longitude != null).map((visit) => {
      const node = document.createElement("button");
      node.className = `journey-marker${visit.id === selectedVisitId ? " is-selected" : ""}${visit.photoCount ? " has-photos" : ""}`;
      node.type = "button"; node.title = `${visit.place}, ${visit.country}`; node.setAttribute("aria-label", node.title);
      node.addEventListener("click", () => chooseVisit(visit.id));
      return new maplibregl.Marker({ element: node, anchor: "center" }).setLngLat([visit.longitude!, visit.latitude!]).addTo(map);
    });
    const current = history.currentLocation;
    if (current?.latitude != null && current.longitude != null) {
      const node = document.createElement("div"); node.className = "journey-marker is-current"; node.title = `Now: ${current.canonical_name}`;
      markersRef.current.push(new maplibregl.Marker({ element: node, anchor: "center" }).setLngLat([current.longitude, current.latitude]).addTo(map));
    }
  }, [history, mapReady, selectedVisitId, chooseVisit]);

  const years = useMemo(() => history ? Array.from(new Set(history.visits.map((visit) => visit.start.year))).sort((a, b) => b - a) : [], [history]);
  const filteredVisits = useMemo(() => {
    const value = query.trim().toLowerCase();
    return (history?.visits || []).filter((visit) => (year === "all" || visit.start.year === year || visit.end.year === year) && (!value || `${visit.place} ${visit.country}`.toLowerCase().includes(value))).sort((a, b) => b.chronologyIndex - a.chronologyIndex);
  }, [history, query, year]);
  const selectedVisit = history?.visits.find((visit) => visit.id === selectedVisitId) || null;
  const visitPhotos = history?.photos.filter((photo) => photo.visitId === selectedVisit?.id) || [];
  const photoIndex = history?.photos.findIndex((photo) => photo.id === selectedPhotoId) ?? -1;
  const moveVisit = (delta: number) => {
    if (!history || !selectedVisit) return;
    const index = history.visits.findIndex((visit) => visit.id === selectedVisit.id);
    const target = history.visits[Math.max(0, Math.min(history.visits.length - 1, index + delta))];
    if (target) chooseVisit(target.id);
  };

  if (error) return <div className="travel-state"><MapPin /><strong>Maps could not be opened.</strong><span>{error}</span></div>;
  if (!history) return <div className="travel-state"><LocateFixed className="is-locating"/><strong>Opening the journey…</strong></div>;
  return <div className="journey-maps system-app">
    <aside className="journey-maps__rail"><header><strong>Nomadic Journey</strong><span>{history.stats.visits} visits since Sep 2023 · {history.stats.lifetimeCountries} countries lifetime</span></header><label className="system-search"><Search/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search places" aria-label="Search places"/>{query && <button onClick={() => setQuery("")} aria-label="Clear"><X/></button>}</label><div className="journey-years"><button className={year === "all" ? "is-selected" : ""} onClick={() => setYear("all")}>All</button>{years.map((value) => <button key={value} className={year === value ? "is-selected" : ""} onClick={() => setYear(value)}>{value}</button>)}</div><div className="journey-timeline">{filteredVisits.map((visit, index) => { const previous = filteredVisits[index - 1]; return <div key={visit.id}>{(!previous || previous.start.year !== visit.start.year) && <b>{visit.start.year}</b>}<button className={selectedVisitId === visit.id ? "is-selected" : ""} onClick={() => chooseVisit(visit.id)}><i className={visit.photoCount ? "has-photos" : ""}/><span><strong>{visit.place}</strong><small>{rangeLabel(visit)} · {visit.country}{visit.photoCount ? ` · ${visit.photoCount} photo${visit.photoCount === 1 ? "" : "s"}` : ""}</small></span></button></div>; })}</div></aside>
    <section className="journey-map"><div ref={mapNode} className="journey-map__canvas"/>{mapFailed && <div className="journey-map__notice">The detailed map could not load. Your chronology remains available.</div>}{selectedVisit && <VisitDrawer visit={selectedVisit} photos={visitPhotos} onPhoto={setSelectedPhotoId} onPrevious={() => moveVisit(-1)} onNext={() => moveVisit(1)} />}</section>
    {selectedPhotoId && photoIndex >= 0 && <TravelPhotoViewer photos={history.photos} photoId={selectedPhotoId} onChange={setSelectedPhotoId} onClose={() => setSelectedPhotoId(null)} />}
  </div>;
}

function VisitDrawer({ visit, photos, onPhoto, onPrevious, onNext }: { visit: LivedVisit; photos: LivedPhoto[]; onPhoto: (id: string) => void; onPrevious: () => void; onNext: () => void }) {
  return <article className="visit-drawer"><header><div><span>{visit.country}</span><h2>{visit.place}</h2><p><CalendarDays /> {rangeLabel(visit)}</p></div><div><button onClick={onPrevious} aria-label="Previous visit"><ChevronLeft/></button><button onClick={onNext} aria-label="Next visit"><ChevronRight/></button></div></header>{photos.length > 0 ? <div className="visit-drawer__photos">{photos.slice(0, 8).map((photo) => <button key={photo.id} onClick={() => onPhoto(photo.id)} style={{ aspectRatio: photo.width && photo.height ? `${photo.width}/${photo.height}` : "4/3" }}><img src={photo.derivatives.small.url} alt="" loading="lazy"/></button>)}</div> : <p className="visit-drawer__empty">This visit is part of the route, but has no selected photographs.</p>}{photos.length > 8 && <small>+ {photos.length - 8} more photographs</small>}</article>;
}
