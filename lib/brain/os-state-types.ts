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

export interface BrainOsState {
  schemaVersion: string;
  softwareUpdate: BrainSoftwareUpdate;
  trash: BrainTrashItem[];
}
