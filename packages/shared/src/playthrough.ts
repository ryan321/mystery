import { z } from "zod";
import { FlagValueSchema, PlayerPersonaSnapshotSchema } from "./definition.js";

export const PlaythroughStatusSchema = z.enum([
  "active",
  /**
   * Judgment rendered (solved or failed), but the player may still interact:
   * confessions, fallout, goodbyes. Not a second investigation.
   */
  "denouement",
  "solved",
  "failed",
  "abandoned",
]);
export type PlaythroughStatus = z.infer<typeof PlaythroughStatusSchema>;

/** Final judgment while still in denouement (or after close). */
export const ResolutionSchema = z.object({
  outcome: z.enum(["success", "partial", "failure", "custom"]),
  endingId: z.string().optional(),
  kind: z.string().optional(),
  path: z.string().optional(),
  title: z.string().optional(),
});
export type Resolution = z.infer<typeof ResolutionSchema>;

export const DenouementStateSchema = z.object({
  /** Turns left in wrap-up; 0 → finalize. null = until player exits. */
  turnsRemaining: z.number().int().nullable(),
  maxTurns: z.number().int().nonnegative(),
  startedAtTurn: z.number().int().nonnegative(),
});
export type DenouementState = z.infer<typeof DenouementStateSchema>;

export const WillingnessSchema = z.enum([
  "open",
  "guarded",
  "hostile",
  "silent",
  "fled",
]);
export type Willingness = z.infer<typeof WillingnessSchema>;

export const NotebookEntrySchema = z.object({
  id: z.string(),
  text: z.string(),
  source: z.enum(["auto", "player"]),
  createdAt: z.string(),
});
export type NotebookEntry = z.infer<typeof NotebookEntrySchema>;

export const DialogueTurnSchema = z.object({
  role: z.enum(["player", "character", "narration"]),
  text: z.string(),
  at: z.string(),
});
export type DialogueTurn = z.infer<typeof DialogueTurnSchema>;

export const CharacterMemorySchema = z.object({
  revealedBeatIds: z.array(z.string()).default([]),
  summary: z.string().default(""),
  recentTurns: z.array(DialogueTurnSchema).default([]),
});
export type CharacterMemory = z.infer<typeof CharacterMemorySchema>;

/** Coerce null/NaN/missing so old or partial state_json never hard-fails load. */
function coerceFiniteNumber(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

/**
 * Improvised scene dressing: durable texture the performer established
 * ("a crystal chandelier hangs over the stairwell"). Facts under the same
 * subject form a cumulative thread; append-only, engine-capped, replayed
 * into every future pack for the same target so the AI stays consistent.
 * Dressing is timeless description — never events, evidence, or state.
 */
export const DressingFactSchema = z.object({
  /** Stable slug grouping facts about one thing, e.g. "chandelier". */
  subject: z.string(),
  detail: z.string(),
  /** Turn the fact was established (ordering/debug). */
  turn: z.number().int().nonnegative().default(0),
});
export type DressingFact = z.infer<typeof DressingFactSchema>;

export const CharacterRuntimeStateSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object") return raw;
  const o = raw as Record<string, unknown>;
  return {
    ...o,
    available: o.available == null ? true : o.available,
    willingness: o.willingness ?? "open",
    pressure: coerceFiniteNumber(o.pressure, 0),
    trust: coerceFiniteNumber(o.trust, 0),
    stance: o.stance == null ? "" : o.stance,
    alibiStatus: o.alibiStatus ?? "none",
    timesTalked: Math.max(
      0,
      Math.floor(coerceFiniteNumber(o.timesTalked, 0))
    ),
  };
}, z.object({
  locationId: z.string(),
  available: z.boolean().default(true),
  willingness: WillingnessSchema.default("open"),
  pressure: z.number().default(0),
  /**
   * Soft rapport with the player. Knowledge may requireTrust: N.
   * Independent of pressure (can be high-pressure and high-trust when cornered honestly).
   */
  trust: z.number().default(0),
  stance: z.string().default(""),
  alibiStatus: z
    .enum(["claimed", "broken", "abandoned", "none"])
    .default("none"),
  timesTalked: z.number().int().nonnegative().default(0),
  /** Improvised durable texture (see DressingFactSchema). */
  dressing: z.array(DressingFactSchema).default([]),
}));
export type CharacterRuntimeState = z.infer<typeof CharacterRuntimeStateSchema>;

