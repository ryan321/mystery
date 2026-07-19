import { z } from "zod";
import { StoryBeatSchema, TimeConfigSchema, EnvironmentDefaultsSchema } from "./beats.js";

/** Flag value stored on a playthrough or set by definition effects. */
export const FlagValueSchema = z.union([
  z.boolean(),
  z.string(),
  z.number(),
]);
export type FlagValue = z.infer<typeof FlagValueSchema>;

export const FlagRequirementSchema = z.record(FlagValueSchema);
export type FlagRequirement = z.infer<typeof FlagRequirementSchema>;

export const FlagDefSchema = z.object({
  id: z.string().min(1),
  description: z.string().optional(),
  /** If true, this flag may appear in AI-visible context packs. */
  aiVisible: z.boolean().default(false),
  defaultValue: FlagValueSchema.optional(),
});
export type FlagDef = z.infer<typeof FlagDefSchema>;

export const KnowledgeBeatSchema = z.object({
  id: z.string().min(1),
  content: z.string().min(1),
  requiresFlags: FlagRequirementSchema.optional(),
  requiresEvidenceIds: z.array(z.string()).optional(),
  /**
   * Character trust (runtime characterState.trust) must be >= this value.
   * Raised via add_trust / set_trust effects or high willingness arcs.
   */
  requiresTrust: z.number().optional(),
  /** If set, character must have this willingness or looser to share. */
  requiresWillingnessIn: z
    .array(z.enum(["open", "guarded", "hostile", "silent", "fled"]))
    .optional(),
  /**
   * Relationship edge ids that must be knownToPlayer (and active)
   * before this knowledge may be shared.
   */
  requiresRelationshipIds: z.array(z.string()).optional(),
  /**
   * Single relationship gate (known + optional type check via edge id).
   * Prefer requiresRelationshipIds for multiple.
   */
  requiresRelationshipId: z.string().optional(),
});
export type KnowledgeBeat = z.infer<typeof KnowledgeBeatSchema>;

/**
 * How this person appears on the mystery cast list / in the story.
 * Victims are listed and portrayed but not talkable by default.
 */
export const CharacterStoryRoleSchema = z.enum([
  "suspect",
  "victim",
  "witness",
  "support",
]);
export type CharacterStoryRole = z.infer<typeof CharacterStoryRoleSchema>;

export const CharacterSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  shortBio: z.string().optional(),
  voice: z.string().optional(),
  /**
   * Path to portrait image relative to the case content folder
   * (e.g. "portraits/henshaw.png"). Served by the API as a case asset.
   */
  portrait: z.string().min(1).optional(),
  /**
   * Cast / story function. Victims appear on the shelf cast with a badge
   * and start unavailable (cannot be interviewed).
   */
  storyRole: CharacterStoryRoleSchema.optional(),
  defaultLocationId: z.string().optional(),
  defaultWillingness: z
    .enum(["open", "guarded", "hostile", "silent", "fled"])
    .default("open"),
  defaultStance: z.string().optional(),
  /**
   * If false, character is not interviewable at start (e.g. deceased).
   * Defaults false when storyRole is "victim", otherwise true.
   */
  availableByDefault: z.boolean().optional(),
  knowledge: z.object({
    public: z.string().default(""),
    private: z.array(KnowledgeBeatSchema).default([]),
    secrets: z.array(KnowledgeBeatSchema).default([]),
  }),
  defenses: z.array(z.string()).default([]),
});
export type Character = z.infer<typeof CharacterSchema>;

/**
 * Directed social edge: how A stands toward B.
 * Novel-like — revealed in dialogue/narration, not a player relationship HUD.
 *
 * Common types (free string, not enum-locked):
 * family | spouse | employer | employee | business | debt | blackmail |
 * romantic | rivalry | loyalty | protects | alibi_with | resents | fears | trusts
 */
