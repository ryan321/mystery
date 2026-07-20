import { API } from "../lib/api";
import styles from "./GoogleButton.module.css";

/**
 * "Continue with Google" — a plain link: the API owns the whole OAuth
 * dance and lands the browser back on /signin/complete with a session
 * cookie set.
 */
export default function GoogleButton({ next = "/gallery" }: { next?: string }) {
  return (
    <div className={styles.wrap}>
      <div className={styles.divider} aria-hidden="true">
        <span className={styles.dividerLine} />
        <span className={styles.dividerText}>or</span>
        <span className={styles.dividerLine} />
      </div>
      <a
        className={styles.googleBtn}
        href={`${API}/v1/auth/google?next=${encodeURIComponent(next)}`}
      >
        <svg
          className={styles.gMark}
          viewBox="0 0 24 24"
          width="18"
          height="18"
          aria-hidden="true"
        >
          <path
            fill="#4285F4"
            d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.45a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.57-5.17 3.57-8.8z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3c-1.08.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.27v3.1A12 12 0 0 0 12 24z"
          />
          <path
            fill="#FBBC05"
            d="M5.28 14.29a7.21 7.21 0 0 1 0-4.58v-3.1H1.27a12 12 0 0 0 0 10.78l4.01-3.1z"
          />
          <path
            fill="#EA4335"
            d="M12 4.76c1.76 0 3.34.6 4.59 1.79l3.44-3.44A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.27 6.61l4.01 3.1C6.22 6.87 8.87 4.76 12 4.76z"
          />
        </svg>
        Continue with Google
      </a>
    </div>
  );
}
