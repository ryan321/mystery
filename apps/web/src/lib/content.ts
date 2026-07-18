export const CHARACTER_NAMES: Record<string, string> = {
  henshaw: "Butler Henshaw",
  vale: "Mr. Vale",
  "mrs-blackwood": "Mrs. Blackwood",
  clara: "Miss Clara Blackwood",
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
};

export const CASE_TITLES: Record<string, string> = {
  "blackwood-inheritance": "The Blackwood Inheritance",
};
