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
  "odette-march": "Odette March",
  "iris-hale": "Iris Hale",
  "tomas-berg": "Tomas Berg",
  "petra-lang": "Petra Lang",
  maya: "Maya",
  troy: "Troy",
  jules: "Jules",
  "mr-del": "Mr. Del",
  zoe: "Zoe",
  "kai-okonkwo": "Kai Okonkwo",
  "blake-mercer": "Blake Mercer",
  "amy-chen": "Amy Chen",
  "riley-cho": "Riley Cho",
  "dana-ruiz": "Dana Ruiz",
  "marcus-bell": "Marcus Bell",
  "cole-grant": "Cole Grant",
  "priya-shah": "Priya Shah",
  "jordan-lee": "Jordan Lee",
  "noah-kim": "Noah Kim",
  "constable-hale": "Constable Hale",
  "dr-vesper": "Dr. Vesper",
  "miles-crowe": "Miles Crowe",
  "lottie-kane": "Lottie Kane",
  "lady-evelyn": "Lady Evelyn Ashcombe",
  "ren-sato": "Dr. Ren Sato",
  "mara-quinn": "Mara Quinn",
  "theo-strand": "Theo Strand",
  "pix-harlan": "Pix Harlan",
  "ada-crane": "Ada Crane",
  "bram-holt": "Bram Holt",
  "dr-silas-more": "Dr. Silas More",
  "june-pell": "June Pell",
  "eli-voss": "Eli Voss",
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
  "great-room": "Lodge great room",
  study: "Lucien's study",
  kitchen: "Kitchen and stores",
  "upstairs-hall": "Upstairs guest hall",
  "petra-room": "Petra's guest room",
  "front-porch": "Rick's front porch",
  "skate-park": "Neighborhood skate park",
  "del-shop": "Del's shop",
  alley: "Side alley and garage",
  "studio-floor": "Studio B floor",
  "control-booth": "Control booth",
  "green-room": "Green room",
  "server-closet": "Server closet",
  boardroom: "Boardroom",
  balcony: "Executive balcony",
  anteroom: "Anteroom",
  "ava-office": "Ava's office",
  "morgue-room": "Parish morgue",
  "print-shop": "Kane Print",
  lodging: "Ashcombe's private lodging",
  hub: "Central hub",
  ops: "Operations deck",
  medbay: "Medbay",
  lab: "Bio lab",
  engineering: "Engineering ring",
  "white-room": "The white room",
  corridor: "East corridor",
  "ward-office": "Ward office",
  "day-room": "Day room",
  "east-wing": "East wing — treatment hall",
};

export const CASE_TITLES: Record<string, string> = {
  "blackwood-inheritance": "The Blackwood Inheritance",
  "pier-at-low-tide": "The Pier at Low Tide",
  "snowbound-lodge": "The Snowbound Lodge",
  "cant-trick-rick": "Can't Trick Rick: The Case of the Stolen Skateboard",
  "last-broadcast": "The Last Broadcast",
  "hostile-takeover": "Hostile Takeover",
  "london-1888": "London, 1888",
  "dead-air": "Dead Air",
  "the-white-room": "The White Room",
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

export const EVIDENCE_DESCRIPTIONS_SHELF: Record<
  string,
  { name: string; description: string }
> = {
  "poisoned-glass": {
    name: "Poisoned brandy glass",
    description: "Bitter almond note under brandy; poison delivery.",
  },
  "debt-ledger": {
    name: "Debt ledger page",
    description: "Petra Lang owes Voss; note 'due — or public'.",
  },
  "spare-key": {
    name: "Study spare key",
    description: "Found in upstairs linen; explains the locked room.",
  },
  "teal-scuff": {
    name: "Teal paint scuff",
    description: "Nightwing's grip color on the rack bar.",
  },
  "silver-bolt": {
    name: "Silver bolt",
    description: "Cheap bolt from the rack; not Maya's hardware.",
  },
  "bolt-receipt": {
    name: "Bolt pack receipt",
    description: "12:40 cash sale, green-hoodie buyer.",
  },
  "hidden-board": {
    name: "Hidden skateboard",
    description: "Nightwing under a tarp in the alley garage.",
  },
  "cable-marks": {
    name: "Cable marks",
    description: "Headphone cable abrasion consistent with strangulation.",
  },
  "backup-recorder": {
    name: "Backup recorder",
    description: "Secondary audio that survived the main wipe.",
  },
  "stolen-outline": {
    name: "Stolen episode outline",
    description: "Lena's exposé draft on Blake leaking a source.",
  },
  "usb-confrontation": {
    name: "USB confrontation",
    description: "Hidden USB of the booth confrontation.",
  },
  "struggle-marks": {
    name: "Balcony struggle marks",
    description: "Scuffs on the rail where Ava fought before the fall.",
  },
  "ava-threat-message": {
    name: "Ava's threat message",
    description: "Draft threatening to expose Cole's short positions.",
  },
  "monogram-glove": {
    name: "Monogram glove",
    description: "Glove snagged on the balcony rail — Cole's monogram.",
  },
  "short-term-sheet": {
    name: "Short-term sheet",
    description: "Shell companies shorting the merger.",
  },
  "cufflink-mc": {
    name: "Monogrammed cufflink M.C.",
    description: "Found in the dead palm — Crowe monogram.",
  },
  "wound-notes": {
    name: "Wound examination notes",
    description: "Single professional stab; not Ripper pattern.",
  },
  "scandal-proof": {
    name: "Stopped press proof",
    description: "Dock-shares exposé with Crowe's threat in the margin.",
  },
  "share-ledger": {
    name: "Dock shares ledger",
    description: "Illegal options; Crowe countersigns.",
  },
  "torque-imprint": {
    name: "Torque key imprint",
    description: "Weapon signature on Voss's skull.",
  },
  "collar-marks": {
    name: "Suit collar asphyxia marks",
    description: "Staged vacuum death after blunt force.",
  },
  "sample-theft-log": {
    name: "JO-17 vault log",
    description: "Quinn biometrics around the murder window.",
  },
  "airlock-log": {
    name: "Airlock cycle log",
    description: "Quinn token cycled outer boom airlock at 02:11.",
  },
  "torque-key": {
    name: "Bloody torque key",
    description: "Engineering key racked wrong; blood in the grip.",
  },
  "forged-file": {
    name: "Forged Patient 14 file",
    description: "Fresh ink 'C. Reed' story over a real identity.",
  },
  "true-intake": {
    name: "True intake — Cassandra Vale",
    description: "You are Cassandra Vale, PI, chemically restrained.",
  },
  "marrow-body-notes": {
    name: "Marrow death notes",
    description: "Helen Marrow murdered in restraint chair.",
  },
  "broken-syringe": {
    name: "Broken syringe",
    description: "Lethal injection tool with More's clinic stamp.",
  },
};

// Merge extra case evidence into the shared map used by the play UI
Object.assign(EVIDENCE_DESCRIPTIONS, EVIDENCE_DESCRIPTIONS_PIER);
Object.assign(EVIDENCE_DESCRIPTIONS, EVIDENCE_DESCRIPTIONS_SHELF);