export const RelationshipEdgeSchema = z.object({
  id: z.string().min(1),
  fromId: z.string().min(1),
  toId: z.string().min(1),
  /** Semantic type of the bond. */
  type: z.string().min(1),
  /** Short human/AI label e.g. "business partner", "protects the family name". */
  label: z.string().optional(),
  /** 0 = weak … 3 = defining. Default 1. */
  strength: z.number().int().min(0).max(3).default(1),
  /**
   * If true, the bond is social surface (how people act around each other /
   * what gossip might mention). If false, private — AI uses for behavior but
   * must not dump unless conditions/knowledge allow.
   */
  public: z.boolean().default(false),
  /**
   * If true, player may already "know" this from briefing/gossip at start.
   * Runtime can reveal private edges later without making them public gossip.
   */
  knownToPlayerByDefault: z.boolean().default(false),
  /** Optional author note for AI when this edge is in the behavior pack. */
  notes: z.string().optional(),
  /** Starts active; beats can deactivate (broken alliances, deaths). */
  startsActive: z.boolean().default(true),
});
export type RelationshipEdge = z.infer<typeof RelationshipEdgeSchema>;

export const ExitSchema = z.object({
  toLocationId: z.string().min(1),
  label: z.string().optional(),
  requiresFlags: FlagRequirementSchema.optional(),
  /** Player must hold all of these evidence ids (e.g. key). */
  requiresEvidenceIds: z.array(z.string()).optional(),
  /** Starts closed until set_exit_open effect. */
  startsClosed: z.boolean().default(false),
});
export type Exit = z.infer<typeof ExitSchema>;

export const InspectEffectSchema = z.object({
  narrativeHints: z.string().optional(),
  revealsEvidenceIds: z.array(z.string()).optional(),
  setsFlags: FlagRequirementSchema.optional(),
  requiresFlags: FlagRequirementSchema.optional(),
  /** Must hold these items (keys, tools) to succeed. */
  requiresEvidenceIds: z.array(z.string()).optional(),
});
export type InspectEffect = z.infer<typeof InspectEffectSchema>;

export const InspectableSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** Hidden until a flag reveals it, if set. */
  hiddenUntilFlags: FlagRequirementSchema.optional(),
  /** Optional object id for locked containers. */
  objectId: z.string().optional(),
  onInspect: InspectEffectSchema.default({}),
});
export type Inspectable = z.infer<typeof InspectableSchema>;

export const CharacterPresenceSchema = z.object({
  characterId: z.string().min(1),
  requiresFlags: FlagRequirementSchema.optional(),
});
export type CharacterPresence = z.infer<typeof CharacterPresenceSchema>;

/**
 * Environmental danger at a location — rickety pier, ice, open shaft.
 * Engine + AI can dump the player into fallToLocationId / harm them.
 */
export const LocationHazardSchema = z.object({
  id: z.string().min(1),
  /** What the AI/pack should know is dangerous here. */
  description: z.string().min(1),
  /**
   * on_enter — fire when player arrives here
   * on_inspect — fire when inspecting inspectableId
   * on_act — AI may trigger when player acts carelessly here (default)
   */
  trigger: z
    .enum(["on_enter", "on_inspect", "on_act"])
    .default("on_act"),
  inspectableId: z.string().optional(),
  /** Where they land if they fall / are swept (must be a location id). */
  fallToLocationId: z.string().optional(),
  /** Player condition after: shaken | bruised | injured … */
  condition: z.string().optional(),
  /** Tag e.g. soaked, smoke_choked */
  tag: z.string().optional(),
  once: z.boolean().default(true),
  /** scare = threat only; soak = wet/shaken + optional fall; injure = bruised/injured + fall */
  severity: z.enum(["scare", "soak", "injure"]).default("soak"),
});
export type LocationHazard = z.infer<typeof LocationHazardSchema>;

export const LocationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  startsAccessible: z.boolean().default(true),
  exits: z.array(ExitSchema).default([]),
  inspectables: z.array(InspectableSchema).default([]),
  charactersPresent: z.array(CharacterPresenceSchema).default([]),
  /** Optional environmental dangers (planks give way, ice, etc.). */
  hazards: z.array(LocationHazardSchema).default([]),
});
export type Location = z.infer<typeof LocationSchema>;

export const EvidenceItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  discoverableAt: z
    .object({
      locationId: z.string().min(1),
      inspectableId: z.string().min(1),
    })
    .optional(),
  canPresentTo: z.union([z.array(z.string()), z.literal("*")]).optional(),
  /**
   * Authored red herring — findable and presentable, never required for
   * solution success. Engine does not auto-exclude from inventory.
   */
  redHerring: z.boolean().default(false),
});
export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;

