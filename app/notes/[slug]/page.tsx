import { cache } from "react";
import Note from "@/components/note";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { createClient as createBrowserClient } from "@/utils/supabase/client";
import { redirect } from "next/navigation";
import { Metadata } from "next";
import { Note as NoteType } from "@/lib/types";

// Enable ISR with a reasonable revalidation period for public notes
export const revalidate = 86400; // 24 hours

// Cached function to fetch a note by slug - eliminates duplicate fetches
const getNote = cache(async (slug: string) => {
  const supabase = createServerClient();
  const { data: note } = await supabase.rpc("select_note", {
    note_slug_arg: slug,
  }).single() as { data: NoteType | null };
  return note;
});

// Dynamically determine if this is a user note
export async function generateStaticParams() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return [];
  const supabase = createBrowserClient();
  const { data: posts } = await supabase
    .from("notes")
    .select("slug")
    .eq("public", true);

  // A local build may intentionally omit access to the legacy Notes backend.
  // Dynamic note routes remain available when Supabase is configured.
  return (posts || []).map(({ slug }) => ({
    slug,
  }));
}

// Use dynamic rendering for non-public notes
export const dynamicParams = true;

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const slug = params.slug.replace(/^notes\//, '');
  const note = await getNote(slug);

  if (!note) {
    return { title: "Note not found" };
  }

  const title = note.title || "new note";
  const emoji = note.emoji || "👋🏼";

  return {
    title: `synergetic human | ${title}`,
    openGraph: {
      images: [
        `/notes/api/og?title=${encodeURIComponent(title)}&emoji=${encodeURIComponent(
          emoji
        )}`,
      ],
    },
  };
}

export default async function NotePage({
  params,
}: {
  params: { slug: string };
}) {
  const slug = params.slug.replace(/^notes\//, '');
  const note = await getNote(slug);

  if (!note) {
    return redirect("/notes/error");
  }

  return (
    <div className="w-full min-h-dvh p-3">
      <Note note={note} />
    </div>
  );
}
