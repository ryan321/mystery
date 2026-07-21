export type CaseMeta = {
  title: string;
  premise: string;
  /** Where/when — bookstore setting line. */
  setting?: string;
  /** Longer jacket blurb for the detail page. */
  summary?: string;
  /** Central mystery question the player must answer. */
  theMystery?: string;
  /** Atmosphere theme id from the case definition (see lib/themes.ts). */
  theme?: string;
  tone?: string;
  tags: string[];
  difficulty?: "easy" | "medium" | "hard";
  contentWarnings: string[];
  artStyle?: string;

};

export type CaseSummary = {
  id: string;
  contentVersion: string;
  meta: CaseMeta;
  /** Bundle cover art (API-relative, e.g. "/v1/cases/<id>/assets/cover.jpg"). */
  coverUrl?: string;
};

export type CastMember = {
  id: string;
  name: string;
  shortBio?: string;
  storyRole?: "suspect" | "victim" | "witness" | "support";
  portrait?: string;
  portraitUrl?: string;
};

export type MysteryPlayerInfo = {
  personaId?: string;
  displayName: string;
  fullName?: string;
  addressAs?: string;
  pronouns?: string;
  role: string;
  authority?: "civilian" | "guest" | "professional" | "official";
  gender?: string;
  age?: string;
  appearance?: string;
  clothing?: string;
  background?: string;
  publicPerception?: string;
  objective?: string;
  startingKnowledge?: string;
};

export type CaseDetail = {
  id: string;
  contentVersion: string;
  meta: CaseMeta;
  /** Bundle cover art (API-relative, e.g. "/v1/cases/<id>/assets/cover.jpg"). */
  coverUrl?: string;
  player?: MysteryPlayerInfo;
  cast?: CastMember[];
};

/** Opening dossier shown at the start of play. */
export type MysteryBriefing = {
  setting?: string;
  theMystery?: string;
  /** Atmosphere theme id from the case definition (see lib/themes.ts). */
  theme?: string;
  objective?: string;
  startingKnowledge?: string;
  role?: string;
  displayName?: string;
  addressAs?: string;
  personaId?: string;
  authority?: string;
  appearance?: string;
  age?: string;
  gender?: string;
  background?: string;
  publicPerception?: string;
};

export type DialogueLine = {
  characterId: string;
  characterName: string;
  text: string;
};

export type JustHappened = {
  id: string;
  summary: string;
  narrationHints?: string;
};

export type NotebookEntry = {
  id: string;
  text: string;
  source: "auto" | "player";
  createdAt: string;
};

export type CharacterState = {
  locationId: string;
  available: boolean;
  willingness: "open" | "guarded" | "hostile" | "silent" | "fled";
  pressure: number;
  trust: number;
  stance: string;
  alibiStatus: "claimed" | "broken" | "abandoned" | "none";
  timesTalked: number;
};

export type PlayerStatus = {
  threat: "none" | "watched" | "threatened" | "assaulted";
  /** Bodily state after shock or violence */
  condition?:
    | "unharmed"
    | "shaken"
    | "bruised"
    | "injured"
    | "incapacitated";
  /** Physical control of the body */
  control?: "free" | "held" | "downed" | "restrained" | "unconscious";
  /** Character id holding/restraining the player, if known */
  controlledBy?: string;
  safeHavenCompromised: boolean;
  tags: string[];
  flags: Record<string, string | number | boolean>;
};

export type EnvironmentState = {
  weather: string;
  weatherIntensity?: string;
  light: string;
  ambient?: string;
  crowd: string;
  flags: Record<string, string | number | boolean>;
  activePulses: string[];
};

export type TimeState = {
  slotId: string;
  minutesFromStart: number;
};

export type Ending = {
  id: string;
  when: "success" | "partial" | "failure" | "custom";
  kind?: string;
  title?: string;
  templateNotes?: string;
};

export type Resolution = {
  outcome?: string;
  endingId?: string;
  kind?: string;
  path?: string;
  title?: string;
};

export type Denouement = {
  turnsRemaining: number | null;
  maxTurns: number;
};

export type PlaythroughState = {
  id: string;
  caseId: string;
  contentVersion: string;
  status: "active" | "denouement" | "solved" | "failed" | "abandoned";
  locationId: string;
  evidenceIds: string[];
  flags: Record<string, string | number | boolean>;
  notebook: NotebookEntry[];
  visitedLocationIds: string[];
  turnCount: number;
  phaseId: string;
  endingId?: string;
  ending?: Ending;
  resolution?: Resolution;
  denouement?: Denouement;
  interactive: boolean;
  playerStatus: PlayerStatus;
  playerPersona?: MysteryPlayerInfo & { addressAs?: string };
  clocks: Record<string, number>;
  time?: TimeState;
  environment: EnvironmentState;
  characters: Record<
    string,
    {
      locationId: string;
      willingness: CharacterState["willingness"];
      stance: string;
      pressure: number;
      name?: string;
      portrait?: string;
      portraitUrl?: string;
    }
  >;
  cast?: {
    id: string;
    name: string;
    shortBio?: string;
    portrait?: string;
    portraitUrl?: string;
  }[];
  /** Case default for progress UI */
  progressUi?: "off" | "subtle" | "full";
};