/** Sealed crime history — authoring / lint only; never in performer pack. */
export const CanonTimelineEventSchema = z.object({
  id: z.string().optional(),
  /** Story clock label e.g. "10:45 PM" or "before dinner". */
  at: z.string().min(1),
  event: z.string().min(1),
  locationId: z.string().optional(),
  actorIds: z.array(z.string()).default([]),
});
export type CanonTimelineEvent = z.infer<typeof CanonTimelineEventSchema>;

export const CanonSchema = z.object({
  timeline: z.array(CanonTimelineEventSchema).default([]),
  /** Freeform sealed notes for authors / offline tools. */
  notes: z.string().optional(),
});
export type Canon = z.infer<typeof CanonSchema>;

/**
 * What a rubric fact is for scoring free-text accusations.
 * Evidence possession is NEVER required — only matching words/ids.
 */
export const RubricFactRoleSchema = z.enum([
  "identity",
  "method",
  "motive",
  "supporting",
]);
export type RubricFactRole = z.infer<typeof RubricFactRoleSchema>;

export const RubricFactSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  matchHints: z.array(z.string()).default([]),
  /**
   * identity = who; method/motive/supporting = how/why/detail.
   * Defaults to supporting if omitted (except auto-identity from guiltyPartyIds).
   */
  role: RubricFactRoleSchema.optional(),
});
export type RubricFact = z.infer<typeof RubricFactSchema>;

/**
 * How much of the truth the player must name to fully solve —
 * still never requires having found evidence in inventory.
 */
export const AccusationSuccessPolicySchema = z.enum([
  /** Correct culprit id/name alone closes the case. */
  "identity",
  /** Culprit + at least one method/motive/supporting fact. Default. */
  "identity_plus_one",
  /** Every requiredFacts entry must match. Strict. */
  "all_facts",
]);
export type AccusationSuccessPolicy = z.infer<
  typeof AccusationSuccessPolicySchema
>;

export const SolutionSchema = z.object({
  summary: z.string().min(1),
  guiltyPartyIds: z.array(z.string()).default([]),
  method: z.string().optional(),
  motive: z.string().optional(),
  /**
   * Evidence that, if held (or presented to a guilty party), marks the solve
   * as "earned" rather than a lucky/bluff guess. Optional flavor only —
   * never a gate for success.
   */
  criticalEvidenceIds: z.array(z.string()).default([]),
  rubric: z.object({
    requiredFacts: z.array(RubricFactSchema).default([]),
    partialCredit: z.boolean().default(true),
    /**
     * Free-text accusations always allowed without evidence (default true).
     * If false, engine still scores but marks path; success still does not
     * require inventory — reserved for future hard-mode gates.
     */
    allowWithoutEvidence: z.boolean().default(true),
    /** How many truth facets needed for full success. */
    successPolicy: AccusationSuccessPolicySchema.default("identity_plus_one"),
  }),
});
export type Solution = z.infer<typeof SolutionSchema>;

/**
 * How the case closed — especially distinct failure paths.
 * Authors may have many endings with when:"failure" differentiated by kind/id.
 */
export const EndingKindSchema = z.enum([
  "solved",
  /** Correct theory with little or no investigation evidence */
  "lucky_solve",
  "partial",
  /** Named the wrong person or an unsupportable theory */
  "wrong_accusation",
  /** Investigation clock / story schedule ran out (culprit fled, roads opened, etc.) */
  "time_expired",
  /** The detective was killed (or neutralized) before solving */
  "murdered",
  /** Overreached: locked up, suspended, or detained for misconduct */
  "arrested",
  /** Culprit escaped without necessarily killing the detective */
  "escaped",
  /** Case-specific / other */
  "custom",
]);
export type EndingKind = z.infer<typeof EndingKindSchema>;

export const EndingSchema = z.object({
  id: z.string().min(1),
  /** Broad outcome bucket for scoring / filters. */
  when: z.enum(["success", "partial", "failure", "custom"]),
  /**
   * Finer classification — use for multiple failure branches
   * (time ran out vs murdered vs arrested vs wrong accuse).
   */
  kind: EndingKindSchema.optional(),
  /** Short player-facing title e.g. "Out of time". */
  title: z.string().optional(),
  requiresFlags: FlagRequirementSchema.optional(),
  /** Prose guidance for the performer / end screen. */
  templateNotes: z.string().min(1),
});
export type Ending = z.infer<typeof EndingSchema>;

