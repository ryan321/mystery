import { describe, expect, it } from "vitest";
import {
  evaluateAccess,
  parseAccessPolicy,
  type AccessContext,
} from "./access.js";

const anon = (over: Partial<AccessContext> = {}): AccessContext => ({
  userId: "anon",
  tier: "free",
  solvedCaseIds: [],
  hasGrant: false,
  ...over,
});

describe("evaluateAccess", () => {
  it("public + no requirements → listed and playable", () => {
    const r = evaluateAccess({ visibility: "public" }, anon());
    expect(r).toEqual({ listed: true, reachable: true, playable: true });
  });

  it("VISIBLE BUT LOCKED: public + tier requirement → listed, not playable", () => {
    const r = evaluateAccess(
      { visibility: "public", minTier: "premium" },
      anon()
    );
    expect(r.listed).toBe(true);
    expect(r.reachable).toBe(true);
    expect(r.playable).toBe(false);
    expect(r.lockReason).toBe("tier");
    expect(r.requirement).toEqual({ minTier: "premium" });
  });

  it("tier satisfied unlocks", () => {
    const r = evaluateAccess(
      { visibility: "public", minTier: "standard" },
      anon({ tier: "premium" })
    );
    expect(r.playable).toBe(true);
  });

  it("progression gate: minSolved", () => {
    const policy = { visibility: "public" as const, minSolved: 3 };
    const locked = evaluateAccess(policy, anon({ solvedCaseIds: ["a"] }));
    expect(locked.playable).toBe(false);
    expect(locked.lockReason).toBe("progression");
    const open = evaluateAccess(
      policy,
      anon({ solvedCaseIds: ["a", "b", "c"] })
    );
    expect(open.playable).toBe(true);
  });

  it("series gate: requiresSolvedCaseIds", () => {
    const policy = {
      visibility: "public" as const,
      requiresSolvedCaseIds: ["blackwood-inheritance"],
    };
    const locked = evaluateAccess(policy, anon());
    expect(locked.lockReason).toBe("series");
    expect(locked.requirement).toEqual({
      requiresSolvedCaseIds: ["blackwood-inheritance"],
    });
    const open = evaluateAccess(
      policy,
      anon({ solvedCaseIds: ["blackwood-inheritance"] })
    );
    expect(open.playable).toBe(true);
  });

  it("NOT VISIBLE: private without grant is a 404-shaped result", () => {
    const r = evaluateAccess({ visibility: "private" }, anon());
    expect(r).toEqual({
      listed: false,
      reachable: false,
      playable: false,
      lockReason: "private",
    });
  });

  it("private WITH grant: fully accessible and on the holder's shelf", () => {
    const r = evaluateAccess(
      { visibility: "private", grantOnly: true },
      anon({ hasGrant: true })
    );
    expect(r).toEqual({ listed: true, reachable: true, playable: true });
  });

  it("unlisted: reachable by URL, not on the shelf", () => {
    const r = evaluateAccess({ visibility: "unlisted" }, anon());
    expect(r.listed).toBe(false);
    expect(r.reachable).toBe(true);
    expect(r.playable).toBe(true);
  });

  it("grantOnly without grant locks even public mysteries", () => {
    const r = evaluateAccess(
      { visibility: "public", grantOnly: true },
      anon()
    );
    expect(r.listed).toBe(true);
    expect(r.playable).toBe(false);
    expect(r.lockReason).toBe("grant");
  });

  it("a grant bypasses tier and progression requirements", () => {
    const r = evaluateAccess(
      {
        visibility: "public",
        minTier: "premium",
        minSolved: 10,
      },
      anon({ hasGrant: true })
    );
    expect(r.playable).toBe(true);
  });
});

