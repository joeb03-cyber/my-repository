export interface BrainSoftwareUpdate {
  versionLabel: string;
  new: string[];
  currentlyExploring: string[];
  performance: string[];
  knownIssues: string[];
}

export interface BrainTrashItem {
  id: string;
  title: string;
  description: string;
  category: string;
  trashedAt?: string | null;
}

export type BrainActivityStatus = "running" | "background" | "sleeping" | "not_responding";

export interface BrainActivityProcess {
  id: string;
  name: string;
  status: BrainActivityStatus;
  detail: string;
  startedLabel?: string | null;
  related: string[];
  sortOrder: number;
}

export interface BrainOsState {
  schemaVersion: string;
  softwareUpdate: BrainSoftwareUpdate;
  trash: BrainTrashItem[];
  activity: BrainActivityProcess[];
}
