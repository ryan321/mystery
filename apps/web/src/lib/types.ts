export type CaseMeta = {
  title: string;
  premise: string;
  tone?: string;
  estimatedMinutes?: number;
  tags: string[];
  difficulty?: "easy" | "medium" | "hard";
  contentWarnings: string[];
};

export type CaseSummary = {
  id: string;
  contentVersion: string;
  meta: CaseMeta;
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
};

export type TurnLogEntry = {
  turnIndex: number;
  playerInput: string;
  narration: string;
  dialogue: DialogueLine[];
  evidenceAdded: string[];
  createdAt: string;
};

export type StartCaseResponse = {
  playthrough: PlaythroughState;
  openingNarration: string;
  locationName?: string;
};

export type GetPlaythroughResponse = {
  playthrough: PlaythroughState;
  openingNarration?: string;
  locationName?: string;
  turns: TurnLogEntry[];
};

export type SendTurnResponse = {
  narration: string;
  dialogue: DialogueLine[];
  playthrough: PlaythroughState;
  appliedPatch: unknown;
  rejected: string[];
  evidenceAdded: string[];
  justHappened: JustHappened[];
  locationName?: string;
  _debug?: {
    directorModel?: string;
    performerModel?: string;
    directorMock?: boolean;
    performerMock?: boolean;
    intentNotes?: string[];
  };
};
