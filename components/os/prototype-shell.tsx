"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Archive, ArrowLeft, Atom, BookOpen, Compass, FlaskConical, Info, Map, NotebookPen } from "lucide-react";
import type { AppId } from "@/data/prototype";
import { wallpapers } from "@/data/prototype";
import booksIndexJson from "@/data/brain/books-index.v1.json";
import type { BrainBookSummary, BrainBooksIndex } from "@/lib/brain/types";
import AppContent from "./app-content";
import { BookDetail } from "./library-app";
import WindowFrame, { type WindowState } from "./window-frame";

const apps = [
  { id: "library", label: "Library", icon: BookOpen, tone: "amber" },
  { id: "atlas", label: "Atlas", icon: Map, tone: "blue" },
  { id: "laboratory", label: "Laboratory", icon: FlaskConical, tone: "green" },
  { id: "reality", label: "Reality", icon: Atom, tone: "violet" },
  { id: "journal", label: "Journal", icon: NotebookPen, tone: "rose" },
  { id: "archive", label: "Archive", icon: Archive, tone: "slate" },
  { id: "practice", label: "Practice", icon: Compass, tone: "sand" },
  { id: "about", label: "About", icon: Info, tone: "ink" },
] as const;

const appNames: Record<AppId, string> = Object.fromEntries(apps.map((app) => [app.id, app.label])) as Record<AppId, string>;
const brainBooks = (booksIndexJson as BrainBooksIndex).books;

const initialWindows: WindowState[] = [
  { id: "currently", kind: "currently", title: "Currently", x: 42, y: 58, width: 200, height: 130, z: 1, resizable: false },
  { id: "reading", kind: "reading", title: "Reading", x: 600, y: 630, width: 245, height: 140, z: 3, resizable: false },
  { id: "thinking", kind: "thinking", title: "Thinking About", x: 1135, y: 82, width: 250, height: 135, z: 2, resizable: false },
];

function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const interval = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(interval);
  }, []);
  return <span>{now ? now.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Right now"}</span>;
}

