"use client";

import { Check, ImageUp, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { prepareBookCover } from "@/lib/control/book-cover.client";
import { uploadSigned } from "@/lib/control/photo-intake.client";

type Book = { id: string; slug: string; title: string; authors: string[]; cover: string };

export default function BookCoverOverride({ book, reload, notify }: { book: Book; reload: () => Promise<void>; notify: (value: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File | null) {
    if (!file) return;
    setBusy(true); setDone(false);
    let preview: string | null = null;
    try {
      const cover = await prepareBookCover(file); preview = cover.preview;
      const prepareResponse = await fetch("/api/control/book-cover", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "prepare", bookId: book.id, size: cover.byteSize }) });
      const prepared = await prepareResponse.json();
      if (!prepareResponse.ok) throw new Error(prepared.error || "The cover could not be prepared.");
      await uploadSigned(prepared.signedUrl, cover.blob);
      const finalizeResponse = await fetch("/api/control/book-cover", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "finalize", bookId: book.id, assetId: prepared.assetId, width: cover.width, height: cover.height, byteSize: cover.byteSize, sha256: cover.sha256 }) });
      const finalized = await finalizeResponse.json();
      if (!finalizeResponse.ok) throw new Error(finalized.error || "The cover could not be applied.");
      setDone(true); notify(`${book.title} cover updated everywhere`); await reload();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "The cover could not be updated.");
    } finally {
      if (preview) URL.revokeObjectURL(preview);
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return <label className={`replace-book-cover ${busy ? "is-busy" : ""}`} title={`Replace the canonical cover for ${book.title}`}>
    {busy ? <Loader2 className="spin"/> : done ? <Check/> : <ImageUp/>}{busy ? "Uploading…" : done ? "Cover replaced" : "Replace cover"}
    <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" disabled={busy} onChange={(event) => upload(event.target.files?.[0] || null)}/>
  </label>;
}
