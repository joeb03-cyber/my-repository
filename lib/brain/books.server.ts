import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { BrainBookDetail, BrainBooksIndex } from "./types";
import { getSupabaseBookDetail, getSupabaseBooksIndex } from "./books-supabase.server";

const brainRoot = path.join(process.cwd(), "data", "brain");

export async function getBooksIndex(): Promise<BrainBooksIndex> {
  if (process.env.BRAIN_DATA_SOURCE === "supabase") return getSupabaseBooksIndex();
  return JSON.parse(await readFile(path.join(brainRoot, "books-index.v1.json"), "utf8"));
}

export async function getBookDetail(slug: string): Promise<BrainBookDetail | null> {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  if (process.env.BRAIN_DATA_SOURCE === "supabase") return getSupabaseBookDetail(slug);
  try {
    return JSON.parse(await readFile(path.join(brainRoot, "books", `${slug}.v1.json`), "utf8"));
  } catch {
    return null;
  }
}
