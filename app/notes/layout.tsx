import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Notes · Synergetic Human",
  robots:
    process.env.SITE_ENV === "staging"
      ? { index: false, follow: false, nocache: true }
      : undefined,
};

export default function NotesRedirectLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
