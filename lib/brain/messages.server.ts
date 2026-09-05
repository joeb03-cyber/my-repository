import "server-only";
import { groundedConversations, type GroundedConversation } from "@/data/messages";
import { publicBrainClient } from "./public-supabase.server";

export async function getMessages(): Promise<GroundedConversation[]> {
  if (process.env.BRAIN_DATA_SOURCE !== "supabase") return groundedConversations;
  const db = publicBrainClient();
  const [conversations, messages, sources] = await Promise.all([
    db.from("brain_public_message_conversations").select("*").order("sort_order"),
    db.from("brain_public_conversation_messages").select("*").order("sort_order"),
    db.from("brain_public_conversation_sources").select("*").order("sort_order"),
  ]);
  if (conversations.error || messages.error || sources.error || !conversations.data?.length) return groundedConversations;
  return conversations.data.map((conversation: any) => {
    const thread = (messages.data || []).filter((message: any) => message.conversation_id === conversation.id);
    const exchanges = [];
    for (let index = 0; index < thread.length; index += 1) {
      const joe = thread[index]; const guest = thread[index + 1];
      if (joe?.speaker_role !== "joe" || guest?.speaker_role !== "guest") continue;
      exchanges.push({
        question: joe.body, answer: guest.body,
        sources: (sources.data || []).filter((source: any) => source.message_id === guest.id).map((source: any) => ({ label: source.label, url: source.url, kind: source.source_kind })),
      });
    }
    return { slug: conversation.slug, name: conversation.person_name, initials: conversation.initials, identity: conversation.identity, preview: conversation.preview, accent: conversation.accent, exchanges };
  });
}
