"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Activity, ChevronRight, CircleDot, Clock3, Cpu, Gauge, MapPin, Minus, RotateCcw, Search, ShieldCheck, Sparkles, TerminalSquare, Trash2, X } from "lucide-react";
import currentStateJson from "@/data/brain/current-state.v1.json";
import osStateJson from "@/data/brain/os-state.v1.json";
import type { BrainCurrentState } from "@/lib/brain/notes-types";
import type { BrainActivityProcess, BrainOsState, BrainTrashItem } from "@/lib/brain/os-state-types";

const localOsState = osStateJson as BrainOsState;
const localCurrentState = currentStateJson as BrainCurrentState;

function usePublicSystemState() {
  const [osState, setOsState] = useState(localOsState);
  const [currentState, setCurrentState] = useState(localCurrentState);
  useEffect(() => {
    fetch("/api/brain/os-state").then((response) => response.ok ? response.json() : Promise.reject()).then(setOsState).catch(() => undefined);
    fetch("/api/brain/current-state").then((response) => response.ok ? response.json() : Promise.reject()).then(setCurrentState).catch(() => undefined);
  }, []);
  return { osState, currentState };
}

export function SoftwareUpdateApp() {
  const { osState } = usePublicSystemState();
  const update = osState.softwareUpdate;
  const sections = [
    ["What’s New", update.new, "new"], ["Currently Exploring", update.currentlyExploring, "exploring"],
    ["Performance", update.performance, "performance"], ["Known Issues", update.knownIssues, "issues"],
  ] as const;
  return <div className="software-app system-app">
    <div className="os-toolbar"><strong>Software Update</strong><span>Last checked just now</span><button className="toolbar-button" aria-label="More update options">•••</button></div>
    <div className="software-scroll"><section className="software-hero"><div className="software-orb"><span>S</span><small>{update.versionLabel}</small></div><div><span className="app-kicker">THIS HUMAN IS UP TO DATE</span><h2>Synergetic Human {update.versionLabel}</h2><p>Release notes for one person, maintained manually and subject to revision.</p></div></section>
      <div className="release-notes">{sections.map(([title, items, kind]) => <section key={title} className={`release-section release-section--${kind}`}><header><span/><strong>{title}</strong><small>{items.length}</small></header>{items.length ? <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul> : <p>Nothing published for this section.</p>}</section>)}</div>
      <footer className="software-foot"><ShieldCheck/> No background personality analysis is running.</footer>
    </div>
  </div>;
}

export function ActivityMonitorApp() {
  const { osState } = usePublicSystemState();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const processes = (osState.activity || []).filter((item) => `${item.name} ${item.detail} ${item.related.join(" ")}`.toLowerCase().includes(query.toLowerCase()));
  const selected = processes.find((item) => item.id === selectedId) || processes[0] || null;
  const quit = (item: BrainActivityProcess) => setNotice(item.name === "Synergetic Human OS" ? "This process cannot be quit because you have become emotionally invested in it." : `${item.name} remains ${labelStatus(item.status).toLowerCase()}. No process was harmed.`);
  return <div className="activity-app system-app">
    <div className="os-toolbar activity-toolbar"><div><button className="stop-process" disabled={!selected} onClick={() => selected && quit(selected)}><X/></button><button className="inspect-process" aria-label="Inspect selected process"><CircleDot/></button></div><strong>Activity Monitor</strong><label className="system-search"><Search/><input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search processes" placeholder="Search"/></label></div>
    <div className="activity-table"><div className="activity-columns"><span>Process Name</span><span>Status</span><span>Origin</span></div>{processes.map((item) => <button key={item.id} onClick={() => { setSelectedId(item.id); setNotice(""); }} className={selected?.id === item.id ? "is-selected" : ""}><span><i className={`process-light is-${item.status}`}/><strong>{item.name}</strong></span><small>{labelStatus(item.status)}</small><em>Manual</em></button>)}</div>
    <aside className="process-inspector">{selected ? <><header><Activity/><div><strong>{selected.name}</strong><small>Public process</small></div></header><dl><div><dt>Status</dt><dd>{labelStatus(selected.status)}</dd></div>{selected.startedLabel && <div><dt>Started</dt><dd>{selected.startedLabel}</dd></div>}<div><dt>Related</dt><dd>{selected.related.join(" · ") || "None published"}</dd></div></dl><p>{selected.detail || "No process detail published."}</p>{notice && <div className="process-notice">{notice}</div>}</> : <div className="native-empty"><Cpu/><strong>No process selected</strong></div>}</aside>
    <footer>Attention is manually described here. Nothing is measured in the background.</footer>
  </div>;
}

