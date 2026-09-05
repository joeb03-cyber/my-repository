"use client";

export type PreparedBookCover = {
  blob: Blob;
  preview: string;
  width: number;
  height: number;
  byteSize: number;
  sha256: string;
};

async function digest(blob: Blob) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer())))
    .map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function prepareBookCover(file: File): Promise<PreparedBookCover> {
  if (!file.type.startsWith("image/") && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) {
    throw new Error("Choose an image file.");
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    canvas.getContext("2d", { alpha: false })?.drawImage(image, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
      (value) => value ? resolve(value) : reject(new Error("This browser could not prepare the cover.")),
      "image/webp", .9,
    ));
    return { blob, preview: URL.createObjectURL(blob), width, height, byteSize: blob.size, sha256: await digest(blob) };
  } catch {
    throw new Error("This browser could not decode that cover. Try a JPEG, PNG, or WebP copy.");
  } finally {
    URL.revokeObjectURL(url);
  }
}
