import Link from "next/link";
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
            <h2 className={styles.sectionTitle}>Just say what you mean</h2>
            <p>
              Each case is an authored mystery with a fixed solution, and you
              play the detective investigating it. There are no commands to
              learn, no menus, and no special syntax. Just type what you want to
              say or do in plain language, the way you’d tell a real partner, and
              the game responds with narration, dialogue, and changes to the
              world.
            </p>
            <p className={styles.example}>
              “Examine the broken vase.” · “Henshaw, what did you see tonight?” ·
              “Follow the footprint to the library.”
            </p>
            <p>
              Press <span className={styles.kbd}>Enter</span> to send, or{" "}
              <span className={styles.kbd}>Shift + Enter</span> for a new line.
              The <span className={styles.kbd}>♪</span> and{" "}
              <span className={styles.kbd}>◐</span> buttons in the top nav
              control ambience and theme.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>What you can do</h2>
            <p>
              You never need special words or commands. Describe what you want in
              your own words and the game understands. For example, you can:
            </p>
            <ul>
              <li>
                <strong>Question anyone.</strong> Talk to suspects and witnesses
                however you like. They remember what they told you.
              </li>
              <li>
                <strong>Examine the scene.</strong> Look at objects, clues, and
                locations to uncover evidence.
              </li>
              <li>
                <strong>Move around.</strong> Go to another room or area. Exits
                are described in the narration.
              </li>
              <li>
                <strong>Present evidence.</strong> Show what you’ve found to
                challenge someone’s story.
              </li>
              <li>
                <strong>Use what you carry.</strong> Try keys, tools, and other
                items on the right objects.
              </li>
              <li>
                <strong>Make an accusation.</strong> Name the culprit whenever
                you’re ready. You can accuse at any time, even without evidence.
              </li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Tips</h2>
            <ul>
              <li>
                The truth is already written. The AI doesn’t invent the killer;
                it performs the characters and the world.
              </li>
              <li>
                Evidence matters for pacing and endings, but a correct accusation
                can solve the mystery even without it.
              </li>
              <li>
                Wrong accusations have consequences. The house remembers.
              </li>
              <li>
                A mystery can be lost: by running out of time, pushing the wrong
                person, or letting the killer act.
              </li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Why turns take a moment</h2>
            <p>
              Turns take around 10–20 seconds. That&rsquo;s how long the AI
              takes to process a turn and return a response, and there&rsquo;s
              really nothing we can do about it — we use some of the fastest
              AIs in existence, but they still have limits.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Subscriptions &amp; tiers</h2>
            <p>
              One full mystery, The Blackwood Inheritance, is free to play for
              everyone with an account. A subscription opens more of the{" "}
              <Link href="/gallery" className={styles.link}>
                Gallery
              </Link>
              , and new mysteries are published often. Your tier automatically
              includes every new mystery that fits it, at no extra cost.
            </p>
            <ul>
              <li>
                <strong>Sleuth.</strong> Every Easy and Medium mystery in the
                Gallery.
              </li>
              <li>
                <strong>Master Detective.</strong> Every mystery, including the
                Difficult ones.
              </li>
              <li>
                <strong>Genius.</strong> An invitation-only tier of exclusive
                mysteries. It can’t be bought. You earn the invitation by solving
                3 Difficult mysteries.
              </li>
            </ul>
            <p>
              See all plans on the{" "}
              <Link href="/subscribe" className={styles.link}>
                Subscribe page
              </Link>
              , and view or manage your plan, including its renewal date, on your{" "}
              <Link href="/account" className={styles.link}>
                account page
              </Link>
              .
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>More questions?</h2>
            <p>
              Email us at{" "}
              <a href="mailto:help@mysterytrove.com" className={styles.link}>
                help@mysterytrove.com
              </a>{" "}
              and we’ll help you out.
            </p>
          </section>
        </div>
      </main>
    </>
  );
}
