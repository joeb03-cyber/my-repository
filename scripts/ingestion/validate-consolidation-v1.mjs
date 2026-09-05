import { createClient } from "@supabase/supabase-js";

const expectedRef = "agzcvkdmlrumuqefbtcb";
const url = process.env.SUPABASE_URL || process.env.BRAIN_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.BRAIN_SUPABASE_ANON_KEY;
if (process.env.BRAIN_IMPORT_ENVIRONMENT !== "staging" || !url?.includes(expectedRef) || !serviceKey || !anonKey) throw new Error("Validation is locked to isolated staging.");
const service = createClient(url, serviceKey, { auth: { persistSession: false } });
const anon = createClient(url, anonKey, { auth: { persistSession: false } });

const [conversations, messages, publicConversations, publicMessages, bucket, privateTable, privateMetadata, privateBucket] = await Promise.all([
  service.from("message_conversations").select("id", { count: "exact", head: true }).neq("publication_state", "archived"),
  service.from("conversation_messages").select("id", { count: "exact", head: true }),
  anon.from("brain_public_message_conversations").select("id", { count: "exact", head: true }),
  anon.from("brain_public_conversation_messages").select("id,conversation_id,speaker_role,sort_order"),
  service.storage.getBucket("brain-photo-originals"),
  anon.from("message_conversations").select("id").limit(1),
  anon.from("photo_private_metadata").select("asset_id").limit(1),
  anon.storage.from("brain-photo-originals").list("control-center", { limit: 1 }),
]);
if (conversations.error || conversations.count !== 13) throw new Error(`Expected 13 editable conversations, found ${conversations.count}: ${conversations.error?.message || ""}`);
if (messages.error || !messages.count) throw new Error(`Conversation messages missing: ${messages.error?.message || ""}`);
if (publicConversations.error || publicConversations.count !== 13) throw new Error(`Expected 13 public conversations, found ${publicConversations.count}: ${publicConversations.error?.message || ""}`);
if (publicMessages.error || !publicMessages.data?.length) throw new Error(`Public Messages projection unavailable: ${publicMessages.error?.message || ""}`);
for (const conversationId of new Set(publicMessages.data.map((item) => item.conversation_id))) {
  const thread = publicMessages.data.filter((item) => item.conversation_id === conversationId).sort((a, b) => a.sort_order - b.sort_order);
  if (thread.some((item, index) => item.speaker_role !== (index % 2 === 0 ? "joe" : "guest"))) throw new Error(`Conversation ${conversationId} is not an alternating arc.`);
}
if (bucket.error || bucket.data.public !== false) throw new Error("Private original bucket is not private.");
const deniedOrEmpty = (result) => Boolean(result.error) || !result.data?.length;
if (!deniedOrEmpty(privateTable) || !deniedOrEmpty(privateMetadata) || !deniedOrEmpty(privateBucket)) throw new Error("An anonymous client reached a private editorial/original surface.");
console.log(JSON.stringify({ editableConversations: conversations.count, publicConversations: publicConversations.count, publicMessages: publicMessages.data.length, privateMessageTablesDenied: true, privatePhotoMetadataDenied: true, privateOriginalBucketDenied: true, privateOriginalBucketPublic: bucket.data.public }, null, 2));
