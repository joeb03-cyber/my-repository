"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ExternalLink, Search, SlidersHorizontal, Star, X } from "lucide-react";
import taxonomyJson from "@/data/brain/topic-taxonomy.v1.json";
import { applyDetailDecision, applySummaryDecision, loadEditorialDecisions } from "@/lib/brain/editorial";
import type { BrainBookDetail, BrainBookSummary, BrainBooksIndex, BrainEditorialDecisions, BrainTopic } from "@/lib/brain/types";
import { BookCover } from "./book-cover";
import { EditorialReview } from "./library-editorial-review";

const loadingIndex: BrainBooksIndex = { schemaVersion: "brain-books.loading.v1", bookCount: 0, generatedFrom: "live Brain", books: [] };
const taxonomy = taxonomyJson as { topics: Array<{ slug: string; label: string; bookCount: number }> };
const allTopics: BrainTopic[] = taxonomy.topics.map((topic) => ({ ...topic, confidence: 1, editorialState: "suggested" }));

export function LibraryApp({ onBookOpen }: { onBookOpen: (book: BrainBookSummary) => void }) {
  const [index, setIndex] = useState<BrainBooksIndex>(loadingIndex);
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState("all");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [decisions, setDecisions] = useState<BrainEditorialDecisions>({});

  useEffect(() => {
    const reload = () => setDecisions(loadEditorialDecisions());
    reload();
    window.addEventListener("brain-editorial-change", reload);
    return () => window.removeEventListener("brain-editorial-change", reload);
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/brain/books", { cache: "no-store" }).then((response) => response.ok ? response.json() : Promise.reject()).then((nextIndex: BrainBooksIndex) => {
      if (active) setIndex(nextIndex);
    }).catch(() => { /* Keep the loading-safe empty state; never replace live editorial data with a stale bundle. */ });
    return () => { active = false; };
  }, []);

  const books = useMemo(() => index.books.map((book) => applySummaryDecision(book, decisions[book.slug])).filter((book) => {
    const needle = query.trim().toLowerCase();
    const matchesText = !needle || `${book.title} ${book.subtitle || ""} ${book.authors.join(" ")} ${book.topics.map((item) => item.label).join(" ")}`.toLowerCase().includes(needle);
    return matchesText && (topic === "all" || book.topics.some((item) => item.slug === topic));
  }), [query, topic, decisions, index.books]);
  const topicCounts = useMemo(() => new Map(allTopics.map((item) => [item.slug, index.books.filter((book) => book.topics.some((topicItem) => topicItem.slug === item.slug)).length])), [index.books]);

  if (reviewOpen) return <EditorialReview books={index.books} topics={allTopics} onClose={() => setReviewOpen(false)} onOpenBook={onBookOpen} />;

  return <div className="library-app brain-library">
    <header className="library-head">
      <div><span className="app-kicker">THE SYNERGETIC HUMAN BRAIN</span><h2>Books</h2><p className="library-intro">Books I’ve read, with the passages I saved along the way.<small>These are mostly raw highlights, not polished notes or summaries.</small></p><p>{index.bookCount} books · {index.books.reduce((sum, book) => sum + book.highlightCount, 0).toLocaleString()} readable passages</p></div>
      <div className="library-head__actions">
        {process.env.NODE_ENV !== "production" && <button className="editorial-entry" onClick={() => setReviewOpen(true)}><SlidersHorizontal /> Review <span>{index.books.reduce((sum, book) => sum + book.reviewFlagCount, 0)}</span></button>}
        <label className="library-search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") setQuery(""); }} placeholder="Search title, author, topic…" aria-label="Search Books" />{query && <button type="button" onClick={() => setQuery("")} aria-label="Clear Books search"><X /></button>}</label>
      </div>
    </header>
    <div className="library-toolbar"><div className="filter-row" aria-label="Filter books by topic">
      <button className={topic === "all" ? "is-active" : ""} onClick={() => setTopic("all")} aria-pressed={topic === "all"}>All</button>
      {taxonomy.topics.filter((item) => topicCounts.get(item.slug)).map((item) => <button key={item.slug} className={topic === item.slug ? "is-active" : ""} onClick={() => setTopic(item.slug)} aria-pressed={topic === item.slug}>{item.label}<span>{topicCounts.get(item.slug)}</span></button>)}
    </div><span className="library-result-count" aria-live="polite">{books.length} {books.length === 1 ? "book" : "books"}</span></div>
    <div className="book-grid brain-book-grid">{books.map((book) => <button className="book-tile" key={book.slug} onClick={() => onBookOpen(book)}><BookCover book={book} /><strong title={book.title}>{book.title}</strong><span>{book.authors.join(", ")}</span><div className="tag-list">{book.topics.slice(0, 2).map((item) => <em key={item.slug}>{item.label}</em>)}</div></button>)}</div>
    {!books.length && <div className="library-empty">Nothing on this shelf—try a different thought.</div>}
  </div>;
}

