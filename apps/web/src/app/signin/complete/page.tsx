"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { refreshSession } from "../../../lib/auth";
import styles from "../page.module.css";

/**
 * Landing spot after the API's Google OAuth callback. The session
 * cookie is already set on the API origin — this page asks /v1/me who
 * we are, mirrors it into the client-side auth store (nav state), and
 * moves on.
 */
function CompleteInner() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const next = params.get("next") ?? "/gallery";
    const safeNext = next.startsWith("/") && !next.startsWith("//")
      ? next
      : "/gallery";
    (async () => {
      const session = await refreshSession();
      router.replace(session ? safeNext : "/signin?error=google");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className={styles.auth}>
      <div className={styles.card}>
        <div className={styles.cardBody}>
          <p className={styles.switch}>Stepping inside…</p>
        </div>
      </div>
    </main>
  );
}

export default function SignInCompletePage() {
  return (
    <Suspense fallback={null}>
      <CompleteInner />
    </Suspense>
  );
}
