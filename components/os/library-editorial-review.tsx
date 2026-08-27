"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Download, Link2, Search, Star, Unlink } from "lucide-react";
import { exportEditorialDecisions, loadEditorialDecisions, saveEditorialDecision } from "@/lib/brain/editorial";
import type { BookEditorialDecision, BrainBookDetail, BrainBookSummary, BrainEditorialDecisions, BrainTopic, UnitEditorialDecision } from "@/lib/brain/types";
import { BookCover } from "./book-cover";

const classifications = ["highlight", "chapter_label", "section_label", "summary", "note", "list_item", "exercise", "worksheet_element", "unknown", "possible_personal_summary"];

export function EditorialReview({ books, topics, onClose, onOpenBook }: { books: BrainBookSummary[]; topics: BrainTopic[]; onClose: () => void; onOpenBook: (book: BrainBookSummary) => void }) {
  const [query, setQuery] = useState("");
  const [selectedSlug, setSelectedSlug] = useState(books.find((book) => book.reviewFlagCount)?.slug || books[0]?.slug);
  const [detail, setDetail] = useState<BrainBookDetail | null>(null);
  const [decisions, setDecisions] = useState<BrainEditorialDecisions>({});
  const [message, setMessage] = useState("");
  const [passageQuery, setPassageQuery] = useState("");
  const [unitLimit, setUnitLimit] = useState(80);
  const [passageLimit, setPassageLimit] = useState(80);
  const [groupLimit, setGroupLimit] = useState(80);

  useEffect(() => setDecisions(loadEditorialDecisions()), []);
  useEffect(() => {
    if (!selectedSlug) return;
    setDetail(null);
    setUnitLimit(80);
    setPassageLimit(80);
    setGroupLimit(80);
    setPassageQuery("");
    fetch(`/api/brain/books/${selectedSlug}?review=1`, { cache: "no-store" }).then((response) => response.json()).then(setDetail);
  }, [selectedSlug]);

  const filteredBooks = useMemo(() => books.filter((book) => `${book.title} ${book.authors.join(" ")}`.toLowerCase().includes(query.toLowerCase())).sort((left, right) => left.sourcePosition - right.sourcePosition), [books, query]);
  const decision = selectedSlug ? decisions[selectedSlug] || {} : {};
  const updateDecision = (changes: Partial<BookEditorialDecision>) => {
    if (!selectedSlug) return;
    const next = { ...decision, ...changes };
    setDecisions(saveEditorialDecision(selectedSlug, next));
    setMessage("Saved locally");
    window.setTimeout(() => setMessage(""), 1200);
  };
  const updateUnit = (key: string, changes: Partial<UnitEditorialDecision>) => updateDecision({ units: { ...(decision.units || {}), [key]: { ...(decision.units?.[key] || {}), ...changes } } });
  const toggleStandout = (key: string) => {
    const units = { ...(decision.units || {}) };
    if (units[key]?.standoutRank) {
      units[key] = { ...units[key], standoutRank: null };
      Object.entries(units).filter(([, value]) => value.standoutRank).sort(([, left], [, right]) => (left.standoutRank || 0) - (right.standoutRank || 0)).forEach(([unitKey], index) => { units[unitKey] = { ...units[unitKey], standoutRank: index + 1 }; });
    } else {
      const ranks = Object.values(units).map((value) => value.standoutRank).filter((rank): rank is number => Boolean(rank));
      if (ranks.length >= 3) { setMessage("A book can have at most three starred passages"); return; }
      units[key] = { ...units[key], standoutRank: ranks.length + 1 };
    }
    updateDecision({ units });
  };

  const selectedSummary = books.find((book) => book.slug === selectedSlug);
  const uncertainUnits = detail?.review?.uncertainUnits || [];
  const passages = (detail?.readerUnits || []).filter((unit) => ["highlight", "summary", "note", "list_item", "exercise"].includes(unit.kind) && unit.text.toLowerCase().includes(passageQuery.toLowerCase()));
  const visibleUncertainUnits = uncertainUnits.slice(0, unitLimit);
  const visiblePassages = passages.slice(0, passageLimit);
  const defaultJoinedKeys = new Set((detail?.passageGroups || []).flatMap((group) => group.units.slice(1).map((unit) => unit.sourceUnitKey)));
  const contentKinds = new Set(["highlight", "summary", "note", "list_item", "exercise"]);
  const groupingCandidates = (detail?.readerUnits || []).map((unit, index, units) => ({ unit, canJoin: index > 0 && contentKinds.has(unit.kind) && contentKinds.has(units[index - 1].kind), joined: decision.units?.[unit.sourceUnitKey]?.joinWithPrevious ?? defaultJoinedKeys.has(unit.sourceUnitKey) })).filter((item) => contentKinds.has(item.unit.kind));
  const visibleGroupingCandidates = groupingCandidates.slice(0, groupLimit);

  return <div className="editorial-review">
    <header className="editorial-review__bar"><button onClick={onClose}><ArrowLeft /> Library</button><div><span className="app-kicker">LOCAL · PRIVATE EDITORIAL STATE</span><strong>Books review</strong></div><span className="editorial-saved">{message}</span><button onClick={() => exportEditorialDecisions(decisions)}><Download /> Export decisions</button></header>
    <div className="editorial-layout">
      <aside className="editorial-sidebar"><label><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a book" /></label><div>{filteredBooks.map((book) => <button key={book.slug} className={selectedSlug === book.slug ? "is-selected" : ""} onClick={() => setSelectedSlug(book.slug)}><span>{book.title}</span><small>{book.reviewFlagCount ? `${book.reviewFlagCount} flags` : "ready"}</small></button>)}</div></aside>
      <main className="editorial-main">{!detail || !selectedSummary ? <div className="book-detail-state">Opening review record…</div> : <>
        <section className="editorial-identity"><BookCover book={selectedSummary} compact /><div className="editorial-fields"><label>Canonical title<input value={decision.title ?? detail.title} onChange={(event) => updateDecision({ title: event.target.value })} /></label><label>Subtitle<input value={decision.subtitle ?? detail.subtitle ?? ""} onChange={(event) => updateDecision({ subtitle: event.target.value })} /></label><label>Authors<input value={(decision.authors ?? detail.authors).join(", ")} onChange={(event) => updateDecision({ authors: event.target.value.split(",").map((item) => item.trim()) })} /></label><div className="editorial-status-row"><span className={`review-pill review-pill--${detail.review?.metadataStatus}`}>{detail.review?.metadataStatus.replaceAll("_", " ")}</span><span>{detail.highlightCount} passages</span><span>source #{detail.sourcePosition}</span></div></div></section>
        <section className="editorial-card"><header><div><span className="app-kicker">COVER</span><h3>Choose what the Library displays</h3></div></header><div className="editorial-choice-row"><button className={(decision.coverChoice ?? (detail.cover.status === "cached" ? "provider" : "placeholder")) === "provider" ? "is-selected" : ""} disabled={detail.cover.status !== "cached"} onClick={() => updateDecision({ coverChoice: "provider" })}><Check /> Provider cover</button><button className={decision.coverChoice === "placeholder" || (!decision.coverChoice && detail.cover.status !== "cached") ? "is-selected" : ""} onClick={() => updateDecision({ coverChoice: "placeholder" })}><Check /> Local placeholder</button></div>{detail.review?.metadataWarnings.map((warning) => <p className="editorial-warning" key={warning}>{warning}</p>)}</section>
        <section className="editorial-card"><header><div><span className="app-kicker">TOPICS · SUGGESTED</span><h3>Edit collection-wide assignments</h3></div></header><div className="editorial-topic-grid">{topics.map((topic) => { const active = (decision.topicSlugs ?? detail.topics.map((item) => item.slug)).includes(topic.slug); return <label key={topic.slug}><input type="checkbox" checked={active} onChange={() => { const current = decision.topicSlugs ?? detail.topics.map((item) => item.slug); updateDecision({ topicSlugs: active ? current.filter((slug) => slug !== topic.slug) : [...current, topic.slug] }); }} />{topic.label}</label>; })}</div></section>
        {detail.review?.incomplete && <section className="editorial-card editorial-card--attention"><header><div><span className="app-kicker">INCOMPLETE SOURCE</span><h3>{detail.review.incomplete.message}</h3></div></header><select value={decision.incompleteState || "open"} onChange={(event) => updateDecision({ incompleteState: event.target.value as BookEditorialDecision["incompleteState"] })}><option value="open">Open</option><option value="acknowledged">Acknowledged</option><option value="resolved">Resolved after source update</option></select></section>}
        <section className="editorial-card"><header><div><span className="app-kicker">PARSER REVIEW</span><h3>{uncertainUnits.length} uncertain content units</h3></div></header>{uncertainUnits.length === 0 ? <p className="editorial-empty">No parser exceptions for this book.</p> : <><div className="editorial-unit-list">{visibleUncertainUnits.map((unit) => { const edit = decision.units?.[unit.sourceUnitKey] || {}; const kind = edit.kind || unit.kind; const eligible = edit.publicEligible ?? unit.publicEligible ?? kind !== "possible_personal_summary"; return <article key={unit.id} className={kind === "possible_personal_summary" ? "is-sensitive" : ""}><p>{unit.text}</p><footer><code>{unit.sourceUnitKey} · paragraph {unit.sourceRange?.paragraph_start}</code><select value={kind} onChange={(event) => updateUnit(unit.sourceUnitKey, { kind: event.target.value, publicEligible: event.target.value === "possible_personal_summary" ? false : eligible })}>{classifications.map((option) => <option key={option}>{option}</option>)}</select><label><input type="checkbox" checked={eligible} onChange={(event) => updateUnit(unit.sourceUnitKey, { publicEligible: event.target.checked })} /> Public</label></footer></article>; })}</div>{unitLimit < uncertainUnits.length && <button className="editorial-load-more" onClick={() => setUnitLimit((limit) => limit + 80)}>Show 80 more <span>{unitLimit} of {uncertainUnits.length}</span></button>}</>}</section>
        <section className="editorial-card"><header><div><span className="app-kicker">PASSAGE GROUPING · PRESENTATION ONLY</span><h3>Join or separate adjacent source units</h3></div></header><p className="editorial-card__intro">Grouping changes display boundaries only. Original units, ranges, order, and provenance remain untouched.</p><div className="editorial-grouping-list">{visibleGroupingCandidates.map(({ unit, canJoin, joined }) => <article key={unit.id} className={joined ? "is-joined" : ""}><button disabled={!canJoin} onClick={() => updateUnit(unit.sourceUnitKey, { joinWithPrevious: !joined })} aria-label={joined ? "Separate from previous passage" : "Join with previous passage"}>{joined ? <Link2 /> : <Unlink />}</button><div><code>{unit.sourceUnitKey}</code><p>{unit.text}</p></div></article>)}</div>{groupLimit < groupingCandidates.length && <button className="editorial-load-more" onClick={() => setGroupLimit((limit) => limit + 80)}>Show 80 more <span>{groupLimit} of {groupingCandidates.length}</span></button>}</section>
        <section className="editorial-card"><header><div><span className="app-kicker">STANDOUTS · MANUAL ONLY</span><h3>Star up to three passages</h3></div><label className="editorial-passage-search"><Search /><input value={passageQuery} onChange={(event) => { setPassageQuery(event.target.value); setPassageLimit(80); }} placeholder="Search passages" /></label></header><div className="editorial-passage-list">{visiblePassages.map((unit) => { const rank = decision.units?.[unit.sourceUnitKey]?.standoutRank; return <article key={unit.id}><button className={rank ? "is-starred" : ""} onClick={() => toggleStandout(unit.sourceUnitKey)} aria-label={rank ? "Remove standout" : "Mark as standout"}><Star />{rank || ""}</button><p>{unit.text}</p></article>; })}</div>{passageLimit < passages.length && <button className="editorial-load-more" onClick={() => setPassageLimit((limit) => limit + 80)}>Show 80 more <span>{passageLimit} of {passages.length}</span></button>}</section>
        <div className="editorial-footer-actions"><button onClick={() => updateDecision({ identityState: "resolved" })}><Check /> Mark identity resolved</button><button onClick={() => onOpenBook(selectedSummary)}>Open public book view</button></div>
      </>}</main>
    </div>
  </div>;
}
