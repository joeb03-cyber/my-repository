import type { Metadata } from "next";
import "./control.css";

export const metadata: Metadata = {
  title: "Control Center · Synergetic Human",
  robots: { index: false, follow: false, nocache: true },
};

export default function ControlLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body className="control-body">{children}</body></html>;
}
