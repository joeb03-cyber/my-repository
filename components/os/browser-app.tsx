"use client";

import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, ChevronRight, Clock3, Compass, FileText, Search, Sparkles, UserRound, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import localBrowser from "@/data/brain/browser.v1.json";
import type { AppId } from "@/data/prototype";
import type { BrainBookSummary, BrainBooksIndex } from "@/lib/brain/types";
import type { BrowserIndex, RabbitHole, RabbitHoleBlock, RabbitHoleEntityLink } from "@/lib/brain/browser-types";

export default function BrowserApp({ onBookOpen, onOpenApp }: { onBookOpen: (book: BrainBookSummary) => void; onOpenApp: (id: AppId) => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const pathSlug = pathname.startsWith("/browser/") ? pathname.split("/")[2] : null;
  const [routeSlug, setRouteSlug] = useState<string | null>(pathSlug);
  useEffect(() => { if (pathname === "/browser" || pathname.startsWith("/browser/")) setRouteSlug(pathSlug); }, [pathname, pathSlug]);
  const [data, setData] = useState<BrowserIndex>(localBrowser as BrowserIndex);
  const [books, setBooks] = useState<BrainBookSummary[]>([]);
  const [tabs, setTabs] = useState<string[]>(routeSlug ? [routeSlug] : []);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const viewportRef = useRef<HTMLElement>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/brain/browser").then((response) => response.ok ? response.json() : null),
      fetch("/api/brain/books").then((response) => response.ok ? response.json() : null),
    ]).then(([browser, bookIndex]: [BrowserIndex | null, BrainBooksIndex | null]) => {
      if (browser) setData(browser);
      if (bookIndex) setBooks(bookIndex.books);
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (routeSlug && data.rabbitHoles.some((hole) => hole.slug === routeSlug)) {
      setTabs((current) => current.includes(routeSlug) ? current : [...current, routeSlug]);
    }
  }, [routeSlug, data.rabbitHoles]);

  useEffect(() => { viewportRef.current?.scrollTo({ top: 0, behavior: "auto" }); }, [routeSlug]);

  const selected = data.rabbitHoles.find((hole) => hole.slug === routeSlug) || null;
  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return data.rabbitHoles;
    return data.rabbitHoles.filter((hole) => `${hole.title} ${hole.centralQuestion} ${hole.shortIntro}`.toLowerCase().includes(needle));
  }, [data.rabbitHoles, query]);

  function openHole(slug: string) {
    setTabs((current) => current.includes(slug) ? current : [...current, slug]);
    setSearchOpen(false); setQuery("");
    router.push(`/browser/${slug}`);
  }
  function closeTab(slug: string) {
    setTabs((current) => {
      const next = current.filter((item) => item !== slug);
      if (slug === routeSlug) {
        const nextSlug = next[next.length - 1];
        router.push(nextSlug ? `/browser/${nextSlug}` : "/browser");
      }
      return next;
    });
  }
  function openEntity(link: RabbitHoleEntityLink) {
    if (link.entityKind === "book") {
      const book = books.find((item) => item.id === link.entityId || item.slug === link.entitySlug);
      if (book) onBookOpen(book);
      else router.push(`/library/${link.entitySlug}`);
    } else if (link.entityKind === "person") router.push(`/contacts?person=${encodeURIComponent(link.entitySlug)}`);
    else if (link.entityKind === "note") router.push(`/journal?note=${encodeURIComponent(link.entitySlug)}`);
    else if (link.entitySlug) window.open(link.entitySlug, "_blank", "noopener,noreferrer");
  }

  return <div className="browser-native system-app">
    <header className="browser-chrome">
      <div className="browser-tab-strip">
        <button className={`browser-home-tab ${!selected ? "is-active" : ""}`} onClick={() => router.push("/browser")}><Compass/><span>Start Page</span></button>
        {tabs.map((slug) => { const hole = data.rabbitHoles.find((item) => item.slug === slug); if (!hole) return null; return <button key={slug} className={`browser-tab ${selected?.slug === slug ? "is-active" : ""}`} onClick={() => openHole(slug)}><i className={`is-${hole.accent}`}/><span>{hole.title}</span><b onClick={(event) => { event.stopPropagation(); closeTab(slug); }} aria-label={`Close ${hole.title}`}><X/></b></button>; })}
      </div>
      <div className="browser-controls">
        <button aria-label="Back" title="Back" onClick={() => router.back()}><ArrowLeft/></button><button aria-label="Forward" title="Forward" onClick={() => router.forward()}><ArrowRight/></button>
        <label className={`browser-omnibox ${searchOpen ? "is-searching" : ""}`}><Search/><input aria-label="Search Browser" value={query} onFocus={() => setSearchOpen(true)} onChange={(event) => { setQuery(event.target.value); setSearchOpen(true); }} placeholder={selected ? `brain://browser/${selected.slug}` : "Search Joe's Browser"}/>{query && <button onClick={() => setQuery("")} aria-label="Clear"><X/></button>}</label>

      </div>
      {searchOpen && <div className="browser-search-results"><header><strong>{query ? "Search results" : "Open rabbit holes"}</strong><button onClick={() => setSearchOpen(false)}>Done</button></header>{results.map((hole) => <button key={hole.slug} onClick={() => openHole(hole.slug)}><i className={`is-${hole.accent}`}/><span><strong>{hole.title}</strong><small>{hole.centralQuestion}</small></span><ChevronRight/></button>)}{!results.length && <p>No published trail matches that search.</p>}</div>}
    </header>
    <main ref={viewportRef} className="browser-viewport">{selected ? <RabbitHolePage hole={selected} openHole={openHole} openEntity={openEntity} onOpenApp={onOpenApp}/> : <BrowserLanding data={data} openHole={openHole}/>}</main>
  </div>;
}

