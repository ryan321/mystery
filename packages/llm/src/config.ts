export type LlmConfig = {
  apiKey: string;
  baseURL?: string;
  narratorModel: string;
};

export function tryCreateOpenRouterConfig(
  env: NodeJS.ProcessEnv = process.env
): LlmConfig | null {
  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) return null;
  return {
    apiKey,
    baseURL: env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
    narratorModel:
      env.LLM_NARRATOR_MODEL ?? "anthropic/claude-sonnet-4",
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
