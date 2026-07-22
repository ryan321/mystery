"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Atmosphere from "../../../components/Atmosphere";
import { fetchMe, openBillingPortal, type MeResponse } from "../../../lib/api";
import { refreshSession } from "../../../lib/auth";
import { tierLabel } from "../../../lib/format";
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
      return status ? status : "—";
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

export default function AccountBillingPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const justPaid = params.get("checkout") === "success";
    setSuccess(justPaid);
    let dead = false;
    (async () => {
      try {
        // Checkout just completed → the webhook may have updated the tier;
        // refreshSession reconciles the nav mirror against the new /v1/me.
        if (justPaid) await refreshSession();
        const meRes = await fetchMe();
        if (!dead) setMe(meRes);
      } catch {
        if (!dead) setError("Couldn't load your account. Try again shortly.");
      } finally {
        if (!dead) setLoading(false);
      }
    })();
    return () => {
      dead = true;
    };
  }, []);

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
          ? "No billing account on file yet — subscribe to manage payments here."
          : code === "sign_in_required"
            ? "Please sign in again."
            : "Couldn't open the billing portal. Please try again."
      );
      setBusy(false);
    }
  }

  const user = me?.user;
  const sub = user?.subscription;
  const tier = user?.tier ?? "free";
  const isPaid = tier !== "free";
  const hasBilling = Boolean(sub?.status) && sub?.status !== "comp";
  const renews = formatDate(sub?.currentPeriodEnd);

  return (
    <>
      <Atmosphere />
      <main className={styles.page}>
        <div className={styles.inner}>
          <Link href="/account" className={styles.back}>
            ← Back to your account
          </Link>

          <header className={styles.header}>
            <p className={styles.eyebrow}>Account</p>
            <h1 className={styles.title}>Membership &amp; billing</h1>
          </header>

          {success ? (
            <p className={styles.success}>
              You’re subscribed — welcome. Every mystery is open to you now.
            </p>
          ) : null}
          {error ? <p className={styles.errorNote}>{error}</p> : null}

          {loading ? (
            <p className={styles.muted}>Loading…</p>
          ) : !user ? (
            <div className={styles.card}>
              <p className={styles.muted}>Sign in to manage your membership.</p>
              <Link
                href="/signin?next=%2Faccount%2Fbilling"
                className={styles.btnPrimary}
              >
                Sign in
              </Link>
            </div>
          ) : (
            <div className={styles.card}>
              <div className={styles.planRow}>
                <span className={styles.planLabel}>Current plan</span>
                <span className={styles.planValue}>{tierLabel(tier)}</span>
              </div>
              {sub?.status ? (
                <div className={styles.planRow}>
                  <span className={styles.planLabel}>Status</span>
                  <span className={styles.planValue}>
                    {statusLabel(sub.status)}
                  </span>
                </div>
              ) : null}
              {renews ? (
                <div className={styles.planRow}>
                  <span className={styles.planLabel}>
                    {sub?.cancelAtPeriodEnd ? "Access until" : "Renews"}
                  </span>
                  <span className={styles.planValue}>{renews}</span>
                </div>
              ) : null}
              {sub?.cancelAtPeriodEnd ? (
                <p className={styles.cancelNote}>
                  Your subscription is set to end — you keep access until the
                  date above.
                </p>
              ) : null}

              <div className={styles.actions}>
                {hasBilling ? (
                  <button
                    type="button"
                    className={styles.btnPrimary}
                    onClick={manage}
                    disabled={busy}
                  >
                    {busy ? "Opening…" : "Manage subscription"}
                  </button>
                ) : null}
                {!isPaid ? (
                  <Link href="/subscribe" className={styles.btnPrimary}>
                    Browse plans
                  </Link>
                ) : (
                  <Link href="/subscribe" className={styles.btnGhost}>
                    Change plan
                  </Link>
                )}
              </div>

              {!isPaid ? (
                <p className={styles.muted} style={{ marginTop: "1rem" }}>
                  You’re on the free plan — The Blackwood Inheritance is yours
                  to play. Subscribe to open the rest of the shelf.
                </p>
              ) : null}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
