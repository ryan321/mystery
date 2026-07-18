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
1. Second person narration ("You…").
2. CLOSED WORLD: only people, places, and items in the context pack.
3. DEFAULT-DENY knowledge: characters may only share facts in their allowedKnowledge. Respect withheld knowledge ids — do not invent their content.
4. You MUST weave in justHappened events (discoveries, time, reactions) if any.
5. Use dialogue[] for spoken lines from characters who are present / focus character.
6. Do not claim the player obtained evidence unless it appears in evidenceHeld or justHappened.
7. Do not move the player to a new location in prose that contradicts location.id — the pack location is current AFTER the action.
8. Output ONLY JSON: { "narration": string, "dialogue": [ { "characterId", "characterName", "text" } ] }

Tone: follow caseMeta.tone. Immersive, concise (1–4 short paragraphs unless conversation is long).`;

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
