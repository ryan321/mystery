"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Atmosphere from "../components/Atmosphere";
import { coverSrc, listCases } from "../lib/api";
import { difficultyLabel } from "../lib/format";
import type { CaseSummary } from "../lib/types";
import styles from "./page.module.css";

const FREE_CASE_ID = "blackwood-inheritance";

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

  const featured = cases.slice(0, 3);

  return (
    <>
      <Atmosphere />
      <main className={styles.landing}>
        {/* ── Hero: the logo over the manor in the rain ─────────────── */}
        <section className={styles.hero}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className={styles.logo}
            src="/brand/logo.png"
            alt="MysteryTrove"
          />
          <p className={styles.tagline}>
            Handcrafted whodunits with real, sealed solutions. Question a
            living cast, search the scene, and accuse when you are ready.
          </p>
          <div className={styles.ctaRow}>
            <Link href={`/mystery/${FREE_CASE_ID}`} className={styles.ctaPrimary}>
              Solve your first mystery free
            </Link>
            <Link href="/gallery" className={styles.ctaGhost}>
              Explore the gallery
            </Link>
          </div>
          <p className={styles.heroNote}>
            Plays in your browser. No download.
          </p>
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

          {/* ── Closing call to action ───────────────────────────────── */}
          <section className={`${styles.section} ${styles.closing}`}>
            <h2 className={styles.closingTitle}>Can you solve a mystery?</h2>
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
              MysteryTrove · mysteries you step inside and solve
            </p>
          </footer>
        </div>
      </main>
    </>
  );
}
