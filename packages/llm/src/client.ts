import OpenAI from "openai";
import type { LlmConfig } from "./config.js";
import {
  type AttemptKind,
  type AttemptLog,
  type FailureClass,
  backoffMs,
  formatSchemaIssues,
  isTransportRetryable,
  sleep,
  wrapThrown,
  ClassifiedError,
} from "./retry.js";

/**
 * Memoized per apiKey+baseURL: the SDK keeps its keep-alive agent on the
 * client instance, so a fresh client per call pays a new TLS handshake on
 * every one of the turn's LLM round-trips.
 */
const clientCache = new Map<string, OpenAI>();

export function createOpenRouterClient(config: LlmConfig): OpenAI {
  const baseURL = config.baseURL ?? "https://openrouter.ai/api/v1";
  const key = `${baseURL}|${config.apiKey}`;
  const cached = clientCache.get(key);
  if (cached) return cached;
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL,
    defaultHeaders: {
      "HTTP-Referer": "https://mystery.local",
      "X-Title": "Mystery Game",
    },
  });
  clientCache.set(key, client);
  return client;
}

/**
 * OpenRouter-specific request body fields (provider routing) for a config.
 * Spread into chat.completions.create params; undefined when not configured.
 */
export function openRouterExtraBody(
  config: LlmConfig
): Record<string, unknown> | undefined {
  return config.provider ? { provider: config.provider } : undefined;
}

/**
 * Every completion carries a hard output ceiling — an unbounded reply is an
 * unbounded bill. Generous: well above the largest legitimate director or
 * performer turn.
 */
export const DEFAULT_MAX_OUTPUT_TOKENS = 3000;

export type CompleteJsonOptions = {
  client: OpenAI;
  model: string;
  system: string;
  user: string;
  temperature?: number;
  /** Output token ceiling. Default DEFAULT_MAX_OUTPUT_TOKENS. */
  maxTokens?: number;
  /**
   * Transport retries for 429/5xx/network (in addition to the first try).
   * Default 2 → up to 3 transport attempts.
   */
  maxTransportRetries?: number;
  /** One JSON-parse repair pass after a non-JSON reply. Default true. */
  jsonRepair?: boolean;
  /** Extra OpenRouter body fields (see openRouterExtraBody). */
  extraBody?: Record<string, unknown>;
};

export type CompleteJsonResult = {
  parsed: unknown;
  raw: string;
  attempts: AttemptLog[];
};

async function onceChatJson(args: {
  client: OpenAI;
  model: string;
  messages: OpenAI.Chat.ChatCompletionMessageParam[];
  temperature: number;
  maxTokens?: number;
  extraBody?: Record<string, unknown>;
}): Promise<string> {
  // extraBody carries OpenRouter fields (provider routing) the OpenAI SDK
  // does not type; the SDK serializes unknown params into the request body.
  const completion = await args.client.chat.completions.create({
    model: args.model,
    temperature: args.temperature,
    max_tokens: args.maxTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
    response_format: { type: "json_object" },
    messages: args.messages,
    ...(args.extraBody ?? {}),
  } as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming);
  return completion.choices[0]?.message?.content ?? "";
}

/**
 * Parse model JSON even when wrapped in markdown fences or prose.
 * DeepSeek and others often return ```json ... ``` despite json_object mode.
 */
