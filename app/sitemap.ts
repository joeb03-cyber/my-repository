import type { MetadataRoute } from "next";
import { getNotesIndex } from "@/lib/brain/notes.server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (process.env.SITE_ENV === "staging") return [];
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://synergetichuman.com";
  const notes = await getNotesIndex();
  const routes = ["", "/library", "/journal", "/atlas", "/photos", "/browser", "/laboratory", "/contacts", "/messages"];
  return [...routes.map((route) => ({ url: `${base}${route}`, lastModified: new Date() })), ...notes.notes.map((note) => ({ url: `${base}/notes/${note.slug}`, lastModified: new Date(note.updatedAt) }))];
}
