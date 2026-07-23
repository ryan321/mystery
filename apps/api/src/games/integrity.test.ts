import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Integrity lives in ONE shared turn helper (`standard-turn.ts`), which every
 * default and thin game module composes. Games must not fork a private loop
 * that drops guards. If a game needs a fully custom turn, it must still call
 * these engine primitives (and should be listed here if it grows its own file).
 *
 * Guards live in engine/LLM primitives:
 *   directorIntentsToPatch, validateAndApplyPatch, resolveWorldToPlayer,
 *   neutralizePatchForBoundary, runPerformer.
 */
const REQUIRED_GUARDS = [
  "directorIntentsToPatch",
  "validateAndApplyPatch",
  "resolveWorldToPlayer",
  "neutralizePatchForBoundary",
  "runPerformer",
] as const;

const standardTurnPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "standard-turn.ts"
);

describe("standardTurn integrity guards", () => {
  const src = readFileSync(standardTurnPath, "utf8");

  it("is the single shared turn composition point", () => {
    expect(src).toContain("export async function standardTurn");
  });

  for (const guard of REQUIRED_GUARDS) {
    it(`invokes ${guard}`, () => {
      expect(src).toContain(guard);
    });
  }
});
