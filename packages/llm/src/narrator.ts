import type OpenAI from "openai";
import {
  TurnModelOutputSchema,
  type TurnModelOutput,
} from "@mystery/shared";
import { createOpenRouterClient, openRouterExtraBody } from "./client.js";
import {
  NARRATOR_SYSTEM,
  buildNarratorUserMessage,
  looksLikeTurnOutput,
} from "./prompts.js";
import type { LlmConfig } from "./config.js";

export type NarrateArgs = {
  contextPack: unknown;
  playerInput: string;
};

export type NarrateResult = {
  output: TurnModelOutput;
  model: string;
  mock: boolean;
  latencyMs: number;
};

export async function narrateTurn(
  config: LlmConfig | null,
  args: NarrateArgs,
  options?: { heuristicFallback?: (a: NarrateArgs) => TurnModelOutput }
): Promise<NarrateResult> {
  const started = Date.now();

  if (!config?.apiKey) {
    const output =
      options?.heuristicFallback?.(args) ??
      ({
        narration:
          "The case waits. (No OPENROUTER_API_KEY — set it to enable the AI narrator.)",
        dialogue: [],
        patch: {},
      } satisfies TurnModelOutput);
    return {
      output: TurnModelOutputSchema.parse(output),
      model: "heuristic",
      mock: true,
      latencyMs: Date.now() - started,
    };
  }

  const client = createOpenRouterClient(config);

  const completion = await client.chat.completions.create({
    model: config.narratorModel,
    temperature: 0.7,
    max_tokens: 2000,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: NARRATOR_SYSTEM },
      {
        role: "user",
        content: buildNarratorUserMessage(args),
      },
    ],
    ...(openRouterExtraBody(config) ?? {}),
  } as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming);

  const raw = completion.choices[0]?.message?.content ?? "";
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // one repair attempt
    const repair = await client.chat.completions.create({
      model: config.narratorModel,
      temperature: 0,
      max_tokens: 2000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: NARRATOR_SYSTEM },
        {
          role: "user",
          content: buildNarratorUserMessage(args),
        },
        { role: "assistant", content: raw },
        {
          role: "user",
          content:
            "Your previous reply was not valid JSON. Reply again with ONLY a valid JSON object matching the schema.",
        },
      ],
      ...(openRouterExtraBody(config) ?? {}),
    } as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming);
    const repaired = repair.choices[0]?.message?.content ?? "{}";
    parsed = JSON.parse(repaired);
  }

  if (!looksLikeTurnOutput(parsed)) {
    throw new Error("narrator_invalid_shape");
  }

  // Normalize missing patch
  const withPatch = {
    ...parsed,
    patch: parsed.patch ?? {},
    dialogue: parsed.dialogue ?? [],
  };

  const output = TurnModelOutputSchema.parse(withPatch);

  return {
    output,
    model: config.narratorModel,
    mock: false,
    latencyMs: Date.now() - started,
  };
}
