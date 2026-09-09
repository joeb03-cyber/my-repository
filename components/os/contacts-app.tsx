"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowUpRight, BookOpen, CalendarDays, ChevronRight, Clock3, Info, Mic2, Search, Users, X } from "lucide-react";
import type { BrainBookSummary, BrainBooksIndex } from "@/lib/brain/types";
import type { BrainContact, BrainPeopleSourcesIndex, BrainPodcastEpisode } from "@/lib/brain/people-types";
import { useAppItem } from "@/lib/use-app-item";
import { BookCover } from "./book-cover";

export default function ContactsApp({ onBookOpen }: { onBookOpen: (book: BrainBookSummary) => void }) {
  const { requested, select, active } = useAppItem("/contacts", "person");
  const [data, setData] = useState<BrainPeopleSourcesIndex | null>(null);
  const [books, setBooks] = useState<BrainBookSummary[]>([]);
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [episodeId, setEpisodeId] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/brain/people").then((response) => {
        if (!response.ok) throw new Error("contacts");
        return response.json();
      }),
      fetch("/api/brain/books").then((response) => response.json()),
    ]).then(([peopleData, booksData]: [BrainPeopleSourcesIndex, BrainBooksIndex]) => {
      setData(peopleData);
      setBooks(booksData.books);
      setSelectedId(window.matchMedia("(max-width: 520px)").matches ? null : peopleData.contacts[0]?.id || null);
    }).catch(() => setError(true));
  }, []);

  useEffect(() => {
    if (!active || !data) return;
    const person = data.contacts.find((item) => item.slug === requested);
    if (person) { setQuery(""); setTopic("all"); setSelectedId(person.id); }
    else if (!requested && window.matchMedia("(max-width: 520px)").matches) setSelectedId(null);
  }, [requested, data, active]);
  const topics = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>();
    data?.contacts.forEach((person) => person.topics.forEach((item) => {
      const current = counts.get(item.slug);
      counts.set(item.slug, { label: item.label, count: (current?.count || 0) + 1 });
    }));
    return Array.from(counts, ([slug, value]) => ({ slug, ...value })).sort((a, b) => a.label.localeCompare(b.label));
  }, [data]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (data?.contacts || []).filter((person) => {
      const topicMatch = topic === "all" || person.topics.some((item) => item.slug === topic);
      const queryMatch = !needle || person.displayName.toLowerCase().includes(needle) || person.topics.some((item) => item.label.toLowerCase().includes(needle));
      return topicMatch && queryMatch;
    });
  }, [data, query, topic]);

  useEffect(() => {
    if (!requested && selectedId && filtered.length && !filtered.some((person) => person.id === selectedId)) setSelectedId(filtered[0].id);
  }, [filtered, selectedId, requested]);

  const selected = data?.contacts.find((person) => person.id === selectedId) || null;
  const episode = data?.podcastEpisodes.find((item) => item.id === episodeId) || null;
  const openBook = (bookId: string) => {
    const book = books.find((item) => item.id === bookId);
    if (book) onBookOpen(book);
  };

  if (error) return <div className="contacts-state"><Users/><strong>Contacts could not be opened.</strong><span>The public Brain view is temporarily unavailable.</span></div>;
  if (!data) return <div className="contacts-state"><Users className="is-loading"/><strong>Opening Contacts…</strong></div>;

  if (requested && !data.contacts.some((person) => person.slug === requested)) return <div className="contacts-state">This contact is not available.<button onClick={() => select(null)}>All Contacts</button></div>;

  return <div className={`contacts-app ${selected ? "has-mobile-selection" : ""}`}>
    <aside className="contacts-groups">
      <h2>Contacts</h2>
      <strong className="contacts-section-label">LISTS</strong>
      <button className={topic === "all" ? "is-selected" : ""} onClick={() => setTopic("all")}><span className="contacts-list-icon"><Users/></span><span>All Contacts</span><small>{data.contactCount}</small></button>
      <strong className="contacts-section-label">AREAS</strong>
      <div className="contacts-topic-list">{topics.map((item) => <button key={item.slug} className={topic === item.slug ? "is-selected" : ""} onClick={() => setTopic(item.slug)}><i/><span>{item.label}</span><small>{item.count}</small></button>)}</div>
      <div className="contacts-sidebar-note"><Info/><span>People whose work I’ve found interesting, useful, provocative, or worth exploring. Inclusion isn’t blanket endorsement.</span></div>
    </aside>

    <section className="contacts-list-pane">
      <div className="contacts-list-title"><strong>{topic === "all" ? "All Contacts" : topics.find((item) => item.slug === topic)?.label}</strong><span>{filtered.length}</span></div>
      <label className="contacts-search"><Search/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" aria-label="Search Contacts"/>{query && <button onClick={() => setQuery("")} aria-label="Clear search">×</button>}</label>
      <div className="contacts-list-scroll">{filtered.map((person) => <button key={person.id} className={person.id === selectedId ? "is-selected" : ""} onClick={() => { setSelectedId(person.id); select(person.slug); }}>
        <PersonAvatar person={person} size="small"/><span><strong>{person.displayName}</strong><small>{person.topics[0]?.label || "Contact"}</small></span><ChevronRight/>
      </button>)}{!filtered.length && <p className="contacts-no-results">No matching contacts.</p>}</div>
    </section>

    <ContactDetail person={selected} onBack={() => { setSelectedId(null); select(null); }} onOpenBook={openBook} onOpenEpisode={setEpisodeId}/>
    {episode && <PodcastDetail episode={episode} onClose={() => setEpisodeId(null)}/>}
  </div>;
}

