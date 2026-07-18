import { config as loadEnv } from "dotenv";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname, normalize, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseMysteryDefinition,
  type MysteryDefinition,
  type PlaythroughState,
} from "@mystery/shared";
import { createInitialPlaythrough } from "@mystery/engine";
import { tryCreateOpenRouterConfig } from "@mystery/llm";
import {
  createPool,
  migrate,
  insertPlaythrough,
  getPlaythrough,
  commitTurn,
  listTurns,
  databaseUrl,
} from "./db.js";
import { runTurnPipeline } from "./turn-pipeline.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "../../..");
// Load repo-root .env (OPENROUTER_API_KEY, DATABASE_URL, LLM_NARRATOR_MODEL, …)
loadEnv({ path: join(repoRoot, ".env") });

const contentRoot = join(repoRoot, "content/cases");

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
    player: {
      personaId: def.player.personaId,
      displayName: def.player.displayName,
      fullName: def.player.fullName,
      addressAs: def.player.addressAs ?? def.player.displayName,
      pronouns: def.player.pronouns,
      role: def.player.role,
      authority: def.player.authority,
      gender: def.player.gender,
      age: def.player.age,
      appearance: def.player.appearance,
      clothing: def.player.clothing,
      background: def.player.background,
      publicPerception: def.player.publicPerception,
      objective: def.player.objective,
      startingKnowledge: def.player.startingKnowledge,
    },
    cast: def.characters.map((ch) => ({
      id: ch.id,
      name: ch.name,
      shortBio: ch.shortBio,
      storyRole: ch.storyRole ?? "suspect",
      portrait: ch.portrait,
      portraitUrl: ch.portrait
        ? `/v1/cases/${def.id}/assets/${ch.portrait}`
        : undefined,
    })),
  });
});

/**
 * Serve case content assets (portraits, etc.) under content/cases/<id>/.
 * Path is relative to the case folder; traversal is rejected.
 */
app.get("/v1/cases/:caseId/assets/*", async (c) => {
  const caseId = c.req.param("caseId");
  if (!cases.has(caseId)) return c.json({ error: "not_found" }, 404);

  const prefix = `/v1/cases/${caseId}/assets/`;
  const raw = c.req.path.startsWith(prefix)
    ? c.req.path.slice(prefix.length)
    : "";
  const rel = normalize(decodeURIComponent(raw)).replace(/^(\.\.(\/|\\|$))+/, "");
  if (!rel || rel.startsWith("..") || rel.includes("/../") || rel.includes("\\")) {
    return c.json({ error: "invalid_path" }, 400);
  }

  const caseRoot = resolve(contentRoot, caseId);
  const full = resolve(caseRoot, rel);
  if (!full.startsWith(caseRoot + "/") && full !== caseRoot) {
    return c.json({ error: "invalid_path" }, 400);
  }
  if (!existsSync(full) || !statSync(full).isFile()) {
    return c.json({ error: "not_found" }, 404);
  }

  const ext = extname(full).toLowerCase();
  const types: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
  };
  const body = readFileSync(full);
  return new Response(body, {
    headers: {
      "Content-Type": types[ext] ?? "application/octet-stream",
      "Cache-Control": "public, max-age=3600",
    },
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
    playthrough: publicState(state, def),
    openingNarration: def.openingNarration,
    briefing: buildBriefing(def, state),
    locationName: def.locations.find((l) => l.id === state.locationId)?.name,
  });
});

