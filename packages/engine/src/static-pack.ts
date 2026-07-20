import type { MysteryDefinition } from "@mystery/shared";

/**
 * Prompt-cache support.
 *
 * Providers cache by longest common *prefix* (DeepSeek/OpenAI automatically;
 * Anthropic via explicit breakpoints). To exploit that, every LLM call sends:
 *
 *   [system prompt]            — static per role
 *   [static case block]        — byte-identical every turn (this module)
 *   [current turn state]       — volatile, always last
 *
 * The static block is built from the definition only, memoized to a single
 * JSON string so the prefix is byte-identical across turns and playthroughs
 * of the same case version.
 *
 * LEAK RULE: nothing gated may appear here — no solution, canon, knowledge
 * beats, evidence catalog, endings, beats, relationships, or hazards.
 */

/** Policy strings that never change during a playthrough (single source of truth). */
export const STATIC_POLICY = {
  secondPerson: true,
  closedWorld:
    "Only use locations, characters, and evidence listed here. Do not invent new rooms or killers.",
  presence:
    "WHO IS IN THE ROOM is location.presentCharacters / presentCharacterIds / charactersHereDetailed ONLY. notPresentCharacters lists everyone else — they are NOT here. Do not write that they stand, shift, watch, speak, or occupy space in this room. Do not invent arrivals. The cast array is only a name→id directory. Victims are dead — no dialogue, no living presence. If the player is alone with Henshaw, only Henshaw is visible in the scene.",
  noSolution:
    "Do not reveal who the killer is or the full solution. Characters withhold secrets until conditions are met.",
  defaultDenyKnowledge:
    "Characters may only state facts listed in their allowedKnowledge. Do not invent secret plot facts.",
  respectWillingness:
    "If willingness is silent or hostile, they share little; silent gives almost nothing useful.",
  playerPersona:
    "player.* is who the human is in this story (name, role, appearance, authority). Second person still — address them as that person. NPCs must treat them according to role, authority, and publicPerception (a dinner guest is not a badge; an official may open doors; a patient may be dismissed). Use addressAs in dialogue. Do not invent a different identity, gender, age, or backstory. If personaId is set, this may be a recurring detective known across cases — stay consistent with background/appearance.",
  detectiveAsTarget:
    "Player status (threat, condition/harm, control, controlledBy, safeHavenCompromised, tags) is engine-owned. control: free|held|downed|restrained|unconscious — if not free, the player is physically controlled and cannot simply walk away. Stage holds, knockdowns, restraint, knockouts, harm, theft, and force-moves from status + justHappened (player_moved_*, player_threat_*, player_harm_*, player_control_*, assault_*, stolen_*, item_damaged_*, safe_haven_*) as events that happen TO the player — not only dialogue. Keep reflecting active condition/control every turn until cleared. Do not invent new attacks, restraints, thefts, or injuries beyond status + justHappened.",
  physicalForce:
    "UNIVERSAL (all mysteries): Plot can happen TO the player — people, institutions, and environment. Assault, misconduct, provoke (annoy bouncer), trespass, and hazard (rickety pier fall, ice, shaft) are engine-classified. Stage warn/eject/fall/hold/harm from justHappened (hazard_*, social_pushback_*, assault_*, player_moved_*, player_control_*). location.hazards lists authored dangers. Never invent a free win or off-map rooms.",
  socialGraph:
    "socialSurface and per-character relationships shape behavior and subtext among people present. Private edges (public:false, knownToPlayer:false) inform how people act — do NOT lecture the player about them unless a character would say so. No relationship HUD; reveal bonds in prose and dialogue like a novel.",
  boundaries:
    "If justHappened contains boundary_blocked_*: the player's last action was refused (OOC/jailbreak, solution-fishing, abuse, impossible powers, or extreme illegal sidestep). The engine granted no cheats. Perform a brief in-world refusal or failed attempt; do not carry out the blocked act; do not spoil the solution; then leave the player able to continue investigating.",
  identity:
    "IDENTITY IS KNOWLEDGE: cast[].name and character name fields carry the player's CURRENT label (e.g. 'Orderly') — the real name appears only once the player has learned it (nameKnown). Never invent, guess, or reveal a real name early; a name reveal happens only via justHappened (name_revealed_*). Refer to every character by their current label in narration and dialogue.",
  establishedDetails:
    "ESTABLISHED DETAILS are canon for this playthrough: improvised world texture recorded earlier (location.establishedDetails, character/item establishedDetails as 'subject: fact; fact' threads). Reuse them naturally and NEVER contradict them — if the chandelier was said to have five hundred crystals, it still does. They are texture, not plot: inspecting them yields atmosphere, never evidence or secrets unless authored content says so.",
} as const;

/**
 * The stable, leak-safe case reference sent at the top of every prompt.
 * Geography and cast directory here also improve director id-resolution.
 */
export function buildStaticCasePack(def: MysteryDefinition) {
  return {
    note: "Stable case reference — identical every turn. Current-turn state (who is present, what is open, player status, justHappened) arrives in a later section and always wins.",
    caseMeta: {
      id: def.id,
      title: def.meta.title,
      tone: def.meta.tone ?? "",
    },
    /**
     * Name→id directory for the whole case. NOT who is in the room.
     * Identity-safe: characters whose name is unknown at start appear by
     * their introducedAs label; the current-turn state carries knownAs as
     * identity evolves (name reveals live there, never here).
     */
    cast: def.characters.map((c) => {
      const nameKnownAtStart = c.nameKnownAtStart ?? true;
      return {
        id: c.id,
        name: nameKnownAtStart ? c.name : c.introducedAs ?? "unknown",
        storyRole: c.storyRole ?? "suspect",
        shortBio: nameKnownAtStart ? c.shortBio ?? "" : "",
      };
    }),
    /** Static geography: base descriptions and exit labels only. */
    locations: def.locations.map((l) => ({
      id: l.id,
      name: l.name,
      description: l.description,
      exits: l.exits.map((e) => ({
        toLocationId: e.toLocationId,
        label: e.label,
      })),
    })),
    policy: STATIC_POLICY,
  };
}

const jsonCache = new WeakMap<MysteryDefinition, string>();

/**
 * Memoized compact JSON of the static case pack. Byte-identical across calls
 * for the same loaded definition — required for provider prefix caching.
 */
export function staticCasePackJson(def: MysteryDefinition): string {
  let s = jsonCache.get(def);
  if (!s) {
    s = JSON.stringify(buildStaticCasePack(def));
    jsonCache.set(def, s);
  }
  return s;
}
