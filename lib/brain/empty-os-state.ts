import type { BrainOsState } from "./os-state-types";

export const emptyOsState: BrainOsState = {
  schemaVersion: "loading",
  softwareUpdate: { versionLabel: "…", new: [], currentlyExploring: [], performance: [], knownIssues: [] },
  trash: [], activity: [],
};
