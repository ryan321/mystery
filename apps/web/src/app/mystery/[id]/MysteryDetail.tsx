"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Atmosphere from "../../../components/Atmosphere";
import { assetUrl, coverSrc, getCase, startCase } from "../../../lib/api";
import { getSession } from "../../../lib/auth";
import { difficultyLabel, themeTags } from "../../../lib/format";
import { getPlayState, markBeingPlayed } from "../../../lib/playState";
import type { CaseDetail } from "../../../lib/types";
import styles from "./page.module.css";

function beginPlaythrough(
  id: string,
  data: Awaited<ReturnType<typeof startCase>>
) {
  markBeingPlayed(id, data.playthrough.id);
  sessionStorage.setItem(
    `mystery:opening:${data.playthrough.id}`,
    data.openingNarration ?? ""
  );
  if (data.briefing) {
    sessionStorage.setItem(
      `mystery:briefing:${data.playthrough.id}`,
      JSON.stringify(data.briefing)
    );
  }
}

/** Only The Blackwood Inheritance is free for now. */
const FREE_CASE_IDS = new Set(["blackwood-inheritance"]);

export default function MysteryDetail() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Bump after local play-state changes so Continue/Restart stay in sync. */
  const [playTick, setPlayTick] = useState(0);

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
      router.replace("/gallery");
    }
  }, [loading, detail, router]);

  const playState = useMemo(() => getPlayState(id), [id, playTick]);
  const playStateStatus = playState?.status;
  const hasProgress =
    playStateStatus === "being_played" || playStateStatus === "completed";
  const busy = starting || restarting;

  /** Playing needs an account (browsing doesn't) — funnel to sign-up. */
  function requireAccount(): boolean {
    if (getSession()) return false;
    router.push(`/signup?next=${encodeURIComponent(`/mystery/${id}`)}`);
    return true;
  }

  function handleStartError(e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to start";
    if (message === "signin_required") {
      router.push(`/signup?next=${encodeURIComponent(`/mystery/${id}`)}`);
      return;
    }
    setError(message);
  }

  async function handleStart() {
    setError(null);

    // If already playing, continue the existing playthrough
    if (playStateStatus === "being_played" && playState?.playthroughId) {
      router.push(`/play/${playState.playthroughId}`);
      return;
    }
    if (requireAccount()) return;
    setStarting(true);

    // Fresh start or play-again after completion
    try {
      const data = await startCase(id);
      beginPlaythrough(id, data);
      setPlayTick((n) => n + 1);
      router.push(`/play/${data.playthrough.id}`);
    } catch (e) {
      handleStartError(e);
      setStarting(false);
    }
  }

  async function handleRestart() {
    const inProgress = playStateStatus === "being_played";
    const message = inProgress
      ? "Start this mystery from the beginning? Your current investigation will be left behind and cannot be continued from where you were."
      : "Start a completely new investigation of this mystery?";
    if (!window.confirm(message)) return;
    if (requireAccount()) return;

    setRestarting(true);
    setError(null);
    try {
      const data = await startCase(id);
      beginPlaythrough(id, data);
      setPlayTick((n) => n + 1);
      router.push(`/play/${data.playthrough.id}`);
    } catch (e) {
      handleStartError(e);
      setRestarting(false);
    }
  }

  const buttonLabel =
    playStateStatus === "being_played"
      ? "Continue"
      : playStateStatus === "completed"
        ? "Play again"
        : "Start";

  if (loading || !detail) {
    return null;
  }

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
          <Link href="/gallery" className={styles.back}>
            ← Back to the gallery
          </Link>

          <div className={styles.hero}>
            <img className={styles.heroImage} src={coverSrc(detail)} alt="" />
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
                <h2 className={styles.sectionTitle}>The story</h2>
                <p className={styles.premise}>{detail.meta.premise}</p>
                {detail.meta.summary ? (
                  <p className={styles.description} style={{ marginTop: "0.85rem" }}>
                    {detail.meta.summary}
                  </p>
                ) : null}
              </section>

              {detail.meta.setting ? (
                <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>Setting</h2>
                  <p className={styles.description}>{detail.meta.setting}</p>
                </section>
              ) : null}

              {detail.meta.theMystery ? (
                <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>The mystery</h2>
                  <p className={styles.premise}>{detail.meta.theMystery}</p>
                </section>
              ) : null}

              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>You play as</h2>
                <p className={styles.playerName}>
                  {detail.player?.displayName ?? "Investigator"}
                </p>
                {detail.player?.role ? (
                  <p className={styles.playerRole}>{detail.player.role}</p>
                ) : null}
                {(detail.player?.age ||
                  detail.player?.appearance ||
                  detail.player?.objective) && (
                  <p className={styles.playerMeta}>
                    {[
                      detail.player.age,
                      detail.player.appearance,
                      detail.player.objective,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
              </section>
            </div>

            <aside className={styles.sidebar}>
              <div className={styles.playCard}>
                <h2 className={styles.playTitle}>Start investigating</h2>
                <p className={styles.playMeta}>
                  {FREE_CASE_IDS.has(detail.id)
                    ? "Free mystery · Plays in your browser · No download"
                    : "Plays in your browser · No download"}
                </p>
                {playStateStatus === "being_played" ? (
                  <p className={styles.restartHint}>
                    Investigation in progress.
                  </p>
                ) : playStateStatus === "completed" ? (
                  <p className={styles.restartHint}>
                    You’ve finished this mystery once.
                  </p>
                ) : null}
                <button
                  type="button"
                  className={styles.btnPrimary}
                  onClick={handleStart}
                  disabled={busy}
                >
                  {starting
                    ? playStateStatus === "being_played"
                      ? "Opening…"
                      : "Starting…"
                    : buttonLabel}
                </button>
                {hasProgress ? (
                  <>
                    <button
                      type="button"
                      className={styles.btnGhost}
                      onClick={handleRestart}
                      disabled={busy}
                    >
                      {restarting ? "Restarting…" : "Restart"}
                    </button>
                    <p className={styles.restartHint}>
                      Fresh start from the opening — progress on the current
                      run is not carried over.
                    </p>
                  </>
                ) : null}
                {error ? <p className={styles.playMeta}>{error}</p> : null}
              </div>

              <div className={styles.section}>
                <h2 className={styles.sectionTitle}>Themes</h2>
                <div className={styles.tags}>
                  {themeTags(detail.meta.tags).map((t) => (
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
              <h2 className={styles.sectionTitle}>The characters in this mystery</h2>
              <div className={styles.characters}>
                {[...detail.cast]
                  .sort((a, b) => {
                    const rank = (r?: string) =>
                      r === "victim" ? 0 : r === "suspect" ? 1 : 2;
                    return rank(a.storyRole) - rank(b.storyRole);
                  })
                  .map((c) => (
                    <div key={c.id} className={styles.characterCard}>
                      <div className={styles.characterPortrait}>
                        {c.portraitUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={assetUrl(c.portraitUrl)}
                            alt=""
                            width={140}
                            height={140}
                          />
                        ) : (
                          <span className={styles.characterInitial}>
                            {c.name.charAt(0)}
                          </span>
                        )}
                      </div>
                      <div className={styles.characterInfo}>
                        <div className={styles.characterName}>{c.name}</div>
                        {c.storyRole === "victim" ? (
                          <span className={styles.roleBadge}>Victim</span>
                        ) : c.storyRole === "witness" ? (
                          <span className={styles.roleBadgeMuted}>Witness</span>
                        ) : null}
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
