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

export default function SignUpPage() {
  const [next, setNext] = useState("/gallery");

  useEffect(() => {
    setNext(safeNext(new URLSearchParams(window.location.search).get("next")));
  }, []);

  return (
    <>
      <Atmosphere />
      <main className={styles.auth}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h1 className={styles.cardTitle}>Create account</h1>
          </div>
          <div className={styles.cardBody}>
            <p className={styles.switch} style={{ textAlign: "left" }}>
              No password to invent: we email you a link, and your first
              sign-in creates the account.
            </p>
            <MagicLinkForm next={next} submitLabel="Create my account" />
            <GoogleButton next={next} />
            <p className={styles.switch}>
              Already a member? <Link href={`/signin?next=${encodeURIComponent(next)}`}>Sign in</Link>
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
