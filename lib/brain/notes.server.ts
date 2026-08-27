import "server-only";

import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { BrainCurrentState, BrainNote, BrainNotesIndex } from "./notes-types";
import { getBooksIndex } from "./books.server";

type Row = Record<string, any>;

function supabase() {
  const url = process.env.BRAIN_SUPABASE_URL;
  const anonKey = process.env.BRAIN_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Staging Brain environment variables are required.");
  return createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

function note(row: Row): BrainNote {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt || "",
    bodyMarkdown: row.body_markdown,
    folderSlug: row.folder_slug,
    folderLabel: row.folder_label,
    tags: row.tags || [],
    pinned: Boolean(row.pinned),
    publicationState: "published",
    sourcePublishedAt: row.source_published_at,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
    editorialNotice: row.editorial_notice,
    externalLinks: row.external_links || [],
  };
}

export async function getNotesIndex(): Promise<BrainNotesIndex> {
  if (process.env.BRAIN_DATA_SOURCE !== "supabase") {
    return JSON.parse(await readFile(path.join(process.cwd(), "data/brain/notes/index.v1.json"), "utf8"));
  }
  const [{ data: noteRows, error: notesError }, { data: folderRows, error: foldersError }] = await Promise.all([
    supabase().from("brain_public_notes").select("*").order("pinned", { ascending: false }).order("updated_at", { ascending: false }),
    supabase().from("brain_public_note_folders").select("*").order("sort_order"),
  ]);
  if (notesError) throw new Error(`Supabase brain_public_notes: ${notesError.message}`);
  if (foldersError) throw new Error(`Supabase brain_public_note_folders: ${foldersError.message}`);
  return {
    schemaVersion: "brain-notes.supabase.v1",
    generatedFrom: "staging Supabase public views",
    folders: (folderRows || []).map((row) => ({ id: row.id, slug: row.slug, label: row.label, sortOrder: row.sort_order })),
    notes: (noteRows || []).map(note),
  };
}

export async function getCurrentState(): Promise<BrainCurrentState> {
  if (process.env.BRAIN_DATA_SOURCE !== "supabase") {
    return JSON.parse(await readFile(path.join(process.cwd(), "data/brain/current-state.v1.json"), "utf8"));
  }
  const db = supabase();
  const { data, error } = await db.from("brain_public_current_state").select("*").limit(1).maybeSingle();
  if (error) throw new Error(`Supabase brain_public_current_state: ${error.message}`);
  if (!data) throw new Error("No public current-state snapshot is available.");
  const { data: reading, error: readingError } = await db.from("brain_public_current_state_reading").select("*").eq("snapshot_id", data.id).maybeSingle();
  if (readingError) throw new Error(`Supabase brain_public_current_state_reading: ${readingError.message}`);
  const linkedBook = reading ? (await getBooksIndex()).books.find((book) => book.id === reading.book_id) : null;
  return {
    schemaVersion: "brain-current-state.supabase.v1",
    ...data.state,
    readingBook: reading ? {
      id: reading.book_id,
      slug: reading.slug,
      title: linkedBook?.title || reading.title,
      authors: linkedBook?.authors || (reading.original_author ? [reading.original_author] : []),
      cover: linkedBook?.cover.public_path || (reading.cover_path ? (reading.cover_path.startsWith("/") ? reading.cover_path : `/${reading.cover_path}`) : null),
    } : null,
  } as BrainCurrentState;
}