export function parseModelJson(raw: string): unknown {
  let s = (raw ?? "").trim();
  if (!s) throw new SyntaxError("Empty model JSON");

  // Full-string markdown fence
  const fenceAll = /^```(?:json|JSON)?\s*\r?\n?([\s\S]*?)\r?\n?```\s*$/;
  const fm = s.match(fenceAll);
  if (fm) s = fm[1]!.trim();

  // Leading fence without clean end
  if (/^```/.test(s)) {
    s = s.replace(/^```(?:json|JSON)?\s*\r?\n?/, "");
    s = s.replace(/\r?\n?```\s*$/, "").trim();
  }

  try {
    return JSON.parse(s) as unknown;
  } catch {
    // Extract outermost object/array
    const objStart = s.indexOf("{");
    const arrStart = s.indexOf("[");
    let start = -1;
    if (objStart >= 0 && (arrStart < 0 || objStart < arrStart)) start = objStart;
    else if (arrStart >= 0) start = arrStart;
    if (start < 0) throw new SyntaxError("No JSON object in model reply");
    const open = s[start];
    const close = open === "{" ? "}" : "]";
    const end = s.lastIndexOf(close);
    if (end <= start) throw new SyntaxError("Unclosed JSON in model reply");
    return JSON.parse(s.slice(start, end + 1)) as unknown;
  }
}

/**
 * Call chat completions expecting a JSON object.
 * - Retries transient transport failures with backoff
 * - One repair pass if the model returns non-JSON
 */
export async function completeJson(
  args: CompleteJsonOptions
): Promise<CompleteJsonResult> {
  const maxTransportRetries = args.maxTransportRetries ?? 2;
  const allowJsonRepair = args.jsonRepair !== false;
  const temperature = args.temperature ?? 0.3;
  const attempts: AttemptLog[] = [];

  const baseMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: args.system },
    { role: "user", content: args.user },
  ];

  let transportAttempt = 0;
  let lastErr: ClassifiedError | undefined;

  while (transportAttempt <= maxTransportRetries) {
    const kind: AttemptKind =
      transportAttempt === 0 ? "initial" : "transport_retry";
    const t0 = Date.now();
    try {
      const raw = await onceChatJson({
        client: args.client,
        model: args.model,
        messages: baseMessages,
        temperature,
        maxTokens: args.maxTokens,
        extraBody: args.extraBody,
      });

      try {
        const parsed = parseModelJson(raw);
        attempts.push({
          kind,
          attempt: transportAttempt,
          ok: true,
          latencyMs: Date.now() - t0,
        });
        return { parsed, raw, attempts };
      } catch (parseErr) {
        attempts.push({
          kind,
          attempt: transportAttempt,
          ok: false,
          failureClass: "parse",
          message: String(parseErr),
          latencyMs: Date.now() - t0,
        });

        if (!allowJsonRepair) {
          throw new ClassifiedError("Model returned invalid JSON", {
            failureClass: "parse",
            cause: parseErr,
          });
        }

        // JSON repair pass (same model, temperature 0)
        const t1 = Date.now();
        try {
          const repairedRaw = await onceChatJson({
            client: args.client,
            model: args.model,
            temperature: 0,
            maxTokens: args.maxTokens,
            extraBody: args.extraBody,
            messages: [
              ...baseMessages,
              { role: "assistant", content: raw || "(empty)" },
              {
                role: "user",
                content:
                  "Your previous reply was not valid JSON. Reply again with ONLY a valid JSON object matching the required shape. No markdown fences, no commentary, no ``` wrappers.",
              },
            ],
          });
          const parsed = parseModelJson(repairedRaw);
          attempts.push({
            kind: "json_repair",
            attempt: 0,
            ok: true,
            latencyMs: Date.now() - t1,
          });
          return { parsed, raw: repairedRaw, attempts };
        } catch (repairErr) {
          const classified = wrapThrown(repairErr);
          attempts.push({
            kind: "json_repair",
            attempt: 0,
            ok: false,
            failureClass: classified.failureClass,
            message: classified.message,
            latencyMs: Date.now() - t1,
          });
          // If repair itself is transport-flaky, continue outer loop
          if (
            isTransportRetryable(classified.failureClass) &&
            transportAttempt < maxTransportRetries
          ) {
            lastErr = classified;
            transportAttempt += 1;
            await sleep(
              backoffMs(transportAttempt - 1, {
                retryAfterMs: classified.retryAfterMs,
              })
            );
            continue;
          }
          throw new ClassifiedError("JSON repair failed", {
            failureClass: "parse",
            cause: repairErr,
          });
        }
      }
    } catch (err) {
      const classified = wrapThrown(err);
      if (classified.failureClass === "parse") {
        // already logged inside
        throw classified;
      }
      attempts.push({
        kind,
        attempt: transportAttempt,
        ok: false,
        failureClass: classified.failureClass,
        message: classified.message,
        latencyMs: Date.now() - t0,
      });
      lastErr = classified;
      if (
        isTransportRetryable(classified.failureClass) &&
        transportAttempt < maxTransportRetries
      ) {
        transportAttempt += 1;
        await sleep(
          backoffMs(transportAttempt - 1, {
            retryAfterMs: classified.retryAfterMs,
          })
        );
        continue;
      }
      throw classified;
    }
  }

  throw (
    lastErr ??
    new ClassifiedError("LLM call failed after retries", {
      failureClass: "unknown",
    })
  );
}

export type ValidateResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: string; failureClass: FailureClass };

export type CompleteJsonValidatedOptions<T> = CompleteJsonOptions & {
  /** Parse + business validation. Called on every successful JSON body. */
  validate: (parsed: unknown) => ValidateResult<T>;
  /** One schema/soft repair after validation failure. Default true. */
  schemaRepair?: boolean;
  /** One extra full retry after soft failure. Default true. */
  softRetry?: boolean;
};

export type CompleteJsonValidatedResult<T> = {
  value: T;
  raw: string;
  attempts: AttemptLog[];
};

/**
 * completeJson + validate, with one schema-repair prompt and one soft retry.
 */
