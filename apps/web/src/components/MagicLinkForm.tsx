"use client";

import { FormEvent, useState } from "react";
import { requestMagicLink } from "../lib/api";
import styles from "./MagicLinkForm.module.css";

/**
 * Real sign-in: we email a one-time link (no passwords to keep).
 * Signing in for the first time IS signing up — same form both places.
 */
export default function MagicLinkForm({
  next = "/gallery",
  submitLabel = "Email me a sign-in link",
}: {
  next?: string;
  submitLabel?: string;
}) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) {
      setError("Enter a valid email.");
      return;
    }
    setBusy(true);
    try {
      const res = await requestMagicLink(trimmed, next);
      setSent(true);
      setDevLink(res.devLink ?? null);
    } catch {
      setError("Couldn't send the link. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className={styles.sent}>
        <p className={styles.sentTitle}>A letter is on its way.</p>
        <p className={styles.sentText}>
          Check your email for a sign-in link. It expires in 15 minutes.
        </p>
        {devLink ? (
          <p className={styles.sentText}>
            <a className={styles.devLink} href={devLink}>
              Dev: open the link
            </a>
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={onSubmit}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="magic-email">
          Email
        </label>
        <input
          id="magic-email"
          type="email"
          className={styles.input}
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
      </div>
      {error ? <p className={styles.error}>{error}</p> : null}
      <button type="submit" className={styles.btnPrimary} disabled={busy}>
        {busy ? "Sending…" : submitLabel}
      </button>
    </form>
  );
}
