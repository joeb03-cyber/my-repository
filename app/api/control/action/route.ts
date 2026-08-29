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
    if (input.action === "save-photo-editorial") {
      const photo = input.photo || {};
      const id = String(photo.id || "");
      if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("That photograph could not be identified.");
      let visit: { id: string; place_id: string } | null = null;
      if (photo.visitId) {
        const { data, error } = await db.from("brain_public_travel_visits").select("id,place_id").eq("id", String(photo.visitId)).maybeSingle();
        if (error) throw error; if (!data) throw new Error("That visit is not available in the public travel chronology."); visit = data;
      }
      const { error: publicationError } = await db.from("photo_publications").update({
        visit_id: visit?.id || null, place_id: visit?.place_id || null,
        is_photos_visible: Boolean(photo.visible), visibility: photo.visible ? "public" : "private",
        is_wallpaper_candidate: Boolean(photo.wallpaper), editorial_state: "approved",
      }).eq("asset_id", id);
      if (publicationError) throw publicationError;
      const relationshipId = crypto.randomUUID();
      const { error: draftError } = await db.from("photo_visit_relationships").insert({
        id: relationshipId, asset_id: id, visit_id: visit?.id || null, place_id: visit?.place_id || null,
        relationship_state: visit ? "editorial_confident" : "unresolved", relationship_method: visit ? "control_center_correction" : "control_center_unassigned",
        active: false, provenance: { source: "control_center", editedBy: auth.user.id, preservesPriorAssertion: true },
      });
      if (draftError) throw draftError;
      const { error: deactivateError } = await db.from("photo_visit_relationships").update({ active: false }).eq("asset_id", id).eq("active", true);
      if (deactivateError) throw deactivateError;
      const { error: activateError } = await db.from("photo_visit_relationships").update({ active: true }).eq("id", relationshipId);
      if (activateError) throw activateError;
      return NextResponse.json({ ok: true, id });
    }
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
      const requestedBooks = [
        { role: "reading", id: state.readingBookId, fallback: state.reading },
        { role: "reading_secondary", id: state.readingBookIdSecondary, fallback: state.readingSecondary },
      ];
      const readingBooks: Array<{ role: string; id: string; title: string }> = [];
      for (const requested of requestedBooks) {
        if (!requested.id) continue;
        const { data: book, error: bookError } = await db.from("brain_public_books").select("id,title").eq("id", String(requested.id)).maybeSingle();
        if (bookError) throw bookError;
        if (!book) throw new Error("That linked Book is not available in the public Brain.");
        readingBooks.push({ role: requested.role, ...book });
      }
      const primaryBook = readingBooks.find((book) => book.role === "reading");
      const secondaryBook = readingBooks.find((book) => book.role === "reading_secondary");
      const normalized = {
        schemaVersion: "brain-current-state.control.v1", effectiveAt: now, lastConfirmedAt: now,
        where: { city: String(state.where?.city || "").trim(), country: String(state.where?.country || "").trim(), coordinates: String(state.where?.coordinates || "").trim() || null, timezone: String(state.where?.timezone || "Europe/Sarajevo").trim() },
        reading: primaryBook?.title || textOrNull(state.reading), readingAuthor: primaryBook ? null : textOrNull(state.readingAuthor),
        readingSecondary: secondaryBook?.title || textOrNull(state.readingSecondary), readingSecondaryAuthor: secondaryBook ? null : textOrNull(state.readingSecondaryAuthor),
        thinking: textOrNull(state.thinking), rabbitHoles: asStrings(state.rabbitHoles), experiments: asStrings(state.experiments),
        training: textOrNull(state.training), eatingLately: textOrNull(state.eatingLately), listening: textOrNull(state.listening), tryingToUnderstand: textOrNull(state.tryingToUnderstand),
        making: textOrNull(state.making), currentQuestion: textOrNull(state.currentQuestion), currentThought: textOrNull(state.currentThought),
        humanBattery: { level: typeof state.humanBattery?.level === "number" ? Math.max(0, Math.min(100, Math.round(state.humanBattery.level))) : null, label: String(state.humanBattery?.label || "Unreported").slice(0, 40), note: textOrNull(state.humanBattery?.note) },
      };
      const id = crypto.randomUUID();
      const { error } = await db.from("current_state_snapshots").insert({ id, effective_at: now, last_confirmed_at: now, publication_state: "draft", state: normalized, provenance: { source: "control_center", editedBy: auth.user.id } });
      if (error) throw error;
      if (readingBooks.length) {
        const { error: linkError } = await db.from("current_state_entity_links").insert(readingBooks.map((book) => ({ snapshot_id: id, role: book.role, entity_id: book.id })));
        if (linkError) throw linkError;
      }
      const { error: publishError } = await db.from("current_state_snapshots").update({ publication_state: "published" }).eq("id", id);
      if (publishError) throw publishError;
      await db.from("current_state_snapshots").update({ publication_state: "archived" }).neq("id", id).eq("publication_state", "published");
      return NextResponse.json({ ok: true, state: normalized });
    }
    if (input.action === "save-visit-reflection") {
      const visit = input.visit || {};
      const visitId = String(visit.id || "");
      if (!/^[0-9a-f-]{36}$/i.test(visitId)) throw new Error("That visit could not be identified.");
      const { data: publicVisit, error: visitError } = await db.from("brain_public_travel_visits").select("id").eq("id", visitId).maybeSingle();
      if (visitError) throw visitError;
      if (!publicVisit) throw new Error("That visit is not available in the public chronology.");
      const publicBlurb = String(visit.publicBlurb || "").trim().slice(0, 2000) || null;
      const { error } = await db.from("travel_visit_editorial").upsert({
        visit_id: visitId, public_blurb: publicBlurb, visibility: "public", editorial_state: "approved",
        provenance: { source: "control_center", editedBy: auth.user.id, preservesVisitChronology: true },
      });
      if (error) throw error;
      return NextResponse.json({ ok: true, id: visitId });
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
    if (input.action === "save-human-entry") {
      const item = input.item || {}; const id = item.id || crypto.randomUUID();
      const title = String(item.title || "").trim().slice(0, 160); const slug = String(item.slug || "").trim().toLowerCase();
      const sections = ["inner_life", "environment", "rhythms_recovery", "movement", "food", "frontiers"];
      const states = ["do_this", "do_more", "believe_matters", "exploring"];
      const types = ["principle", "practice", "model", "tool"];
      const publicationState = item.publicationState === "published" ? "published" : "draft";
      if (!title || !slugPattern.test(slug) || !sections.includes(item.section) || !states.includes(item.relationshipState) || !types.includes(item.entryType)) throw new Error("Complete the title, slug, section, state, and type.");
      if (publicationState === "published" && input.confirmPublish !== true) throw new Error("Publication must be explicitly confirmed.");
      const { error } = await db.from("human_entries").upsert({
        id, slug, section: item.section, relationship_state: item.relationshipState, entry_type: item.entryType,
        title, summary: String(item.summary || "").trim().slice(0, 500), current_take: String(item.currentTake || "").trim().slice(0, 4000),
        supporting_details: asStrings(item.supportingDetails).slice(0, 12), publication_state: publicationState,
        visibility: publicationState === "published" ? "public" : "private", editorial_state: publicationState === "published" ? "approved" : "needs_review",
        sort_order: Number.isFinite(item.sortOrder) ? item.sortOrder : 100,
        provenance: item.id ? undefined : { source: "control_center", createdBy: auth.user.id },
      });
      if (error) throw error;
      const { error: clearError } = await db.from("human_entry_entity_links").delete().eq("human_entry_id", id); if (clearError) throw clearError;
      const requested = Array.isArray(item.relationships) ? item.relationships.slice(0, 12) : [];
      if (requested.length) {
        const ids = requested.map((link: any) => String(link.entityId));
        const { data: allowed, error: allowedError } = await db.from("entities").select("id").in("id", ids).eq("visibility", "public").eq("lifecycle_state", "active").eq("editorial_state", "approved");
        if (allowedError) throw allowedError; const allowedIds = new Set((allowed || []).map((entity) => entity.id));
        const rows = requested.filter((link: any) => allowedIds.has(String(link.entityId))).map((link: any, index: number) => ({ human_entry_id: id, entity_id: String(link.entityId), relationship_label: String(link.label || "Related").slice(0, 50), sort_order: index * 10 + 10, provenance: { source: "control_center" } }));
        if (rows.length) { const { error: linkError } = await db.from("human_entry_entity_links").insert(rows); if (linkError) throw linkError; }
      }
      return NextResponse.json({ ok: true, id, publicationState });
    }
    if (input.action === "archive-human-entry") {
      if (!input.id || input.confirm !== true) throw new Error("Archive confirmation required.");
      const { error } = await db.from("human_entries").update({ publication_state: "archived", visibility: "private", editorial_state: "rejected" }).eq("id", input.id);
      if (error) throw error; return NextResponse.json({ ok: true });
    }
    if (input.action === "save-rabbit-hole") {
      const item = input.item || {}; const id = item.id || crypto.randomUUID();
      const title = String(item.title || "").trim().slice(0, 180); const slug = String(item.slug || "").trim().toLowerCase();
      const publicationState = item.publicationState === "published" ? "published" : "draft";
      if (!title || !slugPattern.test(slug)) throw new Error("Add a title and a simple lowercase slug.");
      if (publicationState === "published" && input.confirmPublish !== true) throw new Error("Publication must be explicitly confirmed.");
      const status = ["open","paused","closed"].includes(item.status) ? item.status : "open";
      const accent = ["ember","sun","violet","ocean","moss"].includes(item.accent) ? item.accent : "ember";
      const { error } = await db.from("rabbit_holes").upsert({
        id,slug,title,central_question:String(item.centralQuestion||"").trim().slice(0,500),short_intro:String(item.shortIntro||"").trim().slice(0,2000),current_take:String(item.currentTake||"").trim().slice(0,6000),status,accent,
        publication_state:publicationState,visibility:publicationState==="published"?"public":"private",editorial_state:publicationState==="published"?"approved":"needs_review",sort_order:Number.isFinite(item.sortOrder)?item.sortOrder:100,
        provenance:item.id?undefined:{source:"control_center",createdBy:auth.user.id},
      });
      if (error) throw error;
      for (const table of ["rabbit_hole_blocks","rabbit_hole_resources","rabbit_hole_entity_links","rabbit_hole_links","rabbit_hole_human_links"]) { const { error:clear }=await db.from(table).delete().eq(table==="rabbit_hole_links"?"from_rabbit_hole_id":"rabbit_hole_id",id); if(clear)throw clear; }
      const blocks=(Array.isArray(item.blocks)?item.blocks:[]).slice(0,30).map((block:any,index:number)=>({ id:block.id||crypto.randomUUID(),rabbit_hole_id:id,block_type:["narrative","experience","question","list","quote"].includes(block.type)?block.type:"narrative",heading:String(block.heading||"").slice(0,180),body:String(block.body||"").slice(0,12000),items:asStrings(block.items),sort_order:index*10+10,provenance:{source:"control_center"} }));
      if(blocks.length){const {error:blockError}=await db.from("rabbit_hole_blocks").insert(blocks);if(blockError)throw blockError;}
      const resources=[]; for(const resource of (Array.isArray(item.resources)?item.resources:[]).slice(0,30)){const links=safeLinks([{label:resource.title,url:resource.url}]);if(!links.length)continue;resources.push({id:resource.id||crypto.randomUUID(),rabbit_hole_id:id,title:String(resource.title||"").slice(0,180),url:links[0].url,resource_type:["book","paper","article","podcast","video","website"].includes(resource.resourceType)?resource.resourceType:"website",note:String(resource.note||"").slice(0,1000),public_role:resource.publicRole==="keep_going"?"keep_going":resource.publicRole==="context"?"context":"start_here",evidence_layer:["experience","practice","model","mechanism","experimental","review"].includes(resource.evidenceLayer)?resource.evidenceLayer:"model",sort_order:resources.length*10+10,provenance:{source:"control_center"}});}
      if(resources.length){const {error:resourceError}=await db.from("rabbit_hole_resources").insert(resources);if(resourceError)throw resourceError;}
      const requestedEntities=(Array.isArray(item.entities)?item.entities:[]).slice(0,30);if(requestedEntities.length){const ids=requestedEntities.map((link:any)=>String(link.entityId));const {data:allowed,error:allowedError}=await db.from("entities").select("id").in("id",ids).eq("visibility","public").eq("lifecycle_state","active").eq("editorial_state","approved");if(allowedError)throw allowedError;const allowedIds=new Set((allowed||[]).map((entity)=>entity.id));const rows=requestedEntities.filter((link:any)=>allowedIds.has(String(link.entityId))).map((link:any,index:number)=>({rabbit_hole_id:id,entity_id:String(link.entityId),label:String(link.label||"Related").slice(0,100),public_role:["person","book","source","note","keep_going"].includes(link.publicRole)?link.publicRole:"source",evidence_layer:"model",sort_order:index*10+10,provenance:{source:"control_center"}}));if(rows.length){const {error:linkError}=await db.from("rabbit_hole_entity_links").insert(rows);if(linkError)throw linkError;}}
      const related=(Array.isArray(item.related)?item.related:[]).filter((link:any)=>link.rabbitHoleId&&link.rabbitHoleId!==id).slice(0,20).map((link:any,index:number)=>({from_rabbit_hole_id:id,to_rabbit_hole_id:String(link.rabbitHoleId),label:String(link.label||"Related").slice(0,120),sort_order:index*10+10,provenance:{source:"control_center"}}));if(related.length){const {error:relatedError}=await db.from("rabbit_hole_links").insert(related);if(relatedError)throw relatedError;}
      const human=(Array.isArray(item.humanLinks)?item.humanLinks:[]).slice(0,20).map((link:any,index:number)=>({rabbit_hole_id:id,human_entry_id:String(link.humanEntryId),browser_label:String(link.browserLabel||"How this affects how I live").slice(0,120),human_label:String(link.humanLabel||"Explore why I think this").slice(0,120),sort_order:index*10+10,provenance:{source:"control_center"}}));if(human.length){const {error:humanError}=await db.from("rabbit_hole_human_links").insert(human);if(humanError)throw humanError;}
      return NextResponse.json({ok:true,id,publicationState});
    }
    if (input.action === "archive-rabbit-hole") {
      if (!input.id || input.confirm !== true) throw new Error("Archive confirmation required.");
      const { error } = await db.from("rabbit_holes").update({publication_state:"archived",visibility:"private",editorial_state:"rejected"}).eq("id",input.id);
      if(error)throw error; return NextResponse.json({ok:true});
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
