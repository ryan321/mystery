import { config as loadEnv } from "dotenv";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Context } from "hono";
import { join, dirname, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import type {
  MysteryDefinition,
  PlaythroughState,
} from "@mystery/shared";
import {
  createInitialPlaythrough,
  computeMysteryProgress,
  buildPlayerView,
  addPlayerNote,
  updatePlayerNote,
  deletePlayerNote,
  PlayerNoteError,
  knownAsFor,
} from "@mystery/engine";
import { createOpenRouterClient, tryCreateOpenRouterConfig } from "@mystery/llm";
import {
  createPool,
  migrate,
  insertPlaythrough,
  getPlaythrough,
  listPlaythroughsFor,
  findOpenPlaythroughFor,
  abandonOpenPlaythroughsFor,
  commitTurn,
  countRecentTurns,
  listTurns,
  updateNotebook,
  databaseUrl,
} from "./db.js";
import { runTurnPipeline } from "./turn-pipeline.js";
import { MysteryRegistry } from "./registry.js";
import { BundleError } from "./bundle.js";
import {
  accessContextFor,
  evaluateAccess,
  parseAccessPolicy,
  solvedCaseIdsFor,
  TIER_ORDER,
  type Tier,
} from "./access.js";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import {
  ANON_COOKIE,
  SESSION_COOKIE,
  adoptAnonPlaythroughs,
  createSession,
  destroySession,
  effectiveTier,
  EmailSendError,
  newAnonId,
  publicUser,
  requestMagicLink,
  upsertGoogleUser,
  userForSession,
  verifyMagicLink,
  type UserRow,
} from "./auth.js";
import {
  OAUTH_NEXT_COOKIE,
  OAUTH_STATE_COOKIE,
  exchangeGoogleCode,
  googleAuthUrl,
  googleConfigured,
  safeNextPath,
} from "./google-auth.js";
import {
  PAID_TIERS,
  TIER_CARDS,
  applySubscriptionUpdate,
  bindStripeCustomer,
  isPaidTier,
  LIVE_SUB_STATUSES,
  activeCoupon,
  saleFrom,
  type TierSale,
  mintInvitation,
  priceForTier,
  recordBillingEvent,
  redeemInvitation,
  stripeClient,
  subscriptionUpdateFrom,
  validateInvitation,
} from "./billing.js";
import type Stripe from "stripe";

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

export type Identity = {
  userId: string;
  tier: Tier;
  user: UserRow | null;
  anonId: string | null;
};

/**
 * Who is calling: session cookie (signed-in user) → dev header override
 * (never in production) → anonymous cookie (minted on first contact).
 * Anonymous visitors browse the gallery and case details; starting a
 * playthrough requires an account. Sign-in adopts any legacy anon runs.
 */
async function identity(c: Context): Promise<Identity> {
  const sessionToken = getCookie(c, SESSION_COOKIE);
  if (sessionToken) {
    const user = await userForSession(pool, sessionToken);
    if (user) {
      return {
        userId: user.id,
        tier: effectiveTier(user),
        user,
        anonId: getCookie(c, ANON_COOKIE) ?? null,
      };
    }
  }
  if (process.env.NODE_ENV !== "production") {
    const devId = c.req.header("x-user-id")?.trim();
    if (devId) {
      const raw =
        c.req.header("x-user-tier") ?? process.env.DEFAULT_USER_TIER;
      const tier = TIER_ORDER.includes(raw as Tier) ? (raw as Tier) : "free";
      return { userId: devId, tier, user: null, anonId: null };
    }
  }
  let anonId = getCookie(c, ANON_COOKIE);
  if (!anonId) {
    anonId = newAnonId();
    setCookie(c, ANON_COOKIE, anonId, {
      httpOnly: true,
      sameSite: "Lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      secure: process.env.NODE_ENV === "production",
    });
  }
  return { userId: anonId, tier: "free", user: null, anonId };
}

/**
 * Admin gate for upload/publish/grant/billing-admin routes. Fail closed:
 * with no ADMIN_TOKEN configured, every admin route is denied — a missing
 * token must never mean "wide open". Local dev sets ADMIN_TOKEN in .env
 * (the publish-case script loads the same file); see .env.example.
 */
function adminOk(c: Context): boolean {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return false;
  return c.req.header("x-admin-token") === token;
}

async function accessFor(c: Context, caseId: string) {
  const meta = await registry.getRowMeta(caseId);
  if (!meta) return undefined;
  const ident = await identity(c);
  const ctx = await accessContextFor(pool, {
    userId: ident.userId,
    tier: ident.tier,
    caseId,
  });
  return { meta, result: evaluateAccess(meta.access, ctx), ident };
}

/** Distinct solved "hard" mysteries that must be earned to reach Genius. */
const GENIUS_HARD_SOLVES_REQUIRED = 3;

export type GeniusEligibility = {
  hardSolved: number;
  required: number;
  eligible: boolean;
};

/**
 * Genius (docs/TIER_STRATEGY.md §5) is earned, not bought: a player unlocks
 * the right to subscribe by solving GENIUS_HARD_SOLVES_REQUIRED distinct
 * Difficult mysteries. "In the Master Detective tier" is implicit — Hard cases
 * already require that tier to play. Eligibility is permanent (solve history).
 */
async function geniusEligibility(userId: string): Promise<GeniusEligibility> {
  const [solved, rows] = await Promise.all([
    solvedCaseIdsFor(pool, userId),
    registry.listPublished(),
  ]);
  const hardIds = new Set(
    rows
      .filter((r) => r.definition.meta.difficulty === "hard")
      .map((r) => r.caseId)
  );
  const hardSolved = solved.filter((id) => hardIds.has(id)).length;
  return {
    hardSolved,
    required: GENIUS_HARD_SOLVES_REQUIRED,
    eligible: hardSolved >= GENIUS_HARD_SOLVES_REQUIRED,
  };
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

// Any error escaping a handler: log it so it reaches the platform logs, and
// answer with JSON. Hono's default is a text "Internal Server Error" body,
// which the web client can't parse (every response is read as JSON) — so an
// uncaught throw would otherwise double-fault into an opaque client error.
app.onError((err, c) => {
  console.error(`unhandled error: ${c.req.method} ${c.req.path}`, err);
  return c.json({ error: "internal_error" }, 500);
});

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
  const ident = await identity(c);
  const rows = await registry.listPublished();
  const list: unknown[] = [];
  for (const row of rows) {
    const ctx = await accessContextFor(pool, {
      userId: ident.userId,
      tier: ident.tier,
      caseId: row.caseId,
    });
    const access = evaluateAccess(row.access, ctx);
    if (!access.listed) continue;
    const cover = await registry.coverPath(row.caseId, row.contentVersion);
    list.push({
      id: row.definition.id,
      contentVersion: row.contentVersion,
      meta: row.definition.meta,
      /** Bundle cover art, when the case ships one. */
      coverUrl: cover ? `/v1/cases/${row.caseId}/assets/${cover}` : undefined,
      // Visible-but-locked is merchandising: the shelf shows why.
      locked: !access.playable,
      lockReason: access.lockReason,
      requirement: access.requirement,
      /** Seasonal badge: "Free until …" while a free window is active. */
      freeUntil: access.freeUntil,
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
  const cover = await registry.coverPath(def.id, def.contentVersion);
  return c.json({
    id: def.id,
    contentVersion: def.contentVersion,
    meta: def.meta,
    coverUrl: cover ? `/v1/cases/${def.id}/assets/${cover}` : undefined,
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
    // Mystery detail page: hidden characters (knownAtStart: false) are a
    // per-playthrough reveal — they never appear in pre-start marketing.
    // Only cardTitle ships here: shortBio is the AI's character card and
    // may contain secrets. Array order is the authored display order.
    cast: def.characters
      .filter((ch) => ch.knownAtStart !== false)
      .map((ch) => ({
        id: ch.id,
        name: ch.name,
        cardTitle: ch.cardTitle,
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

app.get("/v1/playthroughs", async (c) => {
  // Account-wide play history — backs the web's My Mysteries page. Scoped
  // to the caller's identity (signed-in user, or the anon cookie for
  // legacy pre-account runs).
  const ident = await identity(c);
  return c.json({ playthroughs: await listPlaythroughsFor(pool, ident.userId) });
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
  // Playing requires an account — even for free cases. Browsing the
  // gallery and case details stays anonymous; existing playthroughs
  // are grandfathered (turn routes stay open).
  if (!found.ident.user && found.ident.anonId !== null) {
    return c.json({ error: "signin_required" }, 401);
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

  // One investigation per mystery per user. A plain start resumes the
  // open run when one exists (the client may not know about it — fresh
  // browser, new device); only an explicit restart forks, and it leaves
  // the old run behind as abandoned.
  if ((body as { restart?: boolean }).restart === true) {
    await abandonOpenPlaythroughsFor(pool, found.ident.userId, caseId);
  } else {
    const openId = await findOpenPlaythroughFor(pool, found.ident.userId, caseId);
    const open = openId ? await getPlaythrough(pool, openId) : null;
    if (open) {
      const openDef = await registry.getDefinition(
        caseId,
        open.state.contentVersion
      );
      return c.json({
        playthrough: publicState(open.state, openDef),
        playerView: openDef ? buildPlayerView(openDef, open.state) : undefined,
        openingNarration: open.openingNarration,
        briefing: openDef ? buildBriefing(openDef, open.state) : undefined,
        locationName: openDef?.locations.find(
          (l) => l.id === open.state.locationId
        )?.name,
        progress: openDef
          ? computeMysteryProgress(openDef, open.state)
          : undefined,
        resumed: true,
      });
    }
  }

  const state = createInitialPlaythrough(def);
  await insertPlaythrough(pool, state, def.openingNarration);
  await pool.query(`UPDATE playthroughs SET user_id = $2 WHERE id = $1`, [
    state.id,
    found.ident.userId,
  ]);

  return c.json({
    playthrough: publicState(state, def),
    playerView: buildPlayerView(def, state),
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
  const closed = ["denouement", "solved", "failed"].includes(row.state.status);
  return c.json({
    playthrough: publicState(row.state, def),
    playerView: def ? buildPlayerView(def, row.state) : undefined,
    openingNarration: row.openingNarration,
    // Stage 2 of the ending (§8f): the authored mask-off document,
    // delivered on any closed outcome — losers get the truth too.
    revelation: closed ? def?.revelation : undefined,
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

/**
 * Post-case debrief — stage 3 of the ending (§8f): out-of-fiction chat
 * with the storyteller. Contract: explain the story, never inventory
 * the world. Available only once the case has closed.
 */
app.post("/v1/playthroughs/:id/debrief", async (c) => {
  const row = await getPlaythrough(pool, c.req.param("id"));
  if (!row) return c.json({ error: "not_found" }, 404);
  const state = row.state;
  if (!["denouement", "solved", "failed"].includes(state.status)) {
    return c.json({ error: "case_still_open", status: state.status }, 400);
  }
  const def = await registry.getDefinition(state.caseId, state.contentVersion);
  if (!def) return c.json({ error: "case_missing" }, 500);
  if (!llmConfig) return c.json({ error: "debrief_unavailable" }, 503);

  const body = await c.req.json().catch(() => ({}));
  const question = String((body as { question?: string }).question ?? "").trim();
  if (!question) return c.json({ error: "empty_question" }, 400);
  if (question.length > 2000) return c.json({ error: "question_too_long" }, 400);

  const turns = await listTurns(pool, state.id);
  const transcript = turns
    .map(
      (t) =>
        `t${t.turn_index} PLAYER: ${t.player_input}\n  SCENE: ${t.narration.slice(0, 240)}`
    )
    .join("\n");

  const system = `You are the storyteller of a concluded interactive mystery, hosting the
post-case debrief. The fiction is over; you are not a character. Warm, literate, a touch dry.

THE CONTRACT — explain the story, never inventory the world:
- ANSWER freely: why events happened, what characters wanted or feared, why they said or did
  what they did in THIS player's playthrough (cite their turns when useful), and
  counterfactuals about the design ("why didn't X just...?"). Ground everything in canon.
- NEVER enumerate missed content: no lists of clues, evidence, secrets, or rooms the player
  did not encounter; no "you missed..."; no walkthroughs. If asked ("did I miss any clues?",
  "what was in the attic?"), deflect warmly in a single line and invite replay — the house
  keeps some of its drawers shut.
- The revelation document was shown to the player; everything in it is fair game.
- Keep answers to a few sentences unless the question genuinely needs more.`;

  const user = `CANON (sealed truth):
${JSON.stringify(def.canon?.timeline ?? [])}

SOLUTION: ${def.solution.summary}

REVELATION (the player has read this):
${def.revelation ?? "(none authored)"}

OUTCOME: ${state.status}

THIS PLAYER'S TRANSCRIPT:
${transcript}

PLAYER'S QUESTION: ${question}`;

  try {
    const client = createOpenRouterClient(llmConfig);
    const completion = await client.chat.completions.create({
      model: llmConfig.narratorModel,
      temperature: 0.4,
      max_tokens: 1000,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    const answer = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!answer) return c.json({ error: "debrief_failed" }, 502);
    return c.json({ answer });
  } catch (err) {
    console.error("debrief failed", err);
    return c.json({ error: "debrief_failed" }, 502);
  }
});

// Every turn is two paid LLM calls, so the turn route is the abuse surface.
// Limits are set where no human player ever meets them: people read the
// narration and type — scripts don't.
const TURN_RATE = {
  per10s: 3, // burst
  per60s: 8, // ~6/min sustained with slack
  per24h: 300, // ~4 thorough playthroughs in a day
} as const;

// One in-flight turn per playthrough (per process). Serializes hammering to
// our own LLM latency and prevents state races; across processes the
// optimistic turn_count lock in updatePlaythrough is the backstop.
const turnsInFlight = new Set<string>();

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

  const counts = await countRecentTurns(
    pool,
    row.userId ? { userId: row.userId } : { playthroughId: state.id }
  );
  const retryAfterSec =
    counts.last24h >= TURN_RATE.per24h
      ? 3600
      : counts.last60s >= TURN_RATE.per60s
        ? 30
        : counts.last10s >= TURN_RATE.per10s
          ? 10
          : 0;
  if (retryAfterSec > 0) {
    c.header("Retry-After", String(retryAfterSec));
    return c.json(
      {
        error: "rate_limited",
        retryAfterSec,
        message: "The investigation needs a moment to breathe.",
      },
      429
    );
  }

  const def = await registry.getDefinition(state.caseId, state.contentVersion);
  if (!def) return c.json({ error: "case_missing" }, 500);

  const body = await c.req.json();
  const input = String((body as { input?: string }).input ?? "").trim();
  if (!input) return c.json({ error: "empty_input" }, 400);
  if (input.length > 500) {
    return c.json({ error: "input_too_long", maxLength: 500 }, 400);
  }

  // Check-and-acquire must stay adjacent — an await between them would let
  // two concurrent requests both pass the check.
  if (turnsInFlight.has(state.id)) {
    c.header("Retry-After", "5");
    return c.json(
      {
        error: "turn_in_flight",
        message: "The previous turn is still resolving.",
      },
      429
    );
  }
  turnsInFlight.add(state.id);
  let result;
  try {
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
  } finally {
    turnsInFlight.delete(state.id);
  }

  const committed = result.state;

  return c.json({
    narration: result.narration,
    dialogue: result.dialogue,
    playthrough: publicState(committed, def),
    playerView: buildPlayerView(def, committed),
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

// ── Player scratchpad notes (docs/PLAYER_SURFACES.md §5.6) ──────────────
// Player notes are inert: never parsed by the engine, never sent to any
// prompt. Only `source: "player"` entries are writable; auto entries are
// the case's own record and immutable from here.

function noteError(c: Context, err: unknown) {
  if (err instanceof PlayerNoteError) {
    const status = err.code === "note_not_found" ? 404 : 400;
    return c.json({ error: err.code }, status);
  }
  throw err;
}

app.post("/v1/playthroughs/:id/notes", async (c) => {
  const row = await getPlaythrough(pool, c.req.param("id"));
  if (!row) return c.json({ error: "not_found" }, 404);
  const body = (await c.req.json().catch(() => ({}))) as { text?: string };
  try {
    const { note, notebook } = addPlayerNote(row.state.notebook, String(body.text ?? ""), {
      id: randomUUID(),
      now: new Date().toISOString(),
    });
    await updateNotebook(pool, row.state.id, notebook);
    return c.json({ note, notebook }, 201);
  } catch (err) {
    return noteError(c, err);
  }
});

app.patch("/v1/playthroughs/:id/notes/:noteId", async (c) => {
  const row = await getPlaythrough(pool, c.req.param("id"));
  if (!row) return c.json({ error: "not_found" }, 404);
  const body = (await c.req.json().catch(() => ({}))) as { text?: string };
  try {
    const { note, notebook } = updatePlayerNote(
      row.state.notebook,
      c.req.param("noteId"),
      String(body.text ?? "")
    );
    await updateNotebook(pool, row.state.id, notebook);
    return c.json({ note, notebook });
  } catch (err) {
    return noteError(c, err);
  }
});

app.delete("/v1/playthroughs/:id/notes/:noteId", async (c) => {
  const row = await getPlaythrough(pool, c.req.param("id"));
  if (!row) return c.json({ error: "not_found" }, 404);
  try {
    const { notebook } = deletePlayerNote(row.state.notebook, c.req.param("noteId"));
    await updateNotebook(pool, row.state.id, notebook);
    return c.json({ notebook });
  } catch (err) {
    return noteError(c, err);
  }
});

// ── Auth: magic-link accounts (docs/SUBSCRIPTIONS.md Phase 1) ───────────

app.post("/v1/auth/magic-link", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    email?: string;
    next?: string;
  };
  try {
    const result = await requestMagicLink(
      pool,
      String(body.email ?? ""),
      typeof body.next === "string" ? body.next : undefined
    );
    if ("error" in result) return c.json(result, 400);
    return c.json(result);
  } catch (err) {
    // A send failure is an upstream/config problem, not the caller's fault:
    // surface it as a 502 with a retryable message, and log the real Resend
    // cause (status + body) so the operator can see e.g. an unverified sender.
    if (err instanceof EmailSendError) {
      console.error("magic-link email send failed", {
        status: err.status,
        detail: err.detail,
      });
      return c.json(
        {
          error: "email_send_failed",
          message: "Couldn't send the sign-in email. Please try again shortly.",
        },
        502
      );
    }
    throw err; // anything else → global onError (500)
  }
});

app.post("/v1/auth/verify", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { token?: string };
  const result = await verifyMagicLink(pool, String(body.token ?? ""));
  if ("error" in result) return c.json(result, 400);

  setCookie(c, SESSION_COOKIE, result.sessionToken, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    secure: process.env.NODE_ENV === "production",
  });

  // Adopt the anonymous cookie's playthroughs so progression follows them in.
  const anonId = getCookie(c, ANON_COOKIE);
  const adopted = anonId
    ? await adoptAnonPlaythroughs(pool, result.user.id, anonId)
    : 0;

  return c.json({ user: publicUser(result.user), adoptedPlaythroughs: adopted });
});

app.post("/v1/auth/signout", async (c) => {
  const sessionToken = getCookie(c, SESSION_COOKIE);
  if (sessionToken) await destroySession(pool, sessionToken);
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  return c.json({ ok: true });
});

// ── Google sign-in (OAuth code flow; see google-auth.ts) ────────────────

app.get("/v1/auth/google", (c) => {
  if (!googleConfigured()) {
    return c.json({ error: "google_not_configured" }, 501);
  }
  const state = randomUUID();
  const oauthCookie = {
    httpOnly: true,
    sameSite: "Lax" as const,
    path: "/",
    maxAge: 10 * 60,
    secure: process.env.NODE_ENV === "production",
  };
  setCookie(c, OAUTH_STATE_COOKIE, state, oauthCookie);
  setCookie(c, OAUTH_NEXT_COOKIE, safeNextPath(c.req.query("next")), oauthCookie);
  return c.redirect(googleAuthUrl(state));
});

app.get("/v1/auth/google/callback", async (c) => {
  const webOrigin = process.env.WEB_ORIGIN ?? "https://mysterytrove.com";
  const fail = (reason: string) => {
    console.warn(`[auth] google sign-in failed: ${reason}`);
    return c.redirect(`${webOrigin}/signin?error=google`);
  };
  if (!googleConfigured()) return fail("not_configured");

  const state = c.req.query("state");
  const expected = getCookie(c, OAUTH_STATE_COOKIE);
  deleteCookie(c, OAUTH_STATE_COOKIE, { path: "/" });
  const next = safeNextPath(getCookie(c, OAUTH_NEXT_COOKIE));
  deleteCookie(c, OAUTH_NEXT_COOKIE, { path: "/" });
  if (!state || !expected || state !== expected) return fail("state_mismatch");

  const code = c.req.query("code");
  if (!code) return fail(c.req.query("error") ?? "no_code");

  const profile = await exchangeGoogleCode(code);
  if ("error" in profile) return fail(profile.error);

  // Account upsert + session are DB work: on failure, keep the user in the
  // OAuth flow (bounce to /signin?error=google) rather than dropping a raw
  // 500 onto the callback URL mid-redirect.
  try {
    const user = await upsertGoogleUser(pool, profile);
    const sessionToken = await createSession(pool, user.id);
    setCookie(c, SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      sameSite: "Lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      secure: process.env.NODE_ENV === "production",
    });

    // Same progression merge as magic-link sign-in.
    const anonId = getCookie(c, ANON_COOKIE);
    if (anonId) await adoptAnonPlaythroughs(pool, user.id, anonId);
  } catch (err) {
    console.error("google sign-in: session creation failed", err);
    return fail("session_error");
  }

  return c.redirect(
    `${webOrigin}/signin/complete?next=${encodeURIComponent(next)}`
  );
});

app.get("/v1/me", async (c) => {
  const ident = await identity(c);
  if (ident.user) {
    return c.json({
      user: publicUser(ident.user),
      genius: await geniusEligibility(ident.user.id),
    });
  }
  return c.json({
    anonymous: true,
    userId: ident.userId,
    tier: ident.tier,
  });
});

// ── Billing: Stripe checkout / portal / webhook (Phase 3) ───────────────

app.get("/v1/billing/tiers", async (c) => {
  const stripe = stripeClient();
  const invite = c.req.query("invite");
  const ident = await identity(c);
  // Genius is whispered, not hidden (docs/TIER_STRATEGY.md §5): it always
  // appears on the ladder, but is purchasable only once earned (3 Hard solves)
  // or via a valid invite link.
  const genius = ident.user
    ? await geniusEligibility(ident.user.id)
    : { hardSolved: 0, required: GENIUS_HARD_SOLVES_REQUIRED, eligible: false };
  // Sales are Stripe-driven: a coupon restricted to a tier's product.
  let coupons: Stripe.Coupon[] = [];
  if (stripe) {
    try {
      coupons = (await stripe.coupons.list({ limit: 100, expand: ["data.applies_to"] })).data;
    } catch {
      /* sales are cosmetic */
    }
  }
  const tiers: unknown[] = [];
  for (const tier of PAID_TIERS) {
    const card = TIER_CARDS[tier];
    const priceId = priceForTier(tier);
    let price: unknown = null;
    let sale: TierSale | null = null;
    if (stripe && priceId) {
      try {
        const p = await stripe.prices.retrieve(priceId);
        price = {
          amount: p.unit_amount,
          currency: p.currency,
          interval: p.recurring?.interval ?? "month",
        };
        const productId =
          typeof p.product === "string" ? p.product : p.product?.id;
        const coupon = activeCoupon(coupons, productId);
        if (coupon && p.unit_amount != null) {
          sale = saleFrom(p.unit_amount, coupon);
        }
      } catch {
        /* price fetch is cosmetic */
      }
    }
    let purchasable = true;
    let requirement: unknown;
    if (card.inviteOnly) {
      const inviteOk = invite
        ? (await validateInvitation(pool, invite, tier)).valid
        : false;
      purchasable = genius.eligible || inviteOk;
      requirement = {
        hardSolved: genius.hardSolved,
        required: genius.required,
      };
    }
    // Price and its sale stay secret until you qualify for the tier — don't
    // even leak them in the API to viewers who can't buy it.
    const hidden = card.inviteOnly && !purchasable;
    tiers.push({
      tier,
      ...card,
      price: hidden ? null : price,
      configured: Boolean(priceId),
      purchasable,
      ...(!hidden && sale ? { sale } : {}),
      ...(requirement ? { requirement } : {}),
    });
  }
  return c.json({ tiers, billingConfigured: Boolean(stripe) });
});

app.post("/v1/billing/checkout", async (c) => {
  const stripe = stripeClient();
  if (!stripe) return c.json({ error: "billing_not_configured" }, 501);
  const ident = await identity(c);
  if (!ident.user) return c.json({ error: "sign_in_required" }, 401);

  const body = (await c.req.json().catch(() => ({}))) as {
    tier?: string;
    inviteCode?: string;
  };
  if (!isPaidTier(body.tier)) return c.json({ error: "invalid_tier" }, 400);
  const tier = body.tier;

  // Already subscribed → a tier change is an in-place, prorated swap in the
  // Billing Portal, not a second checkout that would create a duplicate
  // subscription (and double-charge). Send them to the portal instead.
  if (
    ident.user.subscription_status &&
    LIVE_SUB_STATUSES.has(ident.user.subscription_status)
  ) {
    return c.json({ error: "already_subscribed" }, 409);
  }

  if (TIER_CARDS[tier].inviteOnly) {
    // Genius is earned (3 Hard solves) or invited — either opens checkout.
    const elig = await geniusEligibility(ident.user.id);
    const inviteOk = body.inviteCode
      ? (await validateInvitation(pool, body.inviteCode, tier)).valid
      : false;
    if (!elig.eligible && !inviteOk) {
      return c.json({ error: "not_eligible" }, 403);
    }
  }

  const price = priceForTier(tier);
  if (!price) return c.json({ error: "price_not_configured", tier }, 501);

  let customerId = ident.user.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: ident.user.email,
      metadata: { userId: ident.user.id },
    });
    customerId = customer.id;
    await bindStripeCustomer(pool, ident.user.id, customerId);
  }

  // Auto-apply an active, product-restricted sale coupon (Stripe-driven) so
  // the customer never types a code. Stripe forbids discounts +
  // allow_promotion_codes together, so a live sale replaces manual promo entry;
  // otherwise we keep promo codes on.
  let discounts: Stripe.Checkout.SessionCreateParams.Discount[] | undefined;
  try {
    const p = await stripe.prices.retrieve(price);
    const productId = typeof p.product === "string" ? p.product : p.product?.id;
    const coupon = activeCoupon(
      (await stripe.coupons.list({ limit: 100, expand: ["data.applies_to"] })).data,
      productId
    );
    if (coupon) discounts = [{ coupon: coupon.id }];
  } catch {
    /* sale is optional */
  }

  const webOrigin = process.env.WEB_ORIGIN ?? "https://mysterytrove.com";
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price, quantity: 1 }],
    success_url: `${webOrigin}/account?checkout=success`,
    cancel_url: `${webOrigin}/subscribe?checkout=cancelled`,
    ...(discounts ? { discounts } : { allow_promotion_codes: true }),
    metadata: {
      userId: ident.user.id,
      tier,
      ...(body.inviteCode ? { inviteCode: body.inviteCode } : {}),
    },
    subscription_data: { metadata: { userId: ident.user.id, tier } },
  });
  return c.json({ url: session.url });
});

app.post("/v1/billing/portal", async (c) => {
  const stripe = stripeClient();
  if (!stripe) return c.json({ error: "billing_not_configured" }, 501);
  const ident = await identity(c);
  if (!ident.user) return c.json({ error: "sign_in_required" }, 401);
  if (!ident.user.stripe_customer_id) {
    return c.json({ error: "no_subscription" }, 400);
  }
  const webOrigin = process.env.WEB_ORIGIN ?? "https://mysterytrove.com";
  const session = await stripe.billingPortal.sessions.create({
    customer: ident.user.stripe_customer_id,
    return_url: `${webOrigin}/account`,
  });
  return c.json({ url: session.url });
});

/**
 * Stripe webhook — the single source of truth for users.tier.
 * Raw body + signature verification; idempotent via billing_events.
 */
app.post("/v1/billing/webhook", async (c) => {
  const stripe = stripeClient();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return c.json({ error: "billing_not_configured" }, 501);

  const raw = await c.req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      raw,
      c.req.header("stripe-signature") ?? "",
      secret
    );
  } catch {
    return c.json({ error: "invalid_signature" }, 400);
  }

  const fresh = await recordBillingEvent(pool, event.id, event.type);
  if (!fresh) return c.json({ received: true, duplicate: true });

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const customerId =
        typeof session.customer === "string"
          ? session.customer
          : session.customer?.id;
      if (userId && customerId) {
        await bindStripeCustomer(pool, userId, customerId);
      }
      if (session.metadata?.inviteCode) {
        await redeemInvitation(pool, session.metadata.inviteCode);
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await applySubscriptionUpdate(pool, subscriptionUpdateFrom(sub));
      break;
    }
    default:
      break;
  }
  return c.json({ received: true });
});

// ── Invitations (elite gate) + admin comps ──────────────────────────────

app.post("/v1/invitations", async (c) => {
  if (!adminOk(c)) return c.json({ error: "forbidden" }, 403);
  const body = (await c.req.json().catch(() => ({}))) as {
    tier?: string;
    code?: string;
    expiresAt?: string;
    maxUses?: number;
  };
  if (!isPaidTier(body.tier)) return c.json({ error: "invalid_tier" }, 400);
  const code = await mintInvitation(pool, {
    tier: body.tier,
    code: body.code,
    expiresAt: body.expiresAt,
    maxUses: body.maxUses,
  });
  return c.json({ code, tier: body.tier }, 201);
});

app.get("/v1/invitations/:code", async (c) => {
  const result = await validateInvitation(pool, c.req.param("code"));
  return c.json(result);
});

/** Manual comps / tier overrides without Stripe (kind support, playtests). */
app.post("/v1/admin/users/tier", async (c) => {
  if (!adminOk(c)) return c.json({ error: "forbidden" }, 403);
  const body = (await c.req.json().catch(() => ({}))) as {
    email?: string;
    tier?: string;
    status?: string;
  };
  const tier = TIER_ORDER.includes(body.tier as Tier) ? body.tier : undefined;
  if (!body.email || !tier) return c.json({ error: "invalid_request" }, 400);
  const res = await pool.query(
    `UPDATE users SET tier = $2, subscription_status = $3, updated_at = now()
     WHERE email = $1 RETURNING id`,
    [body.email.trim().toLowerCase(), tier, body.status ?? "comp"]
  );
  if (!res.rowCount) return c.json({ error: "user_not_found" }, 404);
  return c.json({ updated: true, tier });
});

function buildBriefing(def: MysteryDefinition, state?: PlaythroughState) {
  const p = state?.playerPersona;
  return {
    setting: def.meta.setting,
    theMystery: def.meta.theMystery,
    theme: def.meta.theme,
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
          // templateNotes are performer guidance and name the culprit —
          // never shipped to the client (see player-view.ts).
          id: ending.id,
          when: ending.when,
          kind: ending.kind,
          title: ending.title,
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
    // character willingness + portraits for UI — only people the player
    // knows exist (existence fog), labeled by what they know them as.
    characters: Object.fromEntries(
      Object.entries(state.characterState)
        .filter(([id]) => state.playerKnowledge?.[id]?.known !== false)
        .map(([id, cs]) => {
          const ch = def?.characters.find((x) => x.id === id);
          return [
            id,
            {
              locationId: cs.locationId,
              willingness: cs.willingness,
              stance: cs.stance,
              pressure: cs.pressure,
              name: def ? knownAsFor(def, state, id) : ch?.name,
              portrait: ch?.portrait,
              portraitUrl: ch?.portrait
                ? `/v1/cases/${state.caseId}/assets/${ch.portrait}`
                : undefined,
            },
          ];
        })
    ),
    cast: def?.characters
      .filter((ch) => state.playerKnowledge?.[ch.id]?.known !== false)
      .map((ch) => ({
        id: ch.id,
        name: def ? knownAsFor(def, state, ch.id) : ch.name,
        // Dramatis-personae line only — shortBio is the AI's card and
        // may carry secrets; it never reaches a player surface.
        cardTitle:
          state.playerKnowledge?.[ch.id]?.nameKnown === false
            ? undefined
            : ch.cardTitle,
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
  // Guard: a non-production process pointed at a remote DB must not
  // auto-publish local drafts (that combination once pushed an unreviewed
  // draft straight into the live catalog).
  const dbHost = new URL(databaseUrl()).hostname;
  const localDb = dbHost === "localhost" || dbHost === "127.0.0.1";
  const skipImport = process.env.NODE_ENV !== "production" && !localDb;
  if (skipImport) {
    console.warn(
      `Auto-import SKIPPED: dev process with remote DB (${dbHost}). ` +
        `Use pnpm publish-case to upload intentionally.`
    );
  }
  const imported = skipImport
    ? []
    : await registry.importDirectory(contentRoot);
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
