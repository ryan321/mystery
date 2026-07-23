import { z } from "zod";
import { StoryBeatSchema, TimeConfigSchema, EnvironmentDefaultsSchema } from "./beats.js";
import { ConditionSchema } from "./conditions.js";
import { EffectSchema } from "./effects.js";

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

/**
 * How and when a hidden character (knownAtStart: false) enters the story.
 * Compiled by the engine into a synthetic once-only story beat, so `when`
 * is the full condition language (time, evidence, phase, beats, …).
 */
export const CharacterEntranceSchema = z.object({
  /** Condition that brings them into the story. */
  when: z.object({ type: z.string() }).passthrough(),
  /**
   * appear — they arrive in the world at atLocationId (become known,
   *          available, and physically present).
   * mention — the player learns they exist (cast list, hearsay) without
   *           them appearing anywhere yet.
   */
  mode: z.enum(["appear", "mention"]).default("appear"),
  /** Required for mode "appear": where they show up. */
  atLocationId: z.string().optional(),
  /** Performer guidance for staging the entrance / the mention. */
  announce: z.string().optional(),
});
export type CharacterEntrance = z.infer<typeof CharacterEntranceSchema>;

export const CharacterSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /**
   * Existence fog: if false, the player does not know this character
   * exists — hidden from the mystery detail page, cast lists, packs, and
   * PlayerView until revealed (entrance, reveal_character effect, or
   * meeting them). Author full content as usual; nothing leaks early.
   */
  knownAtStart: z.boolean().default(true),
  /** Declarative reveal for hidden characters (see CharacterEntranceSchema). */
  entrance: CharacterEntranceSchema.optional(),
  /**
   * The player's initial label when the name is not yet known
   * (e.g. "Orderly", "the woman in 3B"). UI and narration use this until
   * a reveal_character_name / set_known_as effect fires.
   */
  introducedAs: z.string().optional(),
  /**
   * Whether the player starts knowing the real name. Manor introductions:
   * true (default). Amnesia ward / strangers: false → introducedAs is used.
   */
  nameKnownAtStart: z.boolean().default(true),
  shortBio: z.string().optional(),
  /**
   * Dramatis-personae line for pre-game marketing surfaces (case detail
   * cast list): a short title only — "The caretaker", "The widow".
   * shortBio is the AI's character card and may contain secrets; it must
   * never reach the shelf. Cast order on those surfaces follows the
   * characters array: author it deliberately (keep families together).
   */
  cardTitle: z.string().optional(),
  /**
   * Spoiler-safe one-liner for pre-game marketing surfaces (case detail
   * cast list). shortBio is the AI's character card and may contain
   * secrets — it must never reach the shelf. Cast order on those
   * surfaces follows the characters array: author it deliberately
   * (keep families together).
   */
  cardBio: z.string().optional(),
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
  /**
   * First-class container/search affordance (optional; absent = today's
   * behavior). A fixture that holds items, optionally locked behind a key
   * item or flag, revealed on open/search.
   */
  container: z
    .object({
      locked: z.boolean().default(false),
      unlockRequires: ConditionSchema.optional(),
      /** Evidence ids revealed when the container is opened/searched. */
      contains: z.array(z.string()).default([]),
    })
    .optional(),
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
  /**
   * Fog-of-war seed: the player knows this place exists before visiting
   * (persona familiarity — a local knows their own house; a stranger does
   * not). The starting location is always known.
   */
  knownAtStart: z.boolean().default(false),
  /** Authored sketch-map coordinates for the fog-of-war map UI. */
  map: z
    .object({
      x: z.number(),
      y: z.number(),
      floor: z.number().int().optional(),
    })
    .optional(),
  /** Authored establishing-shot image path relative to the case folder. */
  image: z.string().min(1).optional(),
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
   * First-class item affordances (all optional; absent = today's behavior).
   * A carriable item may be read, or used on a target for an authored outcome.
   */
  readable: z.object({ text: z.string().min(1) }).optional(),
  usableOn: z
    .array(
      z.object({
        /** Fixture / item / character id this item acts on (e.g. key → drawer). */
        targetId: z.string().min(1),
        requires: ConditionSchema.optional(),
        outcome: z.array(EffectSchema).default([]),
      })
    )
    .default([]),
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
 * The deduction graph — how the case can be SOLVED (the inference DAG),
 * distinct from what happens (beats), what people know (knowledge), and what
 * is true (canon/solution). SEALED: never sent to a Director/Performer pack.
 * Only its spoiler-safe projection (open-question text + coarse readiness)
 * reaches the player. See docs/INVESTIGATION_MODEL.md §3.
 */

/** One way to reach a deduction. Author ≥2 disjoint supports per node. */
export const DeductionSupportSchema = z.union([
  /** A clue held / noted. */
  z.object({ evidenceId: z.string().min(1) }),
  /** A character disclosed a knowledge beat to the player. */
  z.object({
    knowledge: z.object({
      characterId: z.string().min(1),
      beatId: z.string().min(1),
    }),
  }),
  /** A prior deduction is itself a support (chaining). */
  z.object({ nodeId: z.string().min(1) }),
  /** Escape hatch: any engine condition (visited, presented, flag, …). */
  z.object({ condition: ConditionSchema }),
]);
export type DeductionSupport = z.infer<typeof DeductionSupportSchema>;

export const DeductionNodeSchema = z.object({
  id: z.string().min(1),
  /** SEALED author-facing: the inference in plain terms. Never shown. */
  claim: z.string().min(1),
  /** Player-facing: the OPEN QUESTION this raises. The only text that surfaces. */
  question: z.string().min(1),
  /**
   * identity | method | motive → terminal (ties to a rubric fact).
   * supporting → terminal detail. lead → intermediate deduction.
   */
  role: z
    .enum(["identity", "method", "motive", "supporting", "lead"])
    .default("lead"),
  /** For terminal nodes: the solution.rubric.requiredFacts id this establishes. */
  factId: z.string().optional(),
  /** Prior node ids that must resolve before this question is even askable. */
  requires: z.array(z.string()).default([]),
  /** The ways to reach it (three-clue rule: prefer ≥2 disjoint). */
  supports: z.array(DeductionSupportSchema).default([]),
  /** How many supports resolve the node. Default 1. */
  minSupports: z.number().int().positive().default(1),
  /**
   * When the question becomes an OPEN thread. Default (omitted): when every
   * `requires` node has resolved (a node with no `requires` opens at start).
   */
  opensWhen: ConditionSchema.optional(),
});
export type DeductionNode = z.infer<typeof DeductionNodeSchema>;

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
/**
 * Structured opening package — the ambient knowledge the protagonist starts
 * with, rendered as a diegetic artifact (case file, invitation, or "what you
 * already know" for accidental protagonists). Never contains spoilers.
 */
export const BriefingSectionSchema = z.object({
  heading: z.string().min(1),
  text: z.string().min(1),
});
export type BriefingSection = z.infer<typeof BriefingSectionSchema>;

export const BriefingSchema = z.object({
  /** Diegetic form; drives UI presentation. */
  form: z
    .enum(["dossier", "letter", "telegram", "invitation", "memory", "custom"])
    .default("dossier"),
  title: z.string().optional(),
  sections: z.array(BriefingSectionSchema).default([]),
});
export type Briefing = z.infer<typeof BriefingSchema>;

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
  /**
   * Structured opening package (PLAYER_SURFACES.md §5.1). When absent, the
   * UI derives one from meta.premise + startingKnowledge + objective.
   */
  briefing: BriefingSchema.optional(),
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

  tags: z.array(z.string()).default([]),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  /**
   * Shelf merchandising override: cases with a sortGroup sit in their own
   * gallery band instead of the main mixed shelf. Band order is fixed by
   * the client: main shelf (easy/medium mixed) → sortGroup bands →
   * premium (Difficult) → elite (Genius). Absent = main shelf.
   * "kids" — junior cases trail the grown-up Sleuth shelf.
   */
  sortGroup: z.enum(["kids"]).optional(),
  contentWarnings: z.array(z.string()).default([]),
  /**
   * Shared visual direction for cast portraits (and optional key art).
   * Authors generate assets offline; engine does not invent images.
   */
  artStyle: z.string().optional(),
  /**
   * Optional progress UI for this mystery (player can only reduce visibility).
   * off — never show progress
   * subtle — unlock toasts only (default for most shelf cases we enable)
   * full — toasts + coarse depth meter
   */
  progressUi: z.enum(["off", "subtle", "full"]).optional(),
  /**
   * Visual atmosphere theme for the web play screen + mystery detail page
   * (rain/lightning manor, starfield station, fogbound noir, alpine snowfall,
   * sunny daylight). Absent = "manor".
   */
  theme: z.enum(["manor", "station", "noir", "snowfall", "daylight"]).optional(),
  /**
   * Playtest acceptance targets (scripts/playtest.mjs --sweep). All
   * optional — defaults derive from difficulty. minTurns is the floor a
   * speedrunner must not beat; maxTurns the ceiling a thorough player
   * should finish within.
   */
  playtest: z
    .object({
      minTurns: z.number().int().positive().optional(),
      maxTurns: z.number().int().positive().optional(),
      minEvidenceCoverage: z.number().min(0).max(1).optional(),
      minFunMedian: z.number().min(1).max(10).optional(),
    })
    .optional(),
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
 * Case-specific ceremony when the player opens a formal accusation
 * (Accuse button). No form fields — stages the room/cast, then freeform speech.
 */
export const AccuseStagingSchema = z.object({
  /**
   * Where the charge is heard. If set, player (and gathered cast) move here.
   * Omit → stay in current location.
   */
  locationId: z.string().min(1).optional(),
  /**
   * Character ids to gather (available, non-victim). Empty/omit = all
   * available non-victim characters who are known or present.
   */
  gatherCharacterIds: z.array(z.string()).optional(),
  /**
   * Performer guidance for the staging turn only — household assembles,
   * player has NOT yet named the culprit. Never spoil the solution.
   */
  narrationHints: z
    .string()
    .min(1)
    .default(
      "A formal accusation is about to be made. Gather those who should hear the charge. The player has not yet spoken their case — stage the assembly, the weight of the moment, and wait. Do not invent a culprit or resolve anything."
    ),
  /** Composer placeholder while the scene is open. */
  composerPlaceholder: z
    .string()
    .optional()
    .default("State your formal accusation — who, how, and why…"),
  /**
   * Short player-facing win reminder shown during the scene
   * (e.g. "Name who killed him, how, and why.").
   */
  winHint: z.string().optional(),
});
export type AccuseStaging = z.infer<typeof AccuseStagingSchema>;

/**
 * How formal an accusation must be before it is judged.
 * Default: informal theories ("X did it") go pending and must be confirmed;
 * explicitly formal wording ("I accuse X") is judged immediately.
 * Accuse button uses staging (ceremony) then freeform speech.
 */
export const AccusePolicySchema = z.object({
  /** Informal accusations require confirmation before scoring. Default true. */
  requireConfirmation: z.boolean().default(true),
  /** How many turns a pending accusation stays confirmable. Default 3. */
  pendingTurns: z.number().int().positive().default(3),
  /**
   * Ceremony for the Accuse button: set the scene, then player speaks freeform.
   * Omit → platform default gathering hints.
   */
  staging: AccuseStagingSchema.optional(),
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
    /**
     * Sealed deduction graph — how the case can be solved (the inference DAG).
     * Never sent to a Director/Performer pack; drives derived threads,
     * readiness, and the reachability audit. See docs/INVESTIGATION_MODEL.md §3.
     */
    deductions: z.array(DeductionNodeSchema).default([]),
    endings: z.array(EndingSchema).min(1),
    openingNarration: z.string().min(1),
    /**
     * The Whole Story — authored mask-off prose shown once the case
     * closes, on any outcome. Fixed like the opening: never generated
     * at runtime (docs/MYSTERY_PRINCIPLES.md §8f). The ending audit
     * requires it; optional here so older bundles still parse.
     */
    revelation: z.string().optional(),
    /**
     * Non-interactive story persons — the dead, the absent, the prior
     * victims whose shadows the case stands in (a first wife, a poisoned
     * husband). One authoritative card each, so their facts live in one
     * place instead of drifting across canon/knowledge text, and the
     * performer draws on a single truth when the living remember them.
     * Never player-facing directly; the player learns of figures only
     * through the world (headstones, testimony, papers).
     */
    figures: z
      .array(
        z.object({
          id: z.string().min(1),
          name: z.string().min(1),
          /** e.g. "1858–1889" */
          dates: z.string().optional(),
          /** Relationship shorthand: "the master's late first wife". */
          relation: z.string().optional(),
          /** The card: who they were, how they died, what they left. */
          description: z.string().min(1),
        })
      )
      .default([]),
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

    for (const c of def.characters) {
      if (!c.entrance) continue;
      if (c.entrance.mode !== "mention") {
        if (!c.entrance.atLocationId) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Character "${c.id}" entrance mode "appear" requires atLocationId`,
            path: ["characters"],
          });
        } else if (!locationIds.has(c.entrance.atLocationId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Character "${c.id}" entrance at unknown location "${c.entrance.atLocationId}"`,
            path: ["characters"],
          });
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
      if (rel.knownToPlayerByDefault) {
        // Front matter cannot reference people the player doesn't know exist.
        for (const endpoint of [rel.fromId, rel.toId]) {
          const ch = def.characters.find((c) => c.id === endpoint);
          if (ch && ch.knownAtStart === false) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Relationship "${rel.id}" is knownToPlayerByDefault but "${endpoint}" is hidden (knownAtStart: false)`,
              path: ["relationships"],
            });
          }
        }
      }
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

    // Accuse staging location / gather ids must exist.
    const staging = def.accusePolicy?.staging;
    if (staging?.locationId && !locationIds.has(staging.locationId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `accusePolicy.staging.locationId "${staging.locationId}" is not a location`,
        path: ["accusePolicy", "staging", "locationId"],
      });
    }
    for (const cid of staging?.gatherCharacterIds ?? []) {
      if (!characterIds.has(cid)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `accusePolicy.staging.gatherCharacterIds unknown character "${cid}"`,
          path: ["accusePolicy", "staging", "gatherCharacterIds"],
        });
      }
    }

    // Fixture contents (container preferred; onInspect.revealsEvidenceIds alias).
    const worldTargetIds = new Set<string>([
      ...evidenceIds,
      ...characterIds,
      ...locationIds,
    ]);
    for (const loc of def.locations) {
      for (const insp of loc.inspectables) {
        worldTargetIds.add(insp.id);
        if (insp.objectId) worldTargetIds.add(insp.objectId);
        const contents = [
          ...(insp.container?.contains ?? []),
          ...(insp.onInspect.revealsEvidenceIds ?? []),
        ];
        for (const eid of contents) {
          if (!evidenceIds.has(eid)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Inspectable "${insp.id}" contains unknown evidence "${eid}"`,
              path: ["locations"],
            });
          }
        }
      }
    }

    // usableOn targets must be closed-world ids.
    for (const item of def.evidence) {
      for (const u of item.usableOn ?? []) {
        if (!worldTargetIds.has(u.targetId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Evidence "${item.id}" usableOn target "${u.targetId}" is not a known fixture/item/character/location`,
            path: ["evidence"],
          });
        }
      }
    }

    // Deduction graph integrity (sealed; drives derived threads/readiness).
    const rubricFactIds = new Set(
      def.solution.rubric.requiredFacts.map((f) => f.id)
    );
    const knowledgeByChar = new Map<string, Set<string>>();
    for (const c of def.characters) {
      const ids = new Set<string>();
      for (const k of [...c.knowledge.private, ...c.knowledge.secrets]) {
        ids.add(k.id);
      }
      knowledgeByChar.set(c.id, ids);
    }
    const deductionIds = new Set<string>();
    for (const node of def.deductions) {
      if (deductionIds.has(node.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate deduction node id "${node.id}"`,
          path: ["deductions"],
        });
      }
      deductionIds.add(node.id);
    }
    for (const node of def.deductions) {
      if (node.factId && !rubricFactIds.has(node.factId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Deduction "${node.id}" factId "${node.factId}" is not a rubric requiredFacts id`,
          path: ["deductions"],
        });
      }
      if (node.minSupports > node.supports.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Deduction "${node.id}" minSupports (${node.minSupports}) exceeds supports.length (${node.supports.length})`,
          path: ["deductions"],
        });
      }
      for (const r of node.requires) {
        if (!deductionIds.has(r)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Deduction "${node.id}" requires unknown node "${r}"`,
            path: ["deductions"],
          });
        }
      }
      for (const s of node.supports) {
        if ("evidenceId" in s) {
          if (!evidenceIds.has(s.evidenceId)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Deduction "${node.id}" support references unknown evidence "${s.evidenceId}"`,
              path: ["deductions"],
            });
          }
        } else if ("nodeId" in s) {
          if (!deductionIds.has(s.nodeId)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Deduction "${node.id}" support references unknown node "${s.nodeId}"`,
              path: ["deductions"],
            });
          }
          if (s.nodeId === node.id) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Deduction "${node.id}" cannot support itself via nodeId`,
              path: ["deductions"],
            });
          }
        } else if ("knowledge" in s) {
          const beats = knowledgeByChar.get(s.knowledge.characterId);
          if (!beats) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Deduction "${node.id}" knowledge support references unknown character "${s.knowledge.characterId}"`,
              path: ["deductions"],
            });
          } else if (!beats.has(s.knowledge.beatId)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Deduction "${node.id}" knowledge support references unknown beat "${s.knowledge.beatId}" on "${s.knowledge.characterId}"`,
              path: ["deductions"],
            });
          }
        }
      }
    }
    // requires + nodeId support edges must form a DAG.
    {
      const WHITE = 0,
        GRAY = 1,
        BLACK = 2;
      const color = new Map<string, number>();
      const byId = new Map(def.deductions.map((n) => [n.id, n]));
      const deps = (id: string): string[] => {
        const n = byId.get(id);
        if (!n) return [];
        const out = [...n.requires];
        for (const s of n.supports) {
          if ("nodeId" in s) out.push(s.nodeId);
        }
        return out;
      };
      let cyclic = false;
      const visit = (id: string) => {
        color.set(id, GRAY);
        for (const r of deps(id)) {
          if (!byId.has(r)) continue;
          const c = color.get(r) ?? WHITE;
          if (c === GRAY) {
            cyclic = true;
            return;
          }
          if (c === WHITE) visit(r);
        }
        color.set(id, BLACK);
      };
      for (const n of def.deductions) {
        if ((color.get(n.id) ?? WHITE) === WHITE) visit(n.id);
        if (cyclic) break;
      }
      if (cyclic) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `deductions graph contains a cycle (requires/nodeId must form a DAG)`,
          path: ["deductions"],
        });
      }
    }

    void beatIds;
  });

export type MysteryDefinition = z.infer<typeof MysteryDefinitionSchema>;

export function parseMysteryDefinition(data: unknown): MysteryDefinition {
  return MysteryDefinitionSchema.parse(data);
}
