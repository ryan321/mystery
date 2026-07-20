"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Atmosphere from "../../components/Atmosphere";
import { signIn } from "../../lib/auth";
import styles from "./page.module.css";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim();
    if (!name.trim()) {
      setError("Enter a name.");
      return;
    }
    if (!trimmed || !trimmed.includes("@")) {
      setError("Enter a valid email.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    // Stub: create a local session (no backend yet).
    signIn(trimmed, name.trim());
    router.push("/gallery");
  }

  return (
    <>
      <Atmosphere />
      <main className={styles.auth}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h1 className={styles.cardTitle}>Create account</h1>
          </div>
          <div className={styles.cardBody}>
            <form className={styles.cardBody} onSubmit={onSubmit}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="name">
                  Name
                </label>
                <input
                  id="name"
                  type="text"
                  className={styles.input}
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  required
                />
              </div>
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
                  autoComplete="new-password"
                  required
                />
              </div>
              {error ? <p className={styles.error}>{error}</p> : null}
              <button type="submit" className={styles.btnPrimary}>
                Sign up
              </button>
            </form>
            <p className={styles.switch}>
              Already have an account? <Link href="/signin">Sign in</Link>
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
