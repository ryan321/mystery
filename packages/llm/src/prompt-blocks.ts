/**
 * Prompt assembly optimized for provider prefix caching.
 *
 * DeepSeek and OpenAI cache automatically on the longest byte-identical
 * message prefix; Anthropic caches via explicit breakpoints. Either way the
 * rule is the same: stable content first, volatile content last.
 *
 * Layout per call:
 *   system prompt (static per role)
 *   ## Case reference — memoized static case JSON (engine staticCasePackJson)
 *   ## Current turn state — per-turn pack, compact JSON
 *   ## Player input / notes / justHappened — most volatile, at the end
 *
 * Retry paths preserve the prefix: soft-retry appends to the END of the user
 * message and repair rounds append extra messages after it.
 */

/** Stable preamble — must stay byte-identical across turns. */
export function staticCaseHeader(staticCaseJson: string): string {
  return [
    "## Case reference (stable — identical every turn)",
    "```json",
    staticCaseJson,
    "```",
  ].join("\n");
}

/**
 * Per-turn slice of the full ContextPack for prompt use when a static case
 * block is also being sent: drops what the static block already carries
 * (cast directory, static policy strings). Everything else is untouched.
 */
export function dynamicPromptPack(fullPack: unknown): unknown {
  if (!fullPack || typeof fullPack !== "object") return fullPack;
  const p = { ...(fullPack as Record<string, unknown>) };
  delete p.cast;
  const policy = p.policy;
  if (policy && typeof policy === "object") {
    const pol = policy as Record<string, unknown>;
    const dynamicPolicy: Record<string, unknown> = {};
    if (pol.denouement !== undefined) dynamicPolicy.denouement = pol.denouement;
    if (pol.accusations !== undefined) {
      dynamicPolicy.accusations = pol.accusations;
    }
    p.policy = dynamicPolicy;
  }
  return p;
}

/** Compact JSON for prompts — pretty-printing costs ~25–40% more tokens. */
export function promptJson(value: unknown): string {
  return JSON.stringify(value);
}
