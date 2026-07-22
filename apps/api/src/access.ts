/**
 * Access model for mystery bundles (docs/MYSTERY_BUNDLES.md §6).
 *
 * Policy lives on the registry row, never in definition.json. Two axes:
 * visibility (listed / reachable) × playability (requirements). Both
 * "visible but locked" (public + unmet requirements) and "not visible"
 * (private without grant → 404, anti-enumeration) are first-class.
 *
 * The engine never sees any of this — enforcement is API-layer only.
 */
import type { Db } from "./db.js";

export type Tier = "free" | "standard" | "premium" | "elite";
export const TIER_ORDER: Tier[] = ["free", "standard", "premium", "elite"];

/**
 * Default subscription tier for a case, derived from its difficulty
 * (docs/TIER_STRATEGY.md): Difficult → Master Detective (premium); Easy and
 * Medium → Sleuth (standard). Used to auto-tier a case at publish time when
 * no explicit tier override has been set.
 */
export function minTierForDifficulty(difficulty?: string): Tier {
  return difficulty === "hard" ? "premium" : "standard";
}

export type AccessPolicy = {
  visibility: "public" | "unlisted" | "private";
  /** Minimum subscription tier to play. */
  minTier?: Tier;
  /**
   * Below this tier the mystery is not even shown: it behaves like
   * `private` (absent from the catalog, 404 by URL, assets 404). The
   * invitation-only shelf: elite mysteries with hiddenBelowTier: "elite"
   * simply do not exist for anyone else.
   */
  hiddenBelowTier?: Tier;
  /**
   * Seasonal free windows: while now ∈ [from, until), the tier gate is
   * waived (progression/series gates still apply). Catalog surfaces
   * freeUntil so the shelf can badge "Free until Sunday".
   */
  freeWindows?: { from: string; until: string }[];
  /** Distinct mysteries solved before this unlocks. */
  minSolved?: number;
  /** Specific mysteries that must be solved first (series/sequels). */
  requiresSolvedCaseIds?: string[];
  /** Only explicit grants may play (commissions, playtests). */
  grantOnly?: boolean;
};

export function parseAccessPolicy(raw: unknown): AccessPolicy {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  const visibility =
    o.visibility === "unlisted" || o.visibility === "private"
      ? o.visibility
      : "public";
  const policy: AccessPolicy = { visibility };
  if (TIER_ORDER.includes(o.minTier as Tier)) {
    policy.minTier = o.minTier as Tier;
  }
  if (TIER_ORDER.includes(o.hiddenBelowTier as Tier)) {
    policy.hiddenBelowTier = o.hiddenBelowTier as Tier;
  }
  if (Array.isArray(o.freeWindows)) {
    const windows = o.freeWindows
      .map((w) => {
        const win = (w && typeof w === "object" ? w : {}) as Record<
          string,
          unknown
        >;
        const from = new Date(String(win.from ?? ""));
        const until = new Date(String(win.until ?? ""));
        if (Number.isNaN(from.getTime()) || Number.isNaN(until.getTime())) {
          return null;
        }
        return { from: from.toISOString(), until: until.toISOString() };
      })
      .filter((w): w is { from: string; until: string } => w !== null);
    if (windows.length) policy.freeWindows = windows;
  }
  if (typeof o.minSolved === "number" && o.minSolved > 0) {
    policy.minSolved = Math.floor(o.minSolved);
  }
  if (
    Array.isArray(o.requiresSolvedCaseIds) &&
    o.requiresSolvedCaseIds.length
  ) {
    policy.requiresSolvedCaseIds = o.requiresSolvedCaseIds.map(String);
  }
  if (o.grantOnly === true) policy.grantOnly = true;
  return policy;
}

export type AccessContext = {
  userId: string;
  tier: Tier;
  /** Distinct case ids this user has solved. */
  solvedCaseIds: string[];
  hasGrant: boolean;
};

export type AccessResult = {
  /** Appears on the shelf/catalog. */
  listed: boolean;
  /** Detail page / assets reachable (404 when false). */
  reachable: boolean;
  /** May start a playthrough. */
  playable: boolean;
  lockReason?: "tier" | "progression" | "series" | "grant" | "private";
  requirement?: Record<string, unknown>;
  /** Set while a seasonal free window is active (shelf badge). */
  freeUntil?: string;
};

