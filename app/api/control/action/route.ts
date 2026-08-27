import { NextResponse } from "next/server";
import { getControlAdmin } from "@/lib/brain/control-auth.server";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const asStrings = (value: unknown) => Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean).slice(0, 30) : [];
const safeLinks = (value: unknown) => Array.isArray(value) ? value.flatMap((item: any) => {
  try {
    const url = new URL(String(item.url));
    if (!['http:', 'https:'].includes(url.protocol)) return [];
    return [{ label: String(item.label || url.hostname).slice(0, 100), url: url.toString() }];
  } catch { return []; }
}).slice(0, 20) : [];

export async function POST(request: Request) {
  const auth = await getControlAdmin();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const input = await request.json().catch(() => null) as any;
  if (!input?.action) return NextResponse.json({ error: "Missing action" }, { status: 400 });
  const db = auth.supabase;
  try {
    if (input.action === "save-note") {
      const payload = input.note || {};
      const id = payload.id || crypto.randomUUID();
      const title = String(payload.title || "").trim().slice(0, 180);
      const slug = String(payload.slug || "").trim().toLowerCase();
      const body = String(payload.bodyMarkdown || "").slice(0, 200000);
      const publicationState = payload.publicationState === "published" ? "published" : "draft";
      if (!title || !slugPattern.test(slug)) throw new Error("Add a title and a simple lowercase slug.");
      if (publicationState === "published" && input.confirmPublish !== true) throw new Error("Publication must be explicitly confirmed.");
      let folderId: string | null = null;
      if (payload.folderSlug) {
        const { data: folder, error } = await db.from("note_folders").select("id").eq("slug", payload.folderSlug).single();
        if (error) throw error; folderId = folder.id;
      }
      const { error: entityError } = await db.from("entities").upsert({
        id, kind: "note", slug, title, summary: String(payload.excerpt || "").trim().slice(0, 500),
        visibility: publicationState === "published" ? "public" : "private", lifecycle_state: "active",
        editorial_state: publicationState === "published" ? "approved" : "needs_review",
      });
      if (entityError) throw entityError;
      const { error: noteError } = await db.from("brain_notes").upsert({
        entity_id: id, folder_id: folderId, excerpt: String(payload.excerpt || "").trim().slice(0, 500), body_markdown: body,
        body_format: "markdown", publication_state: publicationState, pinned: Boolean(payload.pinned),
        source_published_at: payload.sourcePublishedAt || null,
        published_at: publicationState === "published" ? (payload.publishedAt || new Date().toISOString()) : null,
        editorial_notice: String(payload.editorialNotice || "").trim().slice(0, 1000) || null,
        external_links: safeLinks(payload.externalLinks),
      });
      if (noteError) throw noteError;
      const labels = Array.from(new Set(asStrings(payload.tags).map((label) => label.replace(/^#/, "").slice(0, 50))));
      const tagIds: string[] = [];
      for (const label of labels) {
        const tagSlug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        if (!tagSlug) continue;
        let { data: existing } = await db.from("note_tags").select("id").eq("slug", tagSlug).maybeSingle();
        if (!existing) {
          const { data: created, error } = await db.from("note_tags").insert({ id: crypto.randomUUID(), slug: tagSlug, label, editorial_state: "approved" }).select("id").single();
          if (error) throw error; existing = created;
        }
        tagIds.push(existing.id);
      }
      const { error: clearError } = await db.from("note_tag_links").delete().eq("note_entity_id", id);
      if (clearError) throw clearError;
      if (tagIds.length) {
        const { error } = await db.from("note_tag_links").insert(tagIds.map((tagId) => ({ note_entity_id: id, tag_id: tagId })));
        if (error) throw error;
      }
      return NextResponse.json({ ok: true, id, publicationState });
    }
    if (input.action === "archive-note") {
      if (!input.id || input.confirm !== true) throw new Error("Archive confirmation required.");
      const { error: noteError } = await db.from("brain_notes").update({ publication_state: "archived", pinned: false }).eq("entity_id", input.id);
      const { error: entityError } = await db.from("entities").update({ lifecycle_state: "archived", visibility: "private" }).eq("id", input.id).eq("kind", "note");
      if (noteError || entityError) throw noteError || entityError;
      return NextResponse.json({ ok: true });
    }
    if (input.action === "save-current-state") {
      const state = input.state || {};
      const now = new Date().toISOString();
      let readingBook: { id: string; title: string } | null = null;
      if (state.readingBookId) {
        const { data: book, error: bookError } = await db.from("brain_public_books").select("id,title").eq("id", String(state.readingBookId)).maybeSingle();
        if (bookError) throw bookError;
        if (!book) throw new Error("That linked Book is not available in the public Brain.");
        readingBook = book;
      }
      const normalized = {
        schemaVersion: "brain-current-state.control.v1", effectiveAt: now, lastConfirmedAt: now,
        where: { city: String(state.where?.city || "").trim(), country: String(state.where?.country || "").trim(), coordinates: String(state.where?.coordinates || "").trim() || null },
        reading: readingBook?.title || textOrNull(state.reading), thinking: textOrNull(state.thinking), rabbitHoles: asStrings(state.rabbitHoles), experiments: asStrings(state.experiments),
        training: textOrNull(state.training), eatingLately: textOrNull(state.eatingLately), listening: textOrNull(state.listening), tryingToUnderstand: textOrNull(state.tryingToUnderstand),
        making: textOrNull(state.making), currentQuestion: textOrNull(state.currentQuestion), currentThought: textOrNull(state.currentThought),
        humanBattery: { level: typeof state.humanBattery?.level === "number" ? Math.max(0, Math.min(100, Math.round(state.humanBattery.level))) : null, label: String(state.humanBattery?.label || "Unreported").slice(0, 40), note: textOrNull(state.humanBattery?.note) },
      };
      const id = crypto.randomUUID();
      const { error } = await db.from("current_state_snapshots").insert({ id, effective_at: now, last_confirmed_at: now, publication_state: "draft", state: normalized, provenance: { source: "control_center", editedBy: auth.user.id } });
      if (error) throw error;
      if (readingBook) {
        const { error: linkError } = await db.from("current_state_entity_links").insert({ snapshot_id: id, role: "reading", entity_id: readingBook.id });
        if (linkError) throw linkError;
      }
      const { error: publishError } = await db.from("current_state_snapshots").update({ publication_state: "published" }).eq("id", id);
      if (publishError) throw publishError;
      await db.from("current_state_snapshots").update({ publication_state: "archived" }).neq("id", id).eq("publication_state", "published");
      return NextResponse.json({ ok: true, state: normalized });
    }
    if (input.action === "save-software-update") {
      const update = input.update || {};
      const id = crypto.randomUUID(); const now = new Date().toISOString();
      const row = { id, version_label: String(update.versionLabel || "Current").trim().slice(0, 60), new_items: asStrings(update.new), exploring_items: asStrings(update.currentlyExploring), performance_items: asStrings(update.performance), known_issue_items: asStrings(update.knownIssues), publication_state: "published", effective_at: now };
      const { error } = await db.from("software_update_snapshots").insert(row);
      if (error) throw error;
      await db.from("software_update_snapshots").update({ publication_state: "archived" }).neq("id", id).eq("publication_state", "published");
      return NextResponse.json({ ok: true });
    }
    if (input.action === "save-trash") {
      const item = input.item || {}; const id = item.id || crypto.randomUUID();
      if (!String(item.title || "").trim()) throw new Error("Trash needs a title.");
      const { error } = await db.from("os_trash_records").upsert({ id, title: String(item.title).trim().slice(0, 160), description: String(item.description || "").trim().slice(0, 500), category: String(item.category || "other").trim().slice(0, 50), trashed_at: item.trashedAt || null, state: ["active", "trashed", "restored"].includes(item.state) ? item.state : "trashed", visibility: item.visibility === "private" ? "private" : "public", sort_order: Number.isFinite(item.sortOrder) ? item.sortOrder : 100 });
      if (error) throw error;
      return NextResponse.json({ ok: true, id });
    }
    if (input.action === "archive-trash") {
      if (!input.id || input.confirm !== true) throw new Error("Archive confirmation required.");
      const { error } = await db.from("os_trash_records").update({ state: "archived" }).eq("id", input.id);
      if (error) throw error; return NextResponse.json({ ok: true });
    }
    if (input.action === "restore-trash") {
      if (!input.id || input.confirm !== true) throw new Error("Put Back confirmation required.");
      const { error } = await db.from("os_trash_records").update({ state: "restored" }).eq("id", input.id);
      if (error) throw error; return NextResponse.json({ ok: true });
    }
    if (input.action === "save-activity") {
      const item = input.item || {}; const id = item.id || crypto.randomUUID();
      const name = String(item.name || "").trim().slice(0, 120);
      if (!name) throw new Error("A process needs a name.");
      const status = ["running", "background", "sleeping", "not_responding"].includes(item.status) ? item.status : "background";
      const { error } = await db.from("activity_monitor_processes").upsert({
        id, name, status, detail: String(item.detail || "").trim().slice(0, 500),
        started_label: textOrNull(item.startedLabel), related_items: asStrings(item.related).slice(0, 12),
        visibility: item.visibility === "private" ? "private" : "public",
        editorial_state: item.editorialState === "needs_review" ? "needs_review" : "approved",
        lifecycle_state: "active", sort_order: Number.isFinite(item.sortOrder) ? item.sortOrder : 100,
      });
      if (error) throw error; return NextResponse.json({ ok: true, id });
    }
    if (input.action === "archive-activity") {
      if (!input.id || input.confirm !== true) throw new Error("Archive confirmation required.");
      const { error } = await db.from("activity_monitor_processes").update({ lifecycle_state: "archived", visibility: "private" }).eq("id", input.id);
      if (error) throw error; return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Save failed" }, { status: 400 });
  }
}

function textOrNull(value: unknown) {
  const text = String(value ?? "").trim().slice(0, 1000);
  return text || null;
}