/**
 * Who the human plays as in a mystery.
 *
 * Mysteries always define a concrete in-world identity (guest, inspector,
 * patient, kid detective…). Optional `personaId` is a stable handle for
 * *recurring* personas (Miss Marple, Poirot, …) that may later live in a
 * shared catalog and appear across many mysteries with case-specific
 * overrides (role, starting knowledge, clothing).
 */
export const PlayerPersonaSchema = z.object({
  /**
   * Stable id for a recurring persona across mysteries
   * (e.g. "miss-marple", "henri-poirot", "cant-trick-rick").
   * Omit for one-off mystery-local roles.
   */
  personaId: z.string().min(1).optional(),
  /** Short name used in UI and second person (“Inspector”, “Rick”). */
  displayName: z.string().min(1),
  /** Full legal / formal name if different from displayName. */
  fullName: z.string().optional(),
  /**
   * How NPCs should address the player in dialogue
   * (e.g. “Inspector”, “Miss Marple”, “Mr. Cross”). Defaults to displayName.
   */
  addressAs: z.string().optional(),
  /** Pronouns for narration/dialogue consistency, e.g. "she/her", "he/him", "they/them". */
  pronouns: z.string().optional(),
  /**
   * Role *in this mystery* — dinner guest, private detective, patient,
   * kid sleuth, corporate auditor. Drives how the world treats you.
   */
  role: z.string().min(1),
  /**
   * Authority NPCs attribute to you. Shapes cooperation, doors, and tone.
   * civilian = no official power; guest = invited but private;
   * professional = hired/competent outsider; official = police/badge.
   */
  authority: z
    .enum(["civilian", "guest", "professional", "official"])
    .optional(),
  /** Freeform gender presentation, if authored (optional). */
  gender: z.string().optional(),
  /** Age or age band as prose, e.g. "about twelve", "mid-forties", "elderly". */
  age: z.string().optional(),
  /** Physical appearance the cast can notice. */
  appearance: z.string().optional(),
  /** What you're wearing / carrying in this mystery (optional). */
  clothing: z.string().optional(),
  /** Short public bio — what locals or the cast may already know about you. */
  background: z.string().optional(),
  /**
   * How this household/scene sees you at the start
   * (e.g. "unwanted official", "trusted dinner guest", "just another patient").
   */
  publicPerception: z.string().optional(),
  /** Voice / manner for second-person performance notes. */
  voiceNotes: z.string().optional(),
  /**
   * Extra performer guidance: stay in this persona; NPCs react to role/authority.
   */
  performanceNotes: z.string().optional(),
  startingLocationId: z.string().min(1),
  startingEvidenceIds: z.array(z.string()).default([]),
  /**
   * Facts the player already knows at turn 0 (shown in the opening briefing
   * and available to the AI as player knowledge).
   */
  startingKnowledge: z.string().default(""),
  /**
   * Clear statement of what the player is supposed to do
   * (e.g. identify the killer, recover the board, escape the ward).
   * Shown on the mystery page and at the start of play.
   */
  objective: z.string().optional(),
});
export type PlayerPersona = z.infer<typeof PlayerPersonaSchema>;

/**
 * Runtime snapshot of who the player is in a playthrough.
 * Frozen at start so definition edits or future persona-catalog merges
 * don't change mid-game identity.
 */
export const PlayerPersonaSnapshotSchema = z.object({
  personaId: z.string().optional(),
  displayName: z.string().min(1),
  fullName: z.string().optional(),
  addressAs: z.string().min(1),
  pronouns: z.string().optional(),
  role: z.string().min(1),
  authority: z
    .enum(["civilian", "guest", "professional", "official"])
    .optional(),
  gender: z.string().optional(),
  age: z.string().optional(),
  appearance: z.string().optional(),
  clothing: z.string().optional(),
  background: z.string().optional(),
  publicPerception: z.string().optional(),
  voiceNotes: z.string().optional(),
  performanceNotes: z.string().optional(),
  objective: z.string().optional(),
  startingKnowledge: z.string().optional(),
});
export type PlayerPersonaSnapshot = z.infer<typeof PlayerPersonaSnapshotSchema>;

