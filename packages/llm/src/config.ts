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
  /** OpenRouter provider routing; omitted → OpenRouter default routing. */
  provider?: ProviderRouting;
};

export function tryCreateOpenRouterConfig(
  env: NodeJS.ProcessEnv = process.env
): LlmConfig | null {
  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) return null;
  // Both calls use Sonnet 5 by default; override separately only if you want a cheaper director later.
  const defaultModel = "anthropic/claude-sonnet-5";
  const narratorModel = env.LLM_NARRATOR_MODEL ?? defaultModel;
  const directorModel = env.LLM_DIRECTOR_MODEL ?? env.LLM_NARRATOR_MODEL ?? defaultModel;

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

  return {
    apiKey,
    baseURL: env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
    narratorModel,
    directorModel,
    provider,
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
