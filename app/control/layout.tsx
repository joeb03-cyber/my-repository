import type { Metadata } from "next";
import "./control.css";
import "./book-intake.css";
import "./consolidation.css";
import "./real-use-refinement.css";
import "./journey-editor.css";
import "./books-control.css";
import "./capture.css";

export const metadata: Metadata = {
  title: "Control Center · Synergetic Human",
  description: "The private place where Joe maintains Synergetic Human.",
  manifest: "/control-center.webmanifest",
  applicationName: "Synergetic Human Control Center",
  appleWebApp: { capable: true, title: "Control Center", statusBarStyle: "black-translucent" },
  icons: {
    icon: [{ url: "/control-center-icon-192.png", type: "image/png", sizes: "192x192" }],
    apple: [{ url: "/control-center-icon-192.png", type: "image/png", sizes: "192x192" }],
  },
  robots: { index: false, follow: false, nocache: true },
};

export default function ControlLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body className="control-body">{children}</body></html>;
}
