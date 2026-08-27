import "server-only";

import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { BrainOsState } from "./os-state-types";

export async function getOsState(): Promise<BrainOsState> {
  if (process.env.BRAIN_DATA_SOURCE !== "supabase") return JSON.parse(await readFile(path.join(process.cwd(), "data/brain/os-state.v1.json"), "utf8"));
  const url = process.env.BRAIN_SUPABASE_URL;
  const key = process.env.BRAIN_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Staging Brain environment is required.");
  const client = createClient(url, key, { auth: { persistSession: false } });
  const [{ data: update, error: updateError }, { data: trash, error: trashError }, { data: activity, error: activityError }] = await Promise.all([
    client.from("brain_public_software_update").select("*").limit(1).maybeSingle(),
    client.from("brain_public_trash").select("*").order("sort_order"),
    client.from("brain_public_activity_processes").select("*").order("sort_order"),
  ]);
  if (updateError || trashError || activityError) throw new Error(updateError?.message || trashError?.message || activityError?.message);
  return {
    schemaVersion: "brain-os-state.supabase.v1",
    softwareUpdate: update ? { versionLabel: update.version_label, new: update.new_items || [], currentlyExploring: update.exploring_items || [], performance: update.performance_items || [], knownIssues: update.known_issue_items || [] } : { versionLabel: "Current", new: [], currentlyExploring: [], performance: [], knownIssues: [] },
    trash: (trash || []).map((item) => ({ id: item.id, title: item.title, description: item.description, category: item.category, trashedAt: item.trashed_at })),
    activity: (activity || []).map((item) => ({ id: item.id, name: item.name, status: item.status, detail: item.detail, startedLabel: item.started_label, related: item.related_items || [], sortOrder: item.sort_order })),
  };
}
