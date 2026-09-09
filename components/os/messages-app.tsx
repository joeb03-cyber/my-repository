"use client";

import { ArrowLeft, ExternalLink, Search, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAppItem } from "@/lib/use-app-item";
import { type GroundedConversation } from "@/data/messages";

import { messageParagraphs } from "@/lib/message-paragraphs";

function MessageBody({ body }: { body: string }) {
  return <>{messageParagraphs(body).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</>;
}

export default function MessagesApp() {
  const { requested, select, active } = useAppItem("/messages", "conversation");
  const threadRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [items, setItems] = useState<GroundedConversation[]>([]);
  const [selectedSlug, setSelectedSlug] = useState("");
  const [query, setQuery] = useState("");
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
  const conversations = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) => `${item.name} ${item.identity} ${item.preview}`.toLowerCase().includes(needle));
  }, [items, query]);
  const selected = items.find((item) => item.slug === selectedSlug) || items[0];
  useEffect(() => {
    fetch("/api/brain/messages", { cache: "no-store" })
      .then((response) => { if (!response.ok) throw new Error(); return response.json(); })
      .then((value) => { if (!Array.isArray(value.conversations)) throw new Error(); setItems(value.conversations); setSelectedSlug(value.conversations[0]?.slug || ""); setLoaded(true); })
      .catch(() => setError(true));
  }, []);
  useEffect(() => {
    if (!active) return;
    if (requested && items.some((item) => item.slug === requested)) { setQuery(""); setSelectedSlug(requested); setMobileThreadOpen(true); }
    else if (!requested) setMobileThreadOpen(false);
  }, [requested, items, active]);
  useEffect(() => { threadRef.current?.scrollTo({ top: 0 }); }, [selectedSlug]);
  const choose = (slug: string) => { setSelectedSlug(slug); setMobileThreadOpen(true); select(slug); };

  if (error) return <div className="message-no-results" role="status">Messages could not be loaded. Please try again later.</div>;
  if (!loaded) return <div className="message-no-results" role="status">Opening Messages…</div>;
  if (requested && !items.some((item) => item.slug === requested)) return <div className="message-no-results">This conversation is no longer available.<button onClick={() => select(null)}>All conversations</button></div>;
  if (!selected) return <div className="messages-app system-app"><div className="message-no-results">No published conversations yet.</div></div>;

  return <div className={`messages-app system-app ${mobileThreadOpen ? "is-thread-open" : ""}`}>
    <aside className="messages-list">
      <div className="os-toolbar"><strong>Messages</strong><span>{items.length} conversations</span></div>
      <label className="system-search"><Search/><input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search Messages" placeholder="Search"/></label>
      <div className="message-disclosure"><Sparkles/><span>Source-grounded reconstructions—not the actual person.</span></div>
      <div className="message-conversation-list">
        {conversations.map((item) => <button className={item.slug === selected.slug ? "is-selected" : ""} key={item.slug} onClick={() => choose(item.slug)}>
          <span className="message-avatar" style={{ background: `linear-gradient(145deg, ${item.accent}, color-mix(in srgb, ${item.accent} 62%, #26313a))` }}>{item.initials}</span>
          <span><strong>{item.name}</strong><small>{item.preview}</small></span>
        </button>)}
        {!conversations.length && <div className="message-no-results">No conversations found.</div>}
      </div>
    </aside>
    <section className="message-thread">
      <header>
        <button className="message-back" onClick={() => { setMobileThreadOpen(false); select(null); }} aria-label="Back to conversations"><ArrowLeft/></button>
        <span className="message-avatar" style={{ background: selected.accent }}>{selected.initials}</span>
        <strong>{selected.name}</strong>
        <small>source-grounded reconstruction</small>
      </header>
      <div className="message-thread-scroll" ref={threadRef}>
        <div className="message-identity"><strong>{selected.name}</strong><p>{selected.identity}</p><span>An imaginary conversation assembled from things this person has actually written or said. Tap the sources when a thread gets interesting.</span></div>
        {selected.exchanges.map((exchange, index) => <article className="message-exchange" key={exchange.question}>
          <div className="message-bubble message-bubble--joe"><span>You</span><MessageBody body={exchange.question}/></div>
          <div className="message-bubble message-bubble--person"><span>{selected.name}</span><MessageBody body={exchange.answer}/>
            {!!exchange.sources.length && <div className="message-sources">{exchange.sources.map((source) => <a key={`${source.url}-${source.label}`} href={source.url} target={source.url.startsWith("/") ? undefined : "_blank"} rel={source.url.startsWith("/") ? undefined : "noreferrer"}><small>{source.kind}</small>{source.label}<ExternalLink/></a>)}</div>}
          </div>
          {index < selected.exchanges.length - 1 && <div className="message-time">•••</div>}
        </article>)}
        <div className="message-thread-end">That’s enough pretending the bookshelf has iMessage for now.<small>Answers remain source-grounded reconstructions, never live impersonation.</small></div>
      </div>
    </section>
  </div>;
}