/** Build a playthrough-frozen persona from a mystery's player block. */
export function snapshotPlayerPersona(
  player: PlayerPersona
): PlayerPersonaSnapshot {
  return {
    personaId: player.personaId,
    displayName: player.displayName,
    fullName: player.fullName,
    addressAs: player.addressAs ?? player.displayName,
    pronouns: player.pronouns,
    role: player.role,
    authority: player.authority,
    gender: player.gender,
    age: player.age,
    appearance: player.appearance,
    clothing: player.clothing,
    background: player.background,
    publicPerception: player.publicPerception,
    voiceNotes: player.voiceNotes,
    performanceNotes: player.performanceNotes,
    objective: player.objective,
    startingKnowledge: player.startingKnowledge || undefined,
  };
}

/**
 * Catalog + shelf copy. Think bookstore jacket:
 * premise = short hook; setting = where/when; summary = back cover;
 * theMystery = the central question the player must answer.
 */
export const CaseMetaSchema = z.object({
  title: z.string().min(1),
  /** Short shelf-card hook (1–2 sentences). */
  premise: z.string().min(1),
  /**
   * Where and when — place, era, atmosphere.
   * Bookstore “setting” line (e.g. “A fogbound pier, low tide, 1924.”).
   */
  setting: z.string().optional(),
  /**
   * Longer jacket blurb: scene, stakes, and cast without spoilers.
   * Used on the mystery detail page (not necessarily on the shelf card).
   */
  summary: z.string().optional(),
  /**
   * The explicit mystery question (e.g. “Who killed the harbormaster,
   * and why frame the tide?”). Shown on detail + play briefing.
   */
  theMystery: z.string().optional(),
  tone: z.string().optional(),
  estimatedMinutes: z.number().int().positive().optional(),
  tags: z.array(z.string()).default([]),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  contentWarnings: z.array(z.string()).default([]),
  /**
   * Shared visual direction for cast portraits (and optional key art).
   * Authors generate assets offline; engine does not invent images.
   */
  artStyle: z.string().optional(),
});
export type CaseMeta = z.infer<typeof CaseMetaSchema>;

/**
 * After judgment (solve / fail), optional interactive wrap-up:
 * confessions, consequences, goodbyes — still freeform turns.
 */
export const WrapUpConfigSchema = z.object({
  /** Default true — set false for hard cut to end screen. */
  enabled: z.boolean().default(true),
  /** Max interactive turns after judgment (then auto-close). */
  maxTurns: z.number().int().positive().default(10),
  /** Player can end early ("I leave", "goodbye", "end case"). */
  allowEarlyExit: z.boolean().default(true),
  /** Guidance for performer during wrap-up (global). */
  performanceNotes: z.string().optional(),
});
export type WrapUpConfig = z.infer<typeof WrapUpConfigSchema>;

/**
 * How formal an accusation must be before it is judged.
 * Default: informal theories ("X did it") go pending and must be confirmed;
 * explicitly formal wording ("I accuse X") is judged immediately.
 */
export const AccusePolicySchema = z.object({
  /** Informal accusations require confirmation before scoring. Default true. */
  requireConfirmation: z.boolean().default(true),
  /** How many turns a pending accusation stays confirmable. Default 3. */
  pendingTurns: z.number().int().positive().default(3),
});
export type AccusePolicy = z.infer<typeof AccusePolicySchema>;