export async function completeJsonValidated<T>(
  args: CompleteJsonValidatedOptions<T>
): Promise<CompleteJsonValidatedResult<T>> {
  const allowSchemaRepair = args.schemaRepair !== false;
  const allowSoftRetry = args.softRetry !== false;
  const allAttempts: AttemptLog[] = [];

  const runOnce = async (
    messagesExtra: OpenAI.Chat.ChatCompletionMessageParam[] = [],
    temperature = args.temperature
  ): Promise<{ value: T; raw: string } | { fail: ValidateResult<T> & { ok: false }; raw: string }> => {
    // For repair rounds we call the lower-level path with custom messages via a wrapper
    if (messagesExtra.length === 0) {
      const res = await completeJson({
        client: args.client,
        model: args.model,
        system: args.system,
        user: args.user,
        temperature,
        maxTokens: args.maxTokens,
        maxTransportRetries: args.maxTransportRetries,
        jsonRepair: args.jsonRepair,
        extraBody: args.extraBody,
      });
      allAttempts.push(...res.attempts);
      const v = args.validate(res.parsed);
      if (v.ok) return { value: v.value, raw: res.raw };
      return { fail: v, raw: res.raw };
    }

    // Custom multi-turn repair: transport-retry the whole completion
    const maxTransportRetries = args.maxTransportRetries ?? 2;
    let transportAttempt = 0;
    while (transportAttempt <= maxTransportRetries) {
      const t0 = Date.now();
      const kind: AttemptKind =
        transportAttempt === 0 ? "schema_repair" : "transport_retry";
      try {
        const raw = await onceChatJson({
          client: args.client,
          model: args.model,
          temperature: temperature ?? 0,
          maxTokens: args.maxTokens,
          extraBody: args.extraBody,
          messages: [
            { role: "system", content: args.system },
            { role: "user", content: args.user },
            ...messagesExtra,
          ],
        });
        let parsed: unknown;
        try {
          parsed = parseModelJson(raw);
        } catch {
          allAttempts.push({
            kind,
            attempt: transportAttempt,
            ok: false,
            failureClass: "parse",
            message: "invalid JSON on repair",
            latencyMs: Date.now() - t0,
          });
          throw new ClassifiedError("Repair returned invalid JSON", {
            failureClass: "parse",
          });
        }
        allAttempts.push({
          kind,
          attempt: transportAttempt,
          ok: true,
          latencyMs: Date.now() - t0,
        });
        const v = args.validate(parsed);
        if (v.ok) return { value: v.value, raw };
        return { fail: v, raw };
      } catch (err) {
        const c = wrapThrown(err);
        allAttempts.push({
          kind,
          attempt: transportAttempt,
          ok: false,
          failureClass: c.failureClass,
          message: c.message,
          latencyMs: Date.now() - t0,
        });
        if (
          isTransportRetryable(c.failureClass) &&
          transportAttempt < maxTransportRetries
        ) {
          transportAttempt += 1;
          await sleep(
            backoffMs(transportAttempt - 1, { retryAfterMs: c.retryAfterMs })
          );
          continue;
        }
        throw c;
      }
    }
    throw new ClassifiedError("Repair failed after transport retries", {
      failureClass: "unknown",
    });
  };

  // Pass 1
  let result = await runOnce();
  if ("value" in result) {
    return { value: result.value, raw: result.raw, attempts: allAttempts };
  }

  let fail = result.fail;
  let lastRaw = result.raw;

  // Schema repair (wrong shape / zod)
  if (
    allowSchemaRepair &&
    (fail.failureClass === "schema" || fail.failureClass === "parse")
  ) {
    result = await runOnce(
      [
        { role: "assistant", content: lastRaw || "(empty)" },
        {
          role: "user",
          content: `Your previous JSON failed validation: ${fail.reason}. Reply again with ONLY a corrected JSON object. No markdown.`,
        },
      ],
      0
    );
    if ("value" in result) {
      return { value: result.value, raw: result.raw, attempts: allAttempts };
    }
    fail = result.fail;
    lastRaw = result.raw;
  }

  // Soft retry (empty narration / useless intents) — full re-ask once
  if (allowSoftRetry && fail.failureClass === "soft") {
    const softUser =
      args.user +
      "\n\n[System note: Your previous output was empty or unusable. Produce a complete, valid JSON response that satisfies all required fields.]";
    const softRes = await completeJson({
      client: args.client,
      model: args.model,
      system: args.system,
      user: softUser,
      temperature: Math.min(args.temperature ?? 0.3, 0.4),
      maxTransportRetries: args.maxTransportRetries,
      jsonRepair: args.jsonRepair,
      extraBody: args.extraBody,
    });
    // tag attempts
    for (const a of softRes.attempts) {
      allAttempts.push({
        ...a,
        kind: a.kind === "initial" ? "soft_retry" : a.kind,
      });
    }
    const v = args.validate(softRes.parsed);
    if (v.ok) {
      return { value: v.value, raw: softRes.raw, attempts: allAttempts };
    }
    fail = v;
  }

  throw new ClassifiedError(fail.reason, {
    failureClass: fail.failureClass,
  });
}

export { formatSchemaIssues };
