"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, BookOpen } from "lucide-react";
import type { AppId } from "@/data/prototype";
import { wallpapers } from "@/data/prototype";
import booksIndexJson from "@/data/brain/books-index.v1.json";
import currentStateJson from "@/data/brain/current-state.v1.json";
import osStateJson from "@/data/brain/os-state.v1.json";
import type { BrainBookSummary, BrainBooksIndex } from "@/lib/brain/types";
import { refineBooksIndex } from "@/lib/brain/books-editorial";
import type { BrainCurrentState } from "@/lib/brain/notes-types";
import type { BrainOsState } from "@/lib/brain/os-state-types";
import type { LivedPhoto } from "@/lib/brain/lived-history-types";
import AppContent from "./app-content";
import { BookDetail } from "./library-app";
import AppIcon, { type AppIconName } from "./app-icon";
import WindowFrame, { type WindowState } from "./window-frame";

const apps: ReadonlyArray<{ id: AppId; label: string; icon: AppIconName; route: string; separated?: boolean }> = [
  { id: "finder", label: "Finder", icon: "finder", route: "/finder" },
  { id: "library", label: "Books", icon: "books", route: "/library" },
  { id: "atlas", label: "Maps", icon: "maps", route: "/atlas" },
  { id: "messages", label: "Messages", icon: "messages", route: "/messages" },
  { id: "contacts", label: "Contacts", icon: "contacts", route: "/contacts" },
  { id: "journal", label: "Notes", icon: "notes", route: "/journal" },
  { id: "photos", label: "Photos", icon: "photos", route: "/photos" },
  { id: "laboratory", label: "Human", icon: "human", route: "/laboratory" },
  { id: "browser", label: "Browser", icon: "browser", route: "/browser" },
  { id: "about", label: "Settings", icon: "settings", route: "/about", separated: true },
  { id: "trash", label: "Trash", icon: "trash", route: "/trash" },
] as const;

const appNames: Record<AppId, string> = {
  finder: "Finder", library: "Books", atlas: "Maps", messages: "Messages", contacts: "Contacts", journal: "Notes",
  photos: "Photos", laboratory: "Human", browser: "Browser", about: "Settings", trash: "Trash",
  practice: "Practice", reality: "Reality", archive: "Archive",
  software: "Software Update", activity: "Activity Monitor", "screen-time": "Screen Time", terminal: "Terminal",
};
const routes: Partial<Record<AppId, string>> = { ...Object.fromEntries(apps.map((app) => [app.id, app.route])), software: "/software-update", activity: "/activity-monitor", "screen-time": "/screen-time", terminal: "/terminal" };
const routeApps: Record<string, AppId> = {
  finder: "finder", library: "library", atlas: "atlas", messages: "messages", contacts: "contacts", journal: "journal",
  photos: "photos", laboratory: "laboratory", browser: "browser", about: "about", trash: "trash",
  practice: "practice", reality: "reality", archive: "archive",
  "software-update": "software", "activity-monitor": "activity", "screen-time": "screen-time", terminal: "terminal",
};
const brainBooks = refineBooksIndex(booksIndexJson as BrainBooksIndex).books;