export function BookDetail({ slug, onBack }: { slug: string; onBack?: () => void }) {
  const [rawBook, setRawBook] = useState<BrainBookDetail | null>(null);
  const [error, setError] = useState(false);
  const [decisions, setDecisions] = useState<BrainEditorialDecisions>({});

  useEffect(() => {
    let active = true;
    setRawBook(null); setError(false);
    fetch(`/api/brain/books/${slug}${process.env.NODE_ENV !== "production" ? "?review=1" : ""}`, { cache: "no-store" }).then((response) => response.ok ? response.json() : Promise.reject()).then((book) => { if (active) setRawBook(book); }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [slug]);
  useEffect(() => {
    const reload = () => setDecisions(loadEditorialDecisions());
    reload(); window.addEventListener("brain-editorial-change", reload);
    return () => window.removeEventListener("brain-editorial-change", reload);
  }, []);

  const book = rawBook ? applyDetailDecision(rawBook, decisions[slug], allTopics) : null;
  if (error) return <div className="book-detail-state">This book record could not be opened.</div>;
  if (!book) return <div className="book-detail-state"><span className="library-spinner" /> Opening book…</div>;

  return <article className="book-detail brain-book-detail">
    {onBack && <button className="mobile-back-inline" onClick={onBack}><ArrowLeft /> Books</button>}
    <header className="book-detail__hero"><BookCover book={book} compact /><div><span className="app-kicker">BOOK {String(book.sourcePosition).padStart(3, "0")} · {book.highlightCount} PASSAGES</span><h2>{book.title}</h2>{book.subtitle && <p className="book-subtitle">{book.subtitle}</p>}<p className="book-author">{book.authors.join(", ")}</p><div className="tag-list">{book.topics.map((topic) => <em key={topic.slug}>{topic.label}</em>)}</div></div></header>
    {book.standouts.length > 0 && <><section className="standout-section"><Star /><div><span className="app-kicker">STARRED PASSAGES</span><h3>What stayed with me</h3></div></section><div className="standout-list">{book.standouts.map((unit) => <blockquote key={unit.id}><span>0{unit.standoutRank}</span>{unit.text}</blockquote>)}</div></>}
    <div className="detail-columns"><section className="highlight-reader"><span className="app-kicker">COMPLETE HIGHLIGHTS · SOURCE ORDER</span>
      {!book.readerUnits.length && <div className="book-incomplete"><strong>Highlights are not available yet.</strong><p>The book belongs in Books while its source document remains missing or inaccessible.</p></div>}
      {(book.passageGroups || []).map((group) => group.kind === "structure" ? group.units.map((unit) => unit.kind === "chapter_label" ? <h3 key={unit.id}>{unit.text}</h3> : <h4 key={unit.id}>{unit.text}</h4>) : <blockquote className={`passage-group ${group.units.length > 1 ? "is-grouped" : ""}`} key={group.id} data-group-confidence={group.confidence}>{group.units.map((unit) => <div className={`passage-paragraph passage-paragraph--${unit.kind} ${unit.listStyle === "numbered" ? "is-numbered" : ""}`} key={unit.id} id={unit.sourceUnitKey}><p>{unit.text}</p>{unit.locator?.raw && <cite>{unit.locator.raw}</cite>}</div>)}</blockquote>)}
    </section><aside>
      {book.relatedBooks.length > 0 && <Relation title="Related books" items={book.relatedBooks.map((item) => ({ label: item.title, href: `/library/${item.slug}` }))} />}
      <div className="external-links"><span className="app-kicker">SOURCES & INFORMATION</span>{book.links.providerRecord && <a href={book.links.providerRecord} target="_blank" rel="noreferrer">Book information <ExternalLink /></a>}{book.links.sourceHighlights && <a href={book.links.sourceHighlights} target="_blank" rel="noreferrer">Source highlights <ExternalLink /></a>}{book.links.externalReference && !book.links.externalReference.startsWith("hhttps") && <a href={book.links.externalReference} target="_blank" rel="noreferrer">Original reference <ExternalLink /></a>}</div>
    </aside></div>
  </article>;
}

function Relation({ title, items }: { title: string; items: Array<{ label: string; href: string }> }) {
  return <section className="relation"><span className="app-kicker">{title}</span>{items.map((item) => <a key={item.href} href={item.href}>{item.label}<span>↗</span></a>)}</section>;
}
