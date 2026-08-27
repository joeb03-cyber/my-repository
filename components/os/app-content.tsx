"use client";

import { useState } from "react";
import { Archive, ArrowUpRight, ChevronRight, FlaskConical, MapPin, Orbit, Search, Wind } from "lucide-react";
import { LibraryApp } from "./library-app";
import type { AppId } from "@/data/prototype";
import type { BrainBookSummary } from "@/lib/brain/types";
import AppIcon, { iconForApp } from "./app-icon";
import MapsApp from "./maps-app";
import ContactsApp from "./contacts-app";
import NotesApp from "./notes-app";

export default function AppContent({ appId, onBookOpen, onOpenApp }: { appId: AppId; onBookOpen: (book: BrainBookSummary) => void; onOpenApp: (appId: AppId) => void }) {
  if (appId === "finder") return <Finder onOpenApp={onOpenApp} />;
  if (appId === "library") return <LibraryApp onBookOpen={onBookOpen} />;
  if (appId === "atlas") return <MapsApp />;
  if (appId === "contacts") return <ContactsApp onBookOpen={onBookOpen} />;
  if (appId === "laboratory") return <Laboratory />;
  if (appId === "messages") return <Messages />;
  if (appId === "journal") return <NotesApp />;
  if (appId === "photos") return <Photos />;
  if (appId === "browser") return <Browser />;
  if (appId === "trash") return <Trash />;
  if (appId === "practice") return <Practice />;
  if (appId === "about") return <Settings />;
  if (appId === "reality") return <Reality />;
  return <ArchiveApp />;
}

function Finder({ onOpenApp }: { onOpenApp: (appId: AppId) => void }) {
  const available: Array<{ id: AppId; label: string; detail: string }> = [
    { id: "library", label: "Books", detail: "165 books" }, { id: "atlas", label: "Maps", detail: "38 countries" },
    { id: "contacts", label: "Contacts", detail: "15 interesting humans" }, { id: "journal", label: "Notes", detail: "Writing & fragments" }, { id: "photos", label: "Photos", detail: "Travel archive" },
    { id: "laboratory", label: "Human", detail: "Experiments" }, { id: "browser", label: "Browser", detail: "Rabbit holes" },
    { id: "practice", label: "Practice", detail: "Modalities" }, { id: "about", label: "Settings", detail: "About this human" },
  ];
  const future = ["Podcasts", "Stocks", "Time Machine"];
  return <div className="finder-app system-app"><aside className="os-sidebar"><strong>Favorites</strong><button className="is-selected">Brain</button><button>Applications</button><button>Currently</button><span/><strong>Collections</strong><button>Books</button><button>Places</button><button>People</button><button>Ideas</button></aside><section className="finder-main"><div className="os-toolbar"><div><button className="toolbar-button">‹</button><button className="toolbar-button">›</button></div><strong>Synergetic Human</strong><label className="system-search"><Search/><input aria-label="Search Finder" placeholder="Search"/></label></div><div className="finder-section"><span className="section-label">APPLICATIONS</span><div className="finder-grid">{available.map((app)=><button key={app.id} onClick={()=>onOpenApp(app.id)}><AppIcon name={iconForApp[app.id] ?? "finder"}/><span><strong>{app.label}</strong><small>{app.detail}</small></span></button>)}</div></div><div className="finder-section finder-section--future"><span className="section-label">NOT YET INSTALLED</span>{future.map((name)=><div className="os-list-row is-muted" key={name}><span className="future-app-dot"/><strong>{name}</strong><small>Coming later</small></div>)}</div></section></div>;
}