/** Mutable instance of a definition relationship edge. */
export const RelationshipRuntimeStateSchema = z.object({
  active: z.boolean().default(true),
  strength: z.number().int().min(0).max(3).default(1),
  /** Player (and free narration) may treat this as known. */
  knownToPlayer: z.boolean().default(false),
  labelOverride: z.string().optional(),
  flags: z.record(FlagValueSchema).default({}),
});
export type RelationshipRuntimeState = z.infer<
  typeof RelationshipRuntimeStateSchema
>;

/**
 * World object / inventory item state.
 * When stage is "taken" and holder is "player", the item is in inventory.
 */
export const ObjectRuntimeStateSchema = z.object({
  stage: z
    .enum([
      "hidden",
      "visible",
      "examined",
      "taken",
      "destroyed",
      "given_away",
    ])
    .default("visible"),
  locked: z.boolean().default(false),
  /** Where it is in the world (omit / clear when held). */
  locationId: z.string().optional(),
  /**
   * Who holds it: "player" = inventory; character id = on NPC;
   * omit = in the world at locationId.
   */
  holder: z.string().optional(),
  /** Physical/logical condition while held or in world e.g. intact, torn, wet, opened, spent. */
  condition: z.string().default("intact"),
  /** Free tags e.g. "bloody", "read", "smudged". */
  tags: z.array(z.string()).default([]),
  /** Item-local flags (opened_envelope, powder_tested, …). */
  flags: z.record(FlagValueSchema).default({}),
  /** Closer looks while in hand / at scene. */
  timesExamined: z.number().int().nonnegative().default(0),
  /** Uses (key turned, match struck, …). */
  timesUsed: z.number().int().nonnegative().default(0),
  /** Improvised durable texture (see DressingFactSchema). */
  dressing: z.array(DressingFactSchema).default([]),
});
export type ObjectRuntimeState = z.infer<typeof ObjectRuntimeStateSchema>;

export const LocationRuntimeStateSchema = z.object({
  accessible: z.boolean().default(true),
  descriptionAppend: z.string().default(""),
  /** key `${from}->${to}` → open */
  exitOpen: z.record(z.boolean()).default({}),
  /**
   * Fog of war: the player knows this place exists (map surface).
   * Seeded from definition knownAtStart ∪ starting location; also set by
   * the reveal_location effect. Visited locations are always known.
   */
  known: z.boolean().default(false),
  /** Improvised durable texture (see DressingFactSchema). */
  dressing: z.array(DressingFactSchema).default([]),
});
export type LocationRuntimeState = z.infer<typeof LocationRuntimeStateSchema>;

export const EnvironmentStateSchema = z.object({
  weather: z.string().default("clear"),
  weatherIntensity: z.string().optional(),
  light: z.string().default("day"),
  ambient: z.string().optional(),
  crowd: z.string().default("none"),
  flags: z.record(FlagValueSchema).default({}),
  activePulses: z.array(z.string()).default([]),
});
export type EnvironmentState = z.infer<typeof EnvironmentStateSchema>;

export const TimeStateSchema = z.object({
  slotId: z.string(),
  minutesFromStart: z.number().nonnegative().default(0),
  /** Slots entered this turn (for time_reached). */
  reachedSlotIdsThisTurn: z.array(z.string()).default([]),
});
export type TimeState = z.infer<typeof TimeStateSchema>;

/**
 * What the player knows a character AS — identity only, never a factbook
 * (PLAYER_SURFACES.md §5.4). knownAs starts as introducedAs when the name
 * is unknown; reveal_character_name / set_known_as effects update it.
 */
export const PlayerCharacterKnowledgeSchema = z.object({
  /** Existence: the player knows this character is part of the story. */
  known: z.boolean().default(true),
  knownAs: z.string(),
  nameKnown: z.boolean().default(true),
});
export type PlayerCharacterKnowledge = z.infer<
  typeof PlayerCharacterKnowledgeSchema
>;

/**
 * An accusation voiced informally ("Vale did it") that awaits formal
 * confirmation before it is scored. Cleared on confirm, withdraw, or expiry.
 */