export function TrashApp() {
  const { osState } = usePublicSystemState();
  const [items, setItems] = useState<BrainTrashItem[]>(osState.trash);
  const [selected, setSelected] = useState<BrainTrashItem | null>(null);
  const [confirming, setConfirming] = useState<BrainTrashItem | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => setItems(osState.trash), [osState.trash]);
  async function putBack(item: BrainTrashItem) {
    const response = await fetch("/api/control/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "restore-trash", id: item.id, confirm: true }) });
    setItems((current) => current.filter((candidate) => candidate.id !== item.id));
    setSelected(null); setConfirming(null);
    setMessage(response.ok ? `${item.title} was put back.` : `${item.title} was put back for this visit.`);
    window.setTimeout(() => setMessage(""), 3200);
  }
  return <div className="trash-app trash-app--stage13 system-app">
    <div className="os-toolbar"><div className="trash-nav"><button className="toolbar-button" aria-label="Back">‹</button><button className="toolbar-button" aria-label="Forward">›</button></div><strong>Trash</strong><span>{items.length} {items.length === 1 ? "item" : "items"}</span><button className="toolbar-button" disabled title="Permanent deletion is disabled">Empty</button></div>
    <div className="trash-browser"><section className="trash-list"><div className="trash-columns"><span>Name</span><span>Date Trashed</span><span>Kind</span></div>{items.map((item) => <button className={`trash-row ${selected?.id === item.id ? "is-selected" : ""}`} key={item.id} onClick={() => setSelected(item)} onDoubleClick={() => setConfirming(item)}><span className="trashed-page"><i/></span><strong>{item.title}</strong><small>{item.trashedAt || "—"}</small><em>{item.category}</em></button>)}{!items.length && <div className="trash-empty"><Trash2/><strong>Trash is empty</strong><span>For this visit, at least.</span></div>}</section>
      <aside className="trash-inspector">{selected ? <><div className="large-trash-file"><span className="trashed-page"><i/></span></div><h2>{selected.title}</h2><span>{selected.category}</span><p>{selected.description || "No description."}</p>{selected.trashedAt && <small>Trashed {selected.trashedAt}</small>}<button onClick={() => setConfirming(selected)}><RotateCcw/> Put Back</button></> : <div className="native-empty"><Trash2/><strong>Select an item</strong><span>Some former ideas still have metadata.</span></div>}</aside></div>
    <footer>Archaeology of a curious human.</footer>
    {confirming && <div className="system-sheet-backdrop" onPointerDown={() => setConfirming(null)}><section className="system-sheet" role="dialog" aria-modal="true" aria-label={`Put back ${confirming.title}`} onPointerDown={(event) => event.stopPropagation()}><div className="sheet-icon"><RotateCcw/></div><h3>Put back “{confirming.title}”?</h3><p>{confirming.title === "Become a Day Trader" ? "This was in the Trash for a reason." : "It will leave the Trash and return to active consideration."}</p><div><button onClick={() => setConfirming(null)}>Cancel</button><button className="sheet-primary" onClick={() => putBack(confirming)}>{confirming.title === "Become a Day Trader" ? "I Have Learned Nothing" : "Put Back"}</button></div></section></div>}
    {message && <div className="os-toast"><RotateCcw/>{message}</div>}
  </div>;
}

