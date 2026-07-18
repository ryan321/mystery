import OpenAI from "openai";
import type { LlmConfig } from "./config.js";

export function createOpenRouterClient(config: LlmConfig): OpenAI {
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL ?? "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": "https://mystery.local",
      "X-Title": "Mystery Game",
    },
  });
}

export async function completeJson(args: {
  client: OpenAI;
  model: string;
  system: string;
  user: string;
  temperature?: number;
}): Promise<{ parsed: unknown; raw: string }> {
  const completion = await args.client.chat.completions.create({
    model: args.model,
    temperature: args.temperature ?? 0.3,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: args.system },
      { role: "user", content: args.user },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "";
  try {
    return { parsed: JSON.parse(raw), raw };
  } catch {
    const repair = await args.client.chat.completions.create({
      model: args.model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: args.user },
        { role: "assistant", content: raw },
        {
          role: "user",
          content:
            "Your previous reply was not valid JSON. Reply again with ONLY a valid JSON object.",
        },
      ],
    });
    const repaired = repair.choices[0]?.message?.content ?? "{}";
    return { parsed: JSON.parse(repaired), raw: repaired };
  }
}
