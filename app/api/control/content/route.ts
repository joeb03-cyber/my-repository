import { NextResponse } from "next/server";
import { getControlAdmin } from "@/lib/brain/control-auth.server";
import { getBooksIndex } from "@/lib/brain/books.server";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await getControlAdmin();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = auth.supabase;
  const [entitiesResult, notesResult, foldersResult, tagsResult, linksResult, currentResult, updateResult, trashResult, activityResult, humanResult, humanLinksResult, relationshipOptionsResult, rabbitResult, rabbitBlocksResult, rabbitResourcesResult, rabbitEntitiesResult, rabbitLinksResult, rabbitHumanResult, booksIndex] = await Promise.all([
    db.from("entities").select("id,slug,title,summary,visibility,lifecycle_state,editorial_state").eq("kind", "note").neq("lifecycle_state", "archived").order("updated_at", { ascending: false }),
    db.from("brain_notes").select("entity_id,folder_id,excerpt,body_markdown,publication_state,pinned,source_published_at,published_at,editorial_notice,external_links,updated_at"),
    db.from("note_folders").select("id,slug,label,sort_order").order("sort_order"),
    db.from("note_tags").select("id,slug,label").order("label"),
    db.from("note_tag_links").select("note_entity_id,tag_id"),
    db.from("current_state_snapshots").select("id,effective_at,last_confirmed_at,state").eq("publication_state", "published").order("effective_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("software_update_snapshots").select("id,version_label,new_items,exploring_items,performance_items,known_issue_items,effective_at").eq("publication_state", "published").order("effective_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("os_trash_records").select("id,title,description,category,trashed_at,state,visibility,sort_order,updated_at").neq("state", "archived").order("sort_order"),
    db.from("activity_monitor_processes").select("id,name,status,detail,started_label,related_items,visibility,editorial_state,lifecycle_state,sort_order,updated_at").neq("lifecycle_state", "archived").order("sort_order"),
    db.from("human_entries").select("id,slug,section,relationship_state,entry_type,title,summary,current_take,supporting_details,publication_state,visibility,editorial_state,sort_order,updated_at").neq("publication_state", "archived").order("section").order("sort_order"),
    db.from("human_entry_entity_links").select("human_entry_id,entity_id,relationship_label,sort_order"),
    db.from("entities").select("id,slug,title,kind").eq("visibility", "public").eq("lifecycle_state", "active").eq("editorial_state", "approved").in("kind", ["book", "person", "source", "note"]).order("title"),
    db.from("rabbit_holes").select("id,slug,title,central_question,short_intro,current_take,status,accent,publication_state,sort_order,updated_at").neq("publication_state","archived").order("sort_order"),
    db.from("rabbit_hole_blocks").select("id,rabbit_hole_id,block_type,heading,body,items,sort_order").order("sort_order"),
    db.from("rabbit_hole_resources").select("id,rabbit_hole_id,title,url,resource_type,note,public_role,evidence_layer,sort_order").order("sort_order"),
    db.from("rabbit_hole_entity_links").select("rabbit_hole_id,entity_id,label,public_role,evidence_layer,sort_order").order("sort_order"),
    db.from("rabbit_hole_links").select("from_rabbit_hole_id,to_rabbit_hole_id,label,sort_order").order("sort_order"),
    db.from("rabbit_hole_human_links").select("rabbit_hole_id,human_entry_id,browser_label,human_label,sort_order").order("sort_order"),
    getBooksIndex(),
  ]);
  const failure = [entitiesResult, notesResult, foldersResult, tagsResult, linksResult, currentResult, updateResult, trashResult, activityResult, humanResult, humanLinksResult, relationshipOptionsResult, rabbitResult, rabbitBlocksResult, rabbitResourcesResult, rabbitEntitiesResult, rabbitLinksResult, rabbitHumanResult].find((result) => result.error);
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
  const currentLinkResult = currentResult.data?.id
    ? await db.from("current_state_entity_links").select("entity_id").eq("snapshot_id", currentResult.data.id).eq("role", "reading").maybeSingle()
    : { data: null, error: null };
  if (currentLinkResult.error) return NextResponse.json({ error: currentLinkResult.error.message }, { status: 500 });
  return NextResponse.json({
    admin: { displayName: auth.admin.display_name, email: auth.admin.email },
    notes,
    folders: foldersResult.data || [],
    currentState: currentResult.data ? { ...currentResult.data.state, readingBookId: currentLinkResult.data?.entity_id || null } : null,
    bookOptions: booksIndex.books.map((book) => ({ id: book.id, slug: book.slug, title: book.title, authors: book.authors, cover: book.cover.public_path })),
    softwareUpdate: updateResult.data ? {
      versionLabel: updateResult.data.version_label,
      new: updateResult.data.new_items,
      currentlyExploring: updateResult.data.exploring_items,
      performance: updateResult.data.performance_items,
      knownIssues: updateResult.data.known_issue_items,
    } : null,
    trash: trashResult.data || [],
    activity: activityResult.data || [],
    human: (humanResult.data || []).map((entry) => ({
      id: entry.id, slug: entry.slug, section: entry.section, relationshipState: entry.relationship_state,
      entryType: entry.entry_type, title: entry.title, summary: entry.summary, currentTake: entry.current_take,
      supportingDetails: entry.supporting_details || [], publicationState: entry.publication_state,
      sortOrder: entry.sort_order,
      relationships: (humanLinksResult.data || []).filter((link) => link.human_entry_id === entry.id).map((link) => ({ entityId: link.entity_id, label: link.relationship_label })),
    })),
    humanRelationshipOptions: relationshipOptionsResult.data || [],
    browser: (rabbitResult.data || []).map((hole) => ({
      id:hole.id, slug:hole.slug, title:hole.title, centralQuestion:hole.central_question, shortIntro:hole.short_intro,
      currentTake:hole.current_take, status:hole.status, accent:hole.accent, publicationState:hole.publication_state, sortOrder:hole.sort_order,
      blocks:(rabbitBlocksResult.data || []).filter((item)=>item.rabbit_hole_id===hole.id).map((item)=>({ id:item.id,type:item.block_type,heading:item.heading,body:item.body,items:item.items||[],sortOrder:item.sort_order })),
      resources:(rabbitResourcesResult.data || []).filter((item)=>item.rabbit_hole_id===hole.id).map((item)=>({ id:item.id,title:item.title,url:item.url,resourceType:item.resource_type,note:item.note,publicRole:item.public_role,evidenceLayer:item.evidence_layer,sortOrder:item.sort_order })),
      entities:(rabbitEntitiesResult.data || []).filter((item)=>item.rabbit_hole_id===hole.id).map((item)=>({ entityId:item.entity_id,label:item.label,publicRole:item.public_role,evidenceLayer:item.evidence_layer,sortOrder:item.sort_order })),
      related:(rabbitLinksResult.data || []).filter((item)=>item.from_rabbit_hole_id===hole.id).map((item)=>({ rabbitHoleId:item.to_rabbit_hole_id,label:item.label,sortOrder:item.sort_order })),
      humanLinks:(rabbitHumanResult.data || []).filter((item)=>item.rabbit_hole_id===hole.id).map((item)=>({ humanEntryId:item.human_entry_id,browserLabel:item.browser_label,humanLabel:item.human_label,sortOrder:item.sort_order })),
    })),
  }, { headers: { "Cache-Control": "private, no-store" } });
}
