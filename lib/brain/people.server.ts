import "server-only";

import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { BrainContact, BrainPeopleSourcesIndex, BrainPodcastEpisode } from "./people-types";

type Row = Record<string, any>;

function supabase() {
  const url = process.env.BRAIN_SUPABASE_URL;
  const anonKey = process.env.BRAIN_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Staging Brain environment variables are required.");
  return createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function publicRows(view: string): Promise<Row[]> {
  const { data, error } = await supabase().from(view).select("*");
  if (error) throw new Error(`Supabase ${view}: ${error.message}`);
  return data || [];
}

function contact(row: Row): BrainContact {
  return {
    id: row.id,
    slug: row.slug,
    displayName: row.display_name,
    sortName: row.sort_name,
    initials: row.initials,
    factualIdentity: row.factual_identity,
    curatedInterest: true,
    endorsement: false,
    topics: row.topics || [],
    books: row.books || [],
    podcastAppearances: row.podcast_appearances || [],
  };
}

function episode(row: Row): BrainPodcastEpisode {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    showTitle: row.show_title,
    publicationDate: row.publication_date,
    durationSeconds: row.duration_seconds,
    originalUrl: row.original_url,
    publicProvenanceLabel: row.public_provenance_label,
    credits: row.credits || [],
  };
}

export async function getPeopleSourcesIndex(): Promise<BrainPeopleSourcesIndex> {
  if (process.env.BRAIN_DATA_SOURCE !== "supabase") {
    return JSON.parse(await readFile(path.join(process.cwd(), "data/brain/people-sources/index.v1.json"), "utf8"));
  }
  const [contactRows, episodeRows] = await Promise.all([
    publicRows("brain_public_contacts"),
    publicRows("brain_public_podcast_episodes"),
  ]);
  const contacts = contactRows.map(contact).sort((a, b) => a.displayName.localeCompare(b.displayName));
  const podcastEpisodes = episodeRows.map(episode).sort((a, b) => (b.publicationDate || "").localeCompare(a.publicationDate || ""));
  return {
    schemaVersion: "brain-people-sources.supabase.v1",
    generatedFrom: "staging Supabase public views",
    contactCount: contacts.length,
    podcastEpisodeCount: podcastEpisodes.length,
    contacts,
    podcastEpisodes,
  };
}
