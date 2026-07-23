import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Guard-lockstep test (docs/GAME_ARCHITECTURE.md). Per-game isolation means
 * each mystery owns a COPY of the turn loop, so a security fix applied to one
 * loop won't automatically reach another. The integrity guards themselves live
 * INSIDE shared engine/LLM primitives — reserved-flag / solution-leak strip in
 * `directorIntentsToPatch`, closed-world id allowlists in `validateAndApplyPatch`,
 * world→player effect sanitize in `resolveWorldToPlayer`, absent-speaker filter
 * in `runPerformer`, and boundary neutralization via `neutralizePatchForBoundary`.
 * So the invariant we enforce is: EVERY turn loop must invoke every one of them.
 * A game whose loop drops one silently loses that guard — this test fails first.
 *
 * This checks presence, not order or full parity: games are meant to diverge in
 * gameplay, just never to skip an integrity primitive.
 */
const REQUIRED_GUARDS = [
  "directorIntentsToPatch",
  "validateAndApplyPatch",
  "resolveWorldToPlayer",
  "neutralizePatchForBoundary",
  "runPerformer",
] as const;

const apiSrc = join(dirname(fileURLToPath(import.meta.url)), "..");

/** The shared default loop plus every per-game `*-turn.ts`. */
function turnLoopFiles(): { name: string; src: string }[] {
  const paths = [join(apiSrc, "turn-pipeline.ts")];
  for (const f of readdirSync(join(apiSrc, "games"))) {
    if (f.endsWith("-turn.ts")) paths.push(join(apiSrc, "games", f));
  }
  return paths.map((p) => ({
    name: p.split("/").slice(-2).join("/"),
    src: readFileSync(p, "utf8"),
  }));
}

describe("turn-loop integrity guards stay in lockstep", () => {
  const loops = turnLoopFiles();

  it("discovers the shared loop and each game's copy", () => {
    // Sanity: we found turn-pipeline.ts and at least Blackwood's copy.
    expect(loops.length).toBeGreaterThanOrEqual(2);
    expect(loops.some((l) => l.name.endsWith("turn-pipeline.ts"))).toBe(true);
  });

  for (const loop of loops) {
    for (const guard of REQUIRED_GUARDS) {
      it(`${loop.name} invokes ${guard}`, () => {
        expect(loop.src).toContain(guard);
      });
    }
  }
});