export default function PrototypeShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [windows, setWindows] = useState<WindowState[]>(initialWindows);
  const [wallpaperIndex, setWallpaperIndex] = useState(0);
  const [mobileBook, setMobileBook] = useState<BrainBookSummary | null>(null);
  const [launchingApp, setLaunchingApp] = useState<AppId | null>(null);
  const [activeMenu, setActiveMenu] = useState<"file" | "explore" | "view" | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const focusWindow = useCallback((id: string) => {
    setWindows((current) => {
      const top = Math.max(0, ...current.map((win) => win.z)) + 1;
      return current.map((win) => win.id === id ? { ...win, z: top, minimized: false } : win);
    });
  }, []);

  const openApp = useCallback((appId: AppId, changeRoute = true) => {
    const id = `app-${appId}`;
    setWindows((current) => {
      const existing = current.find((win) => win.id === id);
      const top = Math.max(0, ...current.map((win) => win.z)) + 1;
      if (existing) return current.map((win) => win.id === id ? { ...win, z: top, minimized: false, transition: win.minimized ? "reopening" : undefined } : win);
      const offset = current.filter((win) => win.kind === "app").length * 24;
      return [...current, { id, appId, kind: "app", title: appNames[appId], x: 135 + offset, y: 70 + offset, width: appId === "library" ? 900 : 720, height: appId === "library" ? 650 : 520, z: top, transition: "opening" }];
    });
    setLaunchingApp(appId);
    window.setTimeout(() => {
      setLaunchingApp((active) => active === appId ? null : active);
      setWindows((current) => current.map((win) => win.id === id && (win.transition === "opening" || win.transition === "reopening") ? { ...win, transition: undefined } : win));
    }, 520);
    if (changeRoute) router.push(`/${appId}`);
  }, [router]);

  const openBook = useCallback((book: BrainBookSummary, changeRoute = true) => {
    const id = `book-${book.slug}`;
    setWindows((current) => {
      const existing = current.find((win) => win.id === id);
      const top = Math.max(0, ...current.map((win) => win.z)) + 1;
      if (existing) return current.map((win) => win.id === id ? { ...win, z: top, minimized: false, transition: win.minimized ? "reopening" : undefined } : win);
      return [...current, { id, kind: "book", appId: "library", title: book.title, payload: book.slug, x: 255, y: 82, width: 780, height: 650, z: top, transition: "opening" }];
    });
    window.setTimeout(() => setWindows((current) => current.map((win) => win.id === id && (win.transition === "opening" || win.transition === "reopening") ? { ...win, transition: undefined } : win)), 420);
    if (changeRoute) router.push(`/library/${book.slug}`);
  }, [router]);

  useEffect(() => {
    const parts = pathname.split("/").filter(Boolean);
    const appId = parts[0] as AppId;
    if (apps.some((app) => app.id === appId)) openApp(appId, false);
    if (appId === "library" && parts[1]) {
      const book = brainBooks.find((item) => item.slug === parts[1]);
      if (book) { openBook(book, false); setMobileBook(book); }
      else setMobileBook(null);
    } else setMobileBook(null);
  }, [pathname, openApp, openBook]);

  useEffect(() => {
    const interval = window.setInterval(() => setWallpaperIndex((index) => (index + 1) % wallpapers.length), 24_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const keepVisible = () => setWindows((current) => current.map((win) => {
      const width = Math.min(win.width, window.innerWidth - 16);
      const height = Math.min(win.height, Math.max(130, window.innerHeight - 102));
      return {
        ...win,
        x: Math.min(win.x, Math.max(8, window.innerWidth - width - 8)),
        y: Math.min(win.y, Math.max(32, window.innerHeight - height - 70)),
        width,
        height,
      };
    }));
    keepVisible();
    window.addEventListener("resize", keepVisible);
    return () => window.removeEventListener("resize", keepVisible);
  }, []);

  const updateWindow = useCallback((id: string, changes: Partial<WindowState>) => setWindows((current) => current.map((win) => win.id === id ? { ...win, ...changes } : win)), []);
  const closeWindow = useCallback((id: string) => {
    setWindows((current) => current.map((win) => win.id === id ? { ...win, transition: "closing" } : win));
    window.setTimeout(() => setWindows((current) => current.filter((win) => win.id !== id)), 170);
    if (id === `app-${pathname.split("/")[1]}`) window.setTimeout(() => router.push("/"), 170);
    else if (id.startsWith("book-") && pathname.startsWith("/library/")) window.setTimeout(() => router.push("/library"), 170);
  }, [pathname, router]);
  const minimizeWindow = useCallback((id: string) => {
    updateWindow(id, { transition: "minimizing" });
    window.setTimeout(() => updateWindow(id, { minimized: true, transition: undefined }), 190);
  }, [updateWindow]);
  const zoomWindow = useCallback((id: string) => {
    setWindows((current) => current.map((win) => {
      if (win.id !== id || win.resizable === false) return win;
      if (win.zoomed && win.restoreBounds) return { ...win, ...win.restoreBounds, zoomed: false, restoreBounds: undefined };
      return {
        ...win,
        restoreBounds: { x: win.x, y: win.y, width: win.width, height: win.height },
        x: 16,
        y: 38,
        width: window.innerWidth - 32,
        height: window.innerHeight - 112,
        zoomed: true,
      };
    }));
  }, []);
  const currentWallpaper = wallpapers[wallpaperIndex];
  const currentApp = pathname.split("/")[1] as AppId;
  const openApps = useMemo(() => new Set(windows.filter((win) => win.kind === "app" && win.appId).map((win) => win.appId)), [windows]);
  const minimizedApps = useMemo(() => new Set(windows.filter((win) => win.kind === "app" && win.appId && win.minimized).map((win) => win.appId)), [windows]);
  const topVisibleZ = Math.max(0, ...windows.filter((win) => !win.minimized).map((win) => win.z));
  const closeMenus = () => { setActiveMenu(null); setContextMenu(null); };
  const resetDesktop = () => { setWindows(initialWindows.map((win) => ({ ...win }))); closeMenus(); router.push("/"); };
  const closeActiveWindow = () => {
    const active = windows.find((win) => !win.minimized && win.z === topVisibleZ);
    if (active) closeWindow(active.id);
    closeMenus();
  };

  const renderWindowContent = (win: WindowState) => {
    if (win.kind === "currently") return <Currently />;
    if (win.kind === "reading") return <Reading onOpen={() => openApp("library")} />;
    if (win.kind === "thinking") return <Thinking />;
    if (win.kind === "book") {
      return <BookDetail slug={win.payload || ""} />;
    }
    return <AppContent appId={win.appId as AppId} onBookOpen={openBook} />;
  };

  return (
    <main className="os-root">
      {wallpapers.map((wallpaper, index) => <div key={wallpaper.id} className={`wallpaper ${wallpaper.className} ${index === wallpaperIndex ? "is-visible" : ""}`} aria-hidden="true" />)}
      <header className="menu-bar">
        <div className="menu-left">
          <button className="menu-brand" onClick={() => { router.push("/"); closeMenus(); }}><strong>Synergetic Human</strong></button>
          <nav className="system-menus" aria-label="System menus">
            <SystemMenu label="File" open={activeMenu === "file"} onToggle={() => setActiveMenu(activeMenu === "file" ? null : "file")}>
              <MenuAction label="Open Library" shortcut="⌘L" onClick={() => { openApp("library"); closeMenus(); }} />
              <MenuAction label="Close Active Window" shortcut="⌘W" onClick={closeActiveWindow} />
            </SystemMenu>
            <SystemMenu label="Explore" open={activeMenu === "explore"} onToggle={() => setActiveMenu(activeMenu === "explore" ? null : "explore")}>
              <MenuAction label="Library" onClick={() => { openApp("library"); closeMenus(); }} />
              <MenuAction label="Atlas" onClick={() => { openApp("atlas"); closeMenus(); }} />
              <MenuAction label="Archive" onClick={() => { openApp("archive"); closeMenus(); }} />
            </SystemMenu>
            <SystemMenu label="View" open={activeMenu === "view"} onToggle={() => setActiveMenu(activeMenu === "view" ? null : "view")}>
              <MenuAction label="Next Wallpaper" shortcut="⌘→" onClick={() => { setWallpaperIndex((wallpaperIndex + 1) % wallpapers.length); closeMenus(); }} />
              <MenuAction label="Reset Desktop" onClick={resetDesktop} />
            </SystemMenu>
          </nav>
        </div>
        <div className="menu-status"><span>Sarajevo</span><span>22° · clear-ish</span><Clock /></div>
      </header>

      <section className="desktop-stage" aria-label="Synergetic Human desktop" onPointerDown={closeMenus} onContextMenu={(event) => { event.preventDefault(); setActiveMenu(null); setContextMenu({ x: Math.min(event.clientX, window.innerWidth - 190), y: Math.min(event.clientY, window.innerHeight - 220) }); }}>
        {windows.map((win) => <WindowFrame key={win.id} windowState={win} isActive={win.z === topVisibleZ} onFocus={focusWindow} onClose={closeWindow} onMinimize={minimizeWindow} onZoom={zoomWindow} onChange={updateWindow}>{renderWindowContent(win)}</WindowFrame>)}
        {contextMenu && <div className="desktop-context-menu" role="menu" style={{ left: contextMenu.x, top: contextMenu.y }} onPointerDown={(event) => event.stopPropagation()}>
          <MenuAction label="Open Library" onClick={() => { openApp("library"); closeMenus(); }} />
          <MenuAction label="Open Atlas" onClick={() => { openApp("atlas"); closeMenus(); }} />
          <span className="menu-separator" />
          <MenuAction label="Reset Desktop" onClick={resetDesktop} />
        </div>}
      </section>

      <section className="mobile-shell">
        {pathname === "/" ? <MobileHome onOpen={(appId) => router.push(`/${appId}`)} /> : (
          <div className="mobile-app-view">
            <header><button onClick={() => mobileBook ? setMobileBook(null) : router.push("/")}><ArrowLeft /></button><div><span>SYNERGETIC HUMAN</span><strong>{mobileBook?.title ?? appNames[currentApp] ?? "Application"}</strong></div></header>
            <div className="mobile-app-scroll">{mobileBook ? <BookDetail slug={mobileBook.slug} onBack={() => setMobileBook(null)} /> : <AppContent appId={currentApp} onBookOpen={setMobileBook} />}</div>
          </div>
        )}
      </section>

      <button className="wallpaper-caption" onClick={() => setWallpaperIndex((wallpaperIndex + 1) % wallpapers.length)} title="Next wallpaper"><span>●</span> {currentWallpaper.label} · {currentWallpaper.location}<small>{currentWallpaper.credit}</small></button>
      <nav className="dock" aria-label="Applications">
        {apps.map(({ id, label, icon: Icon, tone }) => (
          <button key={id} className={`dock-item ${openApps.has(id) ? "is-open" : ""} ${minimizedApps.has(id) ? "is-minimized" : ""} ${launchingApp === id ? "is-launching" : ""}`} onClick={() => openApp(id)} aria-label={`${label}${minimizedApps.has(id) ? ", minimized" : ""}`}>
            <span className="dock-label">{label}</span><span className={`dock-icon dock-icon--${tone}`}><span className="dock-symbol"><Icon strokeWidth={1.6} /></span></span><span className="dock-running" />
          </button>
        ))}
      </nav>
      <div className="route-placeholder" aria-hidden="true">{children}</div>
    </main>
  );
}

