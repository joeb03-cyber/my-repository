import type { Metadata } from "next";
import PrototypeShell from "@/components/os/prototype-shell";
import "maplibre-gl/dist/maplibre-gl.css";
import "./os.css";
import "./travel-layout-fix.css";
import "./messages-polish.css";

export const metadata: Metadata = {
  title: "Synergetic Human OS — Prototype",
  description: "A visual prototype of a personal operating system.",
  robots:
    process.env.SITE_ENV === "staging"
      ? { index: false, follow: false, nocache: true }
      : undefined,
};

export default function OSLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PrototypeShell>{children}</PrototypeShell>
      </body>
    </html>
  );
}
