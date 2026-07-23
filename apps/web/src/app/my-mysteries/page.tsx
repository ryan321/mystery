"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Atmosphere from "../../components/Atmosphere";
import ConfirmModal from "../../components/ConfirmModal";
import { coverSrc, listCases, listMyPlaythroughs, startCase } from "../../lib/api";
import { getSession } from "../../lib/auth";
import {
  getAllPlayStates,
  markBeingPlayed,
  type PlayStateEntry,
  type PlayStatus,
} from "../../lib/playState";
import type { CaseSummary } from "../../lib/types";
import styles from "./page.module.css";

/** Engine status → shelf status: open runs resume, closed runs replay. */
function shelfStatus(engineStatus: string): PlayStatus {
  return engineStatus === "solved" || engineStatus === "failed"
    ? "completed"
    : "being_played";
}

export default function MyMysteriesPage() {
  const router = useRouter();
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [playStates, setPlayStates] = useState<Record<string, PlayStateEntry>>({});
  /** Case id armed for restart (drives the confirm modal). */
  const [restartId, setRestartId] = useState<string | null>(null);
  const [restarting, setRestarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    let cancelled = false;
    (async () => {
      // Server history is the cross-device source of truth; localStorage
      // only knows this browser. Server wins on conflicts, local fills
      // gaps (offline, or a pre-sign-in run that wasn't adopted).
      const merged = getAllPlayStates();
      try {
        const server = await listMyPlaythroughs();
        for (const p of server) {
          // Runs left behind by a restart are history, not shelf items.
          if (p.status === "abandoned") continue;
          const status = shelfStatus(p.status);
          const existing = merged[p.caseId];
          // An open run outranks a closed one for the same mystery;
          // between equals, the more recently touched wins.
          if (
            !existing ||
            (status === "being_played" && existing.status === "completed") ||
            (status === existing.status && p.updatedAt > existing.updatedAt)
          ) {
            merged[p.caseId] = {
              playthroughId: p.id,
              caseId: p.caseId,
              status,
              updatedAt: p.updatedAt,
            };
          }
        }
      } catch {
        /* API unreachable — the local shelf still renders */
      }
      if (!cancelled) setPlayStates(merged);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const started = cases.filter((c) => playStates[c.id]?.status === "being_played");
  const completed = cases.filter((c) => playStates[c.id]?.status === "completed");
  const restartCase = restartId
    ? cases.find((c) => c.id === restartId)
    : undefined;
  const restartInProgress =
    restartId && playStates[restartId]?.status === "being_played";

  async function handleRestart() {
    if (!restartId) return;
    if (!getSession()) {
      router.push(`/signup?next=${encodeURIComponent("/my-mysteries")}`);
      return;
    }
    setRestarting(true);
    setError(null);
    try {
      const data = await startCase(restartId, true);
      markBeingPlayed(restartId, data.playthrough.id);
      router.push(`/play/${data.playthrough.id}`);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to restart";
      if (message === "signin_required") {
        router.push(`/signup?next=${encodeURIComponent("/my-mysteries")}`);
        return;
      }
      setError(message);
      setRestarting(false);
      setRestartId(null);
    }
  }

  function renderItem(c: CaseSummary, status: PlayStatus) {
    const started = status === "being_played";
    const href = started
      ? `/play/${playStates[c.id]?.playthroughId ?? ""}`
      : `/mystery/${c.id}`;
    return (
      <div key={c.id} className={styles.mysteryItem}>
        <Link href={href} className={styles.mysteryMain}>
          <div className={styles.mysteryImage}>
            <img src={coverSrc(c)} alt="" />
          </div>
          <div className={styles.mysteryInfo}>
            <div className={styles.mysteryTitle}>{c.meta.title}</div>
            <div className={styles.mysteryMeta}>{c.meta.premise}</div>
            <span
              className={`${styles.status} ${
                started ? styles.statusStarted : styles.statusCompleted
              }`}
            >
              {started ? "Started" : "Completed"}
            </span>
          </div>
        </Link>
        <div className={styles.mysteryActions}>
          <Link href={href} className={styles.action}>
            {started ? "Continue" : "Replay"}
          </Link>
          <button
            type="button"
            className={styles.restart}
            onClick={() => setRestartId(c.id)}
          >
            Restart
          </button>
        </div>
      </div>
    );
  }

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

          {error ? <p className={styles.errorNote}>{error}</p> : null}

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Started</h2>
            {loading ? (
              <p className={styles.subtitle}>Loading…</p>
            ) : started.length === 0 ? (
              <p className={styles.empty}>No mysteries in progress.</p>
            ) : (
              <div className={styles.mysteryList}>
                {started.map((c) => renderItem(c, "being_played"))}
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
                {completed.map((c) => renderItem(c, "completed"))}
              </div>
            )}
          </section>
        </div>
      </main>

      <ConfirmModal
        open={restartId !== null}
        title="Start over?"
        message={
          restartInProgress
            ? `Your current investigation of “${restartCase?.meta.title ?? "this mystery"}” will be left behind and can’t be continued from where you were.`
            : `This begins a completely new investigation of “${restartCase?.meta.title ?? "this mystery"}”.`
        }
        confirmLabel="Yes, start over"
        cancelLabel="Cancel"
        busy={restarting}
        destructive
        onConfirm={handleRestart}
        onCancel={() => setRestartId(null)}
      />
    </>
  );
}
