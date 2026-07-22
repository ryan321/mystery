"use client";

import { useRouter } from "next/navigation";
import styles from "./BackLink.module.css";

/**
 * Way out of menu-only pages (Settings, Account, Help). Matters most in
 * the installed home-screen app, where there is no browser back button:
 * follows the router history when there is any, else lands on the home
 * page so the button never dead-ends.
 */
export default function BackLink({ label = "Back" }: { label?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={styles.back}
      onClick={() => {
        if (window.history.length > 1) {
          router.back();
        } else {
          router.push("/");
        }
      }}
    >
      ← {label}
    </button>
  );
}
