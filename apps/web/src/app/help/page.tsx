import Atmosphere from "../../components/Atmosphere";
import BackLink from "../../components/BackLink";
import styles from "./page.module.css";

export default function HelpPage() {
  return (
    <>
      <Atmosphere />
      <main className={styles.help}>
        <div className={styles.inner}>
          <BackLink />
          <header className={styles.header}>
            <p className={styles.eyebrow}>Help</p>
            <h1 className={styles.title}>How to play</h1>
            <p className={styles.subtitle}>
              Everything you need to investigate a mystery.
            </p>
          </header>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>The basics</h2>
            <p>
              Each case is an authored mystery with a fixed solution. You play
              a detective investigating the scene. Type what you want to say or
              do in plain language — the game responds with narration, dialogue,
              and changes to the world.
            </p>
            <p className={styles.example}>
              “Examine the broken vase.” · “Henshaw. What did you see tonight?” ·
              “Follow the footprint to the library.”
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>What you can do</h2>
            <ul>
              <li>
                <strong>Talk</strong> — Question suspects and witnesses in your
                own words. They remember what they told you.
              </li>
              <li>
                <strong>Inspect</strong> — Examine objects, clues, and locations
                to uncover evidence.
              </li>
              <li>
                <strong>Move</strong> — Go to another room or area. Exits are
                described in the narration.
              </li>
              <li>
                <strong>Present</strong> — Show evidence to someone to challenge
                their story.
              </li>
              <li>
                <strong>Use</strong> — Use items you’ve found (keys, tools) on
                the right objects.
              </li>
              <li>
                <strong>Accuse</strong> — Name the culprit when you think you
                have it. You can accuse at any time, even without evidence.
              </li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Tips</h2>
            <ul>
              <li>
                The truth is already written. The AI doesn’t invent the killer —
                it performs the characters and world.
              </li>
              <li>
                Evidence matters for pacing and endings, but a correct accusation
                can solve the mystery even without it.
              </li>
              <li>
                Wrong accusations have consequences. The house remembers.
              </li>
              <li>
                Some mysteries can be lost — by running out of time, pushing the
                wrong person, or letting the killer act.
              </li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Controls</h2>
            <p>
              <span className={styles.kbd}>Enter</span> to send ·{" "}
              <span className={styles.kbd}>Shift + Enter</span> for a new line.
            </p>
            <p>
              Use the <span className={styles.kbd}>♪</span> button in the top nav
              for ambience controls, and <span className={styles.kbd}>◐</span>{" "}
              for theme.
            </p>
          </section>
        </div>
      </main>
    </>
  );
}
