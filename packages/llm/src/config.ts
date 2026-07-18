export type LlmConfig = {
  apiKey: string;
  baseURL?: string;
  /** Call #2 — performer / narrator */
  narratorModel: string;
  /** Call #1 — director / intent (defaults to narratorModel) */
  directorModel?: string;
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
  return {
    apiKey,
    baseURL: env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
    narratorModel,
    directorModel,
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
