import { NextResponse } from "next/server";
import { getControlAdmin } from "@/lib/brain/control-auth.server";
import { getBooksIndex } from "@/lib/brain/books.server";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await getControlAdmin();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = auth.supabase;
  const [entitiesResult, notesResult, foldersResult, tagsResult, linksResult, currentResult, updateResult, trashResult, activityResult, humanResult, humanLinksResult, relationshipOptionsResult, rabbitResult, rabbitBlocksResult, rabbitResourcesResult, rabbitEntitiesResult, rabbitLinksResult, rabbitHumanResult, intakeResult, captureResult, podcastCaptureResult, booksIndex] = await Promise.all([
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
    db.from("book_intake_requests").select("id,book_entity_id,title,author,highlights_reference,metadata_status,cover_status,highlights_status,created_at,updated_at").order("created_at", { ascending: false }).limit(500),
    db.from("capture_inbox").select("id,capture_kind,title,body,occurred_on,visit_id,source_url,tags,status,created_at,updated_at").order("occurred_on", { ascending: false }).order("created_at", { ascending: false }).limit(500),
    db.from("podcast_episode_captures").select("id,episode_title,show_name,guest_names,episode_url,listened_on,listening_state,takeaways,memorable_moments,why_saved,tags,status,created_at,updated_at").order("listened_on", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }).limit(500),
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
    ? await db.from("current_state_entity_links").select("entity_id,role").eq("snapshot_id", currentResult.data.id).in("role", ["reading", "reading_secondary", "recently_read", "recently_read_secondary"])
    : { data: [], error: null };
  if (currentLinkResult.error) return NextResponse.json({ error: currentLinkResult.error.message }, { status: 500 });
  const [photoPublications, photoRelationships, photoDerivatives, photoVisits, photoPlaces, visitEditorial] = await Promise.all([
    db.from("photo_publications").select("asset_id,visit_id,is_photos_visible,is_wallpaper_candidate,visibility,editorial_state,display_place,country_name,captured_on").order("captured_on"),
    db.from("photo_visit_relationships").select("asset_id,visit_id,place_id,relationship_state").eq("active", true),
    db.from("photo_derivatives").select("asset_id,storage_path").eq("variant", "small"),
    db.from("brain_public_travel_visits").select("id,place_id,chronology_index,start_year,start_month"),
    db.from("brain_public_places").select("id,name,country_name"),
    db.from("travel_visit_editorial").select("visit_id,public_blurb,where_stayed,favorite_things,food_drink,visibility,editorial_state"),
  ]);
  const photoFeatureUnavailable = [photoPublications, photoRelationships, photoDerivatives].some((result) => result.error?.code === "42P01" || result.error?.code === "PGRST205");
  const photoFailure = !photoFeatureUnavailable ? [photoPublications, photoRelationships, photoDerivatives, photoVisits, photoPlaces, visitEditorial].find((result) => result.error) : null;
  if (photoFailure?.error) return NextResponse.json({ error: photoFailure.error.message }, { status: 500 });
  const photoRelationshipById = new Map((photoRelationships.data || []).map((row) => [row.asset_id, row]));
  const photoDerivativeById = new Map((photoDerivatives.data || []).map((row) => [row.asset_id, row.storage_path]));
  const photoPlaceById = new Map((photoPlaces.data || []).map((row) => [row.id, row]));
  const storageBase = process.env.BRAIN_SUPABASE_URL || "";
  const [messageConversations, conversationMessages, conversationSources] = await Promise.all([
    db.from("message_conversations").select("id,slug,title,person_name,initials,identity,preview,accent,publication_state,sort_order").neq("publication_state", "archived").order("sort_order"),
    db.from("conversation_messages").select("id,conversation_id,speaker_role,body,sort_order,provenance").order("sort_order"),
    db.from("conversation_message_sources").select("id,message_id,label,url,source_kind,sort_order,provenance").order("sort_order"),
  ]);
  const messagesUnavailable = [messageConversations, conversationMessages, conversationSources].some((result) => result.error?.code === "42P01" || result.error?.code === "PGRST205");
  const messagesFailure = !messagesUnavailable ? [messageConversations, conversationMessages, conversationSources].find((result) => result.error) : null;
  if (messagesFailure?.error) return NextResponse.json({ error: messagesFailure.error.message }, { status: 500 });
  const captureFeatureUnavailable = [captureResult, podcastCaptureResult].some((result) => result.error?.code === "42P01" || result.error?.code === "PGRST205");
  const captureFailure = !captureFeatureUnavailable ? [captureResult, podcastCaptureResult].find((result) => result.error) : null;
  if (captureFailure?.error) return NextResponse.json({ error: captureFailure.error.message }, { status: 500 });
  return NextResponse.json({
    admin: { displayName: auth.admin.display_name, email: auth.admin.email },
    notes,
    folders: foldersResult.data || [],
    currentState: currentResult.data ? {
      ...currentResult.data.state,
      readingBookId: currentLinkResult.data?.find((link) => link.role === "reading")?.entity_id || null,
      readingBookIdSecondary: currentLinkResult.data?.find((link) => link.role === "reading_secondary")?.entity_id || null,
      recentlyReadBookId: currentLinkResult.data?.find((link) => link.role === "recently_read")?.entity_id || null,
      recentlyReadBookIdSecondary: currentLinkResult.data?.find((link) => link.role === "recently_read_secondary")?.entity_id || null,
    } : null,
    bookOptions: booksIndex.books.map((book) => ({ id: book.id, slug: book.slug, title: book.title, authors: book.authors, cover: book.cover.public_path })),
    bookIntakes: intakeResult.error ? [] : intakeResult.data || [],
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
    messages: messagesUnavailable ? [] : (messageConversations.data || []).map((conversation) => ({
      id: conversation.id, slug: conversation.slug, title: conversation.title, personName: conversation.person_name,
      initials: conversation.initials, identity: conversation.identity, preview: conversation.preview, accent: conversation.accent,
      publicationState: conversation.publication_state, sortOrder: conversation.sort_order,
      messages: (conversationMessages.data || []).filter((message) => message.conversation_id === conversation.id).map((message) => ({
        id: message.id, speakerRole: message.speaker_role, body: message.body, sortOrder: message.sort_order,
        sourceGrounded: message.speaker_role === "guest" ? message.provenance?.sourceGroundedReconstruction !== false : undefined,
        sources: (conversationSources.data || []).filter((source) => source.message_id === message.id).map((source) => ({ id: source.id, label: source.label, url: source.url, kind: source.source_kind, sortOrder: source.sort_order })),
      })),
    })),
    captures: captureFeatureUnavailable ? [] : (captureResult.data || []).map((item) => ({
      id: item.id, captureKind: item.capture_kind, title: item.title || "", body: item.body,
      occurredOn: item.occurred_on, visitId: item.visit_id, sourceUrl: item.source_url || "",
      tags: item.tags || [], status: item.status, createdAt: item.created_at, updatedAt: item.updated_at,
    })),
    podcastCaptures: captureFeatureUnavailable ? [] : (podcastCaptureResult.data || []).map((item) => ({
      id: item.id, episodeTitle: item.episode_title, showName: item.show_name || "", guestNames: item.guest_names || [],
      episodeUrl: item.episode_url || "", listenedOn: item.listened_on, listeningState: item.listening_state,
      takeaways: item.takeaways || "", memorableMoments: item.memorable_moments || [], whySaved: item.why_saved || "",
      tags: item.tags || [], status: item.status, createdAt: item.created_at, updatedAt: item.updated_at,
    })),
    photos: photoFeatureUnavailable ? [] : (photoPublications.data || []).map((photo) => {
      const relationship: any = photoRelationshipById.get(photo.asset_id);
      const storagePath = photoDerivativeById.get(photo.asset_id);
      return { id: photo.asset_id, visitId: relationship?.visit_id || photo.visit_id, relationshipState: relationship?.relationship_state || "unresolved", visible: photo.is_photos_visible && photo.visibility === "public", wallpaper: photo.is_wallpaper_candidate, displayPlace: photo.display_place, country: photo.country_name, capturedOn: photo.captured_on, thumbnail: storagePath ? `${storageBase}/storage/v1/object/public/brain-public-media/${storagePath}` : "" };
    }),
    photoVisitOptions: (photoVisits.data || []).sort((a, b) => a.chronology_index - b.chronology_index).map((visit) => {
      const place: any = photoPlaceById.get(visit.place_id);
      const editorial = (visitEditorial.data || []).find((item) => item.visit_id === visit.id);
      return {
        id: visit.id, placeId: visit.place_id,
        label: `${place?.name || "Unknown"}, ${place?.country_name || ""} · ${visit.start_year}-${String(visit.start_month).padStart(2, "0")}`,
        publicBlurb: editorial?.public_blurb || "", whereStayed: editorial?.where_stayed || "",
        favoriteThings: editorial?.favorite_things || [], foodDrink: editorial?.food_drink || [],
      };
    }),
  }, { headers: { "Cache-Control": "private, no-store" } });
}
