import { describe, expect, it } from "vitest";
import { parseModelJson } from "./client.js";

describe("parseModelJson", () => {
  it("parses bare object", () => {
    expect(parseModelJson('{"intents":[{"type":"look"}]}')).toEqual({
      intents: [{ type: "look" }],
    });
  });

  it("strips markdown json fences", () => {
    const raw = '```json\n{\n  "intents": [ { "type": "assault", "characterId": "dr-silas-more" } ]\n}\n```';
    expect(parseModelJson(raw)).toEqual({
      intents: [{ type: "assault", characterId: "dr-silas-more" }],
    });
  });

  it("strips plain fences", () => {
    const raw = '```\n{"a":1}\n```';
    expect(parseModelJson(raw)).toEqual({ a: 1 });
  });

  it("extracts object from prose wrapper", () => {
    const raw = 'Here is the JSON:\n{"intents":[{"type":"look"}]}\nThanks';
    expect(parseModelJson(raw)).toEqual({
      intents: [{ type: "look" }],
    });
  });
});
