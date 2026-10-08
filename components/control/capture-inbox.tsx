"use client";

import { Archive, CalendarDays, Check, ChevronDown, Link2, MapPin, PenLine, Plus, RotateCcw, Save, Sparkles, X } from "lucide-react";
import { useMemo, useState } from "react";

export type CaptureItem = {
  id: string;
  captureKind: string;
  title: string;
  body: string;
  occurredOn: string;
  visitId: string | null;
  sourceUrl: string;
  tags: string[];
  status: "inbox" | "kept" | "archived";
  createdAt: string;
  updatedAt: string;
};

type Visit = { id: string; label: string };
type Draft = Omit<CaptureItem, "id" | "createdAt" | "updatedAt"> & { id?: string };

const kinds = [
  ["moment", "Moment"], ["travel", "Travel"], ["idea", "Idea"], ["observation", "Observation"],
  ["question", "Question"], ["link", "Link"], ["to_try", "Try later"], ["other", "Other"],
] as const;

function today() { return new Date().toLocaleDateString("en-CA"); }
function blank(): Draft { return { captureKind: "moment", title: "", body: "", occurredOn: today(), visitId: null, sourceUrl: "", tags: [], status: "inbox" }; }

async function call(body: unknown) {
  const response = await fetch("/api/control/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { ok: response.ok, ...await response.json() };
}

export default function CaptureInbox({ items, visits, reload, notify }: { items: CaptureItem[]; visits: Visit[]; reload: () => Promise<void>; notify: (value: string) => void }) {
  const [draft, setDraft] = useState<Draft>(blank());
  const [saving, setSaving] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const visible = useMemo(() => items.filter((item) => showArchive ? item.status === "archived" : item.status !== "archived"), [items, showArchive]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const edit = (item: CaptureItem) => { setDraft({ ...item }); setShowDetails(Boolean(item.title || item.visitId || item.sourceUrl || item.tags.length)); window.scrollTo({ top: 0, behavior: "smooth" }); };

  async function save(status: "inbox" | "kept" = draft.status === "kept" ? "kept" : "inbox") {
    if (!draft.body.trim()) return window.alert("Write at least one thing worth remembering.");
    setSaving(true);
    const response = await call({ action: "save-capture", item: { ...draft, status } });
    setSaving(false);
    if (!response.ok) return window.alert(response.error);
    notify(status === "kept" ? "Capture kept" : "Captured");
    setDraft(blank()); setShowDetails(false); await reload();
  }

  async function archive(item: CaptureItem) {
    const response = await call({ action: "archive-capture", id: item.id, archive: item.status !== "archived" });
    if (!response.ok) return window.alert(response.error);
    notify(item.status === "archived" ? "Capture returned to the inbox" : "Capture archived");
    if (draft.id === item.id) { setDraft(blank()); setShowDetails(false); }
    await reload();
  }

  return <section className="capture-page">
    <header className="capture-page__head"><div><span>PRIVATE · JUST FOR YOU</span><h1>Capture</h1><p>What happened, what occurred to you, or what you do not want to lose.</p></div><Sparkles/></header>
    <div className="capture-composer">
      <div className="capture-kind-row" aria-label="Capture type">{kinds.map(([value, label]) => <button key={value} className={draft.captureKind === value ? "is-active" : ""} onClick={() => set("captureKind", value)}>{label}</button>)}</div>
      <textarea autoFocus rows={5} value={draft.body} onChange={(event) => set("body", event.target.value)} placeholder="What do you want to remember about today?"/>
      {showDetails && <div className="capture-details">
        <label><span>Optional title</span><input value={draft.title} onChange={(event) => set("title", event.target.value)} placeholder="Leave blank for a quiet diary entry"/></label>
        <label><span><CalendarDays/> Date</span><input type="date" value={draft.occurredOn} onChange={(event) => set("occurredOn", event.target.value)}/></label>
        <label><span><MapPin/> Journey visit</span><select value={draft.visitId || ""} onChange={(event) => set("visitId", event.target.value || null)}><option value="">No place attached</option>{[...visits].reverse().map((visit) => <option value={visit.id} key={visit.id}>{visit.label}</option>)}</select></label>
        <label><span><Link2/> Link</span><input value={draft.sourceUrl} onChange={(event) => set("sourceUrl", event.target.value)} inputMode="url" placeholder="https://…"/></label>
        <label className="capture-details__wide"><span>Tags</span><input value={draft.tags.join(", ")} onChange={(event) => set("tags", event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean))} placeholder="people, dinner, Istanbul"/></label>
      </div>}
      <footer><button className="capture-more" onClick={() => setShowDetails((value) => !value)}><ChevronDown className={showDetails ? "is-open" : ""}/>{showDetails ? "Fewer details" : "Add date, place, link, or tags"}</button><div>{draft.id && <button onClick={() => { setDraft(blank()); setShowDetails(false); }}><X/> Cancel</button>}<button disabled={saving || !draft.body.trim()} onClick={() => save("kept")}><Check/> Keep</button><button className="capture-save" disabled={saving || !draft.body.trim()} onClick={() => save()}><Save/>{saving ? "Saving…" : draft.id ? "Update" : "Capture"}</button></div></footer>
    </div>

    <div className="capture-list-head"><div><strong>{showArchive ? "Archive" : "Recent captures"}</strong><span>{visible.length} {visible.length === 1 ? "entry" : "entries"}</span></div><button onClick={() => setShowArchive((value) => !value)}>{showArchive ? <RotateCcw/> : <Archive/>}{showArchive ? "Back to recent" : "Archive"}</button></div>
    <div className="capture-list">{visible.map((item) => <article key={item.id}>
      <button className="capture-list__body" onClick={() => edit(item)}><span><em>{kinds.find(([value]) => value === item.captureKind)?.[1] || "Other"}</em>{item.status === "kept" && <b>Kept</b>}<time>{new Date(`${item.occurredOn}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</time></span>{item.title && <strong>{item.title}</strong>}<p>{item.body}</p>{item.tags.length > 0 && <small>{item.tags.map((tag) => `#${tag}`).join("  ")}</small>}</button>
      <button className="capture-list__archive" onClick={() => archive(item)} aria-label={item.status === "archived" ? "Restore capture" : "Archive capture"}>{item.status === "archived" ? <RotateCcw/> : <Archive/>}</button>
    </article>)}{!visible.length && <div className="capture-empty"><PenLine/><strong>{showArchive ? "Nothing archived." : "The day is still unwritten."}</strong><span>{showArchive ? "Old captures can rest here without being deleted." : "Capture one small detail. It does not need to become content."}</span></div>}</div>
  </section>;
}
