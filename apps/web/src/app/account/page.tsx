import Atmosphere from "../../components/Atmosphere";
import styles from "./page.module.css";

export default function AccountPage() {
  return (
    <>
      <Atmosphere />
      <main className={styles.account}>
        <div className={styles.inner}>
          <header className={styles.header}>
            <p className={styles.eyebrow}>Account</p>
            <h1 className={styles.title}>Your investigations</h1>
          </header>

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Profile</h2>
            </div>
            <div className={styles.sectionBody}>
              <div className={styles.profile}>
                <div className={styles.avatar}>I</div>
                <div className={styles.profileInfo}>
                  <div className={styles.name}>Inspector</div>
                  <div className={styles.email}>inspector@mystery.local</div>
                </div>
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>In progress</h2>
            </div>
            <div className={styles.sectionBody}>
              <div className={styles.mysteryList}>
                <div className={styles.mysteryItem}>
                  <div>
                    <div className={styles.mysteryTitle}>
                      The Blackwood Inheritance
                    </div>
                    <div className={styles.mysteryMeta}>
                      Blackwood Manor — the entrance hall · 2 turns
                    </div>
                  </div>
                  <span className={`${styles.status} ${styles.statusActive}`}>
                    Active
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Completed</h2>
            </div>
            <div className={styles.sectionBody}>
              <p className={styles.empty}>No mysteries closed yet.</p>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
