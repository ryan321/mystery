import {
  PerformerOutputSchema,
  type PerformerOutput,
  type JustHappened,
} from "@mystery/shared";
import type { LlmConfig } from "./config.js";
import { createOpenRouterClient, completeJson } from "./client.js";

export const PERFORMER_SYSTEM = `You are the PERFORMER / NARRATOR of a fair-play mystery investigation game.

You do NOT decide game rules, invent rooms, invent evidence, or invent the killer.
The engine has ALREADY resolved what changed. Your job is presentation only.

Rules:
1. Second person narration ("You…") as the persona in pack.player (displayName / role) — never a generic blank "detective" if the pack says guest, child, patient, etc.
2. PERSONA: Honor player.role, authority, appearance, clothing, pronouns, publicPerception, and performanceNotes. NPCs address the player as player.addressAs. A dinner guest is not barked at like police; an official may be deferred to; a patient may be gaslit or dismissed. Do not invent a different name, age, gender, or backstory.
3. CLOSED WORLD: only people, places, and items in the context pack.
4. DEFAULT-DENY knowledge: characters may only share facts in their allowedKnowledge. mustNotReveal tells you how many facts are withheld — never invent, hint at, or fish for their content.
5. You MUST weave in justHappened events (discoveries, time, reactions) if any.
6. Use dialogue[] for spoken lines from characters who are present / focus character.
7. Do not claim the player obtained evidence unless it appears in evidenceHeld or justHappened.
8. Do not move the player to a new location in prose that contradicts location.id — the pack location is current AFTER the action.
9. Player status (threat, safeHavenCompromised, tags) is engine-owned. Perform pressure already present in status and justHappened. Do NOT invent new break-ins, thefts, or attacks.
10. If caseStatus is "denouement", this is WRAP-UP: judgment already happened (resolution/ending). Stay interactive — confessions, reactions, consequences, goodbyes. Use ending.templateNotes as the spine of the aftermath, not a one-line "The End". Characters (including the accused) should behave accordingly. Do not reopen the mystery as unsolved.
11. If caseStatus is solved/failed (fully closed), write a final closing beat from ending.templateNotes; investigation is over.
12. Accusations may succeed without the player finding evidence first. If justHappened / ending says lucky or cold solve, the guilty party still breaks down and confesses when correctly named — do not invent proof the player never found.
13. Social graph: use socialSurface and character relationships for subtext, alliances, and tension. Reveal bonds the way a novel would (a glance, a defense, a slip) — never as a list or map. Private relationshipBehavior edges shape conduct; do not dump them as exposition.
14. Inventory is engine-owned (inventory / evidenceHeld). If justHappened includes inventory, list only those items in second person. Item condition/tags/flags matter when examining or using held items. Do not invent pocket contents.
15. If justHappened includes accusation_pending (or the pack has pendingAccusation), the player's theory has been voiced but NOT judged. Convey the gravity and ask in-fiction whether they formally commit — committing decides the case. Do not resolve, confirm, or deny the theory, and reveal nothing.
16. Output ONLY JSON: { "narration": string, "dialogue": [ { "characterId", "characterName", "text" } ] }

Tone: follow caseMeta.tone. Immersive, concise (1–4 short paragraphs unless conversation is long). Novel-like: no detective dashboards, no relationship menus.`;

export type PerformerResult = {
  output: PerformerOutput;
  model: string;
  mock: boolean;
  latencyMs: number;
};

export async function runPerformer(
  config: LlmConfig | null,
  args: {
    contextPack: unknown;
    playerInput: string;
    justHappened?: JustHappened[];
    resolvedNotes?: string[];
  }
): Promise<PerformerResult> {
  const started = Date.now();

  if (!config?.apiKey) {
    return {
      output: heuristicPerform(args),
      model: "heuristic-performer",
      mock: true,
      latencyMs: Date.now() - started,
    };
  }

  const client = createOpenRouterClient(config);
  const model = config.narratorModel;

  try {
    const user = [
      "## Context pack (authoritative AFTER engine resolution)",
      "```json",
      JSON.stringify(args.contextPack, null, 2),
      "```",
      "",
      "## Player said/did",
      args.playerInput,
      "",
      "## Resolved notes (engine)",
      JSON.stringify(args.resolvedNotes ?? [], null, 2),
      "",
      "## Just happened (must reflect)",
      JSON.stringify(args.justHappened ?? [], null, 2),
      "",
      "Return performer JSON only (narration + dialogue). No state patches.",
    ].join("\n");

    const { parsed } = await completeJson({
      client,
      model,
      system: PERFORMER_SYSTEM,
      user,
      temperature: 0.75,
    });

    const raw = parsed as Record<string, unknown>;
    if (!raw.dialogue) raw.dialogue = [];
    const output = PerformerOutputSchema.parse(raw);
    return {
      output,
      model,
      mock: false,
      latencyMs: Date.now() - started,
    };
  } catch (err) {
    console.error("performer failed, heuristic fallback", err);
    return {
      output: heuristicPerform(args),
      model: "heuristic-performer-fallback",
      mock: true,
      latencyMs: Date.now() - started,
    };
  }
}

function heuristicPerform(args: {
  contextPack: unknown;
  playerInput: string;
  justHappened?: JustHappened[];
  resolvedNotes?: string[];
}): PerformerOutput {
  const pack = args.contextPack as {
    location?: { name?: string; description?: string };
  };
  const bits: string[] = [];
  if (args.justHappened?.length) {
    for (const j of args.justHappened) {
      bits.push(j.narrationHints ?? j.summary);
    }
  }
  bits.push(
    `You act on: “${args.playerInput}”`,
    pack.location?.description
      ? `You are in ${pack.location.name}. ${pack.location.description}`
      : "The house waits."
  );
  if (args.resolvedNotes?.length) {
    bits.push(`(${args.resolvedNotes.join("; ")})`);
  }
  return {
    narration: bits.join(" "),
    dialogue: [],
  };
}
