"use client";

import { Check, ImageUp, Loader2, Search } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { prepareBookCover } from "@/lib/control/book-cover.client";
import { uploadSigned } from "@/lib/control/photo-intake.client";

type Book = { id: string; slug: string; title: string; authors: string[]; cover: string };

export default function BookCoverOverride({ books, reload, notify }: { books: Book[]; reload: () => Promise<void>; notify: (value: string) => void }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = books.find((book) => book.id === selectedId) || null;
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return books.slice(0, 6);
    return books.filter((book) => `${book.title} ${book.authors.join(" ")}`.toLowerCase().includes(needle)).slice(0, 8);
  }, [books, query]);

  async function upload(file: File | null) {
    if (!file || !selected) return;
    setBusy(true); setDone(false);
    try {
      const cover = await prepareBookCover(file);
      const prepareResponse = await fetch("/api/control/book-cover", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "prepare", bookId: selected.id, size: cover.byteSize }) });
      const prepared = await prepareResponse.json();
      if (!prepareResponse.ok) throw new Error(prepared.error || "The cover could not be prepared.");
      await uploadSigned(prepared.signedUrl, cover.blob);
      const finalizeResponse = await fetch("/api/control/book-cover", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "finalize", bookId: selected.id, assetId: prepared.assetId, width: cover.width, height: cover.height, byteSize: cover.byteSize, sha256: cover.sha256 }) });
      const finalized = await finalizeResponse.json();
      if (!finalizeResponse.ok) throw new Error(finalized.error || "The cover could not be applied.");
      URL.revokeObjectURL(cover.preview);
      setDone(true); notify(`${selected.title} cover updated everywhere`); await reload();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "The cover could not be updated.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return <section className="book-cover-override">
    <header><div><strong>Manual Book Cover</strong><small>One canonical cover used everywhere this Book appears.</small></div>{done && <span><Check/> Updated</span>}</header>
    {!selected ? <><label className="cover-book-search"><Search/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a Library book…"/></label><div className="cover-book-results">{matches.map((book) => <button type="button" key={book.id} onClick={() => { setSelectedId(book.id); setQuery(book.title); setDone(false); }}><img src={book.cover} alt=""/><span><strong>{book.title}</strong><small>{book.authors.join(", ") || "Author not recorded"}</small></span></button>)}</div></> : <div className="cover-book-selected"><img src={selected.cover} alt={`Current cover of ${selected.title}`}/><div><small>CANONICAL BOOK</small><strong>{selected.title}</strong><span>{selected.authors.join(", ")}</span></div><button type="button" onClick={() => { setSelectedId(""); setDone(false); }}>Change book</button><label className={busy ? "is-busy" : ""}>{busy ? <Loader2 className="spin"/> : <ImageUp/>}{busy ? "Applying…" : "Upload replacement"}<input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" disabled={busy} onChange={(event) => upload(event.target.files?.[0] || null)}/></label></div>}
    <p>Use an image you own or have permission to display. JPEG, PNG, and WebP are the most reliable choices; the browser stores an optimized WebP copy.</p>
  </section>;
}
