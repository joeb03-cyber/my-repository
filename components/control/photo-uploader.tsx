"use client";

import { Check, ImagePlus, Loader2, Star, X } from "lucide-react";
import { useState } from "react";
import { preparePhoto, uploadSigned, type PreparedPhoto } from "@/lib/control/photo-intake.client";

type Visit = { id: string; label: string };
type QueueItem = PreparedPhoto & { id: string; visitId: string; isPublic: boolean; isWallpaper: boolean; state: "ready" | "uploading" | "done" | "error"; progress: number; error?: string };

const megabytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(bytes < 1024 * 1024 ? 2 : 1)} MB`;

export default function PhotoUploader({ visits, reload, notify }: { visits: Visit[]; reload: () => Promise<void>; notify: (value: string) => void }) {
  const [queue, setQueue] = useState<QueueItem[]>([]); const [preparing, setPreparing] = useState(false); const [batchUploading, setBatchUploading] = useState(false);
  function suggest(date: string) { const month = date.slice(0, 7); const matches = visits.filter((visit) => visit.label.includes(month)); return matches.length === 1 ? matches[0].id : ""; }
  async function choose(files: FileList | null) {
    if (!files?.length) return; setPreparing(true);
    const selected = Array.from(files); const results = new Array<QueueItem | null>(selected.length).fill(null); const errors: string[] = []; let cursor = 0;
    async function worker() {
      while (cursor < selected.length) {
        const index = cursor++; const file = selected[index];
        try { const photo = await preparePhoto(file); results[index] = { ...photo, id: crypto.randomUUID(), visitId: suggest(photo.capture.date), isPublic: true, isWallpaper: false, state: "ready", progress: 0 }; }
        catch (error) { errors.push(`${file.name}: ${error instanceof Error ? error.message : "Could not prepare this photo."}`); }
      }
    }
    await Promise.all(Array.from({ length: Math.min(2, selected.length) }, worker));
    setQueue((items) => [...items, ...results.filter(Boolean) as QueueItem[]]);
    if (errors.length) window.alert(errors.join("\n"));
    setPreparing(false);
  }
  const change = (id: string, value: Partial<QueueItem>) => setQueue((items) => items.map((item) => item.id === id ? { ...item, ...value } : item));
  async function upload(item: QueueItem) {
    change(item.id, { state: "uploading", progress: 0, error: undefined });
    try {
      const response = await fetch("/api/control/photo-upload/prepare", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: item.file.name, size: item.file.size, type: item.file.type || "application/octet-stream" }) });
      const prepared = await response.json(); if (!response.ok) throw new Error(prepared.error);
      const totalBytes = item.derivatives.reduce((sum, derivative) => sum + derivative.byteSize, 0); const loadedByVariant = new Map<string, number>();
      await Promise.all(item.derivatives.map(async (derivative) => {
        const target = prepared.derivatives.find((value: any) => value.variant === derivative.variant);
        await uploadSigned(target.signedUrl, derivative.blob, (loaded) => {
          loadedByVariant.set(derivative.variant, loaded);
          const uploaded = Array.from(loadedByVariant.values()).reduce((sum, value) => sum + value, 0);
          change(item.id, { progress: Math.min(99, Math.round(uploaded / totalBytes * 100)) });
        });
      }));
      const finalized = await fetch("/api/control/photo-upload/finalize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ uploadMode: "optimized_publish_v2", assetId: prepared.assetId, originalName: item.file.name, originalType: item.file.type || "application/octet-stream", originalSize: item.file.size, originalLastModified: item.file.lastModified, width: item.width, height: item.height, capture: item.capture, visitId: item.visitId || null, isPublic: item.isPublic, isWallpaper: item.isWallpaper, derivatives: item.derivatives.map(({ variant, width, height, byteSize, sha256 }) => ({ variant, width, height, byteSize, sha256 })) }) });
      const value = await finalized.json(); if (!finalized.ok) throw new Error(value.error);
      change(item.id, { state: "done", progress: 100 }); notify("Photo added"); await reload();
    } catch (error) { change(item.id, { state: "error", error: error instanceof Error ? error.message : "Upload failed." }); }
  }
  async function uploadReady() {
    const ready = queue.filter((item) => item.state === "ready" || item.state === "error"); if (!ready.length) return;
    setBatchUploading(true); let cursor = 0;
    async function worker() { while (cursor < ready.length) await upload(ready[cursor++]); }
    await Promise.all(Array.from({ length: Math.min(2, ready.length) }, worker)); setBatchUploading(false);
  }
  const readyCount = queue.filter((item) => item.state === "ready" || item.state === "error").length;
  return <section className="photo-uploader">
    <header><div><strong>Add Photos</strong><small>Choose several from your phone or computer.</small></div><div className="photo-upload-header-actions"><label className="photo-picker"><ImagePlus/>{preparing ? "Preparing…" : "Choose photos"}<input type="file" multiple accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" disabled={preparing || batchUploading} onChange={(event) => choose(event.target.files)}/></label>{readyCount > 1 && <button className="primary" disabled={batchUploading} onClick={uploadReady}>{batchUploading ? <><Loader2 className="spin"/> Uploading…</> : `Add ${readyCount} photos`}</button>}</div></header>
    <p className="photo-privacy">Your phone prepares lightweight website copies before uploading; the full camera original stays in your personal photo library. Exact GPS and embedded metadata remain private. Live Photo motion is not uploaded in v1.</p>
    {queue.map((item) => <article className={`photo-upload-item is-${item.state}`} key={item.id}>
      <img src={item.preview} alt=""/><div className="photo-upload-fields"><strong>{item.file.name}</strong><small className="photo-payload">Uploads {megabytes(item.derivatives.reduce((sum, derivative) => sum + derivative.byteSize, 0))} instead of the {megabytes(item.sourceByteSize)} original</small><label>Capture date<input type="date" value={item.capture.date} onChange={(event) => change(item.id, { capture: { ...item.capture, date: event.target.value, instant: event.target.value ? `${event.target.value}T12:00:00.000Z` : null, source: "manual" }, visitId: suggest(event.target.value) })}/></label><label>Journey visit<select value={item.visitId} onChange={(event) => change(item.id, { visitId: event.target.value })}><option value="">Unassigned / choose later</option>{visits.map((visit) => <option value={visit.id} key={visit.id}>{visit.label}</option>)}</select></label><div className="photo-upload-switches"><label><input type="checkbox" checked={item.isPublic} onChange={(event) => change(item.id, { isPublic: event.target.checked })}/> Public</label><label><input type="checkbox" checked={item.isWallpaper} onChange={(event) => change(item.id, { isWallpaper: event.target.checked })}/><Star/> Wallpaper</label></div>{item.state === "uploading" && <div className="photo-progress"><i style={{ width: `${item.progress}%` }}/><span>{item.progress}%</span></div>}{item.error && <small className="upload-error">{item.error}</small>}</div>
      <div className="photo-upload-actions">{item.state === "done" ? <span><Check/> Added</span> : <button className="primary" disabled={item.state === "uploading" || !item.capture.date || batchUploading} onClick={() => upload(item)}>{item.state === "uploading" ? <><Loader2 className="spin"/> {item.progress}%</> : item.state === "error" ? "Retry" : "Add photo"}</button>}<button aria-label="Remove" disabled={item.state === "uploading"} onClick={() => { URL.revokeObjectURL(item.preview); setQueue((items) => items.filter((value) => value.id !== item.id)); }}><X/></button></div>
    </article>)}
  </section>;
}