function Laboratory() {
  const experiments = [["Morning light before screens", "ONGOING"], ["Long exhale protocol", "WEEK 04"], ["Less input, more signal", "OBSERVING"]];
  return <div className="lab-app app-placeholder"><header><FlaskConical/><div><span className="app-kicker">HUMAN · PERSONAL LAB</span><h2>Experiments, not commandments.</h2></div></header><p className="lab-note">A record of protocols tried on one highly specific human. Results may be weird.</p><div className="experiment-list">{experiments.map(([name,status], index)=><div key={name}><span>0{index+1}</span><strong>{name}</strong><em>{status}</em></div>)}</div></div>;
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

function Browser() {
  const trails = ["Is consciousness fundamental?", "Cities built for walking", "The biology of awe", "Markets as collective psychology"];
  return <div className="browser-app system-app"><div className="browser-toolbar"><div><button className="toolbar-button">‹</button><button className="toolbar-button">›</button></div><label className="browser-address"><span>⌕</span><input aria-label="Browser address" readOnly value="brain://rabbit-holes/current"/><button>↻</button></label><button className="toolbar-button">＋</button></div><div className="browser-page"><span className="app-kicker">CURRENT RABBIT HOLES</span><h2>Where attention has been wandering.</h2><div className="browser-trails">{trails.map((trail,index)=><button key={trail}><span>0{index+1}</span><strong>{trail}</strong><ChevronRight/></button>)}</div><p>This is not a general-purpose browser. It is a history of curiosity: research trails, saved resources, abandoned tabs, and questions that refuse to close.</p></div></div>;
}

function ArchiveApp() {
  const nodes = ["books", "places", "podcasts", "ideas", "articles", "experiments", "people"];
  return <div className="archive-app app-placeholder"><header><Archive/><div><span className="app-kicker">THE CONNECTED ARCHIVE</span><h2>Everything touches something else.</h2></div></header><div className="archive-network">{nodes.map((node,index)=><span key={node} style={{"--i": index} as React.CSSProperties}>{node}</span>)}<i/><i/><i/></div><p>Eventually: a navigable web of sources, notes, places, practices, and recurring obsessions.</p></div>;
}

function Practice() {
  return <div className="practice-app app-placeholder"><div className="breath-circle"><Wind/><span>inhale<br/><strong>slowly</strong></span></div><div><span className="app-kicker">PRACTICE</span><h2>Return to the animal.</h2><p>Breath. Walk. Sit. Lift. Listen. Repeat without turning it into a personality.</p><small>Today · five unmeasured minutes</small></div></div>;
}

function Settings() {
  const settings = [["Current location", "Sarajevo"], ["Default mode", "Curious"], ["Input tolerance", "Low"], ["Consensus reality", "Connected"]];
  return <div className="settings-app system-app"><aside className="os-sidebar"><strong>Settings</strong><button className="is-selected">About This Human</button><button>Currently</button><button>Attention</button><button>Energy</button><button>Beliefs</button></aside><section className="settings-main"><div className="settings-profile"><div className="about-monogram">J<span>03</span></div><div><span className="app-kicker">ABOUT THIS HUMAN</span><h2>Joe Burt</h2><p>Version 03 · currently in motion</p></div></div><div className="settings-list">{settings.map(([label,value],index)=><div className="os-list-row" key={label}><span className={`settings-symbol settings-symbol--${index}`}/><strong>{label}</strong><small>{value}</small><ChevronRight/></div>)}</div><p className="settings-copy">Interested in what makes a life feel more alive: travel, markets, health, consciousness, practice, and the unexpected connections between them.</p><div className="about-location"><MapPin/> Sarajevo, for now.</div></section></div>;
}

function Trash() {
  const seed = [["Being productive means being valuable", "belief · 2023"], ["The five-year plan", "document · abandoned"], ["Cold showers fix everything", "experiment · inconclusive"], ["Old About page copy", "identity · superseded"]];
  const [items, setItems] = useState(seed);
  const putBack = (name: string) => setItems((current) => current.filter(([item]) => item !== name));
  return <div className="trash-app system-app"><div className="os-toolbar"><strong>Trash</strong><span>{items.length} {items.length === 1 ? "item" : "items"}</span><button className="toolbar-button" disabled title="Permanent deletion is disabled in staging">Empty</button></div><div className="trash-list"><div className="trash-columns"><span>Name</span><span>Kind</span><span/></div>{items.map(([name,kind])=><div className="os-list-row" key={name}><span className="trashed-page"/><strong>{name}</strong><small>{kind}</small><button onClick={() => putBack(name)}>Put Back</button></div>)}{!items.length && <div className="trash-empty">Nothing here. Suspiciously healthy.</div>}</div><footer>Some things are kept here in case they become funny later.</footer></div>;
}
