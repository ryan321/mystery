import Link from "next/link";
import Atmosphere from "../../components/Atmosphere";
import styles from "./page.module.css";

export default function SignUpPage() {
  return (
    <>
      <Atmosphere />
      <main className={styles.auth}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h1 className={styles.cardTitle}>Create account</h1>
          </div>
          <div className={styles.cardBody}>
            <form className={styles.cardBody}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="name">
                  Name
                </label>
                <input
                  id="name"
                  type="text"
                  className={styles.input}
                  placeholder="Your name"
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
                />
              </div>
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
