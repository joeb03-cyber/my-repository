import type { Metadata } from "next";
import PrototypeShell from "@/components/os/prototype-shell";
import "./os.css";

export const metadata: Metadata = {
  title: "Synergetic Human OS — Prototype",
  description: "A visual prototype of a personal operating system.",
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
