"use client";

import { BookOpen, Compass, Contact, FileText, HeartPulse, Loader2, MapPin, MessageCircle, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type SpotlightItem = { id: string; title: string; subtitle: string; search: string; kind: string; route: string };

const appItems: SpotlightItem[] = [
  ["library", "Books", "Books and saved passages", "/library"], ["atlas", "Maps", "Places and journeys", "/atlas"],
  ["messages", "Messages", "Imagined, source-informed conversations", "/messages"], ["contacts", "Contacts", "People and their work", "/contacts"],
  ["journal", "Notes", "Writing and fragments", "/journal"], ["photos", "Photos", "Travel photographs", "/photos"],
  ["laboratory", "Human", "Joe's operating manual", "/laboratory"], ["browser", "Browser", "Questions and rabbit holes", "/browser"],
].map(([id, title, subtitle, route]) => ({ id: `app-${id}`, title, subtitle, route, search: `${title} ${subtitle}`, kind: "Application" }));

const icons: Record<string, React.ReactNode> = {
  Book: <BookOpen/>, Note: <FileText/>, Person: <Contact/>, "Rabbit hole": <Compass/>, Human: <HeartPulse/>, Place: <MapPin/>, Conversation: <MessageCircle/>, Application: <Search/>,
};

const text = (value: unknown) => String(value || "");
const searchable = (...values: unknown[]) => values.flatMap((value) => Array.isArray(value) ? value : [value]).map(text).join(" ");

export default function Spotlight({ open, onClose, onNavigate }: { open: boolean; onClose: () => void; onNavigate: (route: string) => void }) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<SpotlightItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery(""); window.setTimeout(() => inputRef.current?.focus(), 30);
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  }, [onClose, open]);

  useEffect(() => {
    if (!open || loaded || loading) return;
    setLoading(true);
    Promise.allSettled(["books", "notes", "people", "browser", "human", "messages", "travel"].map(async (endpoint) => {
      const response = await fetch(`/api/brain/${endpoint}`); if (!response.ok) throw new Error(endpoint); return { endpoint, data: await response.json() };
    })).then((responses) => {
      const next: SpotlightItem[] = [];
      for (const response of responses) {
        if (response.status !== "fulfilled") continue;
        const { endpoint, data } = response.value;
        if (endpoint === "books") for (const book of data.books || []) next.push({ id: `book-${book.id}`, title: book.title, subtitle: (book.authors || []).join(", ") || "Book", search: searchable(book.title, book.authors, (book.topics || []).map((topic: any) => topic.label)), kind: "Book", route: `/library/${book.slug}` });
        if (endpoint === "notes") for (const note of data.notes || []) next.push({ id: `note-${note.id}`, title: note.title, subtitle: note.excerpt || note.folderLabel || "Note", search: searchable(note.title, note.excerpt, note.tags), kind: "Note", route: `/journal?note=${encodeURIComponent(note.slug)}` });
        if (endpoint === "people") for (const person of data.contacts || []) next.push({ id: `person-${person.id}`, title: person.displayName, subtitle: person.factualIdentity || "Contact", search: searchable(person.displayName, person.factualIdentity, (person.topics || []).map((topic: any) => topic.label)), kind: "Person", route: `/contacts?person=${encodeURIComponent(person.slug)}` });
        if (endpoint === "browser") for (const hole of data.rabbitHoles || []) next.push({ id: `rabbit-${hole.id}`, title: hole.title, subtitle: hole.centralQuestion || hole.shortIntro || "Rabbit hole", search: searchable(hole.title, hole.centralQuestion, hole.shortIntro, hole.currentTake), kind: "Rabbit hole", route: `/browser/${hole.slug}` });
        if (endpoint === "human") for (const entry of data.entries || []) next.push({ id: `human-${entry.id}`, title: entry.title, subtitle: entry.summary || "Human", search: searchable(entry.title, entry.summary, entry.currentTake, entry.supportingDetails), kind: "Human", route: `/laboratory?entry=${encodeURIComponent(entry.slug)}` });
        if (endpoint === "messages") for (const conversation of data.conversations || []) next.push({ id: `message-${conversation.slug}`, title: conversation.name, subtitle: conversation.preview || conversation.identity || "Conversation", search: searchable(conversation.name, conversation.identity, conversation.preview), kind: "Conversation", route: `/messages?conversation=${encodeURIComponent(conversation.slug)}` });
        if (endpoint === "travel") {
          const places = new Map((data.places || []).map((place: any) => [place.id, place]));
          for (const visit of data.visits || []) { const place: any = places.get(visit.placeId); if (place) next.push({ id: `visit-${visit.id}`, title: place.name, subtitle: `${place.countryName} · ${visit.sourceDateText}`, search: searchable(place.name, place.countryName, visit.publicBlurb, visit.sourceDateText), kind: "Place", route: `/atlas?visit=${encodeURIComponent(visit.id)}` }); }
        }
      }
      setItems(next.filter((item) => Boolean(item.title))); setLoaded(true);
    }).finally(() => setLoading(false));
  }, [loaded, loading, open]);

  const results = useMemo(() => {
    const clean = query.trim().toLocaleLowerCase();
    if (!clean) return appItems;
    const words = clean.split(/\s+/).filter(Boolean);
    return [...appItems, ...items].map((item) => {
      const haystack = item.search.toLocaleLowerCase(); const title = item.title.toLocaleLowerCase();
      if (!words.every((word) => haystack.includes(word))) return null;
      const score = title === clean ? 100 : title.startsWith(clean) ? 75 : title.includes(clean) ? 50 : 10;
      return { item, score };
    }).filter(Boolean).sort((a: any, b: any) => b.score - a.score || a.item.title.localeCompare(b.item.title)).slice(0, 18).map((result: any) => result.item as SpotlightItem);
  }, [items, query]);

  if (!open) return null;
  return <div className="spotlight-backdrop" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="spotlight-panel" role="dialog" aria-modal="true" aria-label="Search Synergetic Human">
      <label><Search/><input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Synergetic Human" aria-label="Search"/>{query && <button onClick={() => setQuery("")} aria-label="Clear search"><X/></button>}</label>
      <div className="spotlight-results">{loading && !loaded ? <div className="spotlight-loading"><Loader2/> Looking through the Brain…</div> : results.length ? results.map((item) => <button key={item.id} onClick={() => { onNavigate(item.route); onClose(); }}><span>{icons[item.kind] || <Search/>}</span><span><strong>{item.title}</strong><small>{item.subtitle}</small></span><em>{item.kind}</em></button>) : <div className="spotlight-empty"><strong>Nothing surfaced.</strong><span>Try a title, person, place, topic, or phrase.</span></div>}</div>
      <footer><span>Searches public Books, Notes, People, Browser, Human, Messages, and Places.</span><kbd>esc</kbd></footer>
    </section>
  </div>;
}
