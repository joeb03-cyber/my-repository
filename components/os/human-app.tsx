"use client";

import { ArrowLeft, BookOpen, ChevronRight, Compass, Heart, Leaf, Moon, Move, Sparkles, SunMedium, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppItem } from "@/lib/use-app-item";
import localHuman from "@/data/brain/human.v1.json";
import type { AppId } from "@/data/prototype";
import type { HumanEntry, HumanIndex, HumanSectionId } from "@/lib/brain/human-types";
import { simplifyHumanIndex } from "@/lib/brain/human-editorial";

const sectionIcons: Record<HumanSectionId, React.ReactNode> = {
  inner_life: <Heart/>, environment: <SunMedium/>, rhythms_recovery: <Moon/>, movement: <Move/>, food: <Leaf/>, frontiers: <Sparkles/>,
};
const stateLabels = { do_this: "I do this", do_more: "I’d do more of this", believe_matters: "I believe this matters", exploring: "I’m exploring this" } as const;

export default function HumanApp({ onOpenApp }: { onOpenApp: (appId: AppId) => void }) {
  const { requested, select, active } = useAppItem("/laboratory", "entry");
  const [data, setData] = useState<HumanIndex>(simplifyHumanIndex(localHuman as HumanIndex));
  const [loaded, setLoaded] = useState(false);
  const [section, setSection] = useState<HumanSectionId>("inner_life");
  const [selectedSlug, setSelectedSlug] = useState<string>((localHuman as HumanIndex).entries[0]?.slug || "");
  const [mobileDetail, setMobileDetail] = useState(false);
  useEffect(() => { fetch("/api/brain/human").then((response) => response.ok ? response.json() : null).then((value) => { if (value) { setData(simplifyHumanIndex(value)); setLoaded(true); } }).catch(() => {}); }, []);
  useEffect(() => {
    if (!active) return;
    const entry = data.entries.find((item) => item.slug === requested);
    if (entry) { setSection(entry.section); setSelectedSlug(entry.slug); setMobileDetail(true); }
    else if (!requested) setMobileDetail(false);
  }, [requested, data, active]);
  const sectionMeta = data.sections.find((item) => item.id === section)!;
  const entries = useMemo(() => data.entries.filter((entry) => entry.section === section).sort((a,b) => a.sortOrder-b.sortOrder), [data, section]);
  const selected = entries.find((entry) => entry.slug === selectedSlug) || entries[0];
  function chooseSection(id: HumanSectionId) { setSection(id); const first = data.entries.filter((entry) => entry.section === id).sort((a,b)=>a.sortOrder-b.sortOrder)[0]; setSelectedSlug(first?.slug || ""); setMobileDetail(false); select(null); }
  if (loaded && requested && !data.entries.some((entry) => entry.slug === requested)) return <div className="notes-state">This entry is not available.<button onClick={() => select(null)}>Open Human</button></div>;
  return <div className={`human-native system-app ${mobileDetail ? "shows-detail" : "shows-browser"}`}>
    <aside className="human-sidebar">
      <div className="human-sidebar-title"><span className="human-heart-mark"><Heart/></span><span><strong>Human</strong><small>Joe’s operating manual</small></span></div>
      <nav>{data.sections.map((item) => <button key={item.id} className={section === item.id ? "is-selected" : ""} onClick={() => chooseSection(item.id)}>{sectionIcons[item.id]}<span>{item.shortLabel}</span><small>{data.entries.filter((entry) => entry.section === item.id).length}</small></button>)}</nav>
      <section className="human-principles"><strong>OPERATING PRINCIPLES</strong>{data.principles.map((item) => <span key={item}>{item}</span>)}</section>
    </aside>
    <section className="human-browser">
      <header><div><span className="app-kicker">{section === "frontiers" ? "OPEN QUESTIONS" : "CURRENT MANUAL"}</span><h2>{sectionMeta.label}</h2></div><small>{entries.length}</small></header>
      <p className="human-section-description">{sectionMeta.description}</p>
      <div className="human-compact-list">{entries.map((entry) => <button key={entry.slug} className={selected?.slug === entry.slug ? "is-selected" : ""} onClick={() => { setSelectedSlug(entry.slug); setMobileDetail(true); select(entry.slug); }}><span><strong>{entry.title}</strong><small className={`human-state-chip is-${entry.relationshipState}`}>{stateLabels[entry.relationshipState]}</small></span><p>{entry.summary}</p><ChevronRight/></button>)}</div>
    </section>
    {selected && <HumanDetail entry={selected} sectionLabel={sectionMeta.label} onBack={() => { setMobileDetail(false); select(null); }} onOpenApp={onOpenApp}/>}
  </div>;
}

function HumanDetail({ entry, sectionLabel, onBack, onOpenApp }: { entry: HumanEntry; sectionLabel: string; onBack: () => void; onOpenApp: (id: AppId) => void }) {
  const router = useRouter();
  const browserLinks = entry.browserLinks?.filter((link) => !link.label.includes("not published yet")) || [];
  const relationships = entry.relationships.filter((link) => link.entityKind === "book" || link.entityKind === "person" || link.entityKind === "note");
  return <article className="human-detail">
    <header><button className="human-mobile-back" onClick={onBack}><ArrowLeft/> {sectionLabel}</button><span className={`human-state-chip is-${entry.relationshipState}`}>{stateLabels[entry.relationshipState]}</span><small>{entry.entryType}</small></header>
    <div className="human-detail-scroll"><span className="app-kicker">{sectionLabel.toUpperCase()}</span><h1>{entry.title}</h1><p className="human-lede">{entry.summary}</p><section><h3>My current take</h3><p>{entry.currentTake}</p></section>{entry.supportingDetails.length > 0 && <ul>{entry.supportingDetails.map((detail) => <li key={detail}>{detail}</li>)}</ul>}
      {!!browserLinks.length && <section className="human-related human-browser-links"><h3>Follow the rabbit hole</h3>{browserLinks.map((link) => <button key={link.slug} onClick={() => router.push(`/browser/${link.slug}`)}><span><Compass/></span><span><small>{link.label}</small><strong>{link.title}</strong></span><ChevronRight/></button>)}</section>}
      {relationships.length > 0 && <section className="human-related"><h3>Related</h3>{relationships.map((relationship) => <button key={`${relationship.entitySlug}-${relationship.label}`} onClick={() => relationship.entityKind === "book" ? router.push(`/library/${relationship.entitySlug}`) : relationship.entityKind === "note" ? router.push(`/journal?note=${encodeURIComponent(relationship.entitySlug)}`) : router.push(`/contacts?person=${encodeURIComponent(relationship.entitySlug)}`)}><span>{relationship.entityKind === "book" ? <BookOpen/> : <UserRound/>}</span><span><small>{relationship.label}</small><strong>{relationship.entityTitle || relationship.entitySlug}</strong></span><ChevronRight/></button>)}</section>}
    </div>
  </article>;
}
