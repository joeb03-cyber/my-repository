import type { HumanEntry, HumanIndex } from "./human-types";

const browserLinks: Record<string, Array<{ slug: string; title: string; label: string }>> = {
  "light-is-the-main-signal": [{ slug: "light-biology", title: "Light Biology", label: "Explore why I think this" }],
  "make-night-feel-like-night": [{ slug: "light-biology", title: "Light Biology", label: "Follow the research trail" }],
  "a-life-worth-inhabiting": [
    { slug: "trauma-freeze-somatic-work", title: "Trauma, Freeze & Somatic Work", label: "Explore the somatic trail" },
    { slug: "the-biofield", title: "The Biofield", label: "Explore the field-level trail" },
  ],
  "resonance-breathing": [{ slug: "trauma-freeze-somatic-work", title: "Trauma, Freeze & Somatic Work", label: "Why the nervous system matters to me" }],
  "reduce-wireless-exposure": [{ slug: "emf-symptoms-mechanisms", title: "EMF Symptoms, Mechanisms & Exposure", label: "Rabbit hole not published yet" }],
  "psychoemotional-health-is-physical": [
    { slug: "trauma-freeze-somatic-work", title: "Trauma, Freeze & Somatic Work", label: "Follow the experience and models" },
    { slug: "the-biofield", title: "The Biofield", label: "Explore the field-level model" },
  ],
};

function replacementEntries(entries: HumanEntry[]): HumanEntry[] {
  const replacements = new Set(["psychoemotional-health-is-physical", "reduce-wireless-exposure"]);
  const base = entries.filter((entry) => entry.section !== "frontiers" && !replacements.has(entry.slug));
  return [...base,
    {
      id: "human-psychoemotional-physical", slug: "psychoemotional-health-is-physical", section: "inner_life",
      relationshipState: "believe_matters", entryType: "principle", title: "Psychoemotional Health Is Physical",
      summary: "I think the emotional, psychospiritual, and field-level parts of a person can be upstream of what shows up physically.",
      currentTake: "I don't experience mind and body as separate systems. Repressed emotion, chronic stress, meaning, and the structure of a life can all become physical. Somatic and altered-state exploration have sometimes helped me access things that analysis did not. I use that as an operating lens, not a claim that one model explains every symptom.",
      supportingDetails: ["Ask what else was happening when something began.", "Listen to what the body is doing before immediately trying to suppress it.", "Experience and explanation are separate questions."],
      sortOrder: 30, relationships: [],
    },
    {
      id: "human-wireless-precautions", slug: "reduce-wireless-exposure", section: "environment",
      relationshipState: "do_this", entryType: "practice", title: "Reduce Wireless Exposure",
      summary: "I take a few simple EMF precautions without making my life revolve around them.",
      currentTake: "I use airplane mode when my phone is in my pocket and while I sleep, keep devices away from the bed, use wired headphones instead of AirPods, and would hardwire more of my home if I had a permanent one. Distance and timing are easy wins. I care about this, but I don't want to live in fear of an environment I can't completely control.",
      supportingDetails: ["Airplane mode in my pocket and at night.", "Wired headphones and distance from devices.", "A lower-wireless sleep environment when practical."],
      sortOrder: 35, relationships: [],
    },
  ];
}

export function simplifyHumanIndex(index: HumanIndex): HumanIndex {
  return {
    ...index,
    schemaVersion: `${index.schemaVersion}.human-browser-boundary`,
    sections: index.sections.filter((section) => section.id !== "frontiers"),
    entries: replacementEntries(index.entries).map((entry) => ({ ...entry, browserLinks: browserLinks[entry.slug] || [] })),
  };
}
