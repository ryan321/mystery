"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Atmosphere from "../../components/Atmosphere";
import { coverSrc, listCases } from "../../lib/api";
import { getAllPlayStates, type PlayStateEntry } from "../../lib/playState";
import type { CaseSummary } from "../../lib/types";
import styles from "./page.module.css";

export default function MyMysteriesPage() {
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [playStates, setPlayStates] = useState<Record<string, PlayStateEntry>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await listCases();
        if (!cancelled) setCases(list);
      } catch {
        if (!cancelled) setCases([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setPlayStates(getAllPlayStates());
  }, []);

  const started = cases.filter((c) => playStates[c.id]?.status === "being_played");
  const completed = cases.filter((c) => playStates[c.id]?.status === "completed");

  return (
    <>
      <Atmosphere />
      <main className={styles.myMysteries}>
        <div className={styles.inner}>
          <header className={styles.header}>
            <p className={styles.eyebrow}>My mysteries</p>
            <h1 className={styles.title}>Your investigations</h1>
            <p className={styles.subtitle}>
              Resume a case in progress, or revisit one you’ve closed.
            </p>
          </header>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Started</h2>
            {loading ? (
              <p className={styles.subtitle}>Loading…</p>
            ) : started.length === 0 ? (
              <p className={styles.empty}>No mysteries in progress.</p>
            ) : (
              <div className={styles.mysteryList}>
                {started.map((c) => (
                  <Link
                    key={c.id}
                    href={`/play/${playStates[c.id]?.playthroughId ?? ""}`}
                    className={styles.mysteryItem}
                  >
                    <div className={styles.mysteryImage}>
                      <img src={coverSrc(c)} alt="" />
                    </div>
                    <div className={styles.mysteryInfo}>
                      <div className={styles.mysteryTitle}>{c.meta.title}</div>
                      <div className={styles.mysteryMeta}>{c.meta.premise}</div>
                    </div>
                    <span className={`${styles.status} ${styles.statusStarted}`}>
                      Started
                    </span>
                    <span className={styles.action}>Continue</span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Completed</h2>
            {loading ? (
              <p className={styles.subtitle}>Loading…</p>
            ) : completed.length === 0 ? (
              <p className={styles.empty}>No mysteries closed yet.</p>
            ) : (
              <div className={styles.mysteryList}>
                {completed.map((c) => (
                  <Link
                    key={c.id}
                    href={`/mystery/${c.id}`}
                    className={styles.mysteryItem}
                  >
                    <div className={styles.mysteryImage}>
                      <img src={coverSrc(c)} alt="" />
                    </div>
                    <div className={styles.mysteryInfo}>
                      <div className={styles.mysteryTitle}>{c.meta.title}</div>
                      <div className={styles.mysteryMeta}>{c.meta.premise}</div>
                    </div>
                    <span className={`${styles.status} ${styles.statusCompleted}`}>
                      Completed
                    </span>
                    <span className={styles.action}>Replay</span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </>
  );
}
