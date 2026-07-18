"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Atmosphere from "../../components/Atmosphere";
import { listCases, startCase } from "../../lib/api";
import { difficultyClass, difficultyLabel } from "../../lib/format";
import type { CaseSummary } from "../../lib/types";
import styles from "./page.module.css";

const CASE_IMAGES: Record<string, string> = {
  "blackwood-inheritance": "/images/cases/blackwood-inheritance.jpg",
};

export default function PlayLobbyPage() {
  const router = useRouter();
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await listCases();
        if (!cancelled) setCases(list);
      } catch {
        if (!cancelled) {
          setCases([
            {
              id: "blackwood-inheritance",
              contentVersion: "0.8.0",
              meta: {
                title: "The Blackwood Inheritance",
                premise:
                  "A stormy night, a locked manor, and a body at the foot of the stairs. The family was already at each other’s throats.",
                tone: "gothic manor whodunit, tense and formal",
                estimatedMinutes: 40,
                tags: ["Manor", "Family", "Storm", "Classic"],
                difficulty: "easy",
                contentWarnings: ["murder", "violence"],
              },
            },
          ]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleStart(caseId: string) {
    setStarting(caseId);
    setError(null);
    try {
      const data = await startCase(caseId);
      sessionStorage.setItem(
        `mystery:opening:${data.playthrough.id}`,
        data.openingNarration ?? ""
      );
      router.push(`/play/${data.playthrough.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start");
      setStarting(null);
    }
  }

  return (
    <>
      <Atmosphere />
      <main className={styles.lobby}>
        <div className={styles.lobbyInner}>
          <header className={styles.header}>
            <p className={styles.eyebrow}>The case files</p>
            <h1 className={styles.title}>Choose your investigation</h1>
            <p className={styles.subtitle}>
              Each case is an authored mystery with a fixed solution. Question
              suspects, explore the scene, and find the truth.
            </p>
          </header>

          {loading ? (
            <p className={styles.subtitle}>Loading cases…</p>
          ) : (
            <div className={styles.caseGrid}>
              {cases.map((c) => (
                <article key={c.id} className={styles.caseCard}>
                  <div className={styles.caseImage}>
                    <img
                      src={CASE_IMAGES[c.id] ?? "/images/cases/blackwood-inheritance.jpg"}
                      alt=""
                    />
                  </div>
                  <div className={styles.caseBody}>
                    <div className={styles.caseTitleRow}>
                      <h2 className={styles.caseTitle}>{c.meta.title}</h2>
                      <span
                        className={`${styles.difficulty} ${difficultyClass(c.meta.difficulty)}`}
                      >
                        {difficultyLabel(c.meta.difficulty)}
                      </span>
                    </div>
                    <p className={styles.premise}>{c.meta.premise}</p>
                    <div className={styles.meta}>
                      {c.meta.tags.map((t) => (
                        <span key={t} className={styles.tag}>
                          {t}
                        </span>
                      ))}
                      {c.meta.estimatedMinutes ? (
                        <span className={styles.tag}>
                          ~{c.meta.estimatedMinutes} min
                        </span>
                      ) : null}
                    </div>
                    <div className={styles.actions}>
                      <button
                        type="button"
                        className={styles.btnPrimary}
                        onClick={() => handleStart(c.id)}
                        disabled={starting !== null}
                      >
                        {starting === c.id ? "Starting…" : "Play free case"}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          {error ? <p className={styles.error}>{error}</p> : null}
        </div>
      </main>
    </>
  );
}
