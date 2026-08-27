import type { AppId } from "@/data/prototype";
import { useId } from "react";

export type AppIconName =
  | "finder"
  | "books"
  | "maps"
  | "messages"
  | "notes"
  | "photos"
  | "human"
  | "browser"
  | "settings"
  | "trash"
  | "practice";

export const iconForApp: Partial<Record<AppId, AppIconName>> = {
  finder: "finder",
  library: "books",
  atlas: "maps",
  messages: "messages",
  journal: "notes",
  photos: "photos",
  laboratory: "human",
  browser: "browser",
  about: "settings",
  trash: "trash",
  practice: "practice",
};

export default function AppIcon({ name }: { name: AppIconName }) {
  return <span className={`app-icon app-identity--${name}`} aria-hidden="true"><IconArtwork name={name} /></span>;
}

function IconArtwork({ name }: { name: AppIconName }) {
  const id = useId().replace(/:/g, "");
  if (name === "finder") return <FinderIcon id={id} />;
  if (name === "books") return <BooksIcon id={id} />;
  if (name === "maps") return <MapsIcon id={id} />;
  if (name === "messages") return <MessagesIcon id={id} />;
  if (name === "notes") return <NotesIcon id={id} />;
  if (name === "photos") return <PhotosIcon id={id} />;
  if (name === "human") return <HumanIcon id={id} />;
  if (name === "browser") return <BrowserIcon id={id} />;
  if (name === "settings") return <SettingsIcon id={id} />;
  if (name === "trash") return <TrashIcon id={id} />;
  return <PracticeIcon id={id} />;
}

const IconSvg = ({ children }: { children: React.ReactNode }) => <svg className="native-icon-artwork" viewBox="0 0 64 64" role="presentation">{children}</svg>;

function FinderIcon({ id }: { id: string }) {
  return <IconSvg>
    <defs>
      <linearGradient id={`${id}-bg`} x1="8" y1="5" x2="55" y2="59"><stop stopColor="#b7f2ee"/><stop offset=".46" stopColor="#69cbd9"/><stop offset="1" stopColor="#4089d1"/></linearGradient>
      <linearGradient id={`${id}-right`} x1="35" y1="2" x2="47" y2="62"><stop stopColor="#7fc7f3"/><stop offset="1" stopColor="#4d75d5"/></linearGradient>
      <radialGradient id={`${id}-glow`} cx="0" cy="0" r="1" gradientTransform="translate(18 9) rotate(56) scale(34 31)"><stop stopColor="white" stopOpacity=".72"/><stop offset="1" stopColor="white" stopOpacity="0"/></radialGradient>
    </defs>
    <rect width="64" height="64" rx="14" fill={`url(#${id}-bg)`}/>
    <path d="M32 0h18c7.7 0 14 6.3 14 14v36c0 7.7-6.3 14-14 14H32z" fill={`url(#${id}-right)`}/>
    <rect width="64" height="64" rx="14" fill={`url(#${id}-glow)`}/>
    <path className="v-line finder-seam" d="M32 4c-.2 10.8-2.9 18.6-7.6 24.6"/>
    <path className="v-line finder-face" d="M16.7 25.2c1.5-1.5 3.2-2.2 5.2-2.2M41.7 23c2.1 0 3.9.8 5.4 2.3M18 39.1c3.6 4 8.3 6 14.1 6 5.6 0 10.2-1.9 13.8-5.8"/>
    <ellipse cx="21" cy="29.5" rx="1.35" ry="1.75" fill="#173b61"/><ellipse cx="43" cy="29.5" rx="1.35" ry="1.75" fill="#173b61"/>
    <path d="M0 50c18 7 43 7.5 64-.6V64H0z" fill="#164d87" opacity=".09"/>
  </IconSvg>;
}

function BooksIcon({ id }: { id: string }) {
  return <IconSvg>
    <defs>
      <linearGradient id={`${id}-bg`} x1="8" y1="3" x2="55" y2="61"><stop stopColor="#ffbc55"/><stop offset=".48" stopColor="#f47c36"/><stop offset="1" stopColor="#d84932"/></linearGradient>
      <linearGradient id={`${id}-paper`} x1="18" y1="13" x2="33" y2="53"><stop stopColor="#fff"/><stop offset="1" stopColor="#f3ede4"/></linearGradient>
      <filter id={`${id}-shadow`}><feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#8b271a" floodOpacity=".32"/></filter>
    </defs>
    <rect width="64" height="64" rx="14" fill={`url(#${id}-bg)`}/>
    <path d="M0 0h64v21C48 11 17 17 0 8z" fill="white" opacity=".13"/>
    <g filter={`url(#${id}-shadow)`}>
      <path d="M9.5 16.2c7.6-2.6 15.2-1.3 22.5 4.3v32.2c-7.1-5.2-14.6-6.7-22.5-4.1z" fill={`url(#${id}-paper)`}/>
      <path d="M54.5 16.2c-7.6-2.6-15.2-1.3-22.5 4.3v32.2c7.1-5.2 14.6-6.7 22.5-4.1z" fill="#fffaf1"/>
      <path d="M12.7 20.3c6.5-1.5 12-.3 16.5 3.3v23.9c-4.6-2.9-10.1-4.1-16.5-3" fill="none" stroke="#ddcfc0" strokeWidth="1"/>
      <path d="M51.3 20.3c-6.5-1.5-12-.3-16.5 3.3v23.9c4.6-2.9 10.1-4.1 16.5-3" fill="none" stroke="#ddcfc0" strokeWidth="1"/>
      <path d="M32 20.5v32.2" stroke="#c9a990" strokeWidth="1.2"/>
    </g>
  </IconSvg>;
}

