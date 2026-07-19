import styles from "./page.module.css";

export default function SettingsPage() {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Settings</h1>
      <p className={styles.lead}>
        Account-wide preferences will live here later.
      </p>

      <section className={styles.section}>
        <h2 className={styles.heading}>Progress</h2>
        <p className={styles.help}>
          Use the gear icon in the play header to set progress cues (off,
          subtle, or full).
        </p>
      </section>
    </main>
  );
}
