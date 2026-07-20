import { config as loadEnv } from "dotenv";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Context } from "hono";
import { join, dirname, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  MysteryDefinition,
  PlaythroughState,
} from "@mystery/shared";
import {
  createInitialPlaythrough,
  computeMysteryProgress,
} from "@mystery/engine";
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
import { MysteryRegistry } from "./registry.js";
import { BundleError } from "./bundle.js";
import {
  accessContextFor,
  evaluateAccess,
  parseAccessPolicy,
  type Tier,
} from "./access.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "../../..");
// Load repo-root .env (OPENROUTER_API_KEY, DATABASE_URL, LLM_NARRATOR_MODEL, …)
loadEnv({ path: join(repoRoot, ".env") });

const contentRoot = join(repoRoot, "content/cases");

const pool = createPool();
// Mystery bundles live in the DB (docs/MYSTERY_BUNDLES.md); content/cases is
// auto-imported at boot as the dev authoring workspace.
const registry = new MysteryRegistry(pool);
const llmConfig = tryCreateOpenRouterConfig();

/** Anonymous session identity until accounts land. */
function userIdFrom(c: Context): string {
  return c.req.header("x-user-id")?.trim() || "anon";
}

/** Billing stub: header override for dev, else env default, else free. */
function tierFrom(c: Context): Tier {
  const raw = c.req.header("x-user-tier") ?? process.env.DEFAULT_USER_TIER;
  return raw === "standard" || raw === "premium" ? raw : "free";
}

/** Admin gate for upload/publish/grant routes. Open in local dev unless ADMIN_TOKEN is set. */
function adminOk(c: Context): boolean {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return true;
  return c.req.header("x-admin-token") === token;
}

async function accessFor(c: Context, caseId: string) {
  const meta = await registry.getRowMeta(caseId);
  if (!meta) return undefined;
  const ctx = await accessContextFor(pool, {
    userId: userIdFrom(c),
    tier: tierFrom(c),
    caseId,
  });
  return { meta, result: evaluateAccess(meta.access, ctx) };
}

const app = new Hono();

// Origins allowed to call the API. The defaults cover local dev; CORS_ORIGINS
// (comma-separated) adds more — e.g. the Tailscale MagicDNS name the site is
// reached by when playing from a phone.
const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  ...(process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
];

