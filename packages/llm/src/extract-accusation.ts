import {
  AccusationExtractionSchema,
  type AccusationExtraction,
} from "@mystery/shared";
import {
  completeJsonValidated,
  createOpenRouterClient,
  openRouterExtraBody,
} from "./client.js";
import type { LlmConfig } from "./config.js";

/**
 * Accusation extraction (accuse turns only): the model reports WHAT the
 * accusation claims — which characters it names as culprit and which
 * solution facts it affirms/denies — and the engine decides the verdict
 * deterministically from that structure. This replaces regex matching on
 * English prose: negation and paraphrase are handled semantically, in any
 * language ("extract, don't match" — docs/I18N.md).
 *
 * Returns null when extraction is unavailable (no API key) or fails —
 * callers fall back to the legacy matcher. Never throws.
 */
const SYSTEM = `You are the accusation extraction engine for a murder-mystery game.

Given the player's formal accusation, the character roster, and a list of solution facts, report what the accusation CLAIMS. You never judge whether the claim is true — only what the player is saying.

Rules:
- namedCulpritIds: character ids the accusation affirmatively names as the culprit. Naming someone to CLEAR them does not count ("it wasn't X", "X is innocent" → do not include X). A character may be named by full name, surname, or their known label ("the orderly").
- facts: for every solution fact, decide if the accusation AFFIRMS it (asserts it, in any wording), DENIES it (explicitly rules it out), or leaves it UNMENTIONED. When unsure between denied and unmentioned, choose unmentioned.
- Judge negation and paraphrase by meaning, in whatever language the accusation is written.
- Output JSON only: {"namedCulpritIds": string[], "facts": [{"factId": string, "status": "affirmed"|"denied"|"unmentioned"}]}. Use only ids from the input.`;

export type AccusationExtractionInput = {
  accuse: {
    summary: string;
    method?: string;
    motive?: string;
    /** Display names for structured suspectIds, to anchor the roster. */
    suspectNames: string[];
  };
  characters: { id: string; name: string; introducedAs?: string }[];
  facts: { id: string; description: string; role?: string; matchHints: string[] }[];
};

/**
 * Validate + normalize a model reply: drop hallucinated ids so a confused
 * model degrades to "unmentioned" instead of corrupting the verdict.
 * Exported for tests.
 */
export function normalizeExtraction(
  parsed: unknown,
  known: { characterIds: Set<string>; factIds: Set<string> }
): AccusationExtraction | null {
  const res = AccusationExtractionSchema.safeParse(parsed);
  if (!res.success) return null;
  return {
    namedCulpritIds: res.data.namedCulpritIds.filter((id) =>
      known.characterIds.has(id)
    ),
    facts: res.data.facts.filter((j) => known.factIds.has(j.factId)),
  };
}

export async function extractAccusationJudgments(
  config: LlmConfig | null,
  input: AccusationExtractionInput
): Promise<AccusationExtraction | null> {
  if (!config?.apiKey) return null;

  const known = {
    characterIds: new Set(input.characters.map((c) => c.id)),
    factIds: new Set(input.facts.map((f) => f.id)),
  };

  const user = [
    "## Player's accusation",
    "```json",
    JSON.stringify(input.accuse, null, 2),
    "```",
    "",
    "## Character roster",
    "```json",
    JSON.stringify(input.characters, null, 2),
    "```",
    "",
    "## Solution facts to judge",
    "```json",
    JSON.stringify(input.facts, null, 2),
    "```",
  ].join("\n");

  try {
    const { value } = await completeJsonValidated({
      client: createOpenRouterClient(config),
      model: config.auxModel ?? config.directorModel ?? config.narratorModel,
      system: SYSTEM,
      user,
      temperature: 0,
      maxTokens: 800,
      maxTransportRetries: 1,
      extraBody: openRouterExtraBody(config),
      validate: (parsed) => {
        const normalized = normalizeExtraction(parsed, known);
        return normalized
          ? { ok: true, value: normalized }
          : {
              ok: false,
              reason: "Extraction JSON did not match the schema",
              failureClass: "schema",
            };
      },
    });
    return value;
  } catch {
    // Extraction is an upgrade, not a dependency — regex fallback covers us.
    return null;
  }
}