function Currently() {
  return <div className="status-content"><span className="eyebrow">CURRENT COORDINATES</span><h1>Sarajevo</h1><p>Bosnia &amp; Herzegovina</p><div className="status-rule"/><small>Slowly learning the shape of the city.</small><div className="coordinate-row"><span>43.8563° N</span><span>18.4131° E</span></div></div>;
}

function Reading({ onOpen }: { onOpen: () => void }) {
  return <div className="reading-card reading-card--unset"><div className="reading-library-glyph"><BookOpen /></div><div><span className="eyebrow">READING STATE</span><h2>Not set yet</h2><p>165 books are ready in the Library.</p><button onClick={onOpen}>Open Library <span>↗</span></button></div></div>;
}

function Thinking() {
  return <><blockquote className="thinking-quote">“What if a personal website felt less like a résumé—and more like walking into someone’s mind mid-thought?”</blockquote><div className="thought-meta"><span>RABBIT HOLE #024</span><span>still unresolved</span></div></>;
}

function MobileHome({ onOpen }: { onOpen: (appId: AppId) => void }) {
  return <div className="mobile-home"><div className="mobile-widget-row"><div className="mobile-now"><span className="app-kicker">CURRENTLY</span><h1>Sarajevo</h1><p>22° · clear-ish</p></div><div className="mobile-thought"><span className="app-kicker">THINKING</span><p>What if a website felt like entering someone’s mind mid-thought?</p></div></div><button className="mobile-reading" onClick={() => onOpen("library")}><div className="reading-library-glyph"><BookOpen /></div><div><span className="app-kicker">LIBRARY</span><strong>165 books</strong><small>Highlights, sources, and connections</small></div></button></div>;
}

function SystemMenu({ label, open, onToggle, children }: { label: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return <div className="system-menu"><button className={open ? "is-open" : ""} onPointerDown={(event) => event.stopPropagation()} onClick={onToggle} aria-haspopup="menu" aria-expanded={open}>{label}</button>{open && <div className="menu-popover" role="menu">{children}</div>}</div>;
}

function MenuAction({ label, shortcut, onClick }: { label: string; shortcut?: string; onClick: () => void }) {
  return <button className="menu-action" role="menuitem" onClick={onClick}><span>{label}</span>{shortcut && <kbd>{shortcut}</kbd>}</button>;
}
