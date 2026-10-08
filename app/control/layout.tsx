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
  robots: { index: false, follow: false, nocache: true },
};

export default function ControlLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body className="control-body">{children}</body></html>;
}