function MapsIcon({ id }: { id: string }) {
  return <IconSvg>
    <defs>
      <linearGradient id={`${id}-paper`} x1="8" y1="4" x2="57" y2="62"><stop stopColor="#f6f3dc"/><stop offset="1" stopColor="#dce8da"/></linearGradient>
      <linearGradient id={`${id}-water`} x1="18" y1="0" x2="42" y2="64"><stop stopColor="#a8e6f6"/><stop offset="1" stopColor="#52afd7"/></linearGradient>
      <filter id={`${id}-shadow`}><feDropShadow dx="0" dy="2" stdDeviation="1.8" floodColor="#4a2522" floodOpacity=".35"/></filter>
    </defs>
    <rect width="64" height="64" rx="14" fill={`url(#${id}-paper)`}/>
    <path d="M-7 54C7 38 19 38 28 28 37 18 43 4 49-6l14 1c-9 18-13 33-23 45-10 12-22 16-29 30z" fill={`url(#${id}-water)`}/>
    <path d="M0 3h23v19c-8 2-15 7-23 12zM43 0h21v26c-7-3-14-4-21-3zM0 47c10-8 20-11 30-9v26H14C6.3 64 0 57.7 0 50z" fill="#8fd289" opacity=".9"/>
    <path className="v-line maps-road" d="M-3 17c12 4 19 10 27 21s19 14 43 8M19-4c3 14 11 23 26 28 9 3 15 7 22 15M-3 45c14-2 25-8 33-19C38 15 43 5 46-3"/>
    <path className="v-line maps-highway" d="M-1 18c13 4 21 11 29 22 7 9 18 11 38 7"/>
    <path className="v-line maps-route" d="M7 50c7-15 17-17 28-13 7 2 11-3 16-12"/>
    <g filter={`url(#${id}-shadow)`}><path d="M50 12c-6.3 0-11.3 4.9-11.3 11 0 8.4 11.3 18.4 11.3 18.4S61.3 31.5 61.3 23c0-6.1-5-11-11.3-11z" fill="#ef4e4d"/><circle cx="50" cy="23" r="4.4" fill="white"/></g>
  </IconSvg>;
}

function MessagesIcon({ id }: { id: string }) {
  return <IconSvg>
    <defs>
      <linearGradient id={`${id}-bg`} x1="10" y1="2" x2="53" y2="63"><stop stopColor="#72f59b"/><stop offset=".46" stopColor="#2ed66f"/><stop offset="1" stopColor="#0aa44f"/></linearGradient>
      <radialGradient id={`${id}-shine`} cx="0" cy="0" r="1" gradientTransform="translate(17 7) rotate(55) scale(41)"><stop stopColor="white" stopOpacity=".62"/><stop offset="1" stopColor="white" stopOpacity="0"/></radialGradient>
      <filter id={`${id}-shadow`}><feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#076b36" floodOpacity=".26"/></filter>
    </defs>
    <rect width="64" height="64" rx="14" fill={`url(#${id}-bg)`}/>
    <rect width="64" height="64" rx="14" fill={`url(#${id}-shine)`}/>
    <g filter={`url(#${id}-shadow)`}><path d="M32 13.2c-14 0-25.3 8.4-25.3 18.8 0 6 3.7 11.2 9.5 14.7l-2.6 8.1 10.5-4.8c2.5.6 5.2.9 7.9.9 14 0 25.3-8.4 25.3-18.9S46 13.2 32 13.2z" fill="white"/></g>
    <path d="M14.5 21.3c7.5-6.6 24.4-8.6 35.7-1.1" fill="none" stroke="white" strokeOpacity=".58" strokeWidth="1.2"/>
  </IconSvg>;
}