export const MysteryDefinitionSchema = z
  .object({
    schemaVersion: z.union([z.literal("1"), z.literal("1.5")]),
    id: z.string().min(1),
    contentVersion: z.string().min(1),
    meta: CaseMetaSchema,
    player: PlayerPersonaSchema,
    locations: z.array(LocationSchema).min(1),
    characters: z.array(CharacterSchema).default([]),
    /** Social graph: directed edges between characters (and optionally player later). */
    relationships: z.array(RelationshipEdgeSchema).default([]),
    evidence: z.array(EvidenceItemSchema).default([]),
    flags: z.array(FlagDefSchema).default([]),
    solution: SolutionSchema,
    /**
     * Sealed past of the crime. Never sent to Director/Performer packs.
     * Used for authoring, lint, and future debrief tools.
     */
    canon: CanonSchema.optional(),
    endings: z.array(EndingSchema).min(1),
    openingNarration: z.string().min(1),
    /** Interactive aftermath after solve/fail. Default: enabled. */
    wrapUp: WrapUpConfigSchema.optional(),
    /** Accusation formality gate. Default: confirmation required. */
    accusePolicy: AccusePolicySchema.optional(),
    /** Plot dynamics */
    beats: z.array(StoryBeatSchema).default([]),
    phases: z
      .array(
        z.object({
          id: z.string(),
          description: z.string().optional(),
        })
      )
      .default([]),
    time: TimeConfigSchema.optional(),
    environment: EnvironmentDefaultsSchema.optional(),
  })
  .superRefine((def, ctx) => {
    const locationIds = new Set(def.locations.map((l) => l.id));
    const characterIds = new Set(def.characters.map((c) => c.id));
    const evidenceIds = new Set(def.evidence.map((e) => e.id));
    const beatIds = new Set(def.beats.map((b) => b.id));

    if (!locationIds.has(def.player.startingLocationId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `player.startingLocationId "${def.player.startingLocationId}" is not a location`,
        path: ["player", "startingLocationId"],
      });
    }

    for (const id of def.player.startingEvidenceIds) {
      if (!evidenceIds.has(id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Unknown starting evidence id "${id}"`,
          path: ["player", "startingEvidenceIds"],
        });
      }
    }

    for (const loc of def.locations) {
      for (const exit of loc.exits) {
        if (!locationIds.has(exit.toLocationId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Exit from "${loc.id}" to unknown location "${exit.toLocationId}"`,
            path: ["locations"],
          });
        }
        for (const eid of exit.requiresEvidenceIds ?? []) {
          if (!evidenceIds.has(eid)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Exit requires unknown evidence "${eid}"`,
              path: ["locations"],
            });
          }
        }
      }
      for (const presence of loc.charactersPresent) {
        if (!characterIds.has(presence.characterId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Location "${loc.id}" references unknown character "${presence.characterId}"`,
            path: ["locations"],
          });
        }
      }
      for (const insp of loc.inspectables) {
        for (const eid of insp.onInspect.revealsEvidenceIds ?? []) {
          if (!evidenceIds.has(eid)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Inspectable "${insp.id}" reveals unknown evidence "${eid}"`,
              path: ["locations"],
            });
          }
        }
        for (const eid of insp.onInspect.requiresEvidenceIds ?? []) {
          if (!evidenceIds.has(eid)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Inspectable "${insp.id}" requires unknown evidence "${eid}"`,
              path: ["locations"],
            });
          }
        }
      }
    }

    for (const eid of def.solution.guiltyPartyIds) {
      if (!characterIds.has(eid) && eid !== "unknown") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `solution.guiltyPartyIds references unknown character "${eid}"`,
          path: ["solution", "guiltyPartyIds"],
        });
      }
    }

    const relIds = new Set<string>();
    for (const rel of def.relationships) {
      if (relIds.has(rel.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate relationship id "${rel.id}"`,
          path: ["relationships"],
        });
      }
      relIds.add(rel.id);
      if (!characterIds.has(rel.fromId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Relationship "${rel.id}" fromId unknown character "${rel.fromId}"`,
          path: ["relationships"],
        });
      }
      if (!characterIds.has(rel.toId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Relationship "${rel.id}" toId unknown character "${rel.toId}"`,
          path: ["relationships"],
        });
      }
    }

    if (def.time) {
      const slotIds = new Set(def.time.schedule.map((s) => s.id));
      if (!slotIds.has(def.time.startSlotId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `time.startSlotId "${def.time.startSlotId}" not in schedule`,
          path: ["time", "startSlotId"],
        });
      }
    }

    void beatIds;
  });

export type MysteryDefinition = z.infer<typeof MysteryDefinitionSchema>;

export function parseMysteryDefinition(data: unknown): MysteryDefinition {
  return MysteryDefinitionSchema.parse(data);
}
