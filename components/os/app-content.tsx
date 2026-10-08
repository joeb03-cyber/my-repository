"use client";

import { Archive, Orbit, Wind } from "lucide-react";
import { LibraryApp } from "./library-app";
import type { AppId } from "@/data/prototype";
import type { BrainBookSummary } from "@/lib/brain/types";
import MapsApp from "./maps-app";
import PhotosApp from "./photos-app";
import ContactsApp from "./contacts-app";
import NotesApp from "./notes-app";
import HumanApp from "./human-app";
import BrowserApp from "./browser-app";
import MessagesApp from "./messages-app";
import { ActivityMonitorApp, ScreenTimeApp, SettingsApp, SoftwareUpdateApp, TerminalApp, TrashApp } from "./personality-apps";

export default function AppContent({ appId, onBookOpen, onOpenApp }: { appId: AppId; onBookOpen: (book: BrainBookSummary) => void; onOpenApp: (appId: AppId) => void }) {
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
