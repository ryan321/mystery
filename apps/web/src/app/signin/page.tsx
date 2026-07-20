"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Atmosphere from "../../components/Atmosphere";
import GoogleButton from "../../components/GoogleButton";
import { signIn } from "../../lib/auth";
import styles from "./page.module.css";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("error") === "google") {
      setError("Google sign-in didn't go through. Try again.");
    }
  }, []);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) {
      setError("Enter a valid email.");
      return;
    }
    if (!password) {
      setError("Enter your password.");
      return;
    }
    // Stub: accept any credentials and open a local session.
    signIn(trimmed);
    router.push("/gallery");
  }

  return (
    <>
      <Atmosphere />
      <main className={styles.auth}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h1 className={styles.cardTitle}>Sign in</h1>
          </div>
          <div className={styles.cardBody}>
            <form className={styles.cardBody} onSubmit={onSubmit}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  className={styles.input}
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  className={styles.input}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
              {error ? <p className={styles.error}>{error}</p> : null}
              <button type="submit" className={styles.btnPrimary}>
                Sign in
              </button>
            </form>
            <GoogleButton />
            <p className={styles.switch}>
              No account? <Link href="/signup">Sign up</Link>
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