type SettingsPanel = "about" | "configuration" | "screen" | "astrology" | "human-design" | "gene-keys";

export function SettingsApp({ initialPanel = "about" }: { initialPanel?: SettingsPanel }) {
  const { osState, currentState } = usePublicSystemState();
  const [panel, setPanel] = useState<SettingsPanel>(initialPanel);
  const panels: Array<[SettingsPanel, string, string]> = [["about","About This Human","human"],["configuration","Current Configuration","config"],["screen","Screen Time","screen"],["astrology","Astrology","astro"],["human-design","Human Design","design"],["gene-keys","Gene Keys","keys"]];
  return <div className="settings-app settings-app--stage13 system-app"><aside className="os-sidebar"><strong>Settings</strong>{panels.map(([id,label,icon]) => <button key={id} className={panel===id?"is-selected":""} onClick={()=>setPanel(id)}><span className={`settings-mini-icon is-${icon}`}/>{label}</button>)}</aside><section className="settings-main">{panel === "about" && <AboutHuman currentState={currentState} version={osState.softwareUpdate.versionLabel}/>} {panel === "configuration" && <Configuration currentState={currentState}/>} {panel === "screen" && <ScreenTimePanel currentState={currentState}/>} {panel === "astrology" && <LensPanel lens="Astrology" kind="astro"/>} {panel === "human-design" && <LensPanel lens="Human Design" kind="design"/>} {panel === "gene-keys" && <LensPanel lens="Gene Keys" kind="keys"/>}</section></div>;
}

export function ScreenTimeApp() { return <div className="screen-time-app system-app"><div className="os-toolbar"><strong>Screen Time</strong><span>Manual snapshot</span></div><ScreenTimePanel currentState={usePublicSystemState().currentState}/></div>; }

function AboutHuman({ currentState, version }: { currentState: BrainCurrentState; version: string }) {
  return <><div className="settings-title"><div className="about-monogram">J<span>03</span></div><div><span className="app-kicker">ABOUT THIS HUMAN</span><h2>Joe Burt</h2><p>Synergetic Human {version}</p></div></div><div className="about-device"><div className="human-device"><span/><i/><i/></div><dl><div><dt>Model</dt><dd>Human</dd></div><div><dt>Version</dt><dd>{version}</dd></div><div><dt>Current Region</dt><dd>{currentState.where.country || "Not reported"}</dd></div><div><dt>Home Directory</dt><dd>/earth</dd></div><div><dt>Default Mode</dt><dd>Curious</dd></div></dl></div><p className="settings-copy">Interested in travel, markets, health, consciousness, practice, and the unexpected connections between them.</p><div className="about-location"><MapPin/> {currentState.where.city || "Somewhere"}, for now.</div></>;
}

function Configuration({ currentState }: { currentState: BrainCurrentState }) {
  const rows = [["Location", `${currentState.where.city || "Unreported"}${currentState.where.country ? `, ${currentState.where.country}` : ""}`],["Reading", currentState.reading || "Not reported"],["Making", currentState.making || "Not reported"],["Thinking About", currentState.thinking || "Not reported"],["Human Battery", currentState.humanBattery.label || "Unreported"]];
  return <><header className="settings-panel-head"><Gauge/><div><h2>Current Configuration</h2><p>A small public snapshot. Updated manually.</p></div></header><div className="settings-list">{rows.map(([label,value],index)=><div className="os-list-row" key={label}><span className={`settings-symbol settings-symbol--${index%4}`}/><strong>{label}</strong><small>{value}</small><ChevronRight/></div>)}</div></>;
}

