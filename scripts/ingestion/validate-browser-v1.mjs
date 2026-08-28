import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.BRAIN_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.BRAIN_SUPABASE_ANON_KEY;
if (!url || !serviceKey || !anonKey || !url.includes("agzcvkdmlrumuqefbtcb")) throw new Error("Staging validation environment is required.");
const service = createClient(url, serviceKey, { auth:{ persistSession:false } });
const anon = createClient(url, anonKey, { auth:{ persistSession:false } });
const views = ["brain_public_rabbit_holes","brain_public_rabbit_hole_blocks","brain_public_rabbit_hole_resources","brain_public_rabbit_hole_entities","brain_public_rabbit_hole_links","brain_public_rabbit_hole_human_links"];
const totals = {};
for (const view of views) { const { count,error } = await anon.from(view).select("*",{count:"exact",head:true}); if(error) throw new Error(`${view}: ${error.message}`); totals[view]=count; }
const { data:holes,error:holeError } = await anon.from("brain_public_rabbit_holes").select("slug"); if(holeError) throw holeError;
if (holes.length !== 3) throw new Error(`Expected exactly 3 public rabbit holes, found ${holes.length}.`);
const { error:baseRead } = await anon.from("rabbit_holes").select("id").limit(1);
if (!baseRead) throw new Error("Anonymous access to rabbit_holes base table should be denied.");
const { count:drafts,error:draftError } = await service.from("rabbit_holes").select("*",{count:"exact",head:true}).eq("publication_state","draft"); if(draftError) throw draftError;
const { count:archivedFrontiers,error:humanError } = await service.from("human_entries").select("*",{count:"exact",head:true}).eq("section","frontiers").eq("publication_state","archived"); if(humanError) throw humanError;
console.log(JSON.stringify({ publicSlugs:holes.map((hole)=>hole.slug).sort(), publicViewTotals:totals, protectedBaseTable:true, draftTrailShells:drafts, archivedHumanFrontiers:archivedFrontiers },null,2));
