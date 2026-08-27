export interface BrainPersonTopic {
  slug: string;
  label: string;
  editorialState: "suggested" | "approved";
}

export interface BrainPersonBook {
  id: string;
  slug: string;
  title: string;
  originalAuthor?: string | null;
  coverPath?: string | null;
}

export interface BrainPodcastAppearance {
  id: string;
  slug: string;
  title: string;
  showTitle: string;
  role: string;
  publicationDate?: string | null;
  durationSeconds?: number | null;
}

export interface BrainContact {
  id: string;
  slug: string;
  displayName: string;
  sortName?: string | null;
  initials: string;
  factualIdentity?: string | null;
  curatedInterest: true;
  endorsement: false;
  topics: BrainPersonTopic[];
  books: BrainPersonBook[];
  podcastAppearances: BrainPodcastAppearance[];
}

export interface BrainSourceCredit {
  role: "host" | "guest" | "author" | "speaker" | "subject" | "creator";
  name: string;
  personId?: string | null;
}

export interface BrainPodcastEpisode {
  id: string;
  slug: string;
  title: string;
  showTitle: string;
  publicationDate?: string | null;
  durationSeconds?: number | null;
  originalUrl: string;
  publicProvenanceLabel?: string | null;
  credits: BrainSourceCredit[];
}

export interface BrainPeopleSourcesIndex {
  schemaVersion: string;
  generatedFrom: string;
  contactCount: number;
  podcastEpisodeCount: number;
  contacts: BrainContact[];
  podcastEpisodes: BrainPodcastEpisode[];
}
