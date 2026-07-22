"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Atmosphere from "../../components/Atmosphere";
import BackLink from "../../components/BackLink";
import { fetchMe, openBillingPortal, type MeResponse } from "../../lib/api";
import { refreshSession } from "../../lib/auth";
import { tierLabel } from "../../lib/format";
import styles from "./page.module.css";

function statusLabel(status?: string | null): string {
  switch (status) {
    case "active":
      return "Active";
    case "trialing":
      return "Trial";
    case "past_due":
      return "Payment overdue";
    case "canceled":
      return "Cancelled";
    case "comp":
      return "Complimentary";
    default:
      return status ? status : "Active";
  }
}

function formatDate(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function AccountPage() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const justPaid =
      new URLSearchParams(window.location.search).get("checkout") === "success";
    setSuccess(justPaid);
    let dead = false;
    (async () => {
      try {
        // Checkout just returned → the webhook may have changed the tier;
        // reconcile the nav mirror before reading /v1/me.
        if (justPaid) await refreshSession();
        const res = await fetchMe();
        if (!dead) setMe(res);
      } catch {
        /* leave me null → signed-out view */
      } finally {
        if (!dead) setLoading(false);
      }
    })();
    return () => {
      dead = true;
    };
  }, []);

  // Opens the Stripe Billing Portal (update card, cancel, invoices, proration).
  async function manage() {
    setError(null);
    setBusy(true);
    try {
      const url = await openBillingPortal();
      window.location.href = url;
    } catch (e) {
      const code = e instanceof Error ? e.message : "error";
      setError(
        code === "no_subscription"
          ? "No billing account on file yet."
          : "Couldn't open the billing portal. Please try again."
      );
      setBusy(false);
    }
  }

  const user = me?.user;
  const sub = user?.subscription;
  const tier = user?.tier ?? "free";
  const isPaid = tier !== "free";
  const renews = formatDate(sub?.currentPeriodEnd);

  return (
    <>
      <Atmosphere />
      <main className={styles.account}>
        <div className={styles.inner}>
          <BackLink />
          <header className={styles.header}>
            <p className={styles.eyebrow}>Account</p>
            <h1 className={styles.title}>Your account</h1>
          </header>

          {success ? (
            <p className={styles.success}>
              You’re subscribed. Every mystery your plan includes is open to you
              now.
            </p>
          ) : null}
          {error ? <p className={styles.errorNote}>{error}</p> : null}

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Subscription</h2>
            </div>
            <div className={styles.sectionBody}>
              {loading ? (
                <p className={styles.empty}>Loading…</p>
              ) : !user ? (
                <>
                  <p className={styles.hint} style={{ marginTop: 0 }}>
                    Sign in to see your subscription.
                  </p>
                  <div className={styles.subActions}>
                    <Link
                      href="/signin?next=%2Faccount"
                      className={styles.btnPrimary}
                    >
                      Sign in
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <div className={styles.subRow}>
                    <span className={styles.subLabel}>Plan</span>
                    <span className={styles.subPlan}>{tierLabel(tier)}</span>
                  </div>
                  {isPaid && sub?.status ? (
                    <div className={styles.subRow}>
                      <span className={styles.subLabel}>Status</span>
                      <span className={styles.subValue}>
                        {statusLabel(sub.status)}
                      </span>
                    </div>
                  ) : null}
                  {isPaid && renews ? (
                    <div className={styles.subRow}>
                      <span className={styles.subLabel}>
                        {sub?.cancelAtPeriodEnd ? "Access until" : "Renews"}
                      </span>
                      <span className={styles.subValue}>{renews}</span>
                    </div>
                  ) : null}
                  {sub?.cancelAtPeriodEnd ? (
                    <p className={styles.cancelNote}>
                      Your subscription is set to end. You keep access until the
                      date above.
                    </p>
                  ) : null}
                  {!isPaid ? (
                    <p className={styles.hint}>
                      You’re on the free plan. The Blackwood Inheritance is yours
                      to play; subscribe to open more of the Gallery.
                    </p>
                  ) : null}
                  <div className={styles.subActions}>
                    {isPaid ? (
                      <>
                        <button
                          type="button"
                          className={styles.btnPrimary}
                          onClick={manage}
                          disabled={busy}
                        >
                          {busy ? "Opening…" : "Manage subscription"}
                        </button>
                        <Link href="/subscribe" className={styles.btnGhost}>
                          Change plan
                        </Link>
                      </>
                    ) : (
                      <Link href="/subscribe" className={styles.btnPrimary}>
                        Browse plans
                      </Link>
                    )}
                  </div>
                </>
              )}
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Your mysteries</h2>
            </div>
            <div className={styles.sectionBody}>
              <Link href="/my-mysteries" className={styles.link}>
                View your investigations →
              </Link>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