export const PendingAccusationSchema = z.object({
  summary: z.string(),
  suspectIds: z.array(z.string()).default([]),
  method: z.string().optional(),
  motive: z.string().optional(),
  /**
   * What the player's OWN stated case leaves unsaid (no how / no why).
   * Purely reflective of their accusation text — never compared against
   * the truth, so surfacing it leaks nothing.
   */
  missing: z.array(z.enum(["method", "motive"])).default([]),
  madeOnTurn: z.number().int().nonnegative(),
  /** Last turnCount at which this pending accusation can still be confirmed. */
  expiresAfterTurn: z.number().int().nonnegative(),
});
export type PendingAccusation = z.infer<typeof PendingAccusationSchema>;

export const PresentedRecordSchema = z.object({
  evidenceId: z.string(),
  characterId: z.string(),
  turn: z.number().int(),
});
export type PresentedRecord = z.infer<typeof PresentedRecordSchema>;

/**
 * How the world is pushing back on the detective (plot-as-target).
 * Authored via beats/effects — not freeform AI inventing attacks.
 */
export const PlayerThreatSchema = z.enum([
  "none",
  "watched",
  "threatened",
  "assaulted",
]);
export type PlayerThreat = z.infer<typeof PlayerThreatSchema>;

/**
 * Physical / bodily state of the player (engine-owned).
 * Escalates only unless set_player_condition force: true.
 */
export const PlayerConditionSchema = z.enum([
  "unharmed",
  "shaken",
  "bruised",
  "injured",
  "incapacitated",
]);
export type PlayerCondition = z.infer<typeof PlayerConditionSchema>;

/**
 * Physical control / restraint of the player (engine-owned).
 * Orthogonal to condition (you can be held without injury, or injured but free).
 * Escalates only unless set_player_control force: true (release uses force).
 */
export const PlayerControlSchema = z.enum([
  /** Free to act and move. */
  "free",
  /** Grabbed / held by someone — cannot walk away cleanly. */
  "held",
  /** Knocked to the floor — still conscious. */
  "downed",
  /** Bound, pinned, or otherwise restrained. */
  "restrained",
  /** Knocked out / senseless. */
  "unconscious",
]);
export type PlayerControl = z.infer<typeof PlayerControlSchema>;

export const PlayerStatusSchema = z.object({
  /** Escalating pressure aimed at the detective personally. */
  threat: PlayerThreatSchema.default("none"),
  /**
   * Bodily condition after violence or shock.
   * Separate from threat (you can be threatened without injury, or bruised after a shove).
   */
  condition: PlayerConditionSchema.default("unharmed"),
  /**
   * Who has physical control of the player body.
   * free | held | downed | restrained | unconscious
   */
  control: PlayerControlSchema.default("free"),
  /** Character id currently holding/restraining the player, if known. */
  controlledBy: z.string().optional(),
  /** True after room broken into / safe place compromised. */
  safeHavenCompromised: z.boolean().default(false),
  /** Case-specific tags e.g. "notes_stolen", "followed". */
  tags: z.array(z.string()).default([]),
  /** Case-specific booleans under player status. */
  flags: z.record(FlagValueSchema).default({}),
});
export type PlayerStatus = z.infer<typeof PlayerStatusSchema>;

