import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseMysteryDefinition, type MysteryDefinition } from "@mystery/shared";
import {
  createInitialPlaythrough,
  validateAndApplyPatch,
  buildContextPack,
} from "@mystery/engine";
import type { PlaythroughState, TurnModelOutput } from "@mystery/shared";

const __dirname = dirname(fileURLToPath(import.meta.url));
const contentRoot = join(__dirname, "../../../content/cases");

function loadCases(): Map<string, MysteryDefinition> {
  const map = new Map<string, MysteryDefinition>();
  for (const dir of readdirSync(contentRoot, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const path = join(contentRoot, dir.name, "definition.json");
    try {
      const def = parseMysteryDefinition(
        JSON.parse(readFileSync(path, "utf8"))
      );
      map.set(def.id, def);
    } catch (err) {
      console.warn(`Skip case ${dir.name}:`, err);
    }
  }
  return map;
}

const cases = loadCases();
/** In-memory store for Phase 1 vertical slice. Replace with Postgres. */
const playthroughs = new Map<string, PlaythroughState>();
const openingByPlaythrough = new Map<string, string>();

const app = new Hono();

app.use(
  "*",
  cors({
    origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
    credentials: true,
  })
);

app.get("/health", (c) => c.json({ ok: true, cases: [...cases.keys()] }));

app.get("/v1/cases", (c) => {
  const list = [...cases.values()].map((def) => ({
    id: def.id,
    contentVersion: def.contentVersion,
    meta: def.meta,
  }));
  return c.json({ cases: list });
});

app.get("/v1/cases/:caseId", (c) => {
  const def = cases.get(c.req.param("caseId"));
  if (!def) return c.json({ error: "not_found" }, 404);
  return c.json({
    id: def.id,
    contentVersion: def.contentVersion,
    meta: def.meta,
    // never solution
  });
});

app.post("/v1/playthroughs", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const caseId = (body as { caseId?: string }).caseId ?? "blackwood-inheritance";
  const def = cases.get(caseId);
  if (!def) return c.json({ error: "unknown_case" }, 400);

  const state = createInitialPlaythrough(def);
  playthroughs.set(state.id, state);
  openingByPlaythrough.set(state.id, def.openingNarration);

  return c.json({
    playthrough: publicState(state),
    openingNarration: def.openingNarration,
    locationName: def.locations.find((l) => l.id === state.locationId)?.name,
  });
});

app.get("/v1/playthroughs/:id", (c) => {
  const state = playthroughs.get(c.req.param("id"));
  if (!state) return c.json({ error: "not_found" }, 404);
  const def = cases.get(state.caseId);
  return c.json({
    playthrough: publicState(state),
    openingNarration: openingByPlaythrough.get(state.id),
    locationName: def?.locations.find((l) => l.id === state.locationId)?.name,
  });
});

/**
 * Phase 1 stub turn: applies a hand-validated empty patch path when no LLM key,
 * or will call OpenRouter once llm package is wired in Phase 1 complete.
 *
 * For now: echo engine context pack size + require client to use mock only if
 * OPENROUTER not set — actually better: deterministic mock narrator for offline dev.
 */
app.post("/v1/playthroughs/:id/turns", async (c) => {
  const state = playthroughs.get(c.req.param("id"));
  if (!state) return c.json({ error: "not_found" }, 404);
  if (state.status !== "active") {
    return c.json({ error: "case_not_active", status: state.status }, 400);
  }

  const def = cases.get(state.caseId);
  if (!def) return c.json({ error: "case_missing" }, 500);

  const body = await c.req.json();
  const input = String((body as { input?: string }).input ?? "").trim();
  if (!input) return c.json({ error: "empty_input" }, 400);

  const contextPack = buildContextPack(def, state);

  // Offline-safe mock until OpenRouter narrator is implemented end-to-end.
  // Still runs full validateAndApplyPatch when a structured patch is supplied
  // by a future LLM path; mock proposes nothing illegal.
  const modelOut: TurnModelOutput = {
    narration: mockNarration(input, contextPack),
    dialogue: [],
    patch: {},
    intentGuess: "other",
  };

  const { applied, rejected, nextState, evidenceAdded } = validateAndApplyPatch(
    def,
    state,
    modelOut.patch
  );

  nextState.turnCount = state.turnCount + 1;
  playthroughs.set(state.id, nextState);

  return c.json({
    narration: modelOut.narration,
    dialogue: modelOut.dialogue ?? [],
    playthrough: publicState(nextState),
    appliedPatch: applied,
    rejected,
    evidenceAdded,
    locationName: def.locations.find((l) => l.id === nextState.locationId)
      ?.name,
    // debug assist for development — strip in production
    _debug: {
      contextPackKeys: Object.keys(contextPack),
      mock: true,
    },
  });
});

function publicState(state: PlaythroughState) {
  return {
    id: state.id,
    caseId: state.caseId,
    contentVersion: state.contentVersion,
    status: state.status,
    locationId: state.locationId,
    evidenceIds: state.evidenceIds,
    flags: state.flags,
    notebook: state.notebook,
    visitedLocationIds: state.visitedLocationIds,
    turnCount: state.turnCount,
  };
}

function mockNarration(
  input: string,
  contextPack: ReturnType<typeof buildContextPack>
): string {
  return (
    `You consider: “${input}” ` +
    `You are still in ${contextPack.location.name}. ` +
    `(Dev mock narrator — wire OpenRouter in packages/llm for live AI. ` +
    `Exits: ${contextPack.location.exits.map((e) => e.label).join("; ") || "none"}.)`
  );
}

const port = Number(process.env.PORT ?? 8787);
console.log(`Mystery API listening on http://localhost:${port}`);
console.log(`Loaded cases: ${[...cases.keys()].join(", ") || "(none)"}`);

serve({ fetch: app.fetch, port });
