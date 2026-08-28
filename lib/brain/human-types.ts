export type HumanSectionId = "inner_life" | "environment" | "rhythms_recovery" | "movement" | "food" | "frontiers";
export type HumanRelationshipState = "do_this" | "do_more" | "believe_matters" | "exploring";

export type HumanRelationship = {
  entityId?: string;
  entitySlug: string;
  entityTitle?: string;
  entityKind?: string;
  label: string;
};

export type HumanEntry = {
  id: string;
  slug: string;
  section: HumanSectionId;
  relationshipState: HumanRelationshipState;
  entryType: "principle" | "practice" | "model" | "tool";
  title: string;
  summary: string;
  currentTake: string;
  supportingDetails: string[];
  sortOrder: number;
  relationships: HumanRelationship[];
  browserLinks?: Array<{ slug: string; title: string; label: string }>;
};

export type HumanIndex = {
  schemaVersion: string;
  principles: string[];
  sections: Array<{ id: HumanSectionId; label: string; shortLabel: string; description: string }>;
  entries: HumanEntry[];
};