function PersonAvatar({ person, size }: { person: BrainContact; size: "small" | "large" }) {
  const palettes = ["sage", "blue", "plum", "amber", "rose"];
  const palette = palettes[person.displayName.codePointAt(0)! % palettes.length];
  return <span className={`person-avatar person-avatar--${size} person-avatar--${palette} ${person.portrait ? "has-portrait" : ""}`} aria-hidden="true">
    {person.portrait ? <img src={person.portrait.path} alt=""/> : person.initials}
  </span>;
}

function ContactDetail({ person, onBack, onOpenBook, onOpenEpisode }: { person: BrainContact | null; onBack: () => void; onOpenBook: (id: string) => void; onOpenEpisode: (id: string) => void }) {
  if (!person) return <section className="contact-detail contact-detail--empty"><Users/><strong>Select a contact</strong></section>;
  return <section className="contact-detail">
    <div className="contact-detail-toolbar"><button className="contact-mobile-back" onClick={onBack}><ArrowLeft/> Contacts</button></div>
    <div className="contact-detail-scroll">
      <header className="contact-profile"><PersonAvatar person={person} size="large"/><div><h1>{person.displayName}</h1>{person.factualIdentity && <p>{person.factualIdentity}</p>}<div className="contact-topic-pills">{person.topics.map((item) => <span key={item.slug}>{item.label}</span>)}</div>{person.portrait?.sourceUrl && <a className="contact-portrait-credit" href={person.portrait.sourceUrl} target="_blank" rel="noreferrer">Photo: {person.portrait.attribution} · {person.portrait.license}</a>}</div></header>

      {!!person.books.length && <ContactSection icon={<BookOpen/>} title="Books"><div className="contact-books">{person.books.map((book) => <button key={book.id} onClick={() => onOpenBook(book.id)}>
        <BookCover compact book={{ title: book.title, authors: book.originalAuthor ? [book.originalAuthor] : [], cover: book.coverPath ? { status: "cached", public_path: book.coverPath } : { status: "placeholder", public_path: "/book-covers/placeholder.svg" } }}/><span><strong>{book.title}</strong>{book.originalAuthor && <small>{book.originalAuthor}</small>}<em>Open in Books <ChevronRight/></em></span>
      </button>)}</div></ContactSection>}

      {!!person.podcastAppearances.length && <ContactSection icon={<Mic2/>} title="Podcast appearances"><div className="contact-podcasts">{person.podcastAppearances.map((item) => <button key={item.id} onClick={() => onOpenEpisode(item.id)}>
        <span className="podcast-source-icon"><Mic2/></span><span><small>{item.showTitle}</small><strong>{item.title}</strong><em>{formatDate(item.publicationDate)}{item.durationSeconds ? ` · ${formatDuration(item.durationSeconds)}` : ""}</em></span><ChevronRight/>
      </button>)}</div></ContactSection>}

      {!person.books.length && !person.podcastAppearances.length && <div className="contact-sparse"><span>No linked books or episodes yet.</span></div>}
    </div>
  </section>;
}

function ContactSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return <section className="contact-section"><h2>{icon}{title}</h2>{children}</section>;
}

function PodcastDetail({ episode, onClose }: { episode: BrainPodcastEpisode; onClose: () => void }) {
  const hosts = episode.credits.filter((credit) => credit.role === "host");
  const guests = episode.credits.filter((credit) => credit.role === "guest");
  return <div className="podcast-detail-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <article className="podcast-detail-card" role="dialog" aria-modal="true" aria-label={episode.title}>
      <header><span className="podcast-detail-art"><Mic2/></span><div><small>PODCAST EPISODE</small><h2>{episode.title}</h2><p>{episode.showTitle}</p></div><button onClick={onClose} aria-label="Close episode"><X/></button></header>
      <dl>
        {!!guests.length && <><dt>Guests</dt><dd>{guests.map((credit) => credit.name).join(", ")}</dd></>}
        {!!hosts.length && <><dt>Hosts</dt><dd>{hosts.map((credit) => credit.name).join(", ")}</dd></>}
        {episode.publicationDate && <><dt><CalendarDays/> Date</dt><dd>{formatDate(episode.publicationDate)}</dd></>}
        {episode.durationSeconds && <><dt><Clock3/> Duration</dt><dd>{formatDuration(episode.durationSeconds)}</dd></>}
      </dl>

      {episode.publicProvenanceLabel && <p className="podcast-provenance">{episode.publicProvenanceLabel}</p>}
      <a href={episode.originalUrl} target="_blank" rel="noreferrer">Open original episode <ArrowUpRight/></a>
    </article>
  </div>;
}

function formatDate(value?: string | null) {
  if (!value) return "Date unknown";
  return new Intl.DateTimeFormat("en", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

function formatDuration(total: number) {
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return hours ? `${hours} hr ${minutes} min` : `${minutes} min`;
}
