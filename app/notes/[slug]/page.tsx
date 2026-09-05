import type { Metadata } from "next";
import { redirect } from "next/navigation";

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  return { title: `${params.slug.replace(/-/g, " ")} · Synergetic Human` };
}

export default function LegacyNoteRedirect({ params }: { params: { slug: string } }) {
  redirect(`/journal?note=${encodeURIComponent(params.slug)}`);
}