export const PlaythroughStateSchema = z.object({
  id: z.string().min(1),
  caseId: z.string().min(1),
  contentVersion: z.string().min(1),
  status: PlaythroughStatusSchema,
  locationId: z.string().min(1),
  evidenceIds: z.array(z.string()).default([]),
  flags: z.record(FlagValueSchema).default({}),
  notebook: z.array(NotebookEntrySchema).default([]),
  characterMemory: z.record(CharacterMemorySchema).default({}),
  visitedLocationIds: z.array(z.string()).default([]),
  turnCount: z.number().int().nonnegative().default(0),
  createdAt: z.string(),
  updatedAt: z.string(),
  // Dynamics
  phaseId: z.string().default("arrival"),
  firedBeatIds: z.array(z.string()).default([]),
  beatQueue: z
    .array(
      z.object({
        beatId: z.string(),
        fireOnTurn: z.number().int(),
      })
    )
    .default([]),
  clocks: z.record(z.number()).default({}),
  characterState: z.record(CharacterRuntimeStateSchema).default({}),
  /** key = relationship edge id from definition */
  relationshipState: z.record(RelationshipRuntimeStateSchema).default({}),
  objectState: z.record(ObjectRuntimeStateSchema).default({}),
  locationState: z.record(LocationRuntimeStateSchema).default({}),
  environment: EnvironmentStateSchema.default({
    weather: "clear",
    light: "day",
    crowd: "none",
    flags: {},
    activePulses: [],
  }),
  time: TimeStateSchema.optional(),
  presented: z.array(PresentedRecordSchema).default([]),
  /** Plot pressure on the detective (hostility, room ransacked, etc.). */
  playerStatus: PlayerStatusSchema.default({
    threat: "none",
    condition: "unharmed",
    control: "free",
    safeHavenCompromised: false,
    tags: [],
    flags: {},
  }),
  /**
   * Who the player is in this playthrough (role, appearance, recurring personaId).
   * Snapshot at start from definition.player (+ future persona catalog merges).
   */
  playerPersona: PlayerPersonaSnapshotSchema.optional(),
  endingId: z.string().optional(),
  /** Per-character identity knowledge (knownAs labels). Keyed by character id. */
  playerKnowledge: z.record(PlayerCharacterKnowledgeSchema).default({}),
  /** Informal accusation awaiting formal confirmation (accuse gate). */
  pendingAccusation: PendingAccusationSchema.optional(),
  /**
   * Formal accusation ceremony opened by the Accuse button (or equivalent).
   * Household is staged; the player's next freeform speech is treated as a
   * formal charge when it names a theory. Cleared on score, withdraw, or cancel.
   */
  formalAccusationScene: z
    .object({
      active: z.literal(true),
      openedOnTurn: z.number().int().nonnegative(),
      locationId: z.string().optional(),
    })
    .optional(),
  /** Set when judgment is rendered (accuse / fail beat), even during denouement. */
  resolution: ResolutionSchema.optional(),
  /** Present while status === denouement. */
  denouement: DenouementStateSchema.optional(),
});
export type PlaythroughState = z.infer<typeof PlaythroughStateSchema>;

/** LLM / director proposes; engine validates before apply. */
export const StatePatchSchema = z.object({
  setLocationId: z.string().optional(),
  addEvidenceIds: z.array(z.string()).optional(),
  setFlags: z.record(FlagValueSchema).optional(),
  revealBeats: z
    .array(
      z.object({
        characterId: z.string(),
        beatId: z.string(),
      })
    )
    .optional(),
  notebookAppend: z.array(z.string()).optional(),
  presented: z
    .array(
      z.object({
        evidenceId: z.string(),
        characterId: z.string(),
      })
    )
    .optional(),
  talkToCharacterId: z.string().optional(),
  /** Player asked to review what they are carrying. */
  requestInventory: z.boolean().optional(),
  /**
   * Examine / use an inventory item (updates timesExamined / timesUsed + flags).
   */
  examineItemId: z.string().optional(),
  useItemId: z.string().optional(),
  /** Target of a use (fixture / item / character id) for usableOn outcomes. */
  useTargetId: z.string().optional(),
  setItemFlags: z
    .record(z.record(FlagValueSchema))
    .optional(), // itemId → flags
  accuse: z
    .object({
      summary: z.string(),
      suspectIds: z.array(z.string()).optional(),
      method: z.string().optional(),
      motive: z.string().optional(),
    })
    .optional(),
});
export type StatePatch = z.infer<typeof StatePatchSchema>;

export const TurnModelOutputSchema = z.object({
  narration: z.string().min(1),
  dialogue: z
    .array(
      z.object({
        characterId: z.string(),
        characterName: z.string(),
        text: z.string(),
      })
    )
    .optional(),
  patch: StatePatchSchema.default({}),
  intentGuess: z.string().optional(),
});
export type TurnModelOutput = z.infer<typeof TurnModelOutputSchema>;

export const TurnResultSchema = z.object({
  narration: z.string(),
  dialogue: z
    .array(
      z.object({
        characterId: z.string(),
        characterName: z.string(),
        text: z.string(),
      })
    )
    .default([]),
  state: PlaythroughStateSchema,
  appliedPatch: StatePatchSchema,
  rejected: z.array(z.string()).default([]),
  evidenceAdded: z.array(z.string()).default([]),
});
export type TurnResult = z.infer<typeof TurnResultSchema>;
