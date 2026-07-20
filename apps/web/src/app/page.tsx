"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Atmosphere from "../components/Atmosphere";
import { coverSrc, listCases } from "../lib/api";
import { difficultyLabel } from "../lib/format";
import type { CaseSummary } from "../lib/types";
import styles from "./page.module.css";

const FREE_CASE_ID = "blackwood-inheritance";
const FEATURED_COUNT = 6;

function Ornament() {
  return (
    <div className={styles.ornament} aria-hidden="true">
      <span className={styles.ornamentLine} />
      <span className={styles.ornamentMark}>◆</span>
      <span className={styles.ornamentLine} />
    </div>
  );
}

export default function LandingPage() {
  const [cases, setCases] = useState<CaseSummary[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await listCases();
        if (!cancelled) setCases(list);
      } catch {
        // The landing page still sells the product without the API.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const featured = cases.slice(0, FEATURED_COUNT);

  return (
    <>
      {/* The manor fills the scene again; rain and thunder over everything. */}
      <Atmosphere />
      <main className={styles.landing}>
        {/* ── Hero: the logo in the stormy sky, house full-bleed ────── */}
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className={styles.logo}
              src="/brand/logo.png"
              alt="MysteryTrove"
            />
            <p className={styles.heroEyebrow}>Interactive whodunits</p>
            <h1 className={styles.heroTitle}>Can you solve a murder?</h1>
            <p className={styles.tagline}>
              Handcrafted whodunits with real, sealed solutions. Question a
              living cast, search the scene, and accuse when you are ready.
            </p>
            <div className={styles.ctaRow}>
              <Link
                href={`/mystery/${FREE_CASE_ID}`}
                className={styles.ctaPrimary}
              >
                Solve your first mystery free
              </Link>
              <a href="#sample" className={styles.ctaGhost}>
                Watch a case unfold
              </a>
            </div>
            <p className={styles.heroNote}>
              Plays in your browser · No download · First case free
            </p>
          </div>
        </section>

        <div className={styles.inner}>
          {/* ── How a case works ─────────────────────────────────────── */}
          <section className={styles.section}>
            <p className={styles.eyebrow}>How a case works</p>
            <h2 className={styles.sectionTitle}>You are the detective</h2>
            <Ornament />
            <div className={styles.steps}>
              <div className={styles.step}>
                <span className={styles.stepNumber}>I</span>
                <h3 className={styles.stepTitle}>Take the case</h3>
                <p className={styles.stepText}>
                  Every mystery opens with your role, a dossier, and a place
                  in the story. You are not reading about a detective: you
                  are the one they sent for.
                </p>
              </div>
              <div className={styles.step}>
                <span className={styles.stepNumber}>II</span>
                <h3 className={styles.stepTitle}>Work the scene</h3>
                <p className={styles.stepText}>
                  Interrogate suspects who remember, deflect, and slip.
                  Search the rooms, gather evidence, and fill in the map as
                  the night unfolds.
                </p>
              </div>
              <div className={styles.step}>
                <span className={styles.stepNumber}>III</span>
                <h3 className={styles.stepTitle}>Accuse when ready</h3>
                <p className={styles.stepText}>
                  Name the culprit, the method, and the motive. The solution
                  was sealed before you began: either you cracked it, or you
                  did not.
                </p>
              </div>
            </div>
          </section>

          {/* ── Sample play ──────────────────────────────────────────── */}
          <section id="sample" className={styles.section}>
            <p className={styles.eyebrow}>Sample play</p>
            <h2 className={styles.sectionTitle}>A few moments in a case</h2>
            <Ornament />
            <p className={styles.sectionLede}>
              Every mystery works like this: type what you would say or do in
              plain language, and the case answers — whether you inspect a
              clue, follow a lead, or press a suspect.
            </p>

            <div className={styles.demo}>
              <div className={styles.terminal}>
                <header className={styles.terminalChrome}>
                  <span className={styles.caseBadge}>
                    <span className={styles.caseDot} aria-hidden="true" />
                    The Blackwood Inheritance
                  </span>
                  <span className={styles.chromeGlyphs} aria-hidden="true">
                    ▣&nbsp;&nbsp;⌖&nbsp;&nbsp;✎
                  </span>
                </header>
                <div className={styles.demoBody}>
                  <p className={styles.statusLine}>
                    <span className={styles.statusLabel}>Location</span>
                    Blackwood Manor — the entrance hall
                  </p>
                  <p className={styles.sysLine}>
                    The manor looms against the storm. A crystal vase lies
                    shattered on the marble. Rainwater pools near the east
                    door, and the grandfather clock has stopped at eleven.
                  </p>
                  <div className={`${styles.msg} ${styles.msgYou}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className={styles.avatar}
                      src="/images/avatar-player.png"
                      alt=""
                    />
                    <div className={styles.bubble}>
                      <span className={styles.bubbleLabel}>You</span>
                      Examine the broken vase and the floor around it.
                    </div>
                  </div>
                  <p className={styles.sysLine}>
                    The pieces scatter outward, as if struck from above. Among
                    the shards, a single black thread. Near the east door, a
                    wet boot-print points toward the library — a man&apos;s
                    boot, not the polished shoes the staff wear.
                  </p>
                  <p className={styles.itemLine}>
                    <span aria-hidden="true">✦</span> Black thread and a muddy
                    boot-print added to your evidence.
                  </p>
                  <div className={`${styles.msg} ${styles.msgYou}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className={styles.avatar}
                      src="/images/avatar-player.png"
                      alt=""
                    />
                    <div className={styles.bubble}>
                      <span className={styles.bubbleLabel}>You</span>
                      “Henshaw. What did you see tonight?”
                    </div>
                  </div>
                  <div className={`${styles.msg} ${styles.msgNpc}`}>
                    <span className={styles.avatarInitial} aria-hidden="true">
                      B
                    </span>
                    <div className={styles.bubble}>
                      <span className={styles.bubbleLabel}>Butler Henshaw</span>
                      “I heard the crash just after the clock struck eleven,
                      sir. When I arrived, the east door stood open and Mr.
                      Blackwood was at the top of the stairs.”
                    </div>
                  </div>
                  <div className={`${styles.msg} ${styles.msgYou}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className={styles.avatar}
                      src="/images/avatar-player.png"
                      alt=""
                    />
                    <div className={styles.bubble}>
                      <span className={styles.bubbleLabel}>You</span>
                      Follow the footprint to the library.
                    </div>
                  </div>
                  <p className={styles.statusLine}>
                    <span className={styles.statusLabel}>Location</span>
                    Blackwood Manor — the library
                  </p>
                  <p className={styles.sysLine}>
                    A fire smolders in the hearth. On the desk, a ledger lies
                    open to tonight&apos;s date. A brass key glints in the ash.
                  </p>
                  <div className={`${styles.msg} ${styles.msgYou}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className={styles.avatar}
                      src="/images/avatar-player.png"
                      alt=""
                    />
                    <div className={styles.bubble}>
                      <span className={styles.bubbleLabel}>You</span>
                      Take the brass key and try it on the desk drawer.
                    </div>
                  </div>
                  <p className={styles.sysLine}>
                    The key turns with a dry click. Inside: a letter signed by
                    Mr. Vale, dated yesterday. “If you expose me, I will have
                    no choice.”
                  </p>
                  <p className={styles.itemLine}>
                    <span aria-hidden="true">✦</span> Vale&apos;s letter added
                    to your evidence.
                  </p>
                  <div className={`${styles.msg} ${styles.msgNpc}`}>
                    <span className={styles.avatarInitial} aria-hidden="true">
                      V
                    </span>
                    <div className={styles.bubble}>
                      <span className={styles.bubbleLabel}>Mr. Vale</span>
                      He turns from the window. “Nothing. A business
                      disagreement. I was in the conservatory all evening.”
                    </div>
                  </div>
                  <p className={styles.sysLine}>
                    The conservatory is on the west side — far from the east
                    door, the broken vase, and the footprint that points away
                    from it.
                  </p>
                  <p className={styles.composerLine}>
                    <span className={styles.composerPrompt}>&gt;</span>
                    Ask Mrs. Blackwood where she was at eleven…
                    <span className={styles.cursor} aria-hidden="true" />
                  </p>
                </div>
              </div>
              <p className={styles.demoCaption}>
                You write in plain language. The mystery answers.
              </p>
            </div>
          </section>

          {/* ── The detective's toolkit ──────────────────────────────── */}
          <section className={styles.section}>
            <p className={styles.eyebrow}>The detective&apos;s toolkit</p>
            <h2 className={styles.sectionTitle}>
              Everything you notice, kept close
            </h2>
            <Ornament />
            <div className={styles.toolkit}>
              <div className={styles.tool}>
                <span className={styles.toolGlyph} aria-hidden="true">
                  ▣
                </span>
                <h3 className={styles.toolTitle}>The dossier</h3>
                <p className={styles.toolText}>
                  Every case opens with what your detective already knows —
                  who you are, why you were called, and who is who. Reread it
                  any time.
                </p>
              </div>
              <div className={styles.tool}>
                <span className={styles.toolGlyph} aria-hidden="true">
                  ⌖
                </span>
                <h3 className={styles.toolTitle}>The sketch map</h3>
                <p className={styles.toolText}>
                  Your own floor plan, drawn as you go. Rooms you have only
                  heard of stay faint pencil until you see them yourself.
                </p>
              </div>
              <div className={styles.tool}>
                <span className={styles.toolGlyph} aria-hidden="true">
                  ◉
                </span>
                <h3 className={styles.toolTitle}>The cast</h3>
                <p className={styles.toolText}>
                  Portraits and front matter on everyone you meet — and a face
                  for whoever is in the room with you right now.
                </p>
              </div>
              <div className={styles.tool}>
                <span className={styles.toolGlyph} aria-hidden="true">
                  ✎
                </span>
                <h3 className={styles.toolTitle}>Evidence &amp; notebook</h3>
                <p className={styles.toolText}>
                  What you carry, and a private scratchpad the game never
                  reads. Theorize freely — your suspicions stay yours.
                </p>
              </div>
            </div>
          </section>

          {/* ── Why MysteryTrove ─────────────────────────────────────── */}
          <section className={styles.section}>
            <p className={styles.eyebrow}>Why MysteryTrove</p>
            <h2 className={styles.sectionTitle}>A trove of real mysteries</h2>
            <Ornament />
            <div className={styles.features}>
              <div className={styles.feature}>
                <h3 className={styles.featureTitle}>Sealed solutions</h3>
                <p className={styles.featureText}>
                  Every case is authored by hand with one fixed truth. The AI
                  performs the world; it never invents the ending. Fair play,
                  always.
                </p>
              </div>
              <div className={styles.feature}>
                <h3 className={styles.featureTitle}>A cast that talks back</h3>
                <p className={styles.featureText}>
                  Ask anything, in your own words. Suspects hold grudges,
                  keep secrets, and crack under the right pressure.
                </p>
              </div>
              <div className={styles.feature}>
                <h3 className={styles.featureTitle}>No two nights alike</h3>
                <p className={styles.featureText}>
                  The story reacts to you. Scenes, conversations, and trouble
                  unfold differently every time you play.
                </p>
              </div>
              <div className={styles.feature}>
                <h3 className={styles.featureTitle}>A detective&apos;s toolkit</h3>
                <p className={styles.featureText}>
                  Case dossier, fog-of-war map, evidence in hand, and a
                  private notebook. Everything you notice, kept close.
                </p>
              </div>
            </div>
          </section>

          {/* ── Featured mysteries ───────────────────────────────────── */}
          {featured.length > 0 && (
            <section className={styles.section}>
              <p className={styles.eyebrow}>From the trove</p>
              <h2 className={styles.sectionTitle}>
                Gothic manors, gaslit streets, dead space stations
              </h2>
              <Ornament />
              <div className={styles.featuredGrid}>
                {featured.map((c) => (
                  <Link
                    key={c.id}
                    href={`/mystery/${c.id}`}
                    className={styles.featuredCard}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className={styles.featuredCover}
                      src={coverSrc(c)}
                      alt=""
                    />
                    <div className={styles.featuredBody}>
                      <h3 className={styles.featuredTitle}>{c.meta.title}</h3>
                      <p className={styles.featuredMeta}>
                        {difficultyLabel(c.meta.difficulty)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
              <p className={styles.featuredNote}>
                New mysteries join the trove regularly.{" "}
                <Link href="/gallery" className={styles.inlineLink}>
                  See the full gallery
                </Link>
              </p>
            </section>
          )}

          {/* ── Questions ────────────────────────────────────────────── */}
          <section className={styles.section}>
            <p className={styles.eyebrow}>Questions</p>
            <h2 className={styles.sectionTitle}>Fair to ask</h2>
            <Ornament />
            <div className={styles.faq}>
              <details className={styles.faqItem}>
                <summary className={styles.faqQuestion}>
                  Is the AI making the mystery up as it goes?
                </summary>
                <p className={styles.faqAnswer}>
                  No. Every case is written by hand with one sealed solution
                  before you ever play. The AI performs the world and its
                  characters — it never changes the truth, never invents the
                  ending, and never lets a secret slip early.
                </p>
              </details>
              <details className={styles.faqItem}>
                <summary className={styles.faqQuestion}>
                  Do I need to download or install anything?
                </summary>
                <p className={styles.faqAnswer}>
                  Nothing at all. Every case plays right in your browser, and
                  your investigation is saved as you go.
                </p>
              </details>
              <details className={styles.faqItem}>
                <summary className={styles.faqQuestion}>
                  Can I play on my phone?
                </summary>
                <p className={styles.faqAnswer}>
                  Yes. The whole investigation — questioning, searching, the
                  map, your notes — works on any screen.
                </p>
              </details>
              <details className={styles.faqItem}>
                <summary className={styles.faqQuestion}>
                  Do I need an account?
                </summary>
                <p className={styles.faqAnswer}>
                  Not to start — the first case is free and opens straight
                  away. Sign in when you want your shelf and progress to
                  follow you across devices.
                </p>
              </details>
              <details className={styles.faqItem}>
                <summary className={styles.faqQuestion}>
                  What does it cost?
                </summary>
                <p className={styles.faqAnswer}>
                  Your first case is free, start to finish. A membership
                  unlocks the full gallery, harder cases, and invitation-only
                  investigations.
                </p>
              </details>
            </div>
          </section>

          {/* ── Closing call to action ───────────────────────────────── */}
          <section className={`${styles.section} ${styles.closing}`}>
            <h2 className={styles.closingTitle}>Can you solve a murder?</h2>
            <p className={styles.closingText}>
              Your first case is free. Memberships unlock the full gallery,
              harder cases, and invitation-only investigations.
            </p>
            <div className={styles.ctaRow}>
              <Link href={`/mystery/${FREE_CASE_ID}`} className={styles.ctaPrimary}>
                Start the free case
              </Link>
              <Link href="/gallery" className={styles.ctaGhost}>
                Browse the gallery
              </Link>
            </div>
          </section>

          <footer className={styles.footer}>
            <Ornament />
            <p className={styles.footerLine}>
              MysteryTrove.com · mysteries you step inside and solve
            </p>
          </footer>
        </div>
      </main>
    </>
  );
}
