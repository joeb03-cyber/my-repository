"use client";

import { Archive, ArrowUpRight, FlaskConical, MapPin, NotebookPen, Orbit, Wind } from "lucide-react";
import { LibraryApp } from "./library-app";
import type { AppId } from "@/data/prototype";
import type { BrainBookSummary } from "@/lib/brain/types";

export default function AppContent({ appId, onBookOpen }: { appId: AppId; onBookOpen: (book: BrainBookSummary) => void }) {
  if (appId === "library") return <LibraryApp onBookOpen={onBookOpen} />;
  if (appId === "atlas") return <Atlas />;
  if (appId === "laboratory") return <Laboratory />;
  if (appId === "reality") return <Reality />;
  if (appId === "journal") return <Journal />;
  if (appId === "archive") return <ArchiveApp />;
  if (appId === "practice") return <Practice />;
  return <About />;
}

function Atlas() {
  return <div className="atlas-app app-placeholder"><div className="atlas-map"><div className="route-line route-line--one"/><div className="route-line route-line--two"/><i className="map-point point-one"/><i className="map-point point-two"/><i className="map-point point-three"/><span className="map-label label-one">Tallinn</span><span className="map-label label-two">Sarajevo</span><span className="map-label label-three">Buenos Aires</span></div><div className="placeholder-copy"><span className="app-kicker">ATLAS · 2023—NOW</span><h2>Life between coordinates.</h2><p>A future map of the long route, the short stays, the rooms remembered, and the streets worth walking twice.</p><div className="atlas-stat"><strong>38</strong><span>countries<br/>and counting</span></div></div></div>;
}

function Laboratory() {
  const experiments = [["Morning light before screens", "ONGOING"], ["Long exhale protocol", "WEEK 04"], ["Less input, more signal", "OBSERVING"]];
  return <div className="lab-app app-placeholder"><header><FlaskConical/><div><span className="app-kicker">PERSONAL LABORATORY</span><h2>Experiments, not commandments.</h2></div></header><p className="lab-note">A record of protocols tried on one highly specific human. Results may be weird.</p><div className="experiment-list">{experiments.map(([name,status], index)=><div key={name}><span>0{index+1}</span><strong>{name}</strong><em>{status}</em></div>)}</div></div>;
}

function Reality() {
  return <div className="reality-app app-placeholder"><div className="reality-orbit"><i/><i/><i/><Orbit/></div><div><span className="app-kicker">REALITY / CONSCIOUSNESS</span><h2>Things get less solid in here.</h2><p>Notes from the borderlands of perception, identity, awareness, anomalous experience, and whatever this is.</p><button>Enter carefully <ArrowUpRight/></button></div></div>;
}

function Journal() {
  return <div className="journal-app app-placeholder"><aside><NotebookPen/><span>AUG<br/><strong>26</strong><br/>2026</span></aside><article><span className="app-kicker">FIELD NOTE · SARAJEVO</span><h2>The city gets quieter after the heat gives up.</h2><p>Prototype writing surface. Future entries can remain fragments: observations, questions, unfinished arguments, strange encounters, things noticed from café tables.</p><span className="cursor-mark"/></article></div>;
}

function ArchiveApp() {
  const nodes = ["books", "places", "podcasts", "ideas", "articles", "experiments", "people"];
  return <div className="archive-app app-placeholder"><header><Archive/><div><span className="app-kicker">THE CONNECTED ARCHIVE</span><h2>Everything touches something else.</h2></div></header><div className="archive-network">{nodes.map((node,index)=><span key={node} style={{"--i": index} as React.CSSProperties}>{node}</span>)}<i/><i/><i/></div><p>Eventually: a navigable web of sources, notes, places, practices, and recurring obsessions.</p></div>;
}

function Practice() {
  return <div className="practice-app app-placeholder"><div className="breath-circle"><Wind/><span>inhale<br/><strong>slowly</strong></span></div><div><span className="app-kicker">PRACTICE</span><h2>Return to the animal.</h2><p>Breath. Walk. Sit. Lift. Listen. Repeat without turning it into a personality.</p><small>Today · five unmeasured minutes</small></div></div>;
}

function About() {
  return <div className="about-app app-placeholder"><div className="about-monogram">J<span>03</span></div><article><span className="app-kicker">ABOUT THIS HUMAN</span><h2>Joe, currently in motion.</h2><p>I’m interested in what makes a life feel more alive: travel, markets, health, consciousness, practice, and the unexpected connections between them.</p><p>This operating system is an attempt to make a personal website behave more like a living mind than a polished résumé.</p><div className="about-location"><MapPin/> Sarajevo, for now.</div></article></div>;
}
