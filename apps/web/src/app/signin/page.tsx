"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Atmosphere from "../../components/Atmosphere";
import GoogleButton from "../../components/GoogleButton";
import MagicLinkForm from "../../components/MagicLinkForm";
import styles from "./page.module.css";

/** Same-site paths only (mirrors the API's open-redirect guard). */
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/gallery";
  return raw;
}

export default function SignInPage() {
  const [next, setNext] = useState("/gallery");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNext(safeNext(params.get("next")));
    const err = params.get("error");
    if (err === "google") {
      setError("Google sign-in didn't go through. Try again.");
    } else if (err === "link") {
      setError("That sign-in link expired or was already used. Request a fresh one.");
    }
  }, []);

  return (
    <>
      <Atmosphere />
      <main className={styles.auth}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h1 className={styles.cardTitle}>Sign in</h1>
          </div>
          <div className={styles.cardBody}>
            {error ? <p className={styles.error}>{error}</p> : null}
            <MagicLinkForm next={next} />
            <GoogleButton next={next} />
            <p className={styles.switch}>
              First time? <Link href={`/signup?next=${encodeURIComponent(next)}`}>Create an account</Link>
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
