"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Atmosphere from "../../../components/Atmosphere";
import { assetUrl, getCase, startCase } from "../../../lib/api";
import { difficultyLabel } from "../../../lib/format";
import { getPlayState, markBeingPlayed } from "../../../lib/playState";
import type { CaseDetail } from "../../../lib/types";
import styles from "./page.module.css";

const CASE_IMAGES: Record<string, string> = {
  "blackwood-inheritance": "/images/cases/blackwood-inheritance.jpg",
};

export default function CaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getCase(id);
        if (!cancelled) setDetail(data);
      } catch {
        if (!cancelled) setDetail(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!loading && !detail) {
      router.replace("/play");
    }
  }, [loading, detail, router]);

  if (loading || !detail) {
    return null;
  }

  const playState = getPlayState(id);
  const playStateStatus = playState?.status;

  async function handleStart() {
    setStarting(true);
    setError(null);

    // If already playing, continue the existing playthrough
    if (playStateStatus === "being_played" && playState?.playthroughId) {
      router.push(`/play/${playState.playthroughId}`);
      return;
    }

    // If completed, start a new playthrough (replay)
    try {
      const data = await startCase(id);
      markBeingPlayed(id, data.playthrough.id);
      sessionStorage.setItem(
        `mystery:opening:${data.playthrough.id}`,
        data.openingNarration ?? ""
      );
      router.push(`/play/${data.playthrough.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start");
      setStarting(false);
    }
  }

  const buttonLabel =
    playStateStatus === "being_played"
      ? "Continue"
      : playStateStatus === "completed"
        ? "Replay"
        : "Start";

  const difficultyClass =
    detail.meta.difficulty === "hard"
      ? styles.badgeHard
      : detail.meta.difficulty === "medium"
        ? styles.badgeMedium
        : styles.badgeEasy;

  return (
    <>
      <Atmosphere />
      <main className={styles.detail}>
        <div className={styles.inner}>
          <Link href="/play" className={styles.back}>
            ← Back to shelf
          </Link>

          <div className={styles.hero}>
            <img
              className={styles.heroImage}
              src={CASE_IMAGES[id] ?? "/images/cases/blackwood-inheritance.jpg"}
              alt=""
            />
            <div className={styles.heroOverlay} />
            <div className={styles.heroContent}>
              <p className={styles.eyebrow}>Mystery</p>
              <h1 className={styles.title}>{detail.meta.title}</h1>
              <div className={styles.metaRow}>
                <span className={`${styles.badge} ${difficultyClass}`}>
                  {difficultyLabel(detail.meta.difficulty)}
                </span>
                {detail.meta.tone ? (
                  <span className={`${styles.badge} ${styles.badgeNeutral}`}>
                    {detail.meta.tone}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className={styles.content}>
            <div className={styles.main}>
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Premise</h2>
                <p className={styles.premise}>{detail.meta.premise}</p>
              </section>

              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>About this case</h2>
                <p className={styles.description}>
                  You are a detective called to investigate. Question the
                  household, search the scene, and find the truth. The mystery
                  has a fixed solution — the AI performs the characters and
                  world, but the truth is already written.
                </p>
              </section>

            </div>

            <aside className={styles.sidebar}>
              <div className={styles.playCard}>
                <h2 className={styles.playTitle}>Start investigating</h2>
                <p className={styles.playMeta}>
                  Free mystery · Plays in your browser · No download
                </p>
                <button
                  type="button"
                  className={styles.btnPrimary}
                  onClick={handleStart}
                  disabled={starting}
                >
                  {starting ? "Starting…" : buttonLabel}
                </button>
                {error ? <p className={styles.playMeta}>{error}</p> : null}
              </div>

              <div className={styles.section}>
                <h2 className={styles.sectionTitle}>Tags</h2>
                <div className={styles.tags}>
                  {detail.meta.tags.map((t) => (
                    <span key={t} className={styles.tag}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </aside>
          </div>

          {detail.cast && detail.cast.length > 0 ? (
            <section className={styles.charactersSection}>
              <h2 className={styles.sectionTitle}>The people in this case</h2>
              <div className={styles.characters}>
                {detail.cast.map((c) => (
                  <div key={c.id} className={styles.characterCard}>
                    <div className={styles.characterPortrait}>
                      {c.portraitUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={assetUrl(c.portraitUrl)}
                          alt=""
                          width={96}
                          height={96}
                        />
                      ) : (
                        <span className={styles.characterInitial}>
                          {c.name.charAt(0)}
                        </span>
                      )}
                    </div>
                    <div className={styles.characterInfo}>
                      <div className={styles.characterName}>{c.name}</div>
                      {c.shortBio ? (
                        <div className={styles.characterBio}>{c.shortBio}</div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </main>
    </>
  );
}
