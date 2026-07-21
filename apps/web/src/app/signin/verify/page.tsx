"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { verifyMagicToken } from "../../../lib/api";
import { refreshSession } from "../../../lib/auth";
import styles from "../page.module.css";

/**
 * The magic-link email lands here. POSTing the token to the API sets
 * the session cookie; then we sync the client store and move on.
 */
function VerifyInner() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const token = params.get("token") ?? "";
    const rawNext = params.get("next");
    const next =
      rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//")
        ? rawNext
        : "/gallery";
    (async () => {
      try {
        await verifyMagicToken(token);
        await refreshSession();
        router.replace(next);
      } catch {
        router.replace("/signin?error=link");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className={styles.auth}>
      <div className={styles.card}>
        <div className={styles.cardBody}>
          <p className={styles.switch}>Checking your letter…</p>
        </div>
      </div>
    </main>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={null}>
      <VerifyInner />
    </Suspense>
  );
}
