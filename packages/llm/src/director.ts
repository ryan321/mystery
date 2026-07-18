import {
  DirectorOutputSchema,
  type DirectorOutput,
} from "@mystery/shared";
import type { LlmConfig } from "./config.js";
import { createOpenRouterClient, completeJson } from "./client.js";
import { heuristicDirector } from "./heuristic-director.js";

export const DIRECTOR_SYSTEM = `You are the DIRECTOR of a fair-play mystery game. You do NOT write story prose for the player.

Given the context pack (closed world) and the player's free-text input, output JSON describing intents only.

Rules:
1. Only use location ids, character ids, evidence ids, and inspectable ids that appear in the context pack.
2. Map natural language to structured intents: move, inspect, talk, present, use, look, inventory, accuse, other.
3. Prefer specific ids when you can resolve them; otherwise put a short hint string.
4. For present: player shows held evidence to someone present.
5. For use: player uses held item on something (e.g. key on drawer) — often also inspect with requirements.
6. For accuse: ANY clear claim of who committed the crime is an accuse intent — even cold, mid-conversation, without evidence, without the word "accuse". Examples: "X did it", "It was X with the knife", "I know X is the killer", "X murdered them because…". Map names to cast[].id from the pack. Put the full player wording in summary; fill method/motive if stated. The engine scores truth — you do NOT know the solution and must not block a guess for lack of evidence. If caseStatus is already denouement/solved/failed, do NOT emit accuse again — map to talk/look/other.
7. If caseStatus is denouement and the player says they leave, go, goodbye, end, or finish the case → intent type "other" with note "exit_denouement" (engine will close wrap-up).
8. You may include suggestedPatch with setLocationId / addEvidenceIds / setFlags / accuse — but only for ids in the pack. Prefer intents; patch is optional.
9. Set focusCharacterId when the player is clearly addressing someone (including when accusing them to their face).
10. Output ONLY JSON. No markdown.

JSON shape:
{
  "intents": [ { "type": "inspect", "inspectableId": "...", "targetHint": "..." }, ... ],
  "suggestedPatch": { ... optional ... },
  "focusCharacterId": "optional",
  "reasoning": "short internal note"
}`;

export type DirectorResult = {
  output: DirectorOutput;
  model: string;
  mock: boolean;
  latencyMs: number;
};

export async function runDirector(
  config: LlmConfig | null,
  args: { contextPack: unknown; playerInput: string }
): Promise<DirectorResult> {
  const started = Date.now();

  if (!config?.apiKey) {
    return {
      output: heuristicDirector(args),
      model: "heuristic-director",
      mock: true,
      latencyMs: Date.now() - started,
    };
  }

  const client = createOpenRouterClient(config);
  const model = config.directorModel ?? config.narratorModel;

  try {
    const user = [
      "## Context pack",
      "```json",
      JSON.stringify(args.contextPack, null, 2),
      "```",
      "",
      "## Player input",
      args.playerInput,
      "",
      "Return director JSON.",
    ].join("\n");

    const { parsed } = await completeJson({
      client,
      model,
      system: DIRECTOR_SYSTEM,
      user,
      temperature: 0.2,
    });

    // Normalize intents array
    const raw = parsed as Record<string, unknown>;
    if (!raw.intents || !Array.isArray(raw.intents) || raw.intents.length === 0) {
      raw.intents = [{ type: "other", note: "empty intents" }];
    }

    const output = DirectorOutputSchema.parse(raw);
    return {
      output,
      model,
      mock: false,
      latencyMs: Date.now() - started,
    };
  } catch (err) {
    console.error("director failed, heuristic fallback", err);
    return {
      output: heuristicDirector(args),
      model: "heuristic-director-fallback",
      mock: true,
      latencyMs: Date.now() - started,
    };
  }
}
