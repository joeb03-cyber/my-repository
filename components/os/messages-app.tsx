"use client";

import { ArrowLeft, ExternalLink, Search, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { groundedConversations } from "@/data/messages";

export default function MessagesApp() {
  const [selectedSlug, setSelectedSlug] = useState(groundedConversations[0].slug);
  const [query, setQuery] = useState("");
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
  const conversations = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return groundedConversations;
    return groundedConversations.filter((item) => `${item.name} ${item.identity} ${item.preview}`.toLowerCase().includes(needle));
  }, [query]);
  const selected = groundedConversations.find((item) => item.slug === selectedSlug) || groundedConversations[0];
  const choose = (slug: string) => { setSelectedSlug(slug); setMobileThreadOpen(true); };

  return <div className={`messages-app system-app ${mobileThreadOpen ? "is-thread-open" : ""}`}>
    <aside className="messages-list">
      <div className="os-toolbar"><strong>Messages</strong><span>{groundedConversations.length} conversations</span></div>
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
        <button className="message-back" onClick={() => setMobileThreadOpen(false)} aria-label="Back to conversations"><ArrowLeft/></button>
        <span className="message-avatar" style={{ background: selected.accent }}>{selected.initials}</span>
        <strong>{selected.name}</strong>
        <small>source-grounded reconstruction</small>
      </header>
      <div className="message-thread-scroll">
        <div className="message-identity"><strong>{selected.name}</strong><p>{selected.identity}</p><span>An imaginary conversation assembled from things this person has actually written or said. Tap the sources when a thread gets interesting.</span></div>
        {selected.exchanges.map((exchange, index) => <article className="message-exchange" key={exchange.question}>
          <div className="message-bubble message-bubble--joe"><span>You</span><p>{exchange.question}</p></div>
          <div className="message-bubble message-bubble--person"><span>{selected.name}</span><p>{exchange.answer}</p>
            <div className="message-sources">{exchange.sources.map((source) => <a key={`${source.url}-${source.label}`} href={source.url} target={source.url.startsWith("/") ? undefined : "_blank"} rel={source.url.startsWith("/") ? undefined : "noreferrer"}><small>{source.kind}</small>{source.label}<ExternalLink/></a>)}</div>
          </div>
          {index < selected.exchanges.length - 1 && <div className="message-time">•••</div>}
        </article>)}
        <div className="message-thread-end">That’s enough pretending the bookshelf has iMessage for now.<small>Answers remain source-grounded reconstructions, never live impersonation.</small></div>
      </div>
    </section>
  </div>;
}
