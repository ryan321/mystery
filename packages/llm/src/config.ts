/**
 * OpenRouter provider routing (request body `provider` field). Pinning one
 * provider via `order` keeps consecutive turns on the same backend so its
 * prompt-prefix cache actually hits — OpenRouter's default price-based
 * routing hops providers and silently defeats the static-pack cache layout.
 */
export type ProviderRouting = {
  /** Providers to try first, in order (e.g. ["deepseek"]). */
  order?: string[];
  /** With order set: whether other providers may serve if those fail. */
  allow_fallbacks?: boolean;
  /** "throughput" | "latency" | "price" */
  sort?: string;
};

export type LlmConfig = {
  apiKey: string;
  baseURL?: string;
  /** Call #2 — performer / narrator */
  narratorModel: string;
  /** Call #1 — director / intent (defaults to narratorModel) */
  directorModel?: string;
  /**
   * Small structured side-calls (classify-physical, extract-accusation) —
   * narrow deterministic tasks. Point at a cheap/fast model (LLM_AUX_MODEL) to
   * cut per-turn cost; defaults to the director model (no change if unset).
   */
  auxModel?: string;
  /** OpenRouter provider routing; omitted → OpenRouter default routing. */
  provider?: ProviderRouting;
  /**
   * OpenRouter unified reasoning control. Defaults to { enabled: false }:
   * many open-weight models (Qwen3.5, Kimi K2.5) reason by default, which
   * multiplies output tokens ~5-15x and can consume the whole max_tokens
   * budget before any JSON appears — a 230s turn in prod. Turns are
   * latency-bound; reasoning is opt-in via LLM_REASONING_ENABLED=true.
   */
  reasoning?: { enabled: boolean };
};

export function tryCreateOpenRouterConfig(
  env: NodeJS.ProcessEnv = process.env
): LlmConfig | null {
  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) return null;
  // Production (Fly mysterytrove-api, 2026-07): director qwen/qwen3.5-35b-a3b,
  // narrator deepseek/deepseek-v4-pro, aux google/gemini-2.5-flash — balance of
  // quality / speed / cost. Defaults below are local-dev fallbacks only.
  const defaultModel = "anthropic/claude-sonnet-5";
  const narratorModel = env.LLM_NARRATOR_MODEL ?? defaultModel;
  const directorModel = env.LLM_DIRECTOR_MODEL ?? env.LLM_NARRATOR_MODEL ?? defaultModel;
  // Cheap/fast model for the small structured side-calls; falls back to the
  // director model so nothing changes until LLM_AUX_MODEL is set.
  const auxModel = env.LLM_AUX_MODEL ?? directorModel;

  // OPENROUTER_PROVIDER_ORDER=deepseek[,other] pins routing for cache hits.
  // Fallbacks stay on unless OPENROUTER_ALLOW_FALLBACKS=false: a provider
  // outage then costs a cache miss instead of degrading turns to heuristics.
  const providerOrder = (env.OPENROUTER_PROVIDER_ORDER ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const providerSort = env.OPENROUTER_PROVIDER_SORT;
  let provider: ProviderRouting | undefined;
  if (providerOrder.length > 0 || providerSort) {
    provider = {};
    if (providerOrder.length > 0) {
      provider.order = providerOrder;
      provider.allow_fallbacks = env.OPENROUTER_ALLOW_FALLBACKS !== "false";
    }
    if (providerSort) provider.sort = providerSort;
  }

  // Reasoning off unless explicitly re-enabled (see LlmConfig.reasoning).
  const reasoning =
    env.LLM_REASONING_ENABLED === "true" ? undefined : { enabled: false };

  return {
    apiKey,
    baseURL: env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
    narratorModel,
    directorModel,
    auxModel,
    provider,
    reasoning,
  };
}

/** @deprecated use tryCreateOpenRouterConfig — throws if missing */
export function createOpenRouterConfig(
  env: NodeJS.ProcessEnv = process.env
): LlmConfig {
  const cfg = tryCreateOpenRouterConfig(env);
  if (!cfg) throw new Error("OPENROUTER_API_KEY is required");
  return cfg;
}
