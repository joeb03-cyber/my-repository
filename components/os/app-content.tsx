"use client";

import { Activity, Archive, ArrowUpRight, ChevronRight, Clock3, Orbit, Search, TerminalSquare, Wind } from "lucide-react";
import { LibraryApp } from "./library-app";
import type { AppId } from "@/data/prototype";
import type { BrainBookSummary } from "@/lib/brain/types";
import AppIcon, { iconForApp } from "./app-icon";
import MapsApp from "./maps-app";
import PhotosApp from "./photos-app";
import ContactsApp from "./contacts-app";
import NotesApp from "./notes-app";
import HumanApp from "./human-app";
import BrowserApp from "./browser-app";
import MessagesApp from "./messages-app";
import { ActivityMonitorApp, ScreenTimeApp, SettingsApp, SoftwareUpdateApp, TerminalApp, TrashApp } from "./personality-apps";

export default function AppContent({ appId, onBookOpen, onOpenApp }: { appId: AppId; onBookOpen: (book: BrainBookSummary) => void; onOpenApp: (appId: AppId) => void }) {
  if (appId === "finder") return <Finder onOpenApp={onOpenApp} />;
  if (appId === "library") return <LibraryApp onBookOpen={onBookOpen} />;
  if (appId === "atlas") return <MapsApp onOpenApp={onOpenApp} />;
  if (appId === "contacts") return <ContactsApp onBookOpen={onBookOpen} />;
  if (appId === "laboratory") return <HumanApp onOpenApp={onOpenApp} />;
  if (appId === "messages") return <MessagesApp />;
  if (appId === "journal") return <NotesApp />;
  if (appId === "photos") return <PhotosApp onOpenApp={onOpenApp} />;
  if (appId === "browser") return <BrowserApp onBookOpen={onBookOpen} onOpenApp={onOpenApp} />;
  if (appId === "trash") return <TrashApp />;
  if (appId === "software") return <SoftwareUpdateApp />;
  if (appId === "activity") return <ActivityMonitorApp />;
  if (appId === "screen-time") return <ScreenTimeApp />;
  if (appId === "terminal") return <TerminalApp />;
  if (appId === "practice") return <Practice />;
  if (appId === "about") return <SettingsApp />;
  if (appId === "reality") return <Reality />;
  return <ArchiveApp />;
}

function Finder({ onOpenApp }: { onOpenApp: (appId: AppId) => void }) {
  const available: Array<{ id: AppId; label: string; detail: string }> = [
    { id: "library", label: "Books", detail: "Books & passages" }, { id: "atlas", label: "Maps", detail: "Places & journeys" },
    { id: "contacts", label: "Contacts", detail: "People & their work" }, { id: "journal", label: "Notes", detail: "Writing & fragments" }, { id: "photos", label: "Photos", detail: "Travel archive" },
    { id: "laboratory", label: "Human", detail: "Operating manual" }, { id: "browser", label: "Browser", detail: "Rabbit holes" },
    { id: "practice", label: "Practice", detail: "Modalities" }, { id: "about", label: "Settings", detail: "About this human" },
  ];
  const system = [{id:"software" as AppId,label:"Software Update",detail:"Current release",icon:<ArrowUpRight/>},{id:"activity" as AppId,label:"Activity Monitor",detail:"Attention processes",icon:<Activity/>},{id:"screen-time" as AppId,label:"Screen Time",detail:"Manual snapshot",icon:<Clock3/>},{id:"terminal" as AppId,label:"Terminal",detail:"Handcrafted commands",icon:<TerminalSquare/>}];
  return <div className="finder-app system-app"><aside className="os-sidebar"><strong>Favorites</strong><strong>Joe</strong><span/><strong>Locations</strong><button onClick={()=>onOpenApp("library")}>/Joe/Books</button><button onClick={()=>onOpenApp("atlas")}>/Joe/Places</button><button onClick={()=>onOpenApp("contacts")}>/Joe/People</button><button onClick={()=>onOpenApp("journal")}>/Joe/Notes</button><button onClick={()=>onOpenApp("browser")}>/Joe/Obsessions/Current</button></aside><section className="finder-main"><div className="os-toolbar"><strong>/Joe</strong></div><div className="finder-section"><span className="section-label">APPLICATIONS</span><div className="finder-grid">{available.map((app)=><button key={app.id} onClick={()=>onOpenApp(app.id)}><AppIcon name={iconForApp[app.id] ?? "finder"}/><span><strong>{app.label}</strong><small>{app.detail}</small></span></button>)}</div></div><div className="finder-section finder-system-list"><span className="section-label">SYSTEM</span>{system.map((item)=><button className="os-list-row" key={item.id} onClick={()=>onOpenApp(item.id)}><span className="system-tool-icon">{item.icon}</span><strong>{item.label}</strong><small>{item.detail}</small><ChevronRight/></button>)}</div></section></div>;
}

function Reality() {
  return <div className="reality-app app-placeholder"><div className="reality-orbit"><i/><i/><i/><Orbit/></div><div><span className="app-kicker">REALITY / CONSCIOUSNESS</span><h2>Things get less solid in here.</h2><p>Notes from the borderlands of perception, identity, awareness, anomalous experience, and whatever this is.</p></div></div>;
}

function ArchiveApp() {
  const nodes = ["books", "places", "podcasts", "ideas", "articles", "experiments", "people"];
  return <div className="archive-app app-placeholder"><header><Archive/><div><span className="app-kicker">THE CONNECTED ARCHIVE</span><h2>Everything touches something else.</h2></div></header><div className="archive-network">{nodes.map((node,index)=><span key={node} style={{"--i": index} as React.CSSProperties}>{node}</span>)}<i/><i/><i/></div><p>Eventually: a navigable web of sources, notes, places, practices, and recurring obsessions.</p></div>;
}

function Practice() {
  return <div className="practice-app app-placeholder"><div className="breath-circle"><Wind/><span>inhale<br/><strong>slowly</strong></span></div><div><span className="app-kicker">PRACTICE</span><h2>Return to the animal.</h2><p>Breath. Walk. Sit. Lift. Listen. Repeat without turning it into a personality.</p><small>Today · five unmeasured minutes</small></div></div>;
}
