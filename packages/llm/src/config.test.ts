import { describe, it, expect } from "vitest";
import { tryCreateOpenRouterConfig } from "./config.js";
import { openRouterExtraBody } from "./client.js";

describe("tryCreateOpenRouterConfig reasoning default", () => {
  it("disables reasoning by default", () => {
    const cfg = tryCreateOpenRouterConfig({ OPENROUTER_API_KEY: "k" } as NodeJS.ProcessEnv);
    expect(cfg?.reasoning).toEqual({ enabled: false });
    expect(openRouterExtraBody(cfg!)).toEqual({ reasoning: { enabled: false } });
  });

  it("omits the reasoning field when LLM_REASONING_ENABLED=true", () => {
    const cfg = tryCreateOpenRouterConfig({
      OPENROUTER_API_KEY: "k",
      LLM_REASONING_ENABLED: "true",
    } as NodeJS.ProcessEnv);
    expect(cfg?.reasoning).toBeUndefined();
    expect(openRouterExtraBody(cfg!)).toBeUndefined();
  });

  it("keeps provider routing alongside reasoning", () => {
    const cfg = tryCreateOpenRouterConfig({
      OPENROUTER_API_KEY: "k",
      OPENROUTER_PROVIDER_ORDER: "deepinfra",
    } as NodeJS.ProcessEnv);
    expect(openRouterExtraBody(cfg!)).toEqual({
      provider: { order: ["deepinfra"], allow_fallbacks: true },
      reasoning: { enabled: false },
    });
  });
});