app.get("/v1/playthroughs/:id", async (c) => {
  const row = await getPlaythrough(pool, c.req.param("id"));
  if (!row) return c.json({ error: "not_found" }, 404);
  const def = cases.get(row.state.caseId);
  const turns = await listTurns(pool, row.state.id);
  return c.json({
    playthrough: publicState(row.state, def),
    openingNarration: row.openingNarration,
    briefing: def ? buildBriefing(def, row.state) : undefined,
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
  if (state.status !== "active" && state.status !== "denouement") {
    return c.json(
      {
        error: "case_not_active",
        status: state.status,
        message: "Case is fully closed. Start a new playthrough.",
      },
      400
    );
  }

  const def = cases.get(state.caseId);
  if (!def) return c.json({ error: "case_missing" }, 500);

  const body = await c.req.json();
  const input = String((body as { input?: string }).input ?? "").trim();
  if (!input) return c.json({ error: "empty_input" }, 400);
  if (input.length > 4000) {
    return c.json({ error: "input_too_long" }, 400);
  }

  let result;
  try {
    result = await runTurnPipeline({
      def,
      state,
      playerInput: input,
      llmConfig,
    });
  } catch (err) {
    console.error("turn pipeline failed", err);
    return c.json(
      {
        error: "turn_failed",
        message: err instanceof Error ? err.message : "unknown",
      },
      500
    );
  }

  const committed = result.state;

  try {
    await commitTurn(pool, committed, {
      playthroughId: committed.id,
      turnIndex: committed.turnCount,
      playerInput: input,
      narration: result.narration,
      dialogue: result.dialogue,
      appliedPatch: result.appliedPatch,
      rejected: result.rejected,
      evidenceAdded: result.evidenceAdded,
      model: `${result.debug.directorModel}+${result.debug.performerModel}`,
      mock: result.debug.directorMock || result.debug.performerMock,
      latencyMs:
        result.debug.directorLatencyMs + result.debug.performerLatencyMs,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "playthrough_conflict") {
      return c.json({ error: "conflict", message: "Stale playthrough" }, 409);
    }
    throw err;
  }

  return c.json({
    narration: result.narration,
    dialogue: result.dialogue,
    playthrough: publicState(committed, def),
    appliedPatch: result.appliedPatch,
    rejected: result.rejected,
    evidenceAdded: result.evidenceAdded,
    justHappened: result.justHappened,
    locationName: def.locations.find((l) => l.id === committed.locationId)
      ?.name,
    _debug: result.debug,
  });
});

function buildBriefing(def: MysteryDefinition, state?: PlaythroughState) {
  const p = state?.playerPersona;
  return {
    setting: def.meta.setting,
    theMystery: def.meta.theMystery,
    objective: p?.objective ?? def.player.objective,
    startingKnowledge:
      p?.startingKnowledge ?? def.player.startingKnowledge,
    role: p?.role ?? def.player.role,
    displayName: p?.displayName ?? def.player.displayName,
    addressAs: p?.addressAs ?? def.player.addressAs ?? def.player.displayName,
    personaId: p?.personaId ?? def.player.personaId,
    authority: p?.authority ?? def.player.authority,
    appearance: p?.appearance ?? def.player.appearance,
    age: p?.age ?? def.player.age,
    gender: p?.gender ?? def.player.gender,
    background: p?.background ?? def.player.background,
    publicPerception: p?.publicPerception ?? def.player.publicPerception,
  };
}

function publicState(state: PlaythroughState, def?: MysteryDefinition) {
  const ending =
    state.endingId && def
      ? def.endings.find((e) => e.id === state.endingId)
      : undefined;
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
    phaseId: state.phaseId,
    playerPersona: state.playerPersona,
    endingId: state.endingId,
    ending: ending
      ? {
          id: ending.id,
          when: ending.when,
          kind: ending.kind,
          title: ending.title,
          templateNotes: ending.templateNotes,
        }
      : undefined,
    resolution: state.resolution,
    denouement: state.denouement,
    interactive: state.status === "active" || state.status === "denouement",
    playerStatus: state.playerStatus,
    clocks: state.clocks,
    time: state.time
      ? {
          slotId: state.time.slotId,
          minutesFromStart: state.time.minutesFromStart,
        }
      : undefined,
    environment: {
      weather: state.environment.weather,
      light: state.environment.light,
      crowd: state.environment.crowd,
      ambient: state.environment.ambient,
    },
    // character willingness + portraits for UI
    characters: Object.fromEntries(
      Object.entries(state.characterState).map(([id, cs]) => {
        const ch = def?.characters.find((x) => x.id === id);
        return [
          id,
          {
            locationId: cs.locationId,
            willingness: cs.willingness,
            stance: cs.stance,
            pressure: cs.pressure,
            name: ch?.name,
            portrait: ch?.portrait,
            portraitUrl: ch?.portrait
              ? `/v1/cases/${state.caseId}/assets/${ch.portrait}`
              : undefined,
          },
        ];
      })
    ),
    cast: def?.characters.map((ch) => ({
      id: ch.id,
      name: ch.name,
      shortBio: ch.shortBio,
      portrait: ch.portrait,
      portraitUrl: ch.portrait
        ? `/v1/cases/${state.caseId}/assets/${ch.portrait}`
        : undefined,
    })),
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
