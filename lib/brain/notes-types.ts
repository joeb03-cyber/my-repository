export type NotePublicationState = "draft" | "published" | "archived";

export interface BrainNoteFolder {
  id: string;
  slug: string;
  label: string;
  sortOrder: number;
}

export interface BrainNote {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  bodyMarkdown: string;
  folderSlug: string;
  folderLabel: string;
  tags: string[];
  pinned: boolean;
  publicationState: NotePublicationState;
  sourcePublishedAt?: string | null;
  publishedAt?: string | null;
  updatedAt: string;
  editorialNotice?: string | null;
  externalLinks: Array<{ label: string; url: string }>;
}

export interface BrainNotesIndex {
  schemaVersion: string;
  generatedFrom: string;
  folders: BrainNoteFolder[];
  notes: BrainNote[];
}

export interface BrainCurrentState {
  schemaVersion: string;
  effectiveAt: string;
  lastConfirmedAt: string;
  where: { city: string; country: string; coordinates?: string | null; timezone?: string | null };
  reading: string | null;
  readingBook?: {
    id: string;
    slug: string;
    title: string;
    authors: string[];
    cover: string | null;
  } | null;
  readingSecondary?: string | null;
  readingBooks?: Array<{
    id: string;
    slug: string;
    title: string;
    authors: string[];
    cover: string | null;
    role: "reading" | "reading_secondary";
  }>;
  thinking: string | null;
  rabbitHoles: string[];
  experiments: string[];
  training: string | null;
  eatingLately: string | null;
  listening: string | null;
  tryingToUnderstand: string | null;
  making: string | null;
  currentQuestion: string | null;
  currentThought: string | null;
  humanBattery: { level: number | null; label: string; note: string | null };
}
