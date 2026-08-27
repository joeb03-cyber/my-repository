import "server-only";

import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { HumanIndex } from "./human-types";

async function localHuman(): Promise<HumanIndex> {
  return JSON.parse(await readFile(path.join(process.cwd(), "data/brain/human.v1.json"), "utf8"));
}

export async function getHumanIndex(): Promise<HumanIndex> {
  const local = await localHuman();
  if (process.env.BRAIN_DATA_SOURCE !== "supabase") return local;
  const url = process.env.BRAIN_SUPABASE_URL;
  const key = process.env.BRAIN_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Staging Brain environment is required.");
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const [{ data: rows, error }, { data: links, error: linkError }] = await Promise.all([
    client.from("brain_public_human_entries").select("*"),
    client.from("brain_public_human_relationships").select("*"),
  ]);
  if (error || linkError) throw new Error(error?.message || linkError?.message);
  return {
    ...local,
    schemaVersion: "brain-human.supabase.v1",
    entries: (rows || []).map((row: any) => ({
      id: row.id, slug: row.slug, section: row.section, relationshipState: row.relationship_state,
      entryType: row.entry_type, title: row.title, summary: row.summary, currentTake: row.current_take,
      supportingDetails: row.supporting_details || [], sortOrder: row.sort_order,
      relationships: (links || []).filter((link: any) => link.human_entry_id === row.id).map((link: any) => ({
        entityId: link.entity_id, entitySlug: link.entity_slug, entityTitle: link.entity_title,
        entityKind: link.entity_kind, label: link.relationship_label,
      })),
    })),
  };
}
