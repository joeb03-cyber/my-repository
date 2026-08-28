export type RabbitHoleStatus = "open" | "paused" | "closed";
export type RabbitHoleBlockType = "narrative" | "experience" | "question" | "list" | "quote";
export type RabbitHolePublicationState = "draft" | "published";

export type RabbitHoleBlock = {
  id: string;
  type: RabbitHoleBlockType;
  heading: string;
  body: string;
  items: string[];
  sortOrder: number;
};

export type RabbitHoleResource = {
  id: string;
  title: string;
  url: string;
  resourceType: "book" | "paper" | "article" | "podcast" | "video" | "website";
  note: string;
  publicRole: "start_here" | "keep_going" | "context";
  evidenceLayer: "experience" | "practice" | "model" | "mechanism" | "experimental" | "review";
  sortOrder: number;
};

export type RabbitHoleEntityLink = {
  entityId?: string;
  entitySlug: string;
  entityTitle: string;
  entityKind: "book" | "person" | "source" | "note";
  label: string;
  publicRole: "person" | "book" | "source" | "note" | "keep_going";
  sortOrder: number;
};

export type RabbitHoleTrailLink = {
  slug: string;
  title: string;
  label: string;
  publicationState: RabbitHolePublicationState;
  sortOrder: number;
};

export type RabbitHoleHumanLink = {
  humanEntryId?: string;
  humanEntrySlug: string;
  humanEntryTitle: string;
  browserLabel: string;
  humanLabel: string;
  sortOrder: number;
};

export type RabbitHole = {
  id: string;
  slug: string;
  title: string;
  centralQuestion: string;
  shortIntro: string;
  currentTake: string;
  status: RabbitHoleStatus;
  accent: "ember" | "sun" | "violet" | "ocean" | "moss";
  sortOrder: number;
  publicationState: RabbitHolePublicationState;
  blocks: RabbitHoleBlock[];
  resources: RabbitHoleResource[];
  entities: RabbitHoleEntityLink[];
  related: RabbitHoleTrailLink[];
  humanLinks: RabbitHoleHumanLink[];
};

export type BrowserIndex = {
  schemaVersion: string;
  title: string;
  description: string;
  currentReading: { title: string; note: string } | null;
  rabbitHoles: RabbitHole[];
};
