import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { BrainBookDetail, BrainBooksIndex } from "./types";
import { getSupabaseBookDetail, getSupabaseBooksIndex } from "./books-supabase.server";
import { hiddenPublicBookSlugs, refineBooksIndex } from "./books-editorial";

const brainRoot = path.join(process.cwd(), "data", "brain");

export async function getBooksIndex(): Promise<BrainBooksIndex> {
  if (process.env.BRAIN_DATA_SOURCE === "supabase") return refineBooksIndex(await getSupabaseBooksIndex());
  return refineBooksIndex(JSON.parse(await readFile(path.join(brainRoot, "books-index.v1.json"), "utf8")));
}

export async function getBookDetail(slug: string): Promise<BrainBookDetail | null> {
  if (!/^[a-z0-9-]+$/.test(slug) || hiddenPublicBookSlugs.has(slug)) return null;
  if (process.env.BRAIN_DATA_SOURCE === "supabase") return getSupabaseBookDetail(slug);
  try {
    const detail = JSON.parse(await readFile(path.join(brainRoot, "books", `${slug}.v1.json`), "utf8"));
    const summary = (await getBooksIndex()).books.find((book) => book.slug === slug);
    return summary ? { ...detail, ...summary } : null;
  } catch {
    return null;
  }
}