function NotesIcon({ id }: { id: string }) {
  return <IconSvg>
    <defs>
      <linearGradient id={`${id}-paper`} x1="10" y1="4" x2="52" y2="62"><stop stopColor="#fffef8"/><stop offset="1" stopColor="#ecebe4"/></linearGradient>
      <linearGradient id={`${id}-cap`} x1="0" y1="0" x2="0" y2="19"><stop stopColor="#ffe86c"/><stop offset="1" stopColor="#f4c633"/></linearGradient>
    </defs>
    <rect width="64" height="64" rx="14" fill={`url(#${id}-paper)`}/>
    <path d="M0 0h64v18H0z" fill={`url(#${id}-cap)`}/>
    <path d="M0 17.5h64" stroke="#cda92d" strokeOpacity=".45" strokeWidth="1"/>
    <g stroke="#b9b9b4" strokeOpacity=".68" strokeWidth="1"><path d="M11 28.5h42M11 36h42M11 43.5h35M11 51h28"/></g>
    <path d="M8 0v64" stroke="white" strokeOpacity=".45"/>
    <path d="M0 0h64v7C43 3 23 7 0 3z" fill="white" opacity=".18"/>
  </IconSvg>;
}

function PhotosIcon({ id }: { id: string }) {
  const petals = [
    ["#f6cf35", 0], ["#f08c31", 45], ["#ec4e57", 90], ["#d84e9d", 135],
    ["#7763d9", 180], ["#3c9ee8", 225], ["#32c1bd", 270], ["#65c45a", 315],
  ] as const;
  return <IconSvg>
    <defs><radialGradient id={`${id}-bg`}><stop stopColor="#fff"/><stop offset="1" stopColor="#e9ebef"/></radialGradient><filter id={`${id}-depth`}><feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#51545a" floodOpacity=".2"/></filter></defs>
    <rect width="64" height="64" rx="14" fill={`url(#${id}-bg)`}/>
    <g filter={`url(#${id}-depth)`}>{petals.map(([color, angle]) => <ellipse key={angle} cx="32" cy="17" rx="8.3" ry="14" fill={color} fillOpacity=".84" transform={`rotate(${angle} 32 32)`}/>)}</g>
    <circle cx="32" cy="32" r="8.1" fill="white" fillOpacity=".94"/><circle cx="32" cy="32" r="3.2" fill="#fff"/>
    <path d="M4 4h56" stroke="white" strokeOpacity=".7"/>
  </IconSvg>;
}

function HumanIcon({ id }: { id: string }) {
  return <IconSvg>
    <defs><linearGradient id={`${id}-bg`} x1="9" y1="2" x2="55" y2="63"><stop stopColor="#ff9e91"/><stop offset=".45" stopColor="#ed5579"/><stop offset="1" stopColor="#9147a3"/></linearGradient><radialGradient id={`${id}-aura`}><stop stopColor="#ffd8bc" stopOpacity=".78"/><stop offset="1" stopColor="#ffd8bc" stopOpacity="0"/></radialGradient></defs>
    <rect width="64" height="64" rx="14" fill={`url(#${id}-bg)`}/>
    <circle cx="32" cy="31" r="25" fill={`url(#${id}-aura)`} opacity=".45"/>
    <circle cx="32" cy="14.7" r="5.3" fill="white" fillOpacity=".95"/>
    <path d="M25.7 23.2c1.8-2.4 3.9-3.6 6.3-3.6s4.5 1.2 6.3 3.6l5.7 11.2-5 2.4-3-6.1v19.8h-8V30.7l-3 6.1-5-2.4z" fill="white" fillOpacity=".94"/>
    <path className="v-line human-pulse-new" d="M18 34h9l2.5-5.2 4.4 11 3-5.8H46"/>
    <circle cx="32" cy="32" r="20.5" fill="none" stroke="white" strokeOpacity=".2"/>
  </IconSvg>;
}

function BrowserIcon({ id }: { id: string }) {
  return <IconSvg>
    <defs><linearGradient id={`${id}-bg`} x1="7" y1="2" x2="55" y2="62"><stop stopColor="#5dd7ed"/><stop offset=".46" stopColor="#1b8bd4"/><stop offset="1" stopColor="#3852b9"/></linearGradient><linearGradient id={`${id}-metal`} x1="12" y1="8" x2="51" y2="57"><stop stopColor="#fff"/><stop offset=".45" stopColor="#cbdbe4"/><stop offset="1" stopColor="#748b9b"/></linearGradient><filter id={`${id}-shadow`}><feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#143c73" floodOpacity=".4"/></filter></defs>
    <rect width="64" height="64" rx="14" fill={`url(#${id}-bg)`}/>
    <g filter={`url(#${id}-shadow)`}><circle cx="32" cy="32" r="23" fill={`url(#${id}-metal)`}/><circle cx="32" cy="32" r="19.8" fill="#167ec8"/></g>
    <g fill="none" stroke="white" strokeOpacity=".3" strokeWidth=".8"><circle cx="32" cy="32" r="14.5"/><path d="M12.5 32h39M32 12.5v39M18.3 18.3l27.4 27.4M45.7 18.3L18.3 45.7"/></g>
    <path d="M38.1 22.7l-3.4 11.9-11.8 6.8 4.8-12.2z" fill="#f05b57"/><path d="M25.9 41.3l3.4-11.9 11.8-6.8-4.8 12.2z" fill="white"/><circle cx="32" cy="32" r="2.3" fill="#f6f8fa" stroke="#38536b" strokeWidth=".8"/>
  </IconSvg>;
}

