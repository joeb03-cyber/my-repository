import { Suspense } from "react";
import type { Metadata } from "next";
import PrototypeShell from "@/components/os/prototype-shell";
import "maplibre-gl/dist/maplibre-gl.css";
import "./os.css";
import "./travel-layout-fix.css";
import "./messages-polish.css";

export const metadata: Metadata = {
  title: "Synergetic Human OS",
  description: "A personal operating system for a life in motion.",
  robots:
    process.env.SITE_ENV === "staging"
      ? { index: false, follow: false, nocache: true }
      : undefined,
};

export default function OSLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Suspense><PrototypeShell>{children}</PrototypeShell></Suspense>
      </body>
    </html>
  );
}
