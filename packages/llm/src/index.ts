/**
 * OpenRouter / LLM integration.
 * Phase 1: client + prompt builders will live here.
 * Narrator calls must never receive full solution payloads — only ContextPack.
 */

export type LlmConfig = {
  apiKey: string;
  baseURL?: string;
  narratorModel: string;
};

export function createOpenRouterConfig(
  env: NodeJS.ProcessEnv = process.env
): LlmConfig {
  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is required");
  }
  return {
    apiKey,
    baseURL: env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
    narratorModel:
      env.LLM_NARRATOR_MODEL ?? "anthropic/claude-sonnet-4",
  };
}
