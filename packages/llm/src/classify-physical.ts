import type OpenAI from "openai";
import type { LlmConfig } from "./config.js";
import {
  createOpenRouterClient,
  completeJsonValidated,
  openRouterExtraBody,
  parseModelJson,
} from "./client.js";
import type {
  DirectorPhysical,
  DirectorWorldToPlayer,
  Effect,
} from "@mystery/shared";

export type ClassifiedWorldToPlayer = {
  physical: DirectorPhysical;
  worldToPlayer: DirectorWorldToPlayer;
};

type ClassifyRaw = {
  active?: boolean;
  summary?: string | null;
  effects?: unknown;
  // legacy soft fields
  kind?: string | null;
  characterId?: string | null;
  manner?: string | null;
};

const SYSTEM = `You decide whether the WORLD should act ON the player this turn in a fair-play mystery.

You do NOT list situations in advance. Judge the player input + present people + location/hazards.
If yes, compose ENGINE EFFECTS (tools) that apply. Situations are open-ended; tools are fixed.

Return ONLY JSON:
{
  "active": true | false,
  "summary": "short what happens TO the player",
  "effects": [ { "type": "...", ...fields } ]
}

Allowed effect types ONLY:
move_player, set_player_threat, harm_player, set_player_condition,
hold_player, knock_down_player, restrain_player, knock_out_player, release_player, set_player_control,
steal_from_player, remove_evidence, set_item_condition,
add_player_tag, set_player_status_flag, set_safe_haven_compromised, set_game_flag, notebook_append,
append_location_description, set_ambient,
set_willingness, add_pressure, set_stance, move_character, start_clock

Rules:
- Use only characterId / toLocationId / itemId values from the lists provided.
- If nothing should hit the player: { "active": false, "effects": [] }.
- Escalate when they already provoked the same person or place.
- Environment (rotten planks, ice, water): move_player to a fall location + harm_player + tags.
- Social (bouncer, refuse to leave): set_willingness hostile, set_player_threat, maybe move_player out.
- Violence: hold/harm as appropriate to authority (patient vs official).
- Never invent rooms, people, or evidence ids.`;

/**
 * Open-ended AI: compose world→player effects. No fixed situation catalog.
 */
export async function classifyPhysicalAction(
  config: LlmConfig,
  args: {
    playerInput: string;
    present: { id: string; name: string }[];
    locationIds?: string[];
    playerRole?: string;
    priorPressure?: string;
  }
): Promise<ClassifiedWorldToPlayer> {
  const empty: ClassifiedWorldToPlayer = {
    physical: { kind: "none" },
    worldToPlayer: { active: false, effects: [] },
  };
  if (!config.apiKey) return empty;

  const client = createOpenRouterClient(config);
  const model = config.auxModel ?? config.directorModel ?? config.narratorModel;
  const presentLines =
    args.present.length > 0
      ? args.present.map((p) => `- ${p.id}: ${p.name}`).join("\n")
      : "(nobody else present)";
  const locs =
    args.locationIds && args.locationIds.length
      ? args.locationIds.join(", ")
      : "(see pack)";

  const user = [
    `Player role: ${args.playerRole ?? "unknown"}`,
    "People present:",
    presentLines,
    `Location ids: ${locs}`,
    args.priorPressure ? `Prior pressure: ${args.priorPressure}` : "",
    "",
    "Player input:",
    args.playerInput,
    "",
    "If the world should act on them, return active effects. Else active:false.",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const { value } = await completeJsonValidated({
      client,
      model,
      system: SYSTEM,
      user,
      temperature: 0,
      maxTokens: 256,
      maxTransportRetries: 1,
      extraBody: openRouterExtraBody(config),
      validate: (parsed) => {
        try {
          return { ok: true as const, value: parseClassify(parsed) };
        } catch (err) {
          return {
            ok: false as const,
            reason: String(err),
            failureClass: "schema" as const,
          };
        }
      },
    });
    return toResult(value);
  } catch {
    try {
      const completion = await client.chat.completions.create({
        model,
        temperature: 0,
        max_tokens: 600,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: user },
        ],
        ...(openRouterExtraBody(config) ?? {}),
      } as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming);
      const raw = completion.choices[0]?.message?.content ?? "";
      return toResult(parseClassify(parseModelJson(raw)));
    } catch {
      return empty;
    }
  }
}

function parseClassify(parsed: unknown): ClassifyRaw {
  if (!parsed || typeof parsed !== "object") {
    throw new Error("not an object");
  }
  return parsed as ClassifyRaw;
}

function toResult(value: ClassifyRaw): ClassifiedWorldToPlayer {
  const effects = Array.isArray(value.effects)
    ? (value.effects.filter(
        (e) => e && typeof e === "object" && typeof (e as Effect).type === "string"
      ) as Effect[])
    : [];
  const active = Boolean(value.active) || effects.length > 0;
  return {
    physical: {
      kind: active ? String(value.kind ?? "world") : "none",
      characterId: value.characterId ?? undefined,
      manner: value.manner ?? undefined,
    },
    worldToPlayer: {
      active,
      summary: value.summary ?? undefined,
      effects,
    },
  };
}

/** Merge classifier / physical result into director output. */
export function applyPhysicalToDirectorOutput(
  output: {
    intents: Array<{ type: string; [k: string]: unknown }>;
    physical?: DirectorPhysical;
    worldToPlayer?: DirectorWorldToPlayer;
    focusCharacterId?: string;
    reasoning?: string;
  },
  classified: ClassifiedWorldToPlayer | DirectorPhysical
): {
  intents: Array<{ type: string; [k: string]: unknown }>;
  physical?: DirectorPhysical;
  worldToPlayer?: DirectorWorldToPlayer;
  focusCharacterId?: string;
  reasoning?: string;
} {
  // Support both new ClassifiedWorldToPlayer and bare DirectorPhysical
  const c: ClassifiedWorldToPlayer =
    "worldToPlayer" in classified
      ? (classified as ClassifiedWorldToPlayer)
      : {
          physical: classified as DirectorPhysical,
          worldToPlayer: { active: false, effects: [] },
        };

  const next = {
    ...output,
    physical: c.physical ?? output.physical ?? { kind: "none" },
    worldToPlayer: c.worldToPlayer?.active
      ? c.worldToPlayer
      : output.worldToPlayer ?? { active: false, effects: [] },
    intents: [...output.intents],
  };

  if (
    c.worldToPlayer?.active &&
    (c.worldToPlayer.effects?.length ?? 0) > 0
  ) {
    next.worldToPlayer = c.worldToPlayer;
  }

  const kind = (c.physical?.kind ?? "none").toLowerCase();
  if (kind.includes("assault") || kind === "attack" || kind === "fight") {
    const has = next.intents.some((i) => i.type === "assault");
    if (!has) {
      next.intents.unshift({
        type: "assault",
        characterId: c.physical?.characterId,
        manner: c.physical?.manner,
      });
    }
    if (c.physical?.characterId) {
      next.focusCharacterId = c.physical.characterId;
    }
  }

  return next;
}