const NOT_FOUND: AccessResult = {
  listed: false,
  reachable: false,
  playable: false,
  lockReason: "private",
};

/** Active seasonal window, if any. */
function activeFreeWindow(
  policy: AccessPolicy,
  now: Date
): { from: string; until: string } | undefined {
  return policy.freeWindows?.find(
    (w) => now >= new Date(w.from) && now < new Date(w.until)
  );
}

/** Pure policy evaluation — unit-testable, no IO. */
export function evaluateAccess(
  policy: AccessPolicy,
  ctx: AccessContext,
  now: Date = new Date()
): AccessResult {
  // A grant is explicit access: reachable, on the holder's shelf, playable.
  if (ctx.hasGrant) {
    return { listed: true, reachable: true, playable: true };
  }

  // Invitation-only shelf: below the tier, the mystery does not exist.
  if (policy.hiddenBelowTier) {
    const need = TIER_ORDER.indexOf(policy.hiddenBelowTier);
    if (TIER_ORDER.indexOf(ctx.tier) < need) {
      return NOT_FOUND;
    }
  }

  if (policy.visibility === "private") {
    // Existence hidden — anti-enumeration.
    return NOT_FOUND;
  }

  const listed = policy.visibility === "public";
  const reachable = true; // public + unlisted are reachable by URL
  const freeWindow = activeFreeWindow(policy, now);
  const freeUntil = freeWindow
    ? new Date(freeWindow.until).toISOString()
    : undefined;

  if (policy.grantOnly) {
    return {
      listed,
      reachable,
      playable: false,
      lockReason: "grant",
      requirement: { grantOnly: true },
    };
  }

  // Seasonal free window waives the tier gate.
  if (!freeWindow && policy.minTier && policy.minTier !== "free") {
    const need = TIER_ORDER.indexOf(policy.minTier);
    const have = TIER_ORDER.indexOf(ctx.tier);
    if (have < need) {
      return {
        listed,
        reachable,
        playable: false,
        lockReason: "tier",
        requirement: { minTier: policy.minTier },
      };
    }
  }

  if (policy.requiresSolvedCaseIds?.length) {
    const solved = new Set(ctx.solvedCaseIds);
    const missing = policy.requiresSolvedCaseIds.filter(
      (id) => !solved.has(id)
    );
    if (missing.length) {
      return {
        listed,
        reachable,
        playable: false,
        lockReason: "series",
        requirement: { requiresSolvedCaseIds: missing },
        freeUntil,
      };
    }
  }

  if (policy.minSolved && ctx.solvedCaseIds.length < policy.minSolved) {
    return {
      listed,
      reachable,
      playable: false,
      lockReason: "progression",
      requirement: {
        minSolved: policy.minSolved,
        solved: ctx.solvedCaseIds.length,
      },
      freeUntil,
    };
  }

  return { listed, reachable, playable: true, freeUntil };
}

/** Distinct case ids this user has solved (progression source of truth). */
export async function solvedCaseIdsFor(
  pool: Db,
  userId: string
): Promise<string[]> {
  const res = await pool.query<{ case_id: string }>(
    `SELECT DISTINCT case_id FROM playthroughs
     WHERE user_id = $1 AND status = 'solved'`,
    [userId]
  );
  return res.rows.map((r) => r.case_id);
}

export async function hasGrant(
  pool: Db,
  caseId: string,
  userId: string
): Promise<boolean> {
  const res = await pool.query(
    `SELECT 1 FROM mystery_grants WHERE case_id = $1 AND user_id = $2`,
    [caseId, userId]
  );
  return (res.rowCount ?? 0) > 0;
}

/** Resolve everything evaluateAccess needs for one user+case. */
export async function accessContextFor(
  pool: Db,
  args: { userId: string; tier: Tier; caseId: string }
): Promise<AccessContext> {
  const [solvedCaseIds, grant] = await Promise.all([
    solvedCaseIdsFor(pool, args.userId),
    hasGrant(pool, args.caseId, args.userId),
  ]);
  return {
    userId: args.userId,
    tier: args.tier,
    solvedCaseIds,
    hasGrant: grant,
  };
}
