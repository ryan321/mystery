#!/usr/bin/env tsx
/**
 * Eval model pairs on a real turn: same case, same player input, real
 * director → intents-to-patch → performer pipeline. Measures speed
 * (per-call wall time), cost (OpenRouter-reported USD), and quality
 * (validation retries + an LLM judge scoring grounding/prose/responsiveness).
 *
 *   pnpm eval-models                                  # default pairs, turn-1 "Look around"
 *   pnpm eval-models -- --input "Look on the ground"
 *   pnpm eval-models -- --pair "qwen/qwen3.5-27b|moonshotai/kimi-k2.5" \
 *       --pair "anthropic/claude-haiku-4-5|anthropic/claude-haiku-4-5"
 *   pnpm eval-models -- --case blackwood-inheritance --runs 3 --no-judge
 *
 * Pair syntax: "directorModel|narratorModel". Judge defaults to Sonnet 5
 * (its cost is reported separately, not counted against the pair).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import {
  buildContextPack,
  createInitialPlaythrough,
  directorIntentsToPatch,
  staticCasePackJson,
} from "@mystery/engine";
import {
  runDirector,
  runPerformer,
  createOpenRouterClient,
  completeJson,
  type AttemptLog,
  type LlmConfig,
} from "@mystery/llm";
import { parseMysteryDefinition } from "@mystery/shared";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
loadEnv({ path: join(repoRoot, ".env"), quiet: true });

const DEFAULT_PAIRS = [
  "qwen/qwen3.5-27b|moonshotai/kimi-k2.5",
  "qwen/qwen3.5-27b|z-ai/glm-4.7:nitro",
  "anthropic/claude-haiku-4-5|anthropic/claude-haiku-4-5",
  "anthropic/claude-sonnet-5|anthropic/claude-sonnet-5",
];

function usage(): never {
  console.error(
    'usage: pnpm eval-models -- [--pair "director|narrator"]... [--input "..."] [--case id] [--runs N] [--judge model] [--no-judge]'
  );
  process.exit(1);
}

const argv = process.argv.slice(2);
const pairs: string[] = [];
let playerInput = "Look around";
let caseId = "blackwood-inheritance";
let runs = 1;
let judgeModel: string | null = "anthropic/claude-sonnet-5";
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--") continue; // pnpm forwards the separator
  else if (a === "--pair") pairs.push(argv[++i] ?? usage());
  else if (a === "--input") playerInput = argv[++i] ?? usage();
  else if (a === "--case") caseId = argv[++i] ?? usage();
  else if (a === "--runs") runs = Number(argv[++i] ?? usage()) || 1;
  else if (a === "--judge") judgeModel = argv[++i] ?? usage();
  else if (a === "--no-judge") judgeModel = null;
  else usage();
}
if (pairs.length === 0) pairs.push(...DEFAULT_PAIRS);

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  console.error("OPENROUTER_API_KEY missing (root .env)");
  process.exit(1);
}

const defPath = join(repoRoot, "content", "cases", caseId, "definition.json");
const def = parseMysteryDefinition(JSON.parse(readFileSync(defPath, "utf8")));

type AttemptStats = {
  calls: number;
  retries: string[];
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  providers: Set<string>;
};

function tally(attempts: AttemptLog[] | undefined): AttemptStats {
  const s: AttemptStats = {
    calls: 0,
    retries: [],
    promptTokens: 0,
    completionTokens: 0,
    costUsd: 0,
    providers: new Set(),
  };
  for (const a of attempts ?? []) {
    s.calls += 1;
    if (a.kind !== "initial") s.retries.push(a.kind);
    if (!a.ok && a.failureClass) s.retries.push(`fail:${a.failureClass}`);
    s.promptTokens += a.usage?.promptTokens ?? 0;
    s.completionTokens += a.usage?.completionTokens ?? 0;
    s.costUsd += a.usage?.costUsd ?? 0;
    if (a.usage?.provider) s.providers.add(a.usage.provider);
  }
  return s;
}

const JUDGE_SYSTEM = `You are grading one turn of a fair-play mystery game. You get the closed-world context pack (ground truth), the player's input, and the narrator's output. Score 0-10 each:
- grounding: every character, location, object mentioned exists in the pack AND is where the narration says it is. Inventing people/places or placing absent people in the room is disqualifying (0-3).
- prose: atmosphere, economy, craft. Purple filler and cliché lower the score.
- responsiveness: does it answer the player's actual input, surfacing what they would perceive?
Output ONLY JSON: {"grounding": n, "prose": n, "responsiveness": n, "issues": ["short strings"]}`;

async function judge(
  pack: unknown,
  narration: string,
  dialogue: unknown
): Promise<{ scores: Record<string, number>; issues: string[]; costUsd: number } | null> {
  if (!judgeModel) return null;
  const client = createOpenRouterClient({ apiKey: apiKey!, narratorModel: judgeModel });
  const res = await completeJson({
    client,
    model: judgeModel,
    system: JUDGE_SYSTEM,
    user: JSON.stringify({ contextPack: pack, playerInput, narration, dialogue }),
    temperature: 0,
    extraBody: { reasoning: { enabled: false } },
  });
  const p = res.parsed as Record<string, unknown>;
  const num = (k: string) => (typeof p[k] === "number" ? (p[k] as number) : NaN);
  return {
    scores: {
      grounding: num("grounding"),
      prose: num("prose"),
      responsiveness: num("responsiveness"),
    },
    issues: Array.isArray(p.issues) ? (p.issues as string[]).slice(0, 6) : [],
    costUsd: tally(res.attempts).costUsd,
  };
}

type Row = Record<string, unknown>;
const results: Row[] = [];

for (const pair of pairs) {
  const [directorModel, narratorModel] = pair.split("|").map((s) => s.trim());
  if (!directorModel || !narratorModel) usage();

  for (let run = 1; run <= runs; run++) {
    const config: LlmConfig = {
      apiKey,
      narratorModel,
      directorModel,
      reasoning: { enabled: false },
    };
    // Fresh state per run — identical starting turn for every pair.
    const state = createInitialPlaythrough(def, `eval-${Date.now()}`);
    const staticCaseJson = staticCasePackJson(def);
    const directorPack = buildContextPack(def, state);

    const label = runs > 1 ? `${pair} #${run}` : pair;
    process.stderr.write(`… ${label}\n`);
    try {
      const director = await runDirector(config, {
        contextPack: directorPack,
        playerInput,
        boundaryHint: null,
        staticCaseJson,
      });
      const { patch: _patch, focusCharacterId, notes } = directorIntentsToPatch(
        def,
        state,
        director.output,
        playerInput
      );
      const performerPack = buildContextPack(def, state, {
        focusCharacterId,
        justHappened: [],
        resolvedIntents: notes,
      });
      const performer = await runPerformer(config, {
        contextPack: performerPack,
        playerInput,
        justHappened: [],
        resolvedNotes: notes,
        staticCaseJson,
      });

      const dStats = tally(director.attempts);
      const pStats = tally(performer.attempts);
      const j = await judge(
        performerPack,
        performer.output.narration,
        performer.output.dialogue
      );

      results.push({
        pair: label,
        directorModel,
        narratorModel,
        directorMs: director.latencyMs,
        performerMs: performer.latencyMs,
        totalMs: director.latencyMs + performer.latencyMs,
        degraded: Boolean(director.degraded) || performer.mock,
        retries: [...dStats.retries, ...pStats.retries],
        promptTokens: dStats.promptTokens + pStats.promptTokens,
        completionTokens: dStats.completionTokens + pStats.completionTokens,
        costUsd: dStats.costUsd + pStats.costUsd,
        providers: [...dStats.providers, ...pStats.providers].join(","),
        judge: j?.scores ?? null,
        judgeIssues: j?.issues ?? [],
        judgeCostUsd: j?.costUsd ?? 0,
        narration: performer.output.narration,
        dialogue: performer.output.dialogue,
        intents: director.output.intents,
      });
    } catch (err) {
      results.push({ pair: label, directorModel, narratorModel, error: String(err) });
    }
  }
}

// ---- report ----
const fmt = (n: unknown, d = 1) => (typeof n === "number" && !Number.isNaN(n) ? n.toFixed(d) : "—");
console.log(
  "\npair".padEnd(55) +
    "total".padStart(7) +
    "dir".padStart(6) +
    "perf".padStart(7) +
    "$/turn".padStart(9) +
    "$/100t".padStart(8) +
    "grnd".padStart(6) +
    "prose".padStart(6) +
    "resp".padStart(6) +
    "  retries"
);
for (const r of results) {
  if (r.error) {
    console.log(`${String(r.pair).padEnd(54)}  ERROR: ${String(r.error).slice(0, 80)}`);
    continue;
  }
  const jj = r.judge as Record<string, number> | null;
  console.log(
    String(r.pair).padEnd(54) +
      `${fmt((r.totalMs as number) / 1000)}s`.padStart(7) +
      `${fmt((r.directorMs as number) / 1000)}s`.padStart(6) +
      `${fmt((r.performerMs as number) / 1000)}s`.padStart(7) +
      `$${fmt(r.costUsd, 4)}`.padStart(9) +
      `$${fmt((r.costUsd as number) * 100, 2)}`.padStart(8) +
      fmt(jj?.grounding, 0).padStart(6) +
      fmt(jj?.prose, 0).padStart(6) +
      fmt(jj?.responsiveness, 0).padStart(6) +
      `  ${(r.retries as string[]).join(",") || "-"}${r.degraded ? " DEGRADED" : ""}`
  );
  const issues = r.judgeIssues as string[];
  if (issues.length) console.log(`    issues: ${issues.join(" | ").slice(0, 140)}`);
  console.log(`    > ${String(r.narration).replace(/\n/g, " ").slice(0, 130)}`);
}

const outPath = join(tmpdir(), `eval-models-${Date.now()}.json`);
writeFileSync(outPath, JSON.stringify({ caseId, playerInput, results }, null, 2));
console.log(`\nFull results: ${outPath}`);
