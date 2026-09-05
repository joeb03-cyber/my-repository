"use client";

import * as exifr from "exifr";

export type PreparedPhoto = {
  file: File;
  preview: string;
  width: number;
  height: number;
  capture: { date: string; instant: string | null; timezone: string | null; source: string; make?: string; model?: string; lens?: string; orientation?: number; latitude?: number; longitude?: number; altitude?: number };
  derivatives: Array<{ variant: "small" | "medium" | "large"; blob: Blob; width: number; height: number; byteSize: number; sha256: string }>;
  originalSha256: string;
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

async function derivative(source: CanvasImageSource, width: number, height: number, max: number, variant: PreparedPhoto["derivatives"][number]["variant"]) {
  const scale = Math.min(1, max / Math.max(width, height));
  const outputWidth = Math.max(1, Math.round(width * scale));
  const outputHeight = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = outputWidth; canvas.height = outputHeight;
  canvas.getContext("2d", { alpha: false })?.drawImage(source, 0, 0, outputWidth, outputHeight);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("This browser could not create a WebP copy.")), "image/webp", .86));
  return { variant, blob, width: outputWidth, height: outputHeight, byteSize: blob.size, sha256: await sha256(blob) };
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
  const derivatives = await Promise.all([
    derivative(loaded.source, loaded.width, loaded.height, 480, "small"),
    derivative(loaded.source, loaded.width, loaded.height, 1024, "medium"),
    derivative(loaded.source, loaded.width, loaded.height, 1800, "large"),
  ]);
  loaded.release();
  return {
    file, preview: URL.createObjectURL(derivatives[0].blob), width: loaded.width, height: loaded.height,
    originalSha256: await sha256(file), derivatives,
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

export async function uploadSigned(signedUrl: string, blob: Blob) {
  const body = new FormData(); body.append("cacheControl", "31536000"); body.append("", blob);
  const response = await fetch(signedUrl, { method: "PUT", headers: { "x-upsert": "false" }, body });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.message || "Upload failed.");
}
