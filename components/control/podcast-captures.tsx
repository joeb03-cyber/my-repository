"use client";

import { Archive, ChevronRight, Headphones, Link2, Plus, RotateCcw, Save, X } from "lucide-react";
import { useMemo, useState } from "react";

export type PodcastCapture = {
  id: string;
  episodeTitle: string;
  showName: string;
  guestNames: string[];
  episodeUrl: string;
  listenedOn: string | null;
  listeningState: "queued" | "listening" | "finished";
  takeaways: string;
  memorableMoments: string[];
  whySaved: string;
  tags: string[];
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
};

type Draft = Omit<PodcastCapture, "id" | "createdAt" | "updatedAt"> & { id?: string };
function blank(): Draft { return { episodeTitle: "", showName: "", guestNames: [], episodeUrl: "", listenedOn: null, listeningState: "finished", takeaways: "", memorableMoments: [], whySaved: "", tags: [], status: "active" }; }
async function call(body: unknown) { const response = await fetch("/api/control/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); return { ok: response.ok, ...await response.json() }; }

export default function PodcastCaptures({ items, reload, notify }: { items: PodcastCapture[]; reload: () => Promise<void>; notify: (value: string) => void }) {
  const [editing, setEditing] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [showArchive, setShowArchive] = useState(false);
  const filtered = useMemo(() => items.filter((item) => (showArchive ? item.status === "archived" : item.status === "active") && `${item.episodeTitle} ${item.showName} ${item.guestNames.join(" ")} ${item.takeaways}`.toLowerCase().includes(query.toLowerCase())), [items, query, showArchive]);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setEditing((current) => current ? { ...current, [key]: value } : current);

  async function save() {
    if (!editing?.episodeTitle.trim()) return window.alert("Add the episode title first.");
    setSaving(true); const response = await call({ action: "save-podcast-capture", item: editing }); setSaving(false);
    if (!response.ok) return window.alert(response.error);
    notify(editing.id ? "Podcast note updated" : "Podcast episode saved"); setEditing(null); await reload();
  }
  async function archive(item: { id: string; status: "active" | "archived" }) {
    const response = await call({ action: "archive-podcast-capture", id: item.id, archive: item.status !== "archived" });
    if (!response.ok) return window.alert(response.error);
    notify(item.status === "archived" ? "Podcast note restored" : "Podcast note archived"); setEditing(null); await reload();
  }

  return <section className="podcast-capture-page">
    <header><div><span>PRIVATE LISTENING MEMORY</span><h1>Podcasts</h1><p>Save the episodes that changed your mind—or at least kept you company.</p></div><button className="primary" onClick={() => setEditing(blank())}><Plus/> Add episode</button></header>
    <div className="podcast-toolbar"><label><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search episodes, shows, people, ideas…"/></label><button onClick={() => setShowArchive((value) => !value)}>{showArchive ? <RotateCcw/> : <Archive/>}{showArchive ? "Recent" : "Archive"}</button></div>
    <div className="podcast-capture-list">{filtered.map((item) => <button key={item.id} onClick={() => setEditing({ ...item })}><span className="podcast-capture-icon"><Headphones/></span><span><small>{item.showName || "Podcast"}{item.listenedOn ? ` · ${new Date(`${item.listenedOn}T12:00:00`).toLocaleDateString(undefined, { month: "short", year: "numeric" })}` : ""}</small><strong>{item.episodeTitle}</strong><em>{item.guestNames.join(", ") || item.whySaved || "No guest recorded"}</em>{item.takeaways && <p>{item.takeaways}</p>}</span><ChevronRight/></button>)}{!filtered.length && <div className="capture-empty"><Headphones/><strong>No episodes here yet.</strong><span>Start with one you still think about.</span></div>}</div>

    {editing && <div className="podcast-sheet-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setEditing(null)}><section className="podcast-sheet">
      <header><div><small>{editing.id ? "EDIT LISTENING NOTE" : "NEW LISTENING NOTE"}</small><strong>{editing.id ? editing.episodeTitle : "Save an episode"}</strong></div><button onClick={() => setEditing(null)}><X/></button></header>
      <div className="podcast-sheet__scroll">
        <label><span>Episode title</span><input autoFocus value={editing.episodeTitle} onChange={(event) => set("episodeTitle", event.target.value)} placeholder="The name of the episode"/></label>
        <div className="podcast-two"><label><span>Podcast / show</span><input value={editing.showName} onChange={(event) => set("showName", event.target.value)} placeholder="The Emerald"/></label><label><span>Guest or people · comma separated</span><input value={editing.guestNames.join(", ")} onChange={(event) => set("guestNames", event.target.value.split(",").map((name) => name.trim()).filter(Boolean))} placeholder="Guest name"/></label></div>
        <div className="podcast-two"><label><span>Listening state</span><select value={editing.listeningState} onChange={(event) => set("listeningState", event.target.value as Draft["listeningState"])}><option value="finished">Finished</option><option value="listening">Listening</option><option value="queued">Saved for later</option></select></label><label><span>Date listened</span><input type="date" value={editing.listenedOn || ""} onChange={(event) => set("listenedOn", event.target.value || null)}/></label></div>
        <label><span><Link2/> Episode link</span><input inputMode="url" value={editing.episodeUrl} onChange={(event) => set("episodeUrl", event.target.value)} placeholder="https://…"/></label>
        <label><span>The thing I learned / keep thinking about</span><textarea rows={6} value={editing.takeaways} onChange={(event) => set("takeaways", event.target.value)} placeholder="Write naturally. This is memory, not a review."/></label>
        <label><span>Memorable moments · one per line</span><textarea rows={4} value={editing.memorableMoments.join("\n")} onChange={(event) => set("memorableMoments", event.target.value.split("\n").map((line) => line.trim()).filter(Boolean))} placeholder="A quote, story, distinction, or timestamp…"/></label>
        <label><span>Why save this one?</span><textarea rows={3} value={editing.whySaved} onChange={(event) => set("whySaved", event.target.value)} placeholder="Optional context for future Joe"/></label>
        <label><span>Tags · comma separated</span><input value={editing.tags.join(", ")} onChange={(event) => set("tags", event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean))} placeholder="consciousness, travel, relationships"/></label>
      </div>
      <footer>{editing.id ? <button className="podcast-archive" onClick={() => archive({ id: editing.id!, status: editing.status })}>{editing.status === "archived" ? <RotateCcw/> : <Archive/>}{editing.status === "archived" ? "Restore" : "Archive"}</button> : <span/>}<button className="primary" disabled={saving || !editing.episodeTitle.trim()} onClick={save}><Save/>{saving ? "Saving…" : "Save episode"}</button></footer>
    </section></div>}
  </section>;
}