export type TurnLogEntry = {
  turnIndex: number;
  playerInput: string;
  narration: string;
  dialogue: DialogueLine[];
  evidenceAdded: string[];
  createdAt: string;
};

export type ProgressPulse = {
  id: string;
  text: string;
  kind: "evidence" | "unlock" | "depth" | "judgment";
};

export type MysteryProgress = {
  caseMode: "off" | "subtle" | "full";
  depth: "surface" | "deepening" | "closing" | "judgment" | "aftermath";
  depthLabel: string;
  fraction: number;
  /** e.g. "About two-thirds through" */
  throughLabel: string;
  /** e.g. "≈⅔" */
  throughCompact: string;
  criticalHeld: number;
  criticalTotal: number;
  pulses: ProgressPulse[];
};

export type StartCaseResponse = {
  playthrough: PlaythroughState;
  playerView?: PlayerView;
  openingNarration: string;
  briefing?: MysteryBriefing;
  locationName?: string;
  progress?: MysteryProgress;
};

export type GetPlaythroughResponse = {
  playthrough: PlaythroughState;
  playerView?: PlayerView;
  openingNarration?: string;
  briefing?: MysteryBriefing;
  locationName?: string;
  turns: TurnLogEntry[];
  progress?: MysteryProgress;
};

export type SendTurnResponse = {
  narration: string;
  dialogue: DialogueLine[];
  playthrough: PlaythroughState;
  playerView?: PlayerView;
  appliedPatch: unknown;
  rejected: string[];
  evidenceAdded: string[];
  justHappened: JustHappened[];
  locationName?: string;
  progress?: MysteryProgress;
  _debug?: {
    directorModel?: string;
    performerModel?: string;
    directorMock?: boolean;
    performerMock?: boolean;
    intentNotes?: string[];
  };
};

// ── PlayerView (docs/PLAYER_SURFACES.md) ─────────────────────────────────
// Mirror of the engine's leak-safe buildPlayerView projection — the single
// data source for every player surface (scene, map, cast, inventory,
// notebook, dossier). Never carries solution/secret material.

export type StoryRole = "suspect" | "victim" | "witness" | "support";

export type ExitView = {
  toLocationId: string;
  label: string;
  open: boolean;
  destinationKnown: boolean;
};

export type PresentCharacter = {
  id: string;
  knownAs: string;
  storyRole: StoryRole;
  portrait?: string;
};

export type SceneObject = {
  id: string;
  name: string;
  locked: boolean;
};

export type SceneView = {
  locationId: string;
  name: string;
  description: string;
  image?: string;
  exits: ExitView[];
  present: PresentCharacter[];
  objects: SceneObject[];
};

export type CastEntry = {
  id: string;
  knownAs: string;
  nameKnown: boolean;
  storyRole: StoryRole;
  portrait?: string;
  /** Front-matter bio; "" until the name is known. */
  bio: string;
};

export type InventoryEntry = {
  id: string;
  name: string;
  description: string;
  condition: string;
  tags: string[];
};

export type MapLocation = {
  id: string;
  name: string;
  visited: boolean;
  x?: number;
  y?: number;
  floor?: number;
  image?: string;
};

export type MapConnection = {
  from: string;
  to: string;
  open: boolean;
  destinationKnown: boolean;
};

export type MapView = {
  currentLocationId: string;
  locations: MapLocation[];
  connections: MapConnection[];
};

export type OpeningPackage = {
  form: "dossier" | "letter" | "telegram" | "invitation" | "memory" | "custom";
  title?: string;
  sections: { heading: string; text: string }[];
};

export type PlayerView = {
  caseId: string;
  title: string;
  caseStatus: PlaythroughState["status"];
  turnCount: number;
  player: {
    displayName: string;
    addressAs: string;
    role: string;
    objective?: string;
    status: {
      condition: string;
      control: string;
      threat: string;
    };
  };
  openingPackage: OpeningPackage;
  scene: SceneView;
  cast: CastEntry[];
  inventory: InventoryEntry[];
  map: MapView;
  notebook: NotebookEntry[];
  time?: { slotId: string; label: string };
  environment: {
    weather: string;
    light: string;
    ambient?: string;
    crowd: string;
  };
  pendingAccusation?: {
    summary: string;
    suspectNames: string[];
    turnsRemaining: number;
  };
  ending?: { id: string; when?: string; kind?: string; title?: string };
};

export type NoteResponse = {
  note?: NotebookEntry;
  notebook: NotebookEntry[];
};