const initialWindows: WindowState[] = [
  { id: "currently", kind: "currently", title: "Currently", x: 42, y: 58, width: 200, height: 130, z: 1, resizable: false },
  { id: "reading", kind: "reading", title: "Reading", x: 1045, y: 555, width: 245, height: 140, z: 2, resizable: false },
  { id: "app-journal", kind: "app", appId: "journal", title: "Notes", x: 315, y: 92, width: 680, height: 500, z: 3 },
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
  const [curatedWallpapers, setCuratedWallpapers] = useState<LivedPhoto[]>([]);
  const [mobileBook, setMobileBook] = useState<BrainBookSummary | null>(null);
  const [launchingApp, setLaunchingApp] = useState<AppId | null>(null);
  const [activeMenu, setActiveMenu] = useState<"file" | "explore" | "view" | null>(null);
  const [statusPanel, setStatusPanel] = useState<"battery" | "wifi" | "update" | null>(null);
  const [currentState, setCurrentState] = useState<BrainCurrentState>(currentStateJson as BrainCurrentState);
  const [osState, setOsState] = useState<BrainOsState>(osStateJson as BrainOsState);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const dockRef = useRef<HTMLElement>(null);
  const dockAnimationRef = useRef<number | null>(null);

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
      const isUtilityApp = appId === "terminal" || appId === "software" || appId === "screen-time";
      const preferredWidth = Math.min(isUtilityApp ? 760 : 1120, window.innerWidth - 48);
      const preferredHeight = Math.min(isUtilityApp ? 520 : 680, window.innerHeight - 112);
      if (existing) return current.map((win) => {
        if (win.id !== id) return win;
        const width = Math.max(win.width, preferredWidth);
        const height = Math.max(win.height, preferredHeight);
        return { ...win, x: Math.min(win.x, window.innerWidth - width - 24), y: Math.min(win.y, 54), width, height, z: top, minimized: false, transition: win.minimized ? "reopening" : undefined };
      });
      const cascade = (current.filter((win) => win.kind === "app").length % 4) * 16;
      const x = Math.min(Math.max(24, (window.innerWidth - preferredWidth) / 2 + cascade), window.innerWidth - preferredWidth - 24);
      const y = Math.min(48 + cascade, window.innerHeight - preferredHeight - 70);
      return [...current, { id, appId, kind: "app", title: appNames[appId], x, y, width: preferredWidth, height: preferredHeight, z: top, transition: "opening" }];
    });
    setLaunchingApp(appId);
    window.setTimeout(() => {
      setLaunchingApp((active) => active === appId ? null : active);
      setWindows((current) => current.map((win) => win.id === id && (win.transition === "opening" || win.transition === "reopening") ? { ...win, transition: undefined } : win));
    }, 520);
    if (changeRoute) router.push(routes[appId] ?? `/${appId}`);
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
    const appId = routeApps[parts[0]];
    if (appId) openApp(appId, false);
    if (appId === "library" && parts[1]) {
      const book = brainBooks.find((item) => item.slug === parts[1]);
      if (book) { openBook(book, false); setMobileBook(book); }
      else setMobileBook(null);
    } else setMobileBook(null);
  }, [pathname, openApp, openBook]);

  const activeWallpapers = curatedWallpapers.length ? curatedWallpapers : wallpapers;

  const advanceWallpaper = useCallback(() => setWallpaperIndex((index) => {
    if (activeWallpapers.length < 2) return 0;
    const placeKey = (wallpaper: (typeof activeWallpapers)[number]) => "derivatives" in wallpaper
      ? `${wallpaper.displayPlace || wallpaper.visitPlace || wallpaper.id}|${wallpaper.country || ""}`.toLocaleLowerCase()
      : `${wallpaper.location || wallpaper.id}`.toLocaleLowerCase();
    const currentKey = placeKey(activeWallpapers[index % activeWallpapers.length]);
    for (let offset = 1; offset < activeWallpapers.length; offset += 1) {
      const candidate = (index + offset) % activeWallpapers.length;
      if (placeKey(activeWallpapers[candidate]) !== currentKey) return candidate;
    }
    return (index + 1) % activeWallpapers.length;
  }), [activeWallpapers]);

  useEffect(() => {
    const interval = window.setInterval(advanceWallpaper, 24_000);
    return () => window.clearInterval(interval);
  }, [advanceWallpaper]);

  useEffect(() => {
    fetch("/api/brain/current-state").then((response) => response.ok ? response.json() : Promise.reject()).then(setCurrentState).catch(() => undefined);
    fetch("/api/brain/os-state").then((response) => response.ok ? response.json() : Promise.reject()).then(setOsState).catch(() => undefined);
    fetch("/api/brain/travel-photos").then((response) => response.ok ? response.json() : Promise.reject()).then((history) => {
      const isPhone = window.matchMedia("(max-width: 700px)").matches;
      const selected = (history.photos as LivedPhoto[]).filter((photo) => photo.wallpaper && (isPhone ? photo.orientation === "portrait" : photo.orientation === "landscape"));
      if (selected.length) { setWallpaperIndex(0); setCuratedWallpapers(selected); }
    }).catch(() => undefined);
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
  const currentWallpaper = activeWallpapers[wallpaperIndex % activeWallpapers.length];
  const currentApp = routeApps[pathname.split("/")[1]];
  const openApps = useMemo(() => new Set(windows.filter((win) => win.kind === "app" && win.appId).map((win) => win.appId)), [windows]);
  const minimizedApps = useMemo(() => new Set(windows.filter((win) => win.kind === "app" && win.appId && win.minimized).map((win) => win.appId)), [windows]);
  const topVisibleZ = Math.max(0, ...windows.filter((win) => !win.minimized).map((win) => win.z));
  const closeMenus = () => { setActiveMenu(null); setStatusPanel(null); setContextMenu(null); };
  const resetDesktop = () => { setWindows(initialWindows.map((win) => ({ ...win }))); closeMenus(); router.push("/"); };
  const closeActiveWindow = () => {
    const active = windows.find((win) => !win.minimized && win.z === topVisibleZ);
    if (active) closeWindow(active.id);
    closeMenus();
  };

  const resetDockTransforms = useCallback(() => {
    if (dockAnimationRef.current !== null) cancelAnimationFrame(dockAnimationRef.current);
    dockAnimationRef.current = null;
    dockRef.current?.querySelectorAll<HTMLElement>(".dock-item").forEach((item) => {
      item.style.removeProperty("--dock-scale");
      item.style.removeProperty("--dock-lift");
    });
  }, []);

  const magnifyDock = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType === "touch") return;
    const pointerX = event.clientX;
    if (dockAnimationRef.current !== null) cancelAnimationFrame(dockAnimationRef.current);
    dockAnimationRef.current = requestAnimationFrame(() => {
      dockRef.current?.querySelectorAll<HTMLElement>(".dock-item").forEach((item) => {
        const bounds = item.getBoundingClientRect();
        const distance = pointerX - (bounds.left + bounds.width / 2);
        const influence = Math.exp(-(distance * distance) / (2 * 47 * 47));
        const scale = 1 + .38 * influence;
        item.style.setProperty("--dock-scale", scale.toFixed(3));
        item.style.setProperty("--dock-lift", `${(-11 * influence).toFixed(2)}px`);
      });
      dockAnimationRef.current = null;
    });
  }, []);

  const renderWindowContent = (win: WindowState) => {
    if (win.kind === "currently") return <Currently state={currentState} />;
    if (win.kind === "reading") return <Reading state={currentState} onOpen={() => {
      const linked = currentState.readingBook ? brainBooks.find((book) => book.id === currentState.readingBook?.id || book.slug === currentState.readingBook?.slug) : null;
      if (linked) openBook(linked); else openApp("library");
    }} />;
    if (win.kind === "thinking") return <Thinking state={currentState} />;
    if (win.kind === "book") {
      return <BookDetail slug={win.payload || ""} />;
    }
    return <AppContent appId={win.appId as AppId} onBookOpen={openBook} onOpenApp={openApp} />;
  };

  return (
    <main className="os-root">
      {activeWallpapers.map((wallpaper, index) => <div key={wallpaper.id} className={`wallpaper ${"className" in wallpaper ? wallpaper.className : "wallpaper--curated"} ${index === wallpaperIndex % activeWallpapers.length ? "is-visible" : ""}`} style={"derivatives" in wallpaper ? { backgroundImage: `linear-gradient(rgba(9,14,18,.08),rgba(9,14,18,.15)),url(${wallpaper.derivatives.large.url})` } : undefined} aria-hidden="true" />)}
      <header className="menu-bar">
        <div className="menu-left">
          <button className="menu-brand" aria-label="Synergetic Human home" title="Synergetic Human" onClick={() => { router.push("/"); closeMenus(); }}><span aria-hidden="true">S</span></button>
          <strong className="menu-app-name">{currentApp ? appNames[currentApp] : "Synergetic Human"}</strong>
          <nav className="system-menus" aria-label="System menus">
            <SystemMenu label="File" open={activeMenu === "file"} onToggle={() => setActiveMenu(activeMenu === "file" ? null : "file")}>
              <MenuAction label="Open Books" shortcut="⌘L" onClick={() => { openApp("library"); closeMenus(); }} />
              <MenuAction label="Close Active Window" shortcut="⌘W" onClick={closeActiveWindow} />
            </SystemMenu>
            <SystemMenu label="Explore" open={activeMenu === "explore"} onToggle={() => setActiveMenu(activeMenu === "explore" ? null : "explore")}>
              <MenuAction label="Finder" onClick={() => { openApp("finder"); closeMenus(); }} />
              <MenuAction label="Books" onClick={() => { openApp("library"); closeMenus(); }} />
              <MenuAction label="Maps" onClick={() => { openApp("atlas"); closeMenus(); }} />
              <MenuAction label="Contacts" onClick={() => { openApp("contacts"); closeMenus(); }} />
              <MenuAction label="Browser" onClick={() => { openApp("browser"); closeMenus(); }} />
              <span className="menu-separator" />
              <MenuAction label="Activity Monitor" onClick={() => { openApp("activity"); closeMenus(); }} />
              <MenuAction label="Terminal" onClick={() => { openApp("terminal"); closeMenus(); }} />
            </SystemMenu>
            <SystemMenu label="View" open={activeMenu === "view"} onToggle={() => setActiveMenu(activeMenu === "view" ? null : "view")}>
              <MenuAction label="Next Wallpaper" shortcut="⌘→" onClick={() => { advanceWallpaper(); closeMenus(); }} />
              <MenuAction label="Reset Desktop" onClick={resetDesktop} />
            </SystemMenu>
          </nav>
        </div>
        <div className="menu-status">
          <span className="menu-location">{currentState.where.city}</span>
          <button className={`status-icon ${statusPanel === "battery" ? "is-active" : ""}`} aria-label="Human Battery" title="Human Battery" onClick={() => { setActiveMenu(null); setStatusPanel(statusPanel === "battery" ? null : "battery"); }}><BatteryGlyph level={currentState.humanBattery.level} /></button>
          <button className={`status-icon ${statusPanel === "wifi" ? "is-active" : ""}`} aria-label="Innernet network" title="Innernet" onClick={() => { setActiveMenu(null); setStatusPanel(statusPanel === "wifi" ? null : "wifi"); }}><WifiGlyph /></button>
          <button className={`status-icon ${statusPanel === "update" ? "is-active" : ""}`} aria-label="Software Update" title="Software Update" onClick={() => { setActiveMenu(null); setStatusPanel(statusPanel === "update" ? null : "update"); }}><ControlGlyph /></button>
          <Clock />
          {statusPanel === "battery" && <StatusPopover title="Human Battery"><div className="battery-readout"><BatteryGlyph level={currentState.humanBattery.level}/><strong>{currentState.humanBattery.label}</strong></div><p>{currentState.humanBattery.note || "No check-in note."}</p><small>Manual check-in only · no health data inferred</small></StatusPopover>}
          {statusPanel === "wifi" && <StatusPopover title="Wi-Fi"><div className="network-row"><WifiGlyph/><span><strong>Innernet</strong><small>Connected · full signal</small></span><i/></div><div className="network-row network-row--available network-row--weak"><WifiGlyph strength="weak"/><span><strong>Consensus Reality</strong><small>Available · weak signal</small></span></div><p className="popover-footnote">Networks are handcrafted interface copy.</p></StatusPopover>}
          {statusPanel === "update" && <StatusPopover title="Software Update"><div className="update-orb">S<span>{osState.softwareUpdate.versionLabel}</span></div><strong>Synergetic Human is up to date</strong><p>{osState.softwareUpdate.new[0] || `Currently making: ${currentState.making || "Not reported"}`}</p><dl><div><dt>Exploring</dt><dd>{osState.softwareUpdate.currentlyExploring[0] || "Not reported"}</dd></div><div><dt>Performance</dt><dd>{osState.softwareUpdate.performance[0] || "Nominally strange"}</dd></div><div><dt>Known issue</dt><dd>{osState.softwareUpdate.knownIssues[0] || "None reported"}</dd></div></dl><button className="popover-action" onClick={() => { openApp("software"); closeMenus(); }}>Open Software Update…</button></StatusPopover>}
        </div>
      </header>

      <section className="desktop-stage" aria-label="Synergetic Human desktop" onPointerDown={closeMenus} onContextMenu={(event) => { event.preventDefault(); setActiveMenu(null); setContextMenu({ x: Math.min(event.clientX, window.innerWidth - 190), y: Math.min(event.clientY, window.innerHeight - 220) }); }}>
        {windows.map((win) => <WindowFrame key={win.id} windowState={win} isActive={win.z === topVisibleZ} onFocus={focusWindow} onClose={closeWindow} onMinimize={minimizeWindow} onZoom={zoomWindow} onChange={updateWindow}>{renderWindowContent(win)}</WindowFrame>)}
        {contextMenu && <div className="desktop-context-menu" role="menu" style={{ left: contextMenu.x, top: contextMenu.y }} onPointerDown={(event) => event.stopPropagation()}>
          <MenuAction label="Open Finder" onClick={() => { openApp("finder"); closeMenus(); }} />
          <MenuAction label="Open Books" onClick={() => { openApp("library"); closeMenus(); }} />
          <MenuAction label="Open Maps" onClick={() => { openApp("atlas"); closeMenus(); }} />
          <MenuAction label="Open Terminal" onClick={() => { openApp("terminal"); closeMenus(); }} />
          <span className="menu-separator" />
          <MenuAction label="Reset Desktop" onClick={resetDesktop} />
        </div>}
      </section>

      <section className="mobile-shell">
        {pathname === "/" ? <MobileHome onOpen={(appId) => router.push(routes[appId] ?? `/${appId}`)} /> : (
          <div className="mobile-app-view">
            <header><button onClick={() => mobileBook ? setMobileBook(null) : router.push("/")}><ArrowLeft /></button><div><span>SYNERGETIC HUMAN</span><strong>{mobileBook?.title ?? appNames[currentApp] ?? "Application"}</strong></div></header>
            <div className="mobile-app-scroll">{mobileBook ? <BookDetail slug={mobileBook.slug} onBack={() => setMobileBook(null)} /> : <AppContent appId={currentApp} onBookOpen={setMobileBook} onOpenApp={(appId) => router.push(routes[appId] ?? `/${appId}`)} />}</div>
          </div>
        )}
      </section>

      <button className="wallpaper-caption" onClick={advanceWallpaper} title="Next wallpaper"><span>●</span> {"derivatives" in currentWallpaper ? ([currentWallpaper.displayPlace || currentWallpaper.visitPlace, currentWallpaper.country].filter(Boolean).join(" · ") || "Along the journey") : `${currentWallpaper.label} · ${currentWallpaper.location}`}<small>{"derivatives" in currentWallpaper ? "From Joe’s selected travel photographs" : currentWallpaper.credit}</small></button>
      <nav ref={dockRef} className="dock" aria-label="Applications" onPointerMove={magnifyDock} onPointerLeave={resetDockTransforms}>
        {apps.map(({ id, label, icon, separated }) => <span className={separated ? "dock-entry dock-entry--separated" : "dock-entry"} key={id}>
          <button className={`dock-item ${openApps.has(id) ? "is-open" : ""} ${minimizedApps.has(id) ? "is-minimized" : ""} ${launchingApp === id ? "is-launching" : ""}`} onClick={() => openApp(id)} aria-label={`${label}${minimizedApps.has(id) ? ", minimized" : ""}`}>
            <span className="dock-label">{label}</span><AppIcon name={icon} /><span className="dock-running" />
          </button>
        </span>)}
      </nav>
      <div className="route-placeholder" aria-hidden="true">{children}</div>
    </main>
  );
}

