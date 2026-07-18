import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseMysteryDefinition,
  type MysteryDefinition,
  type PlaythroughState,
} from "@mystery/shared";
import {
  createInitialPlaythrough,
  validateAndApplyPatch,
  buildContextPack,
  appendDialogueMemory,
} from "@mystery/engine";
import {
  tryCreateOpenRouterConfig,
  narrateTurn,
  heuristicNarrate,
} from "@mystery/llm";
import {
  createPool,
  migrate,
  insertPlaythrough,
  getPlaythrough,
  updatePlaythrough,
  insertTurn,
  listTurns,
  databaseUrl,
} from "./db.js";

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
const pool = createPool();
const llmConfig = tryCreateOpenRouterConfig();

const app = new Hono();

app.use(
  "*",
  cors({
    origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
    credentials: true,
  })
);

app.get("/health", async (c) => {
  let dbOk = false;
  try {
    await pool.query("SELECT 1");
    dbOk = true;
  } catch {
    dbOk = false;
  }
  return c.json({
    ok: dbOk,
    db: dbOk ? "up" : "down",
    cases: [...cases.keys()],
    narrator: llmConfig ? llmConfig.narratorModel : "heuristic",
  });
});

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
  });
});

app.post("/v1/playthroughs", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const caseId =
    (body as { caseId?: string }).caseId ?? "blackwood-inheritance";
  const def = cases.get(caseId);
  if (!def) return c.json({ error: "unknown_case" }, 400);

  const state = createInitialPlaythrough(def);
  await insertPlaythrough(pool, state, def.openingNarration);

  return c.json({
    playthrough: publicState(state),
    openingNarration: def.openingNarration,
    locationName: def.locations.find((l) => l.id === state.locationId)?.name,
  });
});

app.get("/v1/playthroughs/:id", async (c) => {
  const row = await getPlaythrough(pool, c.req.param("id"));
  if (!row) return c.json({ error: "not_found" }, 404);
  const def = cases.get(row.state.caseId);
  const turns = await listTurns(pool, row.state.id);
  return c.json({
    playthrough: publicState(row.state),
    openingNarration: row.openingNarration,
    locationName: def?.locations.find((l) => l.id === row.state.locationId)
      ?.name,
    turns: turns.map((t) => ({
      turnIndex: t.turn_index,
      playerInput: t.player_input,
      narration: t.narration,
      dialogue: t.dialogue,
      evidenceAdded: t.evidence_added,
      createdAt: t.created_at,
    })),
  });
});

app.post("/v1/playthroughs/:id/turns", async (c) => {
  const row = await getPlaythrough(pool, c.req.param("id"));
  if (!row) return c.json({ error: "not_found" }, 404);

  let state = row.state;
  if (state.status !== "active") {
    return c.json({ error: "case_not_active", status: state.status }, 400);
  }

  const def = cases.get(state.caseId);
  if (!def) return c.json({ error: "case_missing" }, 500);

  const body = await c.req.json();
  const input = String((body as { input?: string }).input ?? "").trim();
  if (!input) return c.json({ error: "empty_input" }, 400);
  if (input.length > 4000) {
    return c.json({ error: "input_too_long" }, 400);
  }

  const contextPack = buildContextPack(def, state);

  let narrate;
  try {
    narrate = await narrateTurn(llmConfig, {
      contextPack,
      playerInput: input,
    }, {
      heuristicFallback: (a) =>
        heuristicNarrate({
          contextPack: a.contextPack as Parameters<
            typeof heuristicNarrate
          >[0]["contextPack"],
          playerInput: a.playerInput,
        }),
    });
  } catch (err) {
    console.error("narrator failed", err);
    // fall back to heuristic
    const output = heuristicNarrate({
      contextPack: contextPack as Parameters<
        typeof heuristicNarrate
      >[0]["contextPack"],
      playerInput: input,
    });
    narrate = {
      output,
      model: "heuristic-fallback",
      mock: true,
      latencyMs: 0,
    };
  }

  const modelOut = narrate.output;
  const { applied, rejected, nextState, evidenceAdded } =
    validateAndApplyPatch(def, state, modelOut.patch ?? {});

  let committed: PlaythroughState = appendDialogueMemory(
    nextState,
    input,
    modelOut
  );
  committed = {
    ...committed,
    turnCount: state.turnCount + 1,
    updatedAt: new Date().toISOString(),
  };

  try {
    await updatePlaythrough(pool, committed);
  } catch (err) {
    if (err instanceof Error && err.message === "playthrough_conflict") {
      return c.json({ error: "conflict", message: "Stale playthrough" }, 409);
    }
    throw err;
  }

  await insertTurn(pool, {
    playthroughId: committed.id,
    turnIndex: committed.turnCount,
    playerInput: input,
    narration: modelOut.narration,
    dialogue: modelOut.dialogue ?? [],
    appliedPatch: applied,
    rejected,
    evidenceAdded,
    model: narrate.model,
    mock: narrate.mock,
    latencyMs: narrate.latencyMs,
  });

  return c.json({
    narration: modelOut.narration,
    dialogue: modelOut.dialogue ?? [],
    playthrough: publicState(committed),
    appliedPatch: applied,
    rejected,
    evidenceAdded,
    locationName: def.locations.find((l) => l.id === committed.locationId)
      ?.name,
    _debug: {
      mock: narrate.mock,
      model: narrate.model,
      latencyMs: narrate.latencyMs,
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

async function main() {
  console.log(`Database: ${databaseUrl().replace(/:[^:@/]+@/, ":***@")}`);
  await migrate(pool);
  const port = Number(process.env.PORT ?? 8787);
  console.log(`Mystery API listening on http://localhost:${port}`);
  console.log(`Loaded cases: ${[...cases.keys()].join(", ") || "(none)"}`);
  console.log(
    `Narrator: ${llmConfig ? llmConfig.narratorModel : "heuristic (no OPENROUTER_API_KEY)"}`
  );
  serve({ fetch: app.fetch, port });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
