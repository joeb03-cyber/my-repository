import type { BookEditorialDecision, BrainBookDetail, BrainBookSummary, BrainContentUnit, BrainEditorialDecisions, BrainPassageGroup, BrainTopic } from "./types";

export const EDITORIAL_STORAGE_KEY = "synergetic-human-brain-editorial-v1";

export function loadEditorialDecisions(): BrainEditorialDecisions {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(EDITORIAL_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

export function saveEditorialDecision(slug: string, decision: BookEditorialDecision): BrainEditorialDecisions {
  const current = loadEditorialDecisions();
  const next = { ...current, [slug]: { ...decision, updatedAt: new Date().toISOString() } };
  window.localStorage.setItem(EDITORIAL_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("brain-editorial-change", { detail: { slug } }));
  return next;
}

export function applySummaryDecision(book: BrainBookSummary, decision?: BookEditorialDecision): BrainBookSummary {
  if (!decision) return book;
  const topics = decision.topicSlugs ? book.topics.filter((topic) => decision.topicSlugs?.includes(topic.slug)) : book.topics;
  return {
    ...book,
    title: decision.title?.trim() || book.title,
    subtitle: decision.subtitle === undefined ? book.subtitle : decision.subtitle,
    authors: decision.authors?.filter(Boolean).length ? decision.authors.filter(Boolean) : book.authors,
    cover: decision.coverChoice === "placeholder" ? { status: "placeholder", public_path: "/book-covers/placeholder.svg" } : book.cover,
    topics,
  };
}

export function applyDetailDecision(book: BrainBookDetail, decision?: BookEditorialDecision, allTopics: BrainTopic[] = []): BrainBookDetail {
  if (!decision) return book;
  const unitDecisions = decision.units || {};
  const knownUnits = new Map(book.readerUnits.map((unit) => [unit.sourceUnitKey, unit]));
  for (const unit of book.review?.uncertainUnits || []) {
    if (!knownUnits.has(unit.sourceUnitKey)) knownUnits.set(unit.sourceUnitKey, unit);
  }
  const readerUnits = Array.from(knownUnits.values()).map((unit) => {
    const edit = unitDecisions[unit.sourceUnitKey];
    return edit ? { ...unit, kind: edit.kind || unit.kind, publicEligible: edit.publicEligible ?? unit.publicEligible, standoutRank: edit.standoutRank ?? null } : unit;
  }).filter((unit) => {
    const edit = unitDecisions[unit.sourceUnitKey];
    if (edit?.publicEligible === false) return false;
    if (unit.kind === "possible_personal_summary" && edit?.publicEligible !== true) return false;
    return ["chapter_label", "section_label", "highlight", "summary", "note", "list_item", "exercise"].includes(edit?.kind || unit.kind);
  }).sort((left, right) => left.ordinal - right.ordinal);
  const standouts = readerUnits.filter((unit) => unit.standoutRank).sort((left, right) => (left.standoutRank || 0) - (right.standoutRank || 0));
  const passageGroups = applyGroupingDecisions(book.passageGroups || [], readerUnits, unitDecisions);
  const topics = decision.topicSlugs ? allTopics.filter((topic) => decision.topicSlugs?.includes(topic.slug)) : book.topics;
  return {
    ...book,
    title: decision.title?.trim() || book.title,
    subtitle: decision.subtitle === undefined ? book.subtitle : decision.subtitle,
    authors: decision.authors?.filter(Boolean).length ? decision.authors.filter(Boolean) : book.authors,
    cover: decision.coverChoice === "placeholder" ? { status: "placeholder", public_path: "/book-covers/placeholder.svg" } : book.cover,
    topics,
    readerUnits,
    passageGroups,
    standouts,
    highlightCount: readerUnits.filter((unit) => ["highlight", "summary", "note", "list_item", "exercise"].includes(unit.kind)).length,
  };
}

function applyGroupingDecisions(defaultGroups: BrainPassageGroup[], readerUnits: BrainContentUnit[], unitDecisions: NonNullable<BookEditorialDecision["units"]>): BrainPassageGroup[] {
  const defaultJoin = new Map<string, boolean>();
  for (const group of defaultGroups) group.units.forEach((unit, index) => defaultJoin.set(unit.sourceUnitKey, index > 0));
  const structureKinds = new Set(["chapter_label", "section_label"]);
  const groups: BrainPassageGroup[] = [];
  let current: BrainPassageGroup | null = null;
  for (const unit of readerUnits) {
    const isStructure = structureKinds.has(unit.kind);
    const requestedJoin = unitDecisions[unit.sourceUnitKey]?.joinWithPrevious ?? defaultJoin.get(unit.sourceUnitKey) ?? false;
    const join = Boolean(current && !isStructure && current.kind === "passage" && requestedJoin);
    if (join && current) {
      current.units.push(unit);
      current.groupingMethod = unitDecisions[unit.sourceUnitKey]?.joinWithPrevious === undefined ? current.groupingMethod : "manual";
      if (current.groupingMethod === "manual") current.rationale = "Local editorial grouping decision";
      continue;
    }
    const original = defaultGroups.find((group) => group.units[0]?.sourceUnitKey === unit.sourceUnitKey);
    current = {
      id: original?.id || `local-passage-${unit.sourceUnitKey}`,
      ordinal: groups.length + 1,
      kind: isStructure ? "structure" : "passage",
      confidence: original?.confidence ?? 1,
      groupingMethod: original?.groupingMethod || (isStructure ? "structural" : "manual"),
      rationale: original?.rationale || (isStructure ? "Structural label" : "Local editorial boundary"),
      units: [unit],
    };
    groups.push(current);
  }
  return groups;
}

export function exportEditorialDecisions(decisions: BrainEditorialDecisions) {
  const blob = new Blob([JSON.stringify({ schemaVersion: "brain-editorial-decisions.v1", exportedAt: new Date().toISOString(), decisions }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "synergetic-brain-editorial-decisions.v1.json";
  anchor.click();
  URL.revokeObjectURL(url);
}