function WifiGlyph({ strength = "full" }: { strength?: "full" | "weak" }) {
  return <svg className={`wifi-glyph is-${strength}`} viewBox="0 0 18 14" aria-hidden="true"><path className="wifi-outer" d="M1.5 4.8a11.6 11.6 0 0115 0"/><path className="wifi-middle" d="M4.2 7.7a7.4 7.4 0 019.6 0"/><path d="M7.1 10.5a3 3 0 013.8 0"/><circle cx="9" cy="12.2" r=".8"/></svg>;
}

function BatteryGlyph({ level }: { level: number | null }) {
  const width = level === null ? 4 : Math.max(2, Math.min(12, Math.round(level * .12)));
  return <svg viewBox="0 0 18 14" aria-hidden="true"><rect x="1.5" y="3.5" width="13.5" height="7" rx="1.8"/><path d="M16 5.6v2.8"/><rect className="battery-fill" x="3" y="5" width={width} height="4" rx=".7"/></svg>;
}

function ControlGlyph() {
  return <svg viewBox="0 0 18 14" aria-hidden="true"><path d="M2 4h14M2 10h14"/><circle cx="6" cy="4" r="2"/><circle cx="12" cy="10" r="2"/></svg>;
}

function StatusPopover({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="status-popover" onPointerDown={(event) => event.stopPropagation()}><header>{title}</header>{children}</div>;
}

function Currently({ state }: { state: BrainCurrentState }) {
  return <div className="status-content"><span className="eyebrow">CURRENT COORDINATES</span><h1>{state.where.city}</h1><p>{state.where.country}</p><div className="status-rule"/><small>{state.making ? `Making ${state.making}.` : "Current note not set."}</small><div className="coordinate-row"><span>{state.where.coordinates || "Coordinates not set"}</span></div></div>;
}

function Reading({ state, onOpen }: { state: BrainCurrentState; onOpen: () => void }) {
  const linked = state.readingBook;
  return <div className={`reading-card ${linked?.cover ? "reading-card--linked" : "reading-card--unset"}`}>{linked?.cover ? <img className="book-cover" src={linked.cover} alt={`Cover of ${linked.title}`}/> : <div className="reading-library-glyph"><BookOpen /></div>}<div><span className="eyebrow">READING STATE</span><h2>{linked?.title || state.reading || "Not set yet"}</h2><p>{linked?.authors.length ? linked.authors.join(", ") : state.reading ? "Current reading." : "Books are ready in the Library."}</p><button onClick={onOpen}>{linked ? "Open this Book" : "Open Books"} <span>↗</span></button></div></div>;
}

function Thinking({ state }: { state: BrainCurrentState }) {
  const thought = state.currentThought || state.currentQuestion || state.thinking || state.tryingToUnderstand;
  return <><blockquote className="thinking-quote">{thought ? `“${thought}”` : "Current thought not set yet."}</blockquote><div className="thought-meta"><span>{state.rabbitHoles.length ? "CURRENT RABBIT HOLE" : "OPEN CHANNEL"}</span><span>{state.rabbitHoles[0] || "waiting for signal"}</span></div></>;
}

function MobileHome({ onOpen }: { onOpen: (appId: AppId) => void }) {
  return <div className="mobile-home"><div className="mobile-widget-row"><div className="mobile-now"><span className="app-kicker">CURRENTLY</span><h1>Sarajevo</h1><p>22° · clear-ish</p></div><div className="mobile-thought"><span className="app-kicker">THINKING</span><p>What if a website felt like entering someone’s mind mid-thought?</p></div></div><button className="mobile-reading" onClick={() => onOpen("library")}><AppIcon name="books"/><div><span className="app-kicker">BOOKS</span><strong>163 public books</strong><small>Highlights, sources, and connections</small></div></button><div className="mobile-app-grid">{apps.map((app)=><button key={app.id} onClick={()=>onOpen(app.id)}><AppIcon name={app.icon}/><strong>{app.label}</strong></button>)}</div></div>;
}

function SystemMenu({ label, open, onToggle, children }: { label: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return <div className="system-menu"><button className={open ? "is-open" : ""} onPointerDown={(event) => event.stopPropagation()} onClick={onToggle} aria-haspopup="menu" aria-expanded={open}>{label}</button>{open && <div className="menu-popover" role="menu">{children}</div>}</div>;
}

function MenuAction({ label, shortcut, onClick }: { label: string; shortcut?: string; onClick: () => void }) {
  return <button className="menu-action" role="menuitem" onClick={onClick}><span>{label}</span>{shortcut && <kbd>{shortcut}</kbd>}</button>;
}