function BrowserLanding({ data, openHole }: { data: BrowserIndex; openHole: (slug: string) => void }) {
  return <div className="browser-start-page">
    <section className="browser-start-intro"><span className="app-kicker">BROWSER</span><h1>Open tabs in my head.</h1><p>{data.description}</p></section>
    <section className="browser-favorites" aria-label="Published rabbit holes">{data.rabbitHoles.map((hole, index) => <button key={hole.slug} className={`rabbit-favorite is-${hole.accent}`} onClick={() => openHole(hole.slug)}><span className="rabbit-favorite-number">0{index + 1}</span><i/><div><small>{hole.status === "open" ? "OPEN RABBIT HOLE" : hole.status.toUpperCase()}</small><h2>{hole.title}</h2><p>{hole.centralQuestion}</p><span>Follow the trail <ArrowUpRight/></span></div></button>)}</section>
    <aside className="browser-current-tab"><Clock3/><div><small>CURRENTLY READING AROUND</small><strong>{data.currentReading?.title}</strong><p>{data.currentReading?.note}</p></div><span>Still exploring</span></aside>
  </div>;
}

function RabbitHolePage({ hole, openHole, openEntity, onOpenApp }: { hole: RabbitHole; openHole: (slug: string) => void; openEntity: (link: RabbitHoleEntityLink) => void; onOpenApp: (id: AppId) => void }) {
  const router = useRouter();
  const startHere = [...hole.entities.filter((item) => item.publicRole === "book"), ...hole.resources.filter((item) => item.publicRole === "start_here")];
  const people = hole.entities.filter((item) => item.entityKind === "person");
  const keepGoing = hole.resources.filter((item) => item.publicRole === "keep_going");
  return <article className={`rabbit-page is-${hole.accent}`}>
    <header className="rabbit-hero"><div className="rabbit-path"><span>Browser</span><ChevronRight/><span>Open tab</span></div><span className="rabbit-status"><i/> {hole.status === "open" ? "Still open" : hole.status === "paused" ? "Paused" : "Closed"}</span><h1>{hole.title}</h1><p className="rabbit-question">{hole.centralQuestion}</p><p className="rabbit-intro">{hole.shortIntro}</p></header>
    <div className="rabbit-content-grid"><div className="rabbit-story">
      <section className="rabbit-current-take"><span>WHERE I’M CURRENTLY LEANING</span><p>{hole.currentTake}</p></section>
      {hole.blocks.sort((a,b) => a.sortOrder-b.sortOrder).map((block) => <RabbitBlock block={block} key={block.id}/>)}
    </div><aside className="rabbit-side">
      {!!startHere.length && <section><h2><Sparkles/> Start here</h2>{startHere.map((item: any) => "entityKind" in item ? <button className="rabbit-source" key={item.entitySlug} onClick={() => openEntity(item)}><SourceIcon kind={item.entityKind}/><span><strong>{item.entityTitle}</strong><small>{item.label}</small></span><ChevronRight/></button> : <a className="rabbit-source" key={item.id} href={item.url} target="_blank" rel="noreferrer"><SourceIcon kind={item.resourceType}/><span><strong>{item.title}</strong><small>{item.note}</small></span><ArrowUpRight/></a>)}</section>}
      {!!people.length && <section><h2><UserRound/> People</h2>{people.map((person) => <button className="rabbit-person" onClick={() => openEntity(person)} key={person.entitySlug}><span>{person.entityTitle.split(" ").map((part) => part[0]).slice(0,2).join("")}</span><div><strong>{person.entityTitle}</strong><small>{person.label}</small></div><ChevronRight/></button>)}</section>}
      {!!hole.humanLinks.length && <section className="rabbit-human-links"><h2>How this affects how I live</h2>{hole.humanLinks.map((link) => <button key={link.humanEntrySlug} onClick={() => router.push(`/laboratory?entry=${encodeURIComponent(link.humanEntrySlug)}`)}><span><strong>{link.humanEntryTitle}</strong><small>{link.browserLabel}</small></span><ChevronRight/></button>)}</section>}
    </aside></div>
    {!!keepGoing.length && <section className="rabbit-reading-list"><header><span>KEEP GOING</span><h2>Further down the trail</h2></header><div>{keepGoing.map((resource) => <a key={resource.id} href={resource.url} target="_blank" rel="noreferrer"><small>{resource.resourceType}</small><strong>{resource.title}</strong><p>{resource.note}</p><ArrowUpRight/></a>)}</div></section>}
    <section className="rabbit-connections"><header><span>CONNECTED TABS</span><h2>That connects to this other thing…</h2></header><div className="rabbit-trail-map">{hole.related.sort((a,b) => a.sortOrder-b.sortOrder).map((link, index) => <button key={link.slug} disabled={link.publicationState !== "published"} className={link.publicationState === "published" ? "is-published" : "is-draft"} onClick={() => link.publicationState === "published" && openHole(link.slug)}><i>{String(index + 1).padStart(2,"0")}</i><span><strong>{link.title}</strong><small>{link.label}</small></span><em>{link.publicationState === "published" ? "Open →" : "Still exploring"}</em></button>)}</div></section>
  </article>;
}

function RabbitBlock({ block }: { block: RabbitHoleBlock }) {
  return <section className={`rabbit-block is-${block.type}`}><span>{block.type === "experience" ? "MY EXPERIENCE" : block.type === "question" ? "OPEN QUESTION" : "THE TRAIL"}</span><h2>{block.heading}</h2><p>{block.body}</p>{!!block.items.length && <ul>{block.items.map((item) => <li key={item}>{item}</li>)}</ul>}</section>;
}

function SourceIcon({ kind }: { kind: string }) {
  if (kind === "book") return <BookOpen/>;
  if (kind === "person") return <UserRound/>;
  return <FileText/>;
}
