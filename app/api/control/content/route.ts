import { NextResponse } from "next/server";
import { getControlAdmin } from "@/lib/brain/control-auth.server";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await getControlAdmin();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = auth.supabase;
  const [entitiesResult, notesResult, foldersResult, tagsResult, linksResult, currentResult, updateResult, trashResult, activityResult] = await Promise.all([
    db.from("entities").select("id,slug,title,summary,visibility,lifecycle_state,editorial_state").eq("kind", "note").neq("lifecycle_state", "archived").order("updated_at", { ascending: false }),
    db.from("brain_notes").select("entity_id,folder_id,excerpt,body_markdown,publication_state,pinned,source_published_at,published_at,editorial_notice,external_links,updated_at"),
    db.from("note_folders").select("id,slug,label,sort_order").order("sort_order"),
    db.from("note_tags").select("id,slug,label").order("label"),
    db.from("note_tag_links").select("note_entity_id,tag_id"),
    db.from("current_state_snapshots").select("id,effective_at,last_confirmed_at,state").eq("publication_state", "published").order("effective_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("software_update_snapshots").select("id,version_label,new_items,exploring_items,performance_items,known_issue_items,effective_at").eq("publication_state", "published").order("effective_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("os_trash_records").select("id,title,description,category,trashed_at,state,visibility,sort_order,updated_at").neq("state", "archived").order("sort_order"),
    db.from("activity_monitor_processes").select("id,name,status,detail,started_label,related_items,visibility,editorial_state,lifecycle_state,sort_order,updated_at").neq("lifecycle_state", "archived").order("sort_order"),
  ]);
  const failure = [entitiesResult, notesResult, foldersResult, tagsResult, linksResult, currentResult, updateResult, trashResult, activityResult].find((result) => result.error);
  if (failure?.error) return NextResponse.json({ error: failure.error.message }, { status: 500 });
  const notesById = new Map((notesResult.data || []).map((note) => [note.entity_id, note]));
  const tagsById = new Map((tagsResult.data || []).map((tag) => [tag.id, tag.label]));
  const folderById = new Map((foldersResult.data || []).map((folder) => [folder.id, folder]));
  const tagsFor = (id: string) => (linksResult.data || []).filter((link) => link.note_entity_id === id).map((link) => tagsById.get(link.tag_id)).filter(Boolean);
  const notes = (entitiesResult.data || []).map((entity) => {
    const note: any = notesById.get(entity.id);
    const folder: any = note?.folder_id ? folderById.get(note.folder_id) : null;
    return {
      id: entity.id, slug: entity.slug, title: entity.title, excerpt: note?.excerpt || "", bodyMarkdown: note?.body_markdown || "",
      publicationState: note?.publication_state || "draft", pinned: Boolean(note?.pinned), folderSlug: folder?.slug || null,
      tags: tagsFor(entity.id), sourcePublishedAt: note?.source_published_at || null, publishedAt: note?.published_at || null,
      editorialNotice: note?.editorial_notice || "", externalLinks: note?.external_links || [], updatedAt: note?.updated_at,
    };
  });
  return NextResponse.json({
    admin: { displayName: auth.admin.display_name, email: auth.admin.email },
    notes,
    folders: foldersResult.data || [],
    currentState: currentResult.data?.state || null,
    softwareUpdate: updateResult.data ? {
      versionLabel: updateResult.data.version_label,
      new: updateResult.data.new_items,
      currentlyExploring: updateResult.data.exploring_items,
      performance: updateResult.data.performance_items,
      knownIssues: updateResult.data.known_issue_items,
    } : null,
    trash: trashResult.data || [],
    activity: activityResult.data || [],
  }, { headers: { "Cache-Control": "private, no-store" } });
}
