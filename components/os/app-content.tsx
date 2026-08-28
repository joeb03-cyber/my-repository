"use client";

import { Activity, Archive, ArrowUpRight, ChevronRight, Clock3, Orbit, Search, TerminalSquare, Wind } from "lucide-react";
import { LibraryApp } from "./library-app";
import type { AppId } from "@/data/prototype";
import type { BrainBookSummary } from "@/lib/brain/types";
import AppIcon, { iconForApp } from "./app-icon";
import MapsApp from "./maps-app";
import ContactsApp from "./contacts-app";
import NotesApp from "./notes-app";
import HumanApp from "./human-app";
import BrowserApp from "./browser-app";
import { ActivityMonitorApp, ScreenTimeApp, SettingsApp, SoftwareUpdateApp, TerminalApp, TrashApp } from "./personality-apps";

export default function AppContent({ appId, onBookOpen, onOpenApp }: { appId: AppId; onBookOpen: (book: BrainBookSummary) => void; onOpenApp: (appId: AppId) => void }) {
  if (appId === "finder") return <Finder onOpenApp={onOpenApp} />;
  if (appId === "library") return <LibraryApp onBookOpen={onBookOpen} />;
  if (appId === "atlas") return <MapsApp />;
  if (appId === "contacts") return <ContactsApp onBookOpen={onBookOpen} />;
  if (appId === "laboratory") return <HumanApp onOpenApp={onOpenApp} />;
  if (appId === "messages") return <Messages />;
  if (appId === "journal") return <NotesApp />;
  if (appId === "photos") return <Photos />;
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
    { id: "library", label: "Books", detail: "163 public books" }, { id: "atlas", label: "Maps", detail: "38 countries" },
    { id: "contacts", label: "Contacts", detail: "15 interesting humans" }, { id: "journal", label: "Notes", detail: "Writing & fragments" }, { id: "photos", label: "Photos", detail: "Travel archive" },
    { id: "laboratory", label: "Human", detail: "Operating manual" }, { id: "browser", label: "Browser", detail: "Rabbit holes" },
    { id: "practice", label: "Practice", detail: "Modalities" }, { id: "about", label: "Settings", detail: "About this human" },
  ];
  const future = ["Podcasts", "Stocks", "Time Machine"];
  const system = [{id:"software" as AppId,label:"Software Update",detail:"Current release",icon:<ArrowUpRight/>},{id:"activity" as AppId,label:"Activity Monitor",detail:"Attention processes",icon:<Activity/>},{id:"screen-time" as AppId,label:"Screen Time",detail:"Manual snapshot",icon:<Clock3/>},{id:"terminal" as AppId,label:"Terminal",detail:"Handcrafted commands",icon:<TerminalSquare/>}];
  return <div className="finder-app system-app"><aside className="os-sidebar"><strong>Favorites</strong><button className="is-selected">Joe</button><button>Applications</button><button>Currently</button><span/><strong>Locations</strong><button>/Joe/Books</button><button>/Joe/Places</button><button>/Joe/People</button><button>/Joe/Notes</button><button>/Joe/Obsessions/Current</button></aside><section className="finder-main"><div className="os-toolbar"><div><button className="toolbar-button">‹</button><button className="toolbar-button">›</button></div><strong>/Joe</strong><label className="system-search"><Search/><input aria-label="Search Finder" placeholder="Search"/></label></div><div className="finder-section"><span className="section-label">APPLICATIONS</span><div className="finder-grid">{available.map((app)=><button key={app.id} onClick={()=>onOpenApp(app.id)}><AppIcon name={iconForApp[app.id] ?? "finder"}/><span><strong>{app.label}</strong><small>{app.detail}</small></span></button>)}</div></div><div className="finder-section finder-system-list"><span className="section-label">SYSTEM</span>{system.map((item)=><button className="os-list-row" key={item.id} onClick={()=>onOpenApp(item.id)}><span className="system-tool-icon">{item.icon}</span><strong>{item.label}</strong><small>{item.detail}</small><ChevronRight/></button>)}</div><div className="finder-section finder-section--future"><span className="section-label">NOT YET INSTALLED</span>{future.map((name)=><div className="os-list-row is-muted" key={name}><span className="future-app-dot"/><strong>{name}</strong><small>Coming later</small></div>)}</div></section></div>;
}

function Messages() {
  const conversations = [["Alan Watts", "The menu is not the meal."], ["Ursula K. Le Guin", "What if freedom is a practice?"], ["Future Joe", "Still packing too much."]];
  return <div className="messages-app system-app"><aside className="messages-list"><div className="os-toolbar"><strong>Messages</strong><button className="toolbar-button">＋</button></div><label className="system-search"><Search/><input aria-label="Search Messages" placeholder="Search"/></label>{conversations.map(([name,preview],i)=><button className={i===0?"is-selected":""} key={name}><span className="message-avatar">{name[0]}</span><span><strong>{name}</strong><small>{preview}</small></span></button>)}</aside><section className="message-thread"><header><span className="message-avatar">A</span><strong>Alan Watts</strong><small>an imagined conversation grounded in source material</small></header><div className="message-empty"><AppIcon name="messages"/><h2>Conversations, eventually.</h2><p>A future space for clearly labelled, source-grounded simulations with thinkers who shaped the Brain.</p><span>Nothing has been generated yet.</span></div></section></div>;
}

function Reality() {
  return <div className="reality-app app-placeholder"><div className="reality-orbit"><i/><i/><i/><Orbit/></div><div><span className="app-kicker">REALITY / CONSCIOUSNESS</span><h2>Things get less solid in here.</h2><p>Notes from the borderlands of perception, identity, awareness, anomalous experience, and whatever this is.</p><button>Enter carefully <ArrowUpRight/></button></div></div>;
}

function Photos() {
  return <div className="photos-app system-app"><div className="os-toolbar"><strong>Photos</strong><div className="os-segment"><button className="is-selected">Years</button><button>Months</button><button>All Photos</button></div><button className="toolbar-button">•••</button></div><div className="photos-hero"><div><span className="app-kicker">2026 · SARAJEVO</span><h2>A life, mostly outside.</h2><p>The wallpaper collection and travel archive will live here.</p></div></div><div className="photo-strip">{["coast","street","mountain","window","night"].map((name)=><div className={`photo-tile photo-tile--${name}`} key={name}/>)}</div></div>;
}

function ArchiveApp() {
  const nodes = ["books", "places", "podcasts", "ideas", "articles", "experiments", "people"];
  return <div className="archive-app app-placeholder"><header><Archive/><div><span className="app-kicker">THE CONNECTED ARCHIVE</span><h2>Everything touches something else.</h2></div></header><div className="archive-network">{nodes.map((node,index)=><span key={node} style={{"--i": index} as React.CSSProperties}>{node}</span>)}<i/><i/><i/></div><p>Eventually: a navigable web of sources, notes, places, practices, and recurring obsessions.</p></div>;
}

function Practice() {
  return <div className="practice-app app-placeholder"><div className="breath-circle"><Wind/><span>inhale<br/><strong>slowly</strong></span></div><div><span className="app-kicker">PRACTICE</span><h2>Return to the animal.</h2><p>Breath. Walk. Sit. Lift. Listen. Repeat without turning it into a personality.</p><small>Today · five unmeasured minutes</small></div></div>;
}