function SettingsIcon({ id }: { id: string }) {
  const teeth = Array.from({ length: 8 }, (_, index) => index * 45);
  return <IconSvg>
    <defs><linearGradient id={`${id}-bg`} x1="8" y1="3" x2="56" y2="62"><stop stopColor="#c7d0d6"/><stop offset=".5" stopColor="#778891"/><stop offset="1" stopColor="#43515b"/></linearGradient><linearGradient id={`${id}-metal`} x1="19" y1="14" x2="46" y2="50"><stop stopColor="#f4f7f8"/><stop offset=".45" stopColor="#a8b4ba"/><stop offset="1" stopColor="#65747d"/></linearGradient><filter id={`${id}-shadow`}><feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#1e2b32" floodOpacity=".4"/></filter></defs>
    <rect width="64" height="64" rx="14" fill={`url(#${id}-bg)`}/>
    <circle cx="32" cy="32" r="25" fill="none" stroke="white" strokeOpacity=".16"/>
    <g filter={`url(#${id}-shadow)`}>{teeth.map((angle) => <rect key={angle} x="28.4" y="7" width="7.2" height="13" rx="2.2" fill={`url(#${id}-metal)`} transform={`rotate(${angle} 32 32)`}/>)}</g>
    <circle cx="32" cy="32" r="17.5" fill={`url(#${id}-metal)`}/><circle cx="32" cy="32" r="10.4" fill="#52616a" stroke="#e0e6e9" strokeWidth="2"/><circle cx="32" cy="32" r="4.8" fill="#bdc8cd"/><path d="M19.5 19.5c7-7 18-7.3 25.1-.8" fill="none" stroke="white" strokeOpacity=".5" strokeWidth="1.2"/>
  </IconSvg>;
}

function TrashIcon({ id }: { id: string }) {
  return <IconSvg>
    <defs><linearGradient id={`${id}-bg`} x1="8" y1="1" x2="52" y2="63"><stop stopColor="#fff"/><stop offset="1" stopColor="#c9dce4"/></linearGradient><linearGradient id={`${id}-bin`} x1="18" y1="18" x2="45" y2="59"><stop stopColor="#f8fdff" stopOpacity=".9"/><stop offset="1" stopColor="#9ec3d1" stopOpacity=".78"/></linearGradient><filter id={`${id}-shadow`}><feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#314b57" floodOpacity=".28"/></filter></defs>
    <rect width="64" height="64" rx="14" fill={`url(#${id}-bg)`}/>
    <g filter={`url(#${id}-shadow)`}><path d="M18 20.5h28l-2.6 36H20.6z" fill={`url(#${id}-bin)`} stroke="#789eaf" strokeWidth="1.2"/><path d="M15.5 17.5h33" stroke="#587b8b" strokeWidth="3" strokeLinecap="round"/><path d="M25 13.5h14" stroke="#587b8b" strokeWidth="3" strokeLinecap="round"/></g>
    <g stroke="#7399aa" strokeWidth="1.2" opacity=".85"><path d="M25 25l.8 25M32 25v25M39 25l-.8 25"/></g>
    <path d="M21 8.5l7 7 5-8 8 8" fill="#f0b45d" stroke="#ba7340" strokeWidth="1"/>
  </IconSvg>;
}

function PracticeIcon({ id }: { id: string }) {
  return <IconSvg>
    <defs><linearGradient id={`${id}-bg`} x1="8" y1="2" x2="55" y2="63"><stop stopColor="#efcd71"/><stop offset="1" stopColor="#9c7131"/></linearGradient></defs>
    <rect width="64" height="64" rx="14" fill={`url(#${id}-bg)`}/><circle cx="32" cy="32" r="21" fill="none" stroke="white" strokeOpacity=".48"/>
    <path d="M32 17c-7 7.7-10.5 14-10.5 19.2A10.5 10.5 0 0032 46.7a10.5 10.5 0 0010.5-10.5C42.5 31 39 24.7 32 17z" fill="white" fillOpacity=".88"/>
  </IconSvg>;
}