function ScreenTimePanel({ currentState }: { currentState: BrainCurrentState }) {
  const activities = [["Creating", currentState.making],["Reading", currentState.reading],["Exploring", currentState.rabbitHoles[0]],["Thinking", currentState.thinking || currentState.currentQuestion]];
  return <div className="screen-time-panel"><header className="settings-panel-head"><Clock3/><div><h2>Screen Time</h2><p>Life areas currently receiving attention.</p></div></header><div className="screen-week"><div className="screen-bars">{activities.map(([label,value])=><div key={label}><span/><strong>{label}</strong><small>{value || "Not reported"}</small></div>)}</div><aside><strong>No minutes measured</strong><p>This is an editorial snapshot, not surveillance pretending to be self-knowledge.</p></aside></div></div>;
}

function LensPanel({ lens, kind }: { lens: string; kind: "astro" | "design" | "keys" }) {
  return <div className="lens-panel"><header className="settings-panel-head"><Sparkles/><div><h2>{lens}</h2><p>A lens Joe has explored, not a diagnostic system.</p></div></header><div className={`lens-visual is-${kind}`}><span/><i/><i/><i/></div><div className="lens-empty"><strong>No public profile configured</strong><p>The architecture is ready for a chart/profile, structured attributes, selected interpretations, and future current-context views. No private archive material has been imported.</p></div></div>;
}

export function TerminalApp() {
  const { currentState } = usePublicSystemState();
  const [lines, setLines] = useState<Array<{ command?: string; output: string }>>([{ output: "Synergetic Human Terminal\nType help for available commands." }]);
  const [value, setValue] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [lines]);
  async function run(event: FormEvent) {
    event.preventDefault(); const command = value.trim(); if (!command) return; setValue(""); setHistory((current)=>[...current,command]);
    if (command === "clear") { setLines([]); return; }
    let output = "Command not found. Try help.";
    if (command === "help") output = "help · whoami · whereis joe · now · books · places · history · clear\ncat consciousness.txt · sudo become-enlightened";
    else if (command === "whoami") output = "joe — human, reader, traveler, builder of this particular machine";
    else if (command === "whereis joe") output = `${currentState.where.city || "location unreported"}, ${currentState.where.country || "earth"}`;
    else if (command === "now") output = [`reading: ${currentState.reading || "unreported"}`,`making: ${currentState.making || "unreported"}`,`thinking: ${currentState.thinking || currentState.currentThought || "unreported"}`].join("\n");
    else if (command === "books") { const response=await fetch("/api/brain/books"); const data=response.ok?await response.json():null; output=data?`${data.bookCount} books indexed.`:"Books are temporarily unavailable."; }
    else if (command === "places") { const response=await fetch("/api/brain/travel"); const data=response.ok?await response.json():null; output=data?`${data.stats.uniquePlaces} places across ${data.stats.countries || data.countries?.length || "several"} countries.`:"Places are temporarily unavailable."; }
    else if (command === "history") output = history.length ? history.join("\n") : "No previous commands in this session.";
    else if (command === "cat consciousness.txt") output = "Contents remain unresolved.";
    else if (command === "sudo become-enlightened") output = "Permission denied.";
    setLines((current)=>[...current,{command,output}]);
  }
  return <div className="terminal-app system-app"><div className="terminal-toolbar"><span>joe — synergetic-human — 80×24</span><button aria-label="New terminal tab">＋</button></div><div className="terminal-screen" ref={scrollRef} onClick={()=>document.getElementById("terminal-command")?.focus()}>{lines.map((line,index)=><div key={index}>{line.command&&<p><span>joe@earth</span>:<b>~</b> $ {line.command}</p>}<pre>{line.output}</pre></div>)}<form onSubmit={run}><span>joe@earth</span>:<b>~</b> $ <input id="terminal-command" autoComplete="off" autoCapitalize="none" spellCheck={false} value={value} onChange={(event)=>setValue(event.target.value)} aria-label="Terminal command" autoFocus/><button type="submit" aria-label="Run command">↵</button></form></div><footer><TerminalSquare/> Handcrafted commands only · no shell access</footer></div>;
}

function labelStatus(status: BrainActivityProcess["status"]) { return status === "not_responding" ? "Not Responding" : status[0].toUpperCase() + status.slice(1); }
