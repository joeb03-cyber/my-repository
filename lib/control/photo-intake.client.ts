"use client";

import * as exifr from "exifr";

export type PreparedPhoto = {
  file: File;
  preview: string;
  width: number;
  height: number;
  capture: { date: string; instant: string | null; timezone: string | null; source: string; make?: string; model?: string; lens?: string; orientation?: number; latitude?: number; longitude?: number; altitude?: number };
  derivatives: Array<{ variant: "small" | "medium" | "large"; blob: Blob; width: number; height: number; byteSize: number; sha256: string; mimeType: "image/webp" | "image/jpeg"; extension: "webp" | "jpg" }>;
  sourceByteSize: number;
};

const pad = (value: number) => String(value).padStart(2, "0");
const localDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const sha256 = async (value: Blob) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await value.arrayBuffer()))).map((byte) => byte.toString(16).padStart(2, "0")).join("");

async function loadImage(file: File) {
  if ("createImageBitmap" in window) {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bitmap as CanvasImageSource, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
    } catch { /* Safari's regular image decoder may still understand the file. */ }
  }
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.src = url;
  await image.decode();
  return { source: image as CanvasImageSource, width: image.naturalWidth, height: image.naturalHeight, release: () => URL.revokeObjectURL(url) };
}

async function derivative(source: CanvasImageSource, width: number, height: number, max: number, variant: PreparedPhoto["derivatives"][number]["variant"], targetBytes: number) {
  const scale = Math.min(1, max / Math.max(width, height));
  const outputWidth = Math.max(1, Math.round(width * scale));
  const outputHeight = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = outputWidth; canvas.height = outputHeight;
  canvas.getContext("2d", { alpha: false })?.drawImage(source, 0, 0, outputWidth, outputHeight);
  let quality = variant === "large" ? .82 : variant === "medium" ? .78 : .74;
  let blob: Blob | null = null;
  let mimeType: "image/webp" | "image/jpeg" = "image/webp";
  do {
    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mimeType, quality));
    if ((!blob || blob.type !== mimeType) && mimeType === "image/webp") {
      // Some otherwise-current iPhone Safari versions can decode HEIC/JPEG but
      // cannot encode WebP from canvas. JPEG keeps the upload lightweight and
      // avoids sending the full camera original merely to publish a photograph.
      mimeType = "image/jpeg";
      quality = variant === "large" ? .84 : variant === "medium" ? .8 : .76;
      blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mimeType, quality));
    }
    if (!blob || blob.type !== mimeType) throw new Error("This browser could not create an optimized publishing copy. Update Safari or export the image as JPEG first.");
    quality -= .08;
  } while (blob.size > targetBytes && quality >= .42);
  return { variant, blob, width: outputWidth, height: outputHeight, byteSize: blob.size, sha256: await sha256(blob), mimeType, extension: mimeType === "image/webp" ? "webp" as const : "jpg" as const };
}

export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  const accepted = /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name) || ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"].includes(file.type);
  if (!accepted) throw new Error("Choose a JPEG, PNG, WebP, HEIC, or HEIF still image. Live Photo video is intentionally not uploaded in v1.");
  let metadata: any = {};
  try { metadata = await exifr.parse(file, ["DateTimeOriginal", "CreateDate", "Make", "Model", "LensModel", "Orientation", "latitude", "longitude", "GPSAltitude"]) || {}; } catch { /* Every field remains manually correctable. */ }
  let captured = metadata.DateTimeOriginal instanceof Date ? metadata.DateTimeOriginal : metadata.CreateDate instanceof Date ? metadata.CreateDate : new Date(file.lastModified);
  if (Number.isNaN(captured.getTime())) captured = new Date();
  const captureSource = metadata.DateTimeOriginal || metadata.CreateDate ? "embedded_metadata" : "file_date_fallback";
  let loaded;
  try { loaded = await loadImage(file); } catch { throw new Error("This browser cannot decode that photo. On iPhone, choose the image from Photos or export it as JPEG first."); }
  // Keep peak memory predictable on phones: one canvas encode at a time.
  const derivatives = [] as PreparedPhoto["derivatives"];
  try {
    derivatives.push(await derivative(loaded.source, loaded.width, loaded.height, 480, "small", 140 * 1024));
    derivatives.push(await derivative(loaded.source, loaded.width, loaded.height, 1024, "medium", 500 * 1024));
    derivatives.push(await derivative(loaded.source, loaded.width, loaded.height, 1800, "large", 1500 * 1024));
  } finally { loaded.release(); }
  return {
    file, preview: URL.createObjectURL(derivatives[0].blob), width: loaded.width, height: loaded.height,
    sourceByteSize: file.size, derivatives,
    capture: {
      date: localDate(captured), instant: captured.toISOString(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
      source: captureSource, make: metadata.Make, model: metadata.Model, lens: metadata.LensModel,
      orientation: Number(metadata.Orientation || 0) || undefined,
      latitude: Number.isFinite(metadata.latitude) ? metadata.latitude : undefined,
      longitude: Number.isFinite(metadata.longitude) ? metadata.longitude : undefined,
      altitude: Number.isFinite(metadata.GPSAltitude) ? metadata.GPSAltitude : undefined,
    },
  };
}

export async function uploadSigned(signedUrl: string, blob: Blob, onProgress?: (loaded: number, total: number) => void) {
  async function attempt() {
    const body = new FormData(); body.append("cacheControl", "31536000"); body.append("", blob);
    await new Promise<void>((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open("PUT", signedUrl);
      request.setRequestHeader("x-upsert", "false");
      request.upload.onprogress = (event) => onProgress?.(event.loaded, event.lengthComputable ? event.total : blob.size);
      request.onerror = () => reject(new Error("Upload failed. Check the connection and retry this photo."));
      request.onload = () => {
        if ((request.status >= 200 && request.status < 300) || request.status === 409) { onProgress?.(blob.size, blob.size); resolve(); }
        else {
          let message = "Upload failed.";
          try { message = JSON.parse(request.responseText)?.message || message; } catch { /* Keep the useful fallback. */ }
          reject(new Error(message));
        }
      };
      request.send(body);
    });
  }
  try { await attempt(); }
  catch { await attempt(); }
}
