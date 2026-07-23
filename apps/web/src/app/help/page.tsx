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
                are described in the narration. In mysteries with multiple
                locations, you can also open the map (the map button at the top
                of the game screen) and tap a location to travel there — as long
                as the way is open to you (not locked or otherwise blocked).
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
                <strong>Make an accusation.</strong> When you think you know the
                truth, bring a formal charge (see below). That is how you solve
                the case.
              </li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Making an accusation</h2>
            <p>
              Solving a mystery means making a <strong>formal accusation</strong>
              — naming who is responsible, and usually how and why. The case is
              scored against the authored solution, not against whether you
              collected every clue (though evidence still shapes the ending).
            </p>
            <h3 className={styles.subhead}>The Accuse button (recommended)</h3>
            <ol className={styles.steps}>
              <li>
                Tap <strong>Accuse</strong> next to the send button while the
                case is open.
              </li>
              <li>
                The game <strong>sets the scene</strong>: the household (or
                whoever should hear the charge) gathers. You are not filling
                out a form — you are about to speak into a real moment.
              </li>
              <li>
                In plain language, state your case:{" "}
                <em>who</em> did it, <em>how</em> it was done, and{" "}
                <em>why</em>. Example: “I accuse Margaret Ashmere. She shot him
                from the hall below the gallery because he was abusing her
                granddaughter and the police would not help.”
              </li>
              <li>
                Send as usual. If the charge is clear, the case is judged and
                the aftermath begins. If you only float a theory, the game may
                ask you to confirm before it counts.
              </li>
            </ol>
            <p>
              If you open Accuse by mistake, say you are not ready (for example,{" "}
              “never mind” or “not yet”) and the gathering dissolves with no
              judgment.
            </p>
            <h3 className={styles.subhead}>Without the button</h3>
            <p>
              You can still accuse in free text at any time, for example:{" "}
              “I accuse Henshaw of the murder.” Formal wording like that is
              treated as a real charge. Casual talk (“I think it might be Vale”)
              is usually just conversation until you commit.
            </p>
            <h3 className={styles.subhead}>What counts as solving</h3>
            <ul>
              <li>
                <strong>Who</strong> — name the culprit clearly.
              </li>
              <li>
                <strong>How and why</strong> — most cases also need enough of
                the method and motive for the charge to hold. Say them in your
                own words.
              </li>
              <li>
                You may accuse <strong>before</strong> you have every piece of
                evidence. A correct theory can still win; a wrong formal
                accusation can end the case.
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
                can solve the mystery even without every clue.
              </li>
              <li>
                Wrong formal accusations have consequences. Be sure before you
                commit.
              </li>
              <li>
                A mystery can be lost: by a wrong charge, running out of time,
                pushing the wrong person, or letting the killer act.
              </li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Why turns take a moment</h2>
            <p>
              Turns take around 10–20 seconds. That&rsquo;s how long the AI
              takes to process a turn and return a response, and the AIs
              can&rsquo;t go faster — we use some of the fastest AIs in
              existence, but they still have limits.
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
