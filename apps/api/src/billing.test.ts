import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  isPaidTier,
  newInviteCode,
  priceForTier,
  tierForPrice,
  tierForSubscription,
  subscriptionUpdateFrom,
} from "./billing.js";
import { effectiveTier } from "./auth.js";

const ENV_KEYS = [
  "STRIPE_PRICE_STANDARD",
  "STRIPE_PRICE_PREMIUM",
  "STRIPE_PRICE_ELITE",
];
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  process.env.STRIPE_PRICE_STANDARD = "price_std";
  process.env.STRIPE_PRICE_PREMIUM = "price_prem";
  process.env.STRIPE_PRICE_ELITE = "price_elite";
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("price ↔ tier mapping", () => {
  it("round-trips each paid tier", () => {
    expect(priceForTier("standard")).toBe("price_std");
    expect(tierForPrice("price_prem")).toBe("premium");
    expect(tierForPrice("price_elite")).toBe("elite");
    expect(tierForPrice("price_unknown")).toBeUndefined();
  });

  it("isPaidTier rejects free and junk", () => {
    expect(isPaidTier("standard")).toBe(true);
    expect(isPaidTier("elite")).toBe(true);
    expect(isPaidTier("free")).toBe(false);
    expect(isPaidTier("gold")).toBe(false);
  });
});

describe("tierForSubscription", () => {
  it("maps active subscription to its price's tier", () => {
    expect(
      tierForSubscription({
        customerId: "cus_1",
        status: "active",
        priceId: "price_prem",
        cancelAtPeriodEnd: false,
      })
    ).toBe("premium");
  });

  it("dead statuses drop to free regardless of price", () => {
    for (const status of ["canceled", "unpaid", "incomplete_expired"]) {
      expect(
        tierForSubscription({
          customerId: "cus_1",
          status,
          priceId: "price_elite",
          cancelAtPeriodEnd: false,
        })
      ).toBe("free");
    }
  });

  it("past_due keeps the tier (grace)", () => {
    expect(
      tierForSubscription({
        customerId: "cus_1",
        status: "past_due",
        priceId: "price_std",
        cancelAtPeriodEnd: false,
      })
    ).toBe("standard");
  });
});

describe("subscriptionUpdateFrom", () => {
  it("extracts customer, price, status, period end", () => {
    const sub = {
      customer: "cus_9",
      status: "active",
      cancel_at_period_end: true,
      items: {
        data: [
          {
            price: { id: "price_prem" },
            current_period_end: 1_790_000_000,
          },
        ],
      },
    } as never;
    const u = subscriptionUpdateFrom(sub);
    expect(u.customerId).toBe("cus_9");
    expect(u.priceId).toBe("price_prem");
    expect(u.status).toBe("active");
    expect(u.cancelAtPeriodEnd).toBe(true);
    expect(u.currentPeriodEnd?.getTime()).toBe(1_790_000_000 * 1000);
  });
});

describe("effectiveTier", () => {
  it("entitled statuses keep the paid tier", () => {
    for (const status of ["active", "trialing", "past_due", "comp"]) {
      expect(
        effectiveTier({ tier: "premium", subscription_status: status })
      ).toBe("premium");
    }
  });

  it("anything else falls back to free", () => {
    expect(
      effectiveTier({ tier: "premium", subscription_status: "canceled" })
    ).toBe("free");
    expect(effectiveTier({ tier: "elite", subscription_status: null })).toBe(
      "free"
    );
    expect(effectiveTier({ tier: "free", subscription_status: null })).toBe(
      "free"
    );
  });
});

describe("invitations", () => {
  it("mints readable codes", () => {
    const code = newInviteCode();
    expect(code).toMatch(/^MYST-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(newInviteCode()).not.toBe(code);
  });
});
