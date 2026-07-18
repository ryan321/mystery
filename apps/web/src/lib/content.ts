export const CHARACTER_NAMES: Record<string, string> = {
  henshaw: "Butler Henshaw",
  vale: "Mr. Vale",
  "mrs-blackwood": "Mrs. Blackwood",
  clara: "Miss Clara Blackwood",
  "nell-avery": "Nell Avery",
  "harlan-briggs": "Captain Harlan Briggs",
  "jess-pike": "Jess Pike",
  "miriam-cole": "Dr. Miriam Cole",
  "sam-quinn": "Sam Quinn",
};

export const EVIDENCE_DESCRIPTIONS: Record<
  string,
  { name: string; description: string }
> = {
  "black-thread": {
    name: "Black thread",
    description:
      "A single black thread snagged on the broken vase — matches a dark coat, not staff livery.",
  },
  "muddy-boot-print": {
    name: "Muddy boot-print",
    description:
      "A man's size-eleven wet boot print near the east door, pointing toward the library. Not polished staff shoes.",
  },
  "brass-key": {
    name: "Brass key",
    description: "A small brass key recovered from the library hearth ash.",
  },
  "vale-letter": {
    name: "Vale's letter",
    description:
      "Letter signed by Mr. Vale, dated yesterday: 'If you expose me, I will have no choice.'",
  },
};

export const LOCATION_NAMES: Record<string, string> = {
  "entrance-hall": "Blackwood Manor — the entrance hall",
  library: "Blackwood Manor — the library",
  conservatory: "Blackwood Manor — the conservatory",
  "guest-room": "Blackwood Manor — your guest room",
  "pier-deck": "Coldharbor Pier — the deck",
  "harbormaster-shack": "Harbormaster's shack",
  "fish-shed": "Nell's fish shed",
  "briggs-boat": "The Merrow — Briggs's boat",
  "outer-walk": "Outer walk — fog end",
};

export const CASE_TITLES: Record<string, string> = {
  "blackwood-inheritance": "The Blackwood Inheritance",
  "pier-at-low-tide": "The Pier at Low Tide",
};

export const EVIDENCE_DESCRIPTIONS_PIER: Record<
  string,
  { name: string; description: string }
> = {
  "stopped-watch": {
    name: "Rourke's smashed watch",
    description: "Pocket watch stopped at 4:12.",
  },
  "temple-wound": {
    name: "Temple wound notes",
    description: "Gash consistent with a gaff or heavy hook.",
  },
  "log-scrap": {
    name: "Torn log scrap",
    description: "B. midnight run confirmed. Tell county if he lies again.",
  },
  "bloody-gaff": {
    name: "Bloody gaff",
    description: "Gaff from under a tarp on the Merrow; blood in the iron crease.",
  },
};

// Merge pier evidence into the shared map used by the play UI
Object.assign(EVIDENCE_DESCRIPTIONS, EVIDENCE_DESCRIPTIONS_PIER);