app.use(
  "*",
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.get("/health", async (c) => {
  let dbOk = false;
  let caseIds: string[] = [];
  try {
    await pool.query("SELECT 1");
    dbOk = true;
    caseIds = (await registry.listPublished()).map((r) => r.caseId);
  } catch {
    dbOk = false;
  }
  return c.json({
    ok: dbOk,
    db: dbOk ? "up" : "down",
    cases: caseIds,
    narrator: llmConfig ? llmConfig.narratorModel : "heuristic",
  });
});

app.get("/v1/cases", async (c) => {
  const userId = userIdFrom(c);
  const tier = tierFrom(c);
  const rows = await registry.listPublished();
  const list: unknown[] = [];
  for (const row of rows) {
    const ctx = await accessContextFor(pool, {
      userId,
      tier,
      caseId: row.caseId,
    });
    const access = evaluateAccess(row.access, ctx);
    if (!access.listed) continue;
    list.push({
      id: row.definition.id,
      contentVersion: row.contentVersion,
      meta: row.definition.meta,
      // Visible-but-locked is merchandising: the shelf shows why.
      locked: !access.playable,
      lockReason: access.lockReason,
      requirement: access.requirement,
    });
  }
  return c.json({ cases: list });
});

app.get("/v1/cases/:caseId", async (c) => {
  const caseId = c.req.param("caseId");
  const found = await accessFor(c, caseId);
  // Private without grant → 404: existence stays hidden (anti-enumeration).
  if (!found || !found.result.reachable) {
    return c.json({ error: "not_found" }, 404);
  }
  const def = await registry.getDefinition(caseId, found.meta.contentVersion);
  if (!def) return c.json({ error: "not_found" }, 404);
  return c.json({
    id: def.id,
    contentVersion: def.contentVersion,
    meta: def.meta,
    locked: !found.result.playable,
    lockReason: found.result.lockReason,
    requirement: found.result.requirement,
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

function sanitizeAssetPath(raw: string): string | null {
  const rel = normalize(decodeURIComponent(raw))
    .replace(/\\/g, "/")
    .replace(/^(\.\.(\/|$))+/, "");
  if (!rel || rel.startsWith("/") || rel.split("/").includes("..")) {
    return null;
  }
  return rel;
}

function assetResponse(asset: { mime: string; bytes: Buffer }, immutable: boolean) {
  return new Response(new Uint8Array(asset.bytes), {
    headers: {
      "Content-Type": asset.mime,
      "Cache-Control": immutable
        ? "public, max-age=31536000, immutable"
        : "public, max-age=3600",
    },
  });
}

/**
 * Case assets from the DB registry. Unversioned route serves the latest
 * published version; visibility-gated (private without grant → 404).
 */
app.get("/v1/cases/:caseId/assets/*", async (c) => {
  const caseId = c.req.param("caseId");
  const found = await accessFor(c, caseId);
  if (!found || !found.result.reachable) {
    return c.json({ error: "not_found" }, 404);
  }
  const prefix = `/v1/cases/${caseId}/assets/`;
  const raw = c.req.path.startsWith(prefix) ? c.req.path.slice(prefix.length) : "";
  const rel = sanitizeAssetPath(raw);
  if (!rel) return c.json({ error: "invalid_path" }, 400);

  const asset = await registry.getAsset(caseId, found.meta.contentVersion, rel);
  if (!asset) return c.json({ error: "not_found" }, 404);
  return assetResponse(asset, false);
});

/** Versioned asset route — content is immutable per version. */
app.get("/v1/mysteries/:caseId/:version/assets/*", async (c) => {
  const caseId = c.req.param("caseId");
  const version = c.req.param("version");
  const found = await accessFor(c, caseId);
  if (!found || !found.result.reachable) {
    return c.json({ error: "not_found" }, 404);
  }
  const prefix = `/v1/mysteries/${caseId}/${version}/assets/`;
  const raw = c.req.path.startsWith(prefix) ? c.req.path.slice(prefix.length) : "";
  const rel = sanitizeAssetPath(raw);
  if (!rel) return c.json({ error: "invalid_path" }, 400);

  const asset = await registry.getAsset(caseId, version, rel);
  if (!asset) return c.json({ error: "not_found" }, 404);
  return assetResponse(asset, true);
});

/**
 * Upload a mystery bundle (zip). Lands as draft unless ?publish=true.
 * Local dev is open; set ADMIN_TOKEN to require x-admin-token.
 */
app.post("/v1/mysteries", async (c) => {
  if (!adminOk(c)) return c.json({ error: "forbidden" }, 403);

  let zip: Buffer | undefined;
  const contentType = c.req.header("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const body = await c.req.parseBody();
    const file = body["bundle"];
    if (file instanceof File) {
      zip = Buffer.from(await file.arrayBuffer());
    }
  } else {
    zip = Buffer.from(await c.req.arrayBuffer());
  }
  if (!zip?.length) {
    return c.json(
      { error: "missing_bundle", message: "send a zip body or multipart field 'bundle'" },
      400
    );
  }

  try {
    const publish = c.req.query("publish") === "true";
    const result = await registry.importBundle(zip, {
      status: publish ? "published" : "draft",
    });
    return c.json({ ...result, status: publish ? "published" : "draft" }, 201);
  } catch (err) {
    if (err instanceof BundleError) {
      return c.json({ error: "invalid_bundle", message: err.message, issues: err.issues }, 400);
    }
    throw err;
  }
});

/** Publish a draft version; optional access policy in the body. */
app.post("/v1/mysteries/:caseId/:version/publish", async (c) => {
  if (!adminOk(c)) return c.json({ error: "forbidden" }, 403);
  const body = await c.req.json().catch(() => ({}));
  const access =
    body && typeof body === "object" && "access" in body
      ? parseAccessPolicy((body as { access?: unknown }).access)
      : undefined;
  const ok = await registry.publish(
    c.req.param("caseId"),
    c.req.param("version"),
    access
  );
  if (!ok) return c.json({ error: "not_found" }, 404);
  return c.json({ published: true });
});

/** Set access policy for a case (all versions). */
app.put("/v1/mysteries/:caseId/access", async (c) => {
  if (!adminOk(c)) return c.json({ error: "forbidden" }, 403);
  const body = await c.req.json().catch(() => ({}));
  const access = parseAccessPolicy(body);
  await registry.setAccess(c.req.param("caseId"), access);
  return c.json({ access });
});

/** Grant / revoke per-user access (private commissions, playtests, purchases). */
app.post("/v1/mysteries/:caseId/grants", async (c) => {
  if (!adminOk(c)) return c.json({ error: "forbidden" }, 403);
  const body = (await c.req.json().catch(() => ({}))) as {
    userId?: string;
    kind?: string;
  };
  if (!body.userId) return c.json({ error: "missing_user_id" }, 400);
  await registry.grant(
    c.req.param("caseId"),
    body.userId,
    body.kind ?? "playtest"
  );
  return c.json({ granted: true });
});

app.delete("/v1/mysteries/:caseId/grants/:userId", async (c) => {
  if (!adminOk(c)) return c.json({ error: "forbidden" }, 403);
  await registry.revokeGrant(c.req.param("caseId"), c.req.param("userId"));
  return c.json({ revoked: true });
});

app.post("/v1/playthroughs", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const caseId =
    (body as { caseId?: string }).caseId ?? "blackwood-inheritance";

  // The hard access gate: entitlement is checked at start, then the
  // playthrough is grandfathered (a lapsed tier never bricks a run).
  const found = await accessFor(c, caseId);
  if (!found || !found.result.reachable) {
    return c.json({ error: "unknown_case" }, 404);
  }
  if (!found.result.playable) {
    return c.json(
      {
        error: "locked",
        lockReason: found.result.lockReason,
        requirement: found.result.requirement,
      },
      403
    );
  }

  const def = await registry.getDefinition(caseId, found.meta.contentVersion);
  if (!def) return c.json({ error: "unknown_case" }, 404);

  const state = createInitialPlaythrough(def);
  await insertPlaythrough(pool, state, def.openingNarration);
  await pool.query(`UPDATE playthroughs SET user_id = $2 WHERE id = $1`, [
    state.id,
    userIdFrom(c),
  ]);

  return c.json({
    playthrough: publicState(state, def),
    openingNarration: def.openingNarration,
    briefing: buildBriefing(def, state),
    locationName: def.locations.find((l) => l.id === state.locationId)?.name,
    progress: computeMysteryProgress(def, state),
  });
});

app.get("/v1/playthroughs/:id", async (c) => {
  const row = await getPlaythrough(pool, c.req.param("id"));
  if (!row) return c.json({ error: "not_found" }, 404);
  // Serve the content version this playthrough pinned at start.
  const def = await registry.getDefinition(
    row.state.caseId,
    row.state.contentVersion
  );
  const turns = await listTurns(pool, row.state.id);
  return c.json({
    playthrough: publicState(row.state, def),
    openingNarration: row.openingNarration,
    briefing: def ? buildBriefing(def, row.state) : undefined,
    locationName: def?.locations.find((l) => l.id === row.state.locationId)
      ?.name,
    progress: def ? computeMysteryProgress(def, row.state) : undefined,
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

  const def = await registry.getDefinition(state.caseId, state.contentVersion);
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
    progress: computeMysteryProgress(def, committed, {
      previous: row.state,
      justHappened: result.justHappened,
      evidenceAdded: result.evidenceAdded,
    }),
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
    /** Case author progress UI default (player can only reduce). */
    progressUi: def?.meta.progressUi ?? "off",
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
  // Dev authoring workspace → DB registry (published). Uploads via
  // POST /v1/mysteries need no restart at all.
  const imported = await registry.importDirectory(contentRoot);
  const port = Number(process.env.PORT ?? 8787);
  console.log(`Mystery API listening on http://localhost:${port}`);
  console.log(`Imported bundles: ${imported.join(", ") || "(none)"}`);
  console.log(
    `Narrator: ${llmConfig ? llmConfig.narratorModel : "heuristic (no OPENROUTER_API_KEY)"}`
  );
  serve({ fetch: app.fetch, port });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
