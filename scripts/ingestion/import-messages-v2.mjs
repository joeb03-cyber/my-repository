// Guarded, idempotent import of the 13 accepted source-grounded conversations.
// Isolated staging only; never run against the legacy production project.
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { createClient } from "@supabase/supabase-js";
import { v5 as uuidv5 } from "uuid";

const expectedRef = "agzcvkdmlrumuqefbtcb";
if (process.env.BRAIN_IMPORT_ENVIRONMENT !== "staging" || process.env.BRAIN_IMPORT_PROJECT_REF !== expectedRef || process.env.BRAIN_IMPORT_ACKNOWLEDGE_NON_PRODUCTION !== "yes" || process.env.BRAIN_IMPORT_APPROVED_STAGE !== "consolidation-messages-v2") throw new Error("Messages import is locked pending explicit isolated-staging approval.");
const url = process.env.SUPABASE_URL || process.env.BRAIN_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url?.includes(expectedRef) || !key) throw new Error("Isolated staging credentials are not configured.");

const source = await readFile(new URL("../../data/messages.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = { exports: {} }; new Function("module", "exports", compiled)(module, module.exports);
const conversations = module.exports.groundedConversations;
if (!Array.isArray(conversations) || conversations.length !== 13) throw new Error(`Expected 13 conversations, found ${conversations?.length}.`);
const db = createClient(url, key, { auth: { persistSession: false } });
const namespace = "cd16dcf0-a399-4c71-93bc-abaf07f31a65";

for (let conversationIndex = 0; conversationIndex < conversations.length; conversationIndex += 1) {
  const conversation = conversations[conversationIndex];
  const conversationId = uuidv5(`message-conversation:${conversation.slug}`, namespace);
  const { error: conversationError } = await db.from("message_conversations").upsert({
    id: conversationId, slug: conversation.slug, title: conversation.name, person_name: conversation.name,
    initials: conversation.initials, identity: conversation.identity, preview: conversation.preview, accent: conversation.accent,
    publication_state: "published", visibility: "public", editorial_state: "approved", sort_order: (conversationIndex + 1) * 10,
    provenance: { source: "accepted_messages_v1", sourceGroundedReconstruction: true, importedBy: "consolidation-messages-v2" },
  }, { onConflict: "id" });
  if (conversationError) throw conversationError;
  const { data: oldMessages, error: oldError } = await db.from("conversation_messages").select("id").eq("conversation_id", conversationId);
  if (oldError) throw oldError;
  if (oldMessages?.length) {
    const { error } = await db.from("conversation_message_sources").delete().in("message_id", oldMessages.map((item) => item.id)); if (error) throw error;
  }
  const { error: deleteError } = await db.from("conversation_messages").delete().eq("conversation_id", conversationId); if (deleteError) throw deleteError;
  for (let exchangeIndex = 0; exchangeIndex < conversation.exchanges.length; exchangeIndex += 1) {
    const exchange = conversation.exchanges[exchangeIndex];
    const joeId = uuidv5(`message:${conversation.slug}:${exchangeIndex}:joe`, namespace);
    const guestId = uuidv5(`message:${conversation.slug}:${exchangeIndex}:guest`, namespace);
    const { error: messagesError } = await db.from("conversation_messages").insert([
      { id: joeId, conversation_id: conversationId, speaker_role: "joe", body: exchange.question, sort_order: exchangeIndex * 20 + 10, provenance: { source: "accepted_messages_v1", authorship: "joe_prompt" } },
      { id: guestId, conversation_id: conversationId, speaker_role: "guest", body: exchange.answer, sort_order: exchangeIndex * 20 + 20, provenance: { source: "accepted_messages_v1", sourceGroundedReconstruction: true } },
    ]);
    if (messagesError) throw messagesError;
    if (exchange.sources.length) {
      const rows = exchange.sources.map((item, sourceIndex) => ({ id: uuidv5(`message-source:${conversation.slug}:${exchangeIndex}:${sourceIndex}`, namespace), message_id: guestId, label: item.label, url: item.url, source_kind: item.kind, sort_order: (sourceIndex + 1) * 10, provenance: { source: "accepted_messages_v1" } }));
      const { error } = await db.from("conversation_message_sources").insert(rows); if (error) throw error;
    }
  }
}
console.log(JSON.stringify({ imported: conversations.length, exchanges: conversations.reduce((sum, item) => sum + item.exchanges.length, 0), target: expectedRef }, null, 2));
