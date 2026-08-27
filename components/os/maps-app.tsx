"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronRight, LocateFixed, MapPin, Search } from "lucide-react";
import type { TravelPlace, TravelTimeline, TravelVisit } from "@/lib/brain/travel-types";

const months = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fallbackYears = [2026, 2025, 2024, 2023];

function point(place: TravelPlace) {
  return { x: ((place.longitude as number) + 180) / 360 * 1000, y: (90 - (place.latitude as number)) / 180 * 500 };
}

function rangeLabel(visit: TravelVisit) {
  const start = `${months[visit.start.month]} ${visit.start.year}`;
  const end = `${months[visit.end.month]} ${visit.end.year}`;
  return start === end ? start : `${start} — ${end}`;
}

export default function MapsApp() {
  const [timeline, setTimeline] = useState<TravelTimeline | null>(null);
  const [error, setError] = useState(false);
  const [year, setYear] = useState<number | "all">("all");
  const [query, setQuery] = useState("");
  const [selectedVisitId, setSelectedVisitId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/brain/travel").then((response) => {
      if (!response.ok) throw new Error("Travel timeline unavailable");
      return response.json();
    }).then((data) => { if (active) { setTimeline(data); setSelectedVisitId(data.visits[data.visits.length - 1]?.id ?? null); } }).catch(() => active && setError(true));
    return () => { active = false; };
  }, []);

  const placeById = useMemo(() => new Map((timeline?.places || []).map((place) => [place.id, place])), [timeline]);
  const visits = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return (timeline?.visits || []).filter((visit) => {
      const place = placeById.get(visit.placeId);
      return (year === "all" || visit.start.year === year || visit.end.year === year)
        && (!normalized || `${place?.name} ${place?.countryName} ${visit.sourceValue}`.toLowerCase().includes(normalized));
    });
  }, [timeline, placeById, year, query]);
  const visibleLatestFirst = [...visits].sort((a, b) => a.sourcePosition - b.sourcePosition || a.groupPosition - b.groupPosition);
  const mappedVisits = visits.filter((visit) => {
    const place = placeById.get(visit.placeId); return place?.latitude != null && place.longitude != null;
  });
  const selectedVisit = (timeline?.visits || []).find((visit) => visit.id === selectedVisitId) || visibleLatestFirst[0];
  const selectedPlace = selectedVisit ? placeById.get(selectedVisit.placeId) : undefined;
  const uniqueMappedPlaces = Array.from(new Map(mappedVisits.map((visit) => [visit.placeId, placeById.get(visit.placeId) as TravelPlace])).values());

  if (error) return <div className="maps-state"><MapPin/><strong>Travel history is temporarily unavailable.</strong><span>The staging Brain did not respond.</span></div>;
  if (!timeline) return <div className="maps-state"><LocateFixed className="is-locating"/><strong>Opening the travel archive…</strong><span>Loading the staging Brain</span></div>;

  return <div className="maps-app system-app">
    <aside className="maps-sidebar">
      <div className="maps-sidebar__head"><strong>Places</strong><span>{timeline.stats.visits} visits · {timeline.stats.countries} countries</span></div>
      <label className="system-search maps-search"><Search/><input value={query} onChange={(event)=>setQuery(event.target.value)} aria-label="Search travel history" placeholder="Search places"/>{query && <button onClick={()=>setQuery("")} aria-label="Clear search">×</button>}</label>
      <div className="maps-years" aria-label="Filter by year"><button className={year==="all"?"is-selected":""} onClick={()=>setYear("all")}>All</button>{fallbackYears.map((value)=><button key={value} className={year===value?"is-selected":""} onClick={()=>setYear(value)}>{value}</button>)}</div>
      <div className="maps-timeline">
        {visibleLatestFirst.map((visit, index) => {
          const place = placeById.get(visit.placeId); if (!place) return null;
          const previous = visibleLatestFirst[index-1]; const showYear = !previous || previous.start.year !== visit.start.year;
          return <div key={visit.id}>{showYear && <span className="maps-year-label">{visit.start.year}</span>}<button className={selectedVisit?.id===visit.id?"is-selected":""} onClick={()=>setSelectedVisitId(visit.id)}>
            <span className={`maps-pin-dot ${place.latitude==null?"is-unresolved":""}`}/><span><strong>{place.name}</strong><small>{visit.sourceDateText} · {place.countryName}</small></span><ChevronRight/>
          </button></div>;
        })}
        {!visibleLatestFirst.length && <div className="maps-empty">No matching visits.</div>}
      </div>
    </aside>
    <section className="maps-canvas">
      <div className="maps-toolbar"><span><MapPin/> Route since September 2023</span><div className="maps-map-count">{mappedVisits.length} mapped · {timeline.stats.unresolvedPlaces} labels awaiting coordinates</div></div>
      <div className="world-map" aria-label="World map of travel history">
        <img src="/maps/world-110m.svg" alt=""/>
        <svg viewBox="0 0 1000 500" preserveAspectRatio="none" role="img" aria-label="Chronological travel route">
          <g className="journey-route">{mappedVisits.slice(1).map((visit, index) => {
            const a = point(placeById.get(mappedVisits[index].placeId) as TravelPlace); const b = point(placeById.get(visit.placeId) as TravelPlace);
            if (Math.abs(a.x-b.x)>520) return null;
            return <line key={`${mappedVisits[index].id}-${visit.id}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y}/>;
          })}</g>
          <g className="journey-points">{uniqueMappedPlaces.map((place) => { const p=point(place); const isSelected=selectedPlace?.id===place.id; const choose=()=>{ const visit=[...visits].reverse().find((item)=>item.placeId===place.id); if(visit)setSelectedVisitId(visit.id); }; return <g key={place.id} role="button" tabIndex={0} aria-label={`${place.name}, ${place.countryName}`} onClick={choose} onKeyDown={(event)=>{if(event.key==="Enter"||event.key===" ")choose();}}><circle className={isSelected?"is-selected":""} cx={p.x} cy={p.y} r={isSelected?8:4}/></g>; })}</g>
        </svg>
        <div className="maps-compass" aria-hidden="true">N</div>
        {selectedVisit && selectedPlace && <article className="place-card">
          <div className="place-card__pin"><MapPin/></div><div><span>{selectedPlace.countryName}</span><h2>{selectedPlace.name}</h2><p><CalendarDays/>{rangeLabel(selectedVisit)}</p><small>{selectedPlace.latitude == null ? "Coordinates awaiting review" : `${selectedPlace.placeType} · month-level source precision`}</small></div>
        </article>}
        <small className="map-attribution">Natural Earth · GeoNames CC BY 4.0</small>
      </div>
    </section>
  </div>;
}
