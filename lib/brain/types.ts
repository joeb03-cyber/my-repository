export interface BrainTopic {
  slug: string;
  label: string;
  confidence: number;
  editorialState: "suggested" | "approved" | "rejected";
}

export interface BrainCover {
  status: "cached" | "placeholder";
  public_path: string;
  source_url?: string | null;
  provider?: string | null;
  provider_id?: string | null;
  width?: number;
  height?: number;
}

export interface BrainBookSummary {
  id: string;
  slug: string;
  sourcePosition: number;
  title: string;
  originalTitle: string;
  subtitle?: string | null;
  authors: string[];
  topics: BrainTopic[];
  cover: BrainCover;
  highlightCount: number;
  importState: "complete" | "incomplete";
  metadataStatus: string;
  reviewFlagCount: number;
}

export interface BrainContentUnit {
  id: string;
  sourceUnitKey: string;
  ordinal: number;
  text: string;
  kind: string;
  sectionPath: string[];
  locator?: { raw?: string; page?: number | null; location?: number | null } | null;
  standoutRank?: number | null;
  listStyle?: "numbered" | "literal";
  classificationConfidence?: number;
  classificationReason?: string;
  sourceRange?: { paragraph_start: number; paragraph_end: number; body_block_start: number; body_block_end: number; container: string };
  publicEligible?: boolean;
}

export interface BrainPassageGroup {
  id: string;
  ordinal: number;
  kind: "passage" | "structure";
  confidence: number;
  groupingMethod: "structural" | "conservative_rules_v1" | "manual";
  rationale: string;
  units: BrainContentUnit[];
}

export interface BrainBookDetail {
  schemaVersion: string;
  id: string;
  slug: string;
  sourcePosition: number;
  title: string;
  originalTitle: string;
  subtitle?: string | null;
  authors: string[];
  topics: BrainTopic[];
  cover: BrainCover;
  importState: "complete" | "incomplete";
  highlightCount: number;
  standouts: BrainContentUnit[];
  readerUnits: BrainContentUnit[];
  passageGroups: BrainPassageGroup[];
  relatedBooks: BrainBookSummary[];
  links: {
    sourceHighlights?: string | null;
    externalReference?: string | null;
    providerRecord?: string | null;
  };
  review?: {
    metadataStatus: string;
    metadataConfidence: number;
    metadataWarnings: string[];
    candidateMetadata?: Record<string, unknown> | null;
    incomplete?: { state: string; issue_type: string; message: string } | null;
    uncertainUnits: BrainContentUnit[];
    possiblePersonalSummaryCount: number;
    source: Record<string, unknown>;
    sourceVersion: { id?: string | null; hash?: string | null; parserVersion: string };
  };
}

export interface BrainBooksIndex {
  schemaVersion: string;
  bookCount: number;
  generatedFrom: string;
  books: BrainBookSummary[];
}

export type UnitEditorialDecision = {
  kind?: string;
  publicEligible?: boolean;
  standoutRank?: number | null;
  joinWithPrevious?: boolean;
};

export interface BookEditorialDecision {
  title?: string;
  subtitle?: string;
  authors?: string[];
  coverChoice?: "provider" | "placeholder";
  topicSlugs?: string[];
  identityState?: "open" | "resolved";
  incompleteState?: "open" | "acknowledged" | "resolved";
  units?: Record<string, UnitEditorialDecision>;
  updatedAt?: string;
}

export type BrainEditorialDecisions = Record<string, BookEditorialDecision>;