describe("subscription tiers (elite, seasonal free, hidden shelves)", () => {
  it("elite outranks premium", () => {
    const policy = { visibility: "public" as const, minTier: "elite" as const };
    expect(evaluateAccess(policy, anon({ tier: "premium" })).playable).toBe(false);
    expect(evaluateAccess(policy, anon({ tier: "elite" })).playable).toBe(true);
  });

  it("NOT EVEN SHOWN: hiddenBelowTier behaves like private below the tier", () => {
    const policy = {
      visibility: "public" as const,
      minTier: "elite" as const,
      hiddenBelowTier: "elite" as const,
    };
    // premium user: does not exist — not listed, not reachable
    expect(evaluateAccess(policy, anon({ tier: "premium" }))).toEqual({
      listed: false,
      reachable: false,
      playable: false,
      lockReason: "private",
    });
    // elite user: fully there
    const elite = evaluateAccess(policy, anon({ tier: "elite" }));
    expect(elite.listed).toBe(true);
    expect(elite.playable).toBe(true);
    // a grant also reveals it (invited playtester without the sub)
    expect(evaluateAccess(policy, anon({ hasGrant: true })).playable).toBe(true);
  });

  it("seasonal free window waives the tier gate and surfaces freeUntil", () => {
    const now = new Date("2026-07-20T12:00:00Z");
    const policy = {
      visibility: "public" as const,
      minTier: "premium" as const,
      freeWindows: [
        { from: "2026-07-18T00:00:00Z", until: "2026-07-21T00:00:00Z" },
      ],
    };
    const during = evaluateAccess(policy, anon(), now);
    expect(during.playable).toBe(true);
    expect(during.freeUntil).toBe("2026-07-21T00:00:00.000Z");

    const after = evaluateAccess(
      policy,
      anon(),
      new Date("2026-07-22T00:00:00Z")
    );
    expect(after.playable).toBe(false);
    expect(after.lockReason).toBe("tier");
    expect(after.freeUntil).toBeUndefined();
  });

  it("free window does not waive progression gates", () => {
    const now = new Date("2026-07-20T12:00:00Z");
    const policy = {
      visibility: "public" as const,
      minTier: "premium" as const,
      minSolved: 2,
      freeWindows: [
        { from: "2026-07-18T00:00:00Z", until: "2026-07-21T00:00:00Z" },
      ],
    };
    const r = evaluateAccess(policy, anon(), now);
    expect(r.playable).toBe(false);
    expect(r.lockReason).toBe("progression");
    expect(r.freeUntil).toBe("2026-07-21T00:00:00.000Z");
  });

  it("parseAccessPolicy keeps freeWindows and hiddenBelowTier, drops junk", () => {
    expect(
      parseAccessPolicy({
        visibility: "public",
        hiddenBelowTier: "elite",
        freeWindows: [
          { from: "2026-07-18", until: "2026-07-21" },
          { from: "not a date", until: "2026-07-21" },
        ],
      })
    ).toEqual({
      visibility: "public",
      hiddenBelowTier: "elite",
      freeWindows: [
        {
          from: new Date("2026-07-18").toISOString(),
          until: new Date("2026-07-21").toISOString(),
        },
      ],
    });
  });
});

describe("parseAccessPolicy", () => {
  it("defaults to public with no requirements", () => {
    expect(parseAccessPolicy(null)).toEqual({ visibility: "public" });
    expect(parseAccessPolicy({})).toEqual({ visibility: "public" });
  });

  it("drops invalid values", () => {
    expect(
      parseAccessPolicy({
        visibility: "secret",
        minTier: "gold",
        minSolved: -2,
        grantOnly: "yes",
      })
    ).toEqual({ visibility: "public" });
  });

  it("keeps valid fields", () => {
    expect(
      parseAccessPolicy({
        visibility: "private",
        minTier: "standard",
        minSolved: 2,
        requiresSolvedCaseIds: ["a"],
        grantOnly: true,
      })
    ).toEqual({
      visibility: "private",
      minTier: "standard",
      minSolved: 2,
      requiresSolvedCaseIds: ["a"],
      grantOnly: true,
    });
  });
});
