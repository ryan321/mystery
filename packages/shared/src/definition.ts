import { z } from "zod";

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
  /** Optional soft gate; engine may ignore in v1. */
  requiresTrust: z.number().optional(),
});
export type KnowledgeBeat = z.infer<typeof KnowledgeBeatSchema>;

export const CharacterSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  shortBio: z.string().optional(),
  voice: z.string().optional(),
  knowledge: z.object({
    public: z.string().default(""),
    private: z.array(KnowledgeBeatSchema).default([]),
    secrets: z.array(KnowledgeBeatSchema).default([]),
  }),
  defenses: z.array(z.string()).default([]),
});
export type Character = z.infer<typeof CharacterSchema>;

export const ExitSchema = z.object({
  toLocationId: z.string().min(1),
  label: z.string().optional(),
  requiresFlags: FlagRequirementSchema.optional(),
});
export type Exit = z.infer<typeof ExitSchema>;

export const InspectEffectSchema = z.object({
  narrativeHints: z.string().optional(),
  revealsEvidenceIds: z.array(z.string()).optional(),
  setsFlags: FlagRequirementSchema.optional(),
  requiresFlags: FlagRequirementSchema.optional(),
});
export type InspectEffect = z.infer<typeof InspectEffectSchema>;

export const InspectableSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** Hidden until a flag reveals it, if set. */
  hiddenUntilFlags: FlagRequirementSchema.optional(),
  onInspect: InspectEffectSchema.default({}),
});
export type Inspectable = z.infer<typeof InspectableSchema>;

export const CharacterPresenceSchema = z.object({
  characterId: z.string().min(1),
  requiresFlags: FlagRequirementSchema.optional(),
});
export type CharacterPresence = z.infer<typeof CharacterPresenceSchema>;

export const LocationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  exits: z.array(ExitSchema).default([]),
  inspectables: z.array(InspectableSchema).default([]),
  charactersPresent: z.array(CharacterPresenceSchema).default([]),
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
});
export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;

export const RubricFactSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  matchHints: z.array(z.string()).default([]),
});
export type RubricFact = z.infer<typeof RubricFactSchema>;

export const SolutionSchema = z.object({
  summary: z.string().min(1),
  guiltyPartyIds: z.array(z.string()).default([]),
  method: z.string().optional(),
  motive: z.string().optional(),
  rubric: z.object({
    requiredFacts: z.array(RubricFactSchema).default([]),
    partialCredit: z.boolean().default(true),
  }),
});
export type Solution = z.infer<typeof SolutionSchema>;

export const EndingSchema = z.object({
  id: z.string().min(1),
  when: z.enum(["success", "partial", "failure", "custom"]),
  requiresFlags: FlagRequirementSchema.optional(),
  templateNotes: z.string().min(1),
});
export type Ending = z.infer<typeof EndingSchema>;

export const PlayerPersonaSchema = z.object({
  displayName: z.string().min(1),
  role: z.string().min(1),
  voiceNotes: z.string().optional(),
  startingLocationId: z.string().min(1),
  startingEvidenceIds: z.array(z.string()).default([]),
  startingKnowledge: z.string().default(""),
});
export type PlayerPersona = z.infer<typeof PlayerPersonaSchema>;

export const CaseMetaSchema = z.object({
  title: z.string().min(1),
  premise: z.string().min(1),
  tone: z.string().optional(),
  estimatedMinutes: z.number().int().positive().optional(),
  tags: z.array(z.string()).default([]),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  contentWarnings: z.array(z.string()).default([]),
});
export type CaseMeta = z.infer<typeof CaseMetaSchema>;

export const MysteryDefinitionSchema = z
  .object({
    schemaVersion: z.literal("1"),
    id: z.string().min(1),
    contentVersion: z.string().min(1),
    meta: CaseMetaSchema,
    player: PlayerPersonaSchema,
    locations: z.array(LocationSchema).min(1),
    characters: z.array(CharacterSchema).default([]),
    evidence: z.array(EvidenceItemSchema).default([]),
    flags: z.array(FlagDefSchema).default([]),
    solution: SolutionSchema,
    endings: z.array(EndingSchema).min(1),
    openingNarration: z.string().min(1),
  })
  .superRefine((def, ctx) => {
    const locationIds = new Set(def.locations.map((l) => l.id));
    const characterIds = new Set(def.characters.map((c) => c.id));
    const evidenceIds = new Set(def.evidence.map((e) => e.id));
    const flagIds = new Set(def.flags.map((f) => f.id));

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
      }
    }

    for (const eid of def.solution.guiltyPartyIds) {
      if (!characterIds.has(eid) && eid !== "unknown") {
        // allow non-character ids only if we later expand; warn soft — for now require character
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `solution.guiltyPartyIds references unknown character "${eid}"`,
          path: ["solution", "guiltyPartyIds"],
        });
      }
    }

    // flag ids referenced loosely — only validate known flag defs when present
    void flagIds;
  });

export type MysteryDefinition = z.infer<typeof MysteryDefinitionSchema>;

export function parseMysteryDefinition(data: unknown): MysteryDefinition {
  return MysteryDefinitionSchema.parse(data);
}
