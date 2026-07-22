"use client";

import { Fragment, useEffect, useState } from "react";
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

/** Render text with the word "Difficult" in the gold accent color. */
function goldDifficult(text: string) {
  return text.split(/(Difficult)/g).map((part, i) =>
    part === "Difficult" ? (
      <span key={i} className={styles.gold}>
        Difficult
      </span>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    )
  );
}

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

  // The whole ladder is displayed; each card renders its own state
  // (buyable, coming-soon, or earned-and-whispered for Genius).
  const allTiers = data?.tiers ?? [];

  return (
    <>
      <Atmosphere />
      <main className={styles.page}>
        <div className={styles.inner}>
          <Link href="/gallery" className={styles.back}>
            ← Back to the gallery
          </Link>

          <header className={styles.header}>
            <p className={styles.eyebrow}>Subscription</p>
            <h1 className={styles.title}>Unlock more mysteries</h1>
            <p className={styles.subtitle}>
              The Blackwood Inheritance, a complete mystery, is free to play.
              Subscribe to open more of the Gallery.
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
              Checkout cancelled. No charge was made; pick a plan whenever
              you’re ready.
            </p>
          ) : null}
          {error ? <p className={styles.errorNote}>{error}</p> : null}

          {loading ? (
            <p className={styles.muted}>Loading plans…</p>
          ) : !data?.billingConfigured ? (
            <p className={styles.muted}>
              Subscriptions aren’t open yet. Check back soon.
            </p>
          ) : allTiers.length === 0 ? (
            <p className={styles.muted}>New plans are coming soon.</p>
          ) : (
            <div className={styles.plans}>
              {allTiers.map((tier) => {
                const owned = rank(currentTier) >= rank(tier.tier);
                const hasPrice = Boolean(tier.configured && tier.price);
                const busy = busyTier === tier.tier;
                // Genius: whispered + earned. Locked until eligible or invited.
                const earnedLock =
                  Boolean(tier.inviteOnly) && !tier.purchasable && !owned;
                const remaining = tier.requirement
                  ? Math.max(
                      0,
                      tier.requirement.required - tier.requirement.hardSolved
                    )
                  : 0;
                return (
                  <article
                    key={tier.tier}
                    className={`${styles.plan} ${earnedLock ? styles.planLocked : ""}`}
                  >
                    <div className={styles.planHead}>
                      <h2 className={styles.planName}>{tier.name}</h2>
                      {tier.inviteOnly ? (
                        <span className={styles.invitePill}>By invitation</span>
                      ) : null}
                    </div>
                    <p className={styles.price}>
                      {hasPrice
                        ? formatPrice(tier.price)
                        : tier.inviteOnly
                          ? "Earn your invitation"
                          : "Coming soon"}
                    </p>
                    <p className={styles.blurb}>{goldDifficult(tier.blurb)}</p>

                    {earnedLock ? (
                      <div className={styles.earnBlock}>
                        <p className={styles.earnProgress}>
                          {remaining > 0 ? (
                            <>
                              Solve {remaining} more{" "}
                              <span className={styles.gold}>Difficult</span>{" "}
                              {remaining === 1 ? "mystery" : "mysteries"} to
                              earn your invitation.
                            </>
                          ) : (
                            "You’ve earned your place."
                          )}
                          {tier.requirement ? (
                            <span className={styles.earnCount}>
                              {" "}
                              ({tier.requirement.hardSolved}/
                              {tier.requirement.required})
                            </span>
                          ) : null}
                        </p>
                      </div>
                    ) : owned ? (
                      <Link href="/account/billing" className={styles.btnOwned}>
                        Your current plan · Manage
                      </Link>
                    ) : !hasPrice ? (
                      <button type="button" className={styles.btnBuy} disabled>
                        {tier.inviteOnly
                          ? "You’ve earned it · coming soon"
                          : "Coming soon"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={styles.btnBuy}
                        onClick={() => subscribe(tier)}
                        disabled={busy}
                      >
                        {busy
                          ? "Opening checkout…"
                          : tier.inviteOnly
                            ? "Claim your place"
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

          <section className={styles.faq}>
            <h2 className={styles.faqTitle}>Questions</h2>
            <details className={styles.faqItem}>
              <summary className={styles.faqQuestion}>
                How do the tiers work?
              </summary>
              <p className={styles.faqAnswer}>
                Sleuth unlocks every Easy and Medium mystery. Master Detective
                adds the Difficult ones, so you get the whole Gallery. Genius is
                an invitation-only tier of exclusive mysteries.
              </p>
            </details>
            <details className={styles.faqItem}>
              <summary className={styles.faqQuestion}>
                Do you add new mysteries?
              </summary>
              <p className={styles.faqAnswer}>
                Often. New mysteries are published regularly, and your
                subscription automatically includes every new one that matches
                your tier, at no extra cost.
              </p>
            </details>
            <details className={styles.faqItem}>
              <summary className={styles.faqQuestion}>
                What is Genius, and how do I get it?
              </summary>
              <p className={styles.faqAnswer}>
                An invitation-only tier of exclusive mysteries you won’t find
                anywhere else. It can’t be bought. You earn the invitation by
                solving 3 Difficult mysteries.
              </p>
            </details>
            <details className={styles.faqItem}>
              <summary className={styles.faqQuestion}>
                Is the first mystery really free?
              </summary>
              <p className={styles.faqAnswer}>
                Yes. The Blackwood Inheritance is a complete mystery, free to
                play start to finish with a free account.
              </p>
            </details>
            <details className={styles.faqItem}>
              <summary className={styles.faqQuestion}>
                Can I cancel anytime?
              </summary>
              <p className={styles.faqAnswer}>
                Yes. Manage or cancel anytime from your{" "}
                <Link href="/account/billing" className={styles.link}>
                  billing page
                </Link>
                . Payments are handled securely by Stripe.
              </p>
            </details>
          </section>
        </div>
      </main>
    </>
  );
}
