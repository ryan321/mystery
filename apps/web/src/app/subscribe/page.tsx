"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Atmosphere from "../../components/Atmosphere";
import {
  fetchBillingTiers,
  fetchMe,
  startCheckout,
  type BillingTiersResponse,
  type MeResponse,
} from "../../lib/api";
import { formatPrice, tierLabel } from "../../lib/format";
import type { BillingTier } from "../../lib/types";
import styles from "./page.module.css";

const TIER_ORDER = ["free", "standard", "premium", "elite"];
const rank = (t?: string) => Math.max(0, TIER_ORDER.indexOf(t ?? "free"));

export default function SubscribePage() {
  const router = useRouter();
  const [invite, setInvite] = useState<string | undefined>();
  const [cancelled, setCancelled] = useState(false);
  const [data, setData] = useState<BillingTiersResponse | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyTier, setBusyTier] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inv = params.get("invite") ?? undefined;
    setInvite(inv);
    setCancelled(params.get("checkout") === "cancelled");
    let dead = false;
    (async () => {
      try {
        const [tiers, meRes] = await Promise.all([
          fetchBillingTiers(inv),
          fetchMe(),
        ]);
        if (!dead) {
          setData(tiers);
          setMe(meRes);
        }
      } catch {
        if (!dead) setError("Couldn't load plans. Try again in a moment.");
      } finally {
        if (!dead) setLoading(false);
      }
    })();
    return () => {
      dead = true;
    };
  }, []);

  const currentTier = me?.user?.tier ?? "free";
  const signedIn = Boolean(me?.user);

  async function subscribe(tier: BillingTier) {
    setError(null);
    const next = `/subscribe${invite ? `?invite=${encodeURIComponent(invite)}` : ""}`;
    if (!signedIn) {
      router.push(`/signin?next=${encodeURIComponent(next)}`);
      return;
    }
    setBusyTier(tier.tier);
    try {
      const url = await startCheckout(
        tier.tier,
        tier.inviteOnly ? invite : undefined
      );
      window.location.href = url;
    } catch (e) {
      const code = e instanceof Error ? e.message : "error";
      if (code === "sign_in_required") {
        router.push(`/signin?next=${encodeURIComponent(next)}`);
        return;
      }
      setError(
        code === "invitation_required"
          ? "This tier needs a valid invitation link."
          : code === "billing_not_configured" || code === "price_not_configured"
            ? "This plan isn't available just yet."
            : "Couldn't start checkout. Please try again."
      );
      setBusyTier(null);
    }
  }

  // Only tiers with a live Stripe price are purchasable.
  const buyable = (data?.tiers ?? []).filter((t) => t.configured && t.price);

  return (
    <>
      <Atmosphere />
      <main className={styles.page}>
        <div className={styles.inner}>
          <Link href="/gallery" className={styles.back}>
            ← Back to the gallery
          </Link>

          <header className={styles.header}>
            <p className={styles.eyebrow}>Membership</p>
            <h1 className={styles.title}>Unlock the whole shelf</h1>
            <p className={styles.subtitle}>
              The Blackwood Inheritance is always free. A subscription opens
              every other mystery — new cases as they’re published.
            </p>
            {signedIn ? (
              <p className={styles.current}>
                You’re signed in on the{" "}
                <strong>{tierLabel(currentTier)}</strong> plan.
              </p>
            ) : null}
          </header>

          {cancelled ? (
            <p className={styles.notice}>
              Checkout cancelled — no charge was made. Pick a plan whenever
              you’re ready.
            </p>
          ) : null}
          {error ? <p className={styles.errorNote}>{error}</p> : null}

          {loading ? (
            <p className={styles.muted}>Loading plans…</p>
          ) : !data?.billingConfigured ? (
            <p className={styles.muted}>
              Subscriptions aren’t open yet — check back soon.
            </p>
          ) : buyable.length === 0 ? (
            <p className={styles.muted}>New plans are coming soon.</p>
          ) : (
            <div className={styles.plans}>
              {buyable.map((tier) => {
                const owned = rank(currentTier) >= rank(tier.tier);
                const busy = busyTier === tier.tier;
                return (
                  <article key={tier.tier} className={styles.plan}>
                    <div className={styles.planHead}>
                      <h2 className={styles.planName}>{tier.name}</h2>
                      {tier.inviteOnly ? (
                        <span className={styles.invitePill}>By invitation</span>
                      ) : null}
                    </div>
                    <p className={styles.price}>
                      {formatPrice(tier.price) ?? "—"}
                    </p>
                    <p className={styles.blurb}>{tier.blurb}</p>
                    {owned ? (
                      <Link
                        href="/account/billing"
                        className={styles.btnOwned}
                      >
                        Your current plan · Manage
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className={styles.btnBuy}
                        onClick={() => subscribe(tier)}
                        disabled={busy}
                      >
                        {busy
                          ? "Opening checkout…"
                          : signedIn
                            ? `Subscribe to ${tier.name}`
                            : "Sign in to subscribe"}
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          )}

          <footer className={styles.footer}>
            <p className={styles.muted}>
              Payments are handled securely by Stripe. Cancel anytime from{" "}
              <Link href="/account/billing" className={styles.link}>
                your billing page
              </Link>
              .
            </p>
          </footer>
        </div>
      </main>
    </>
  );
}
