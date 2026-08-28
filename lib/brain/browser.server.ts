import "server-only";

import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { BrowserIndex, RabbitHole } from "./browser-types";

async function localBrowser(): Promise<BrowserIndex> {
  return JSON.parse(await readFile(path.join(process.cwd(), "data/brain/browser.v1.json"), "utf8"));
}

export async function getBrowserIndex(): Promise<BrowserIndex> {
  const local = await localBrowser();
  if (process.env.BRAIN_DATA_SOURCE !== "supabase") return local;
  const url = process.env.BRAIN_SUPABASE_URL;
  const key = process.env.BRAIN_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Staging Brain environment is required.");
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const [holes, blocks, resources, entities, trails, human] = await Promise.all([
    db.from("brain_public_rabbit_holes").select("*"),
    db.from("brain_public_rabbit_hole_blocks").select("*"),
    db.from("brain_public_rabbit_hole_resources").select("*"),
    db.from("brain_public_rabbit_hole_entities").select("*"),
    db.from("brain_public_rabbit_hole_links").select("*"),
    db.from("brain_public_rabbit_hole_human_links").select("*"),
  ]);
  const failure = [holes, blocks, resources, entities, trails, human].find((result) => result.error);
  if (failure?.error) throw new Error(failure.error.message);
  const rabbitHoles: RabbitHole[] = (holes.data || []).map((row: any) => ({
    id: row.id, slug: row.slug, title: row.title, centralQuestion: row.central_question,
    shortIntro: row.short_intro, currentTake: row.current_take, status: row.status,
    accent: row.accent, sortOrder: row.sort_order, publicationState: "published",
    blocks: (blocks.data || []).filter((item: any) => item.rabbit_hole_id === row.id).map((item: any) => ({
      id: item.id, type: item.block_type, heading: item.heading, body: item.body,
      items: item.items || [], sortOrder: item.sort_order,
    })),
    resources: (resources.data || []).filter((item: any) => item.rabbit_hole_id === row.id).map((item: any) => ({
      id: item.id, title: item.title, url: item.url, resourceType: item.resource_type,
      note: item.note, publicRole: item.public_role, evidenceLayer: item.evidence_layer, sortOrder: item.sort_order,
    })),
    entities: (entities.data || []).filter((item: any) => item.rabbit_hole_id === row.id).map((item: any) => ({
      entityId: item.entity_id, entitySlug: item.entity_slug, entityTitle: item.entity_title,
      entityKind: item.entity_kind, label: item.label, publicRole: item.public_role, sortOrder: item.sort_order,
    })),
    related: (trails.data || []).filter((item: any) => item.from_rabbit_hole_id === row.id).map((item: any) => ({
      slug: item.to_slug, title: item.to_title, label: item.label,
      publicationState: item.to_publication_state, sortOrder: item.sort_order,
    })),
    humanLinks: (human.data || []).filter((item: any) => item.rabbit_hole_id === row.id).map((item: any) => ({
      humanEntryId: item.human_entry_id, humanEntrySlug: item.human_entry_slug,
      humanEntryTitle: item.human_entry_title, browserLabel: item.browser_label,
      humanLabel: item.human_label, sortOrder: item.sort_order,
    })),
  }));
  return { ...local, schemaVersion: "brain-browser.supabase.v1", rabbitHoles };
}
