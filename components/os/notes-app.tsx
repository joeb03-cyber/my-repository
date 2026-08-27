"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronRight, ExternalLink, FileText, Folder, FolderOpen, Pin, Search, Tag } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { BrainNote, BrainNotesIndex } from "@/lib/brain/notes-types";

type Collection = "all" | "latest" | "pinned" | string;
type MobilePane = "folders" | "list" | "reader";

export default function NotesApp() {
  const [index, setIndex] = useState<BrainNotesIndex | null>(null);
  const [collection, setCollection] = useState<Collection>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [mobilePane, setMobilePane] = useState<MobilePane>("folders");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/brain/notes")
      .then((response) => { if (!response.ok) throw new Error("Notes could not be loaded."); return response.json(); })
      .then((data: BrainNotesIndex) => { setIndex(data); setSelectedId(data.notes[0]?.id || null); })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Notes could not be loaded."));
  }, []);

  const notes = useMemo(() => {
    const source = index?.notes || [];
    const normalized = query.trim().toLowerCase();
    return source.filter((note) => {
      const inCollection = collection === "all" || collection === "latest" || (collection === "pinned" ? note.pinned : note.folderSlug === collection);
      const searchable = `${note.title} ${note.excerpt} ${note.bodyMarkdown} ${note.tags.join(" ")}`.toLowerCase();
      return inCollection && (!normalized || searchable.includes(normalized));
    }).sort((a, b) => collection === "latest" ? b.updatedAt.localeCompare(a.updatedAt) : Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt));
  }, [collection, index, query]);

  useEffect(() => {
    if (notes.length && !notes.some((note) => note.id === selectedId)) setSelectedId(notes[0].id);
  }, [notes, selectedId]);

  const selected = index?.notes.find((note) => note.id === selectedId) || notes[0];
  const chooseCollection = (value: Collection) => { setCollection(value); setMobilePane("list"); };
  const chooseNote = (note: BrainNote) => { setSelectedId(note.id); setMobilePane("reader"); };

  if (error) return <div className="notes-state"><FileText/><strong>Notes are resting.</strong><span>{error}</span></div>;
  if (!index) return <div className="notes-state"><span className="notes-spinner"/><strong>Opening Notes…</strong></div>;

  return (
    <div className={`notes-app notes-app--mobile-${mobilePane}`}>
      <aside className="notes-folders">
        <div className="notes-sidebar-title"><strong>Notes</strong><button aria-label="New note unavailable in public preview" title="Publishing editor comes next">⌑</button></div>
        <FolderButton label="All Notes" count={index.notes.length} active={collection === "all"} onClick={() => chooseCollection("all")} icon="all" />
        <FolderButton label="Latest" count={index.notes.length} active={collection === "latest"} onClick={() => chooseCollection("latest")} icon="latest" />
        <FolderButton label="Pinned" count={index.notes.filter((note) => note.pinned).length} active={collection === "pinned"} onClick={() => chooseCollection("pinned")} icon="pinned" />
        <span className="notes-folder-heading">Folders</span>
        {index.folders.map((folder) => <FolderButton key={folder.id} label={folder.label} count={index.notes.filter((note) => note.folderSlug === folder.slug).length} active={collection === folder.slug} onClick={() => chooseCollection(folder.slug)} />)}
        <footer><span>iCloud</span><small>{index.notes.length} published notes</small></footer>
      </aside>

      <section className="notes-list-pane">
        <header className="notes-mobile-bar"><button onClick={() => setMobilePane("folders")}><ArrowLeft/> Folders</button><strong>{collectionLabel(collection, index)}</strong><span/></header>
        <label className="notes-search"><Search/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" aria-label="Search Notes"/>{query && <button onClick={() => setQuery("")} aria-label="Clear search">×</button>}</label>
        <div className="notes-list-heading"><strong>{collectionLabel(collection, index)}</strong><span>{notes.length} {notes.length === 1 ? "note" : "notes"}</span></div>
        <div className="notes-list">
          {notes.map((note) => <button key={note.id} className={selected?.id === note.id ? "is-selected" : ""} onClick={() => chooseNote(note)}>
            <span className="notes-list-title">{note.pinned && <Pin/>}{note.title}</span>
            <span className="notes-list-preview"><time>{formatDate(note.updatedAt)}</time> {note.excerpt}</span>
            <span className="notes-list-folder"><Folder/>{note.folderLabel}</span>
            <ChevronRight className="notes-list-chevron"/>
          </button>)}
          {!notes.length && <div className="notes-empty">No notes match “{query}”.</div>}
        </div>
      </section>

      <article className="notes-reader">
        {selected ? <>
          <header className="notes-reader-toolbar">
            <button className="notes-reader-back" onClick={() => setMobilePane("list")}><ArrowLeft/> Notes</button>
            <span>{formatLongDate(selected.sourcePublishedAt || selected.updatedAt)}</span>
            <div><button title="Pinned" aria-label={selected.pinned ? "Pinned note" : "Note is not pinned"}><Pin className={selected.pinned ? "is-active" : ""}/></button><button title="Tags" aria-label="Show tags"><Tag/></button></div>
          </header>
          <div className="notes-document">
            {selected.editorialNotice && <aside className="notes-editorial-notice">{selected.editorialNotice}</aside>}
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{selected.bodyMarkdown}</ReactMarkdown>
            {!!selected.tags.length && <div className="notes-tags">{selected.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>}
            {!!selected.externalLinks.length && <div className="notes-links">{selected.externalLinks.map((link) => <a key={link.url} href={link.url} target="_blank" rel="noreferrer">{link.label}<ExternalLink/></a>)}</div>}
          </div>
        </> : <div className="notes-state"><FileText/><strong>Select a note</strong></div>}
      </article>
    </div>
  );
}

function FolderButton({ label, count, active, onClick, icon }: { label: string; count: number; active: boolean; onClick: () => void; icon?: string }) {
  return <button className={`notes-folder ${active ? "is-selected" : ""}`} onClick={onClick}>
    {icon === "pinned" ? <Pin/> : icon === "all" ? <FolderOpen/> : <Folder/>}<strong>{label}</strong><span>{count}</span><ChevronRight/>
  </button>;
}

function collectionLabel(collection: Collection, index: BrainNotesIndex) {
  if (collection === "all") return "All Notes";
  if (collection === "latest") return "Latest";
  if (collection === "pinned") return "Pinned";
  return index.folders.find((folder) => folder.slug === collection)?.label || "Notes";
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatLongDate(value: string) {
  const date = value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value);
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}
