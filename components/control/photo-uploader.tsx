"use client";

import { Check, ImagePlus, Loader2, Star, X } from "lucide-react";
import { useState } from "react";
import { preparePhoto, uploadSigned, type PreparedPhoto } from "@/lib/control/photo-intake.client";

type Visit = { id: string; label: string };
type QueueItem = PreparedPhoto & { id: string; visitId: string; isPublic: boolean; isWallpaper: boolean; state: "ready" | "uploading" | "done" | "error"; error?: string };

export default function PhotoUploader({ visits, reload, notify }: { visits: Visit[]; reload: () => Promise<void>; notify: (value: string) => void }) {
  const [queue, setQueue] = useState<QueueItem[]>([]); const [preparing, setPreparing] = useState(false);
  function suggest(date: string) { const month = date.slice(0, 7); const matches = visits.filter((visit) => visit.label.includes(month)); return matches.length === 1 ? matches[0].id : ""; }
  async function choose(files: FileList | null) {
    if (!files?.length) return; setPreparing(true);
    for (const file of Array.from(files)) {
      const id = crypto.randomUUID();
      try { const photo = await preparePhoto(file); setQueue((items) => [...items, { ...photo, id, visitId: suggest(photo.capture.date), isPublic: true, isWallpaper: false, state: "ready" }]); }
      catch (error) { window.alert(`${file.name}: ${error instanceof Error ? error.message : "Could not prepare this photo."}`); }
    }
    setPreparing(false);
  }
  const change = (id: string, value: Partial<QueueItem>) => setQueue((items) => items.map((item) => item.id === id ? { ...item, ...value } : item));
  async function upload(item: QueueItem) {
    change(item.id, { state: "uploading", error: undefined });
    try {
      const response = await fetch("/api/control/photo-upload/prepare", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: item.file.name, size: item.file.size, type: item.file.type || "application/octet-stream" }) });
      const prepared = await response.json(); if (!response.ok) throw new Error(prepared.error);
      await uploadSigned(prepared.original.signedUrl, item.file);
      for (const derivative of item.derivatives) { const target = prepared.derivatives.find((value: any) => value.variant === derivative.variant); await uploadSigned(target.signedUrl, derivative.blob); }
      const extension = (item.file.name.split(".").pop() || "jpg").toLowerCase();
      const finalized = await fetch("/api/control/photo-upload/finalize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assetId: prepared.assetId, originalName: item.file.name, originalType: item.file.type || "application/octet-stream", originalSize: item.file.size, originalExtension: extension, originalSha256: item.originalSha256, width: item.width, height: item.height, capture: item.capture, visitId: item.visitId || null, isPublic: item.isPublic, isWallpaper: item.isWallpaper, derivatives: item.derivatives.map(({ variant, width, height, byteSize, sha256 }) => ({ variant, width, height, byteSize, sha256 })) }) });
      const value = await finalized.json(); if (!finalized.ok) throw new Error(value.error);
      change(item.id, { state: "done" }); notify("Photo added"); await reload();
    } catch (error) { change(item.id, { state: "error", error: error instanceof Error ? error.message : "Upload failed." }); }
  }
  return <section className="photo-uploader">
    <header><div><strong>Add Photos</strong><small>Choose several from your phone or computer.</small></div><label className="photo-picker"><ImagePlus/>{preparing ? "Preparing…" : "Choose photos"}<input type="file" multiple accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" disabled={preparing} onChange={(event) => choose(event.target.files)}/></label></header>
    <p className="photo-privacy">Originals stay in private storage for recovery and future portability. Only optimized WebP copies can appear publicly. Exact GPS and embedded metadata are never exposed through the public photo view. Live Photo motion is not uploaded in v1.</p>
    {queue.map((item) => <article className={`photo-upload-item is-${item.state}`} key={item.id}>
      <img src={item.preview} alt=""/><div className="photo-upload-fields"><strong>{item.file.name}</strong><label>Capture date<input type="date" value={item.capture.date} onChange={(event) => change(item.id, { capture: { ...item.capture, date: event.target.value, instant: event.target.value ? `${event.target.value}T12:00:00.000Z` : null, source: "manual" }, visitId: suggest(event.target.value) })}/></label><label>Journey visit<select value={item.visitId} onChange={(event) => change(item.id, { visitId: event.target.value })}><option value="">Unassigned / choose later</option>{visits.map((visit) => <option value={visit.id} key={visit.id}>{visit.label}</option>)}</select></label><div className="photo-upload-switches"><label><input type="checkbox" checked={item.isPublic} onChange={(event) => change(item.id, { isPublic: event.target.checked })}/> Public</label><label><input type="checkbox" checked={item.isWallpaper} onChange={(event) => change(item.id, { isWallpaper: event.target.checked })}/><Star/> Wallpaper</label></div>{item.error && <small className="upload-error">{item.error}</small>}</div>
      <div className="photo-upload-actions">{item.state === "done" ? <span><Check/> Added</span> : <button className="primary" disabled={item.state === "uploading" || !item.capture.date} onClick={() => upload(item)}>{item.state === "uploading" ? <><Loader2 className="spin"/> Uploading…</> : "Add photo"}</button>}<button aria-label="Remove" disabled={item.state === "uploading"} onClick={() => { URL.revokeObjectURL(item.preview); setQueue((items) => items.filter((value) => value.id !== item.id)); }}><X/></button></div>
    </article>)}
  </section>;
}
