"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Atmosphere from "../components/Atmosphere";
import { listCases, startCase } from "../lib/api";
import { difficultyClass, difficultyLabel } from "../lib/format";
import type { CaseSummary } from "../lib/types";
import styles from "./page.module.css";

const CASE_IMAGES: Record<string, string> = {
  "blackwood-inheritance": "/images/cases/blackwood-inheritance.jpg",
};

export default function HomePage() {
  const router = useRouter();
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);
  const [search, setSearch] = useState("");
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
                  "A stormy night, a locked manor, and violence at the foot of the stairs. The family was already at each other’s throats.",
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

  const filtered = cases.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.meta.title.toLowerCase().includes(q) ||
      c.meta.premise.toLowerCase().includes(q) ||
      c.meta.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

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
      <main className={styles.home}>
        <div className={styles.inner}>
          <header className={styles.header}>
            <p className={styles.eyebrow}>Mystery</p>
            <h1 className={styles.title}>What will you investigate?</h1>
            <p className={styles.subtitle}>
              Handcrafted cases with real solutions. Search the shelf or
              continue where you left off.
            </p>
          </header>

          <div className={styles.search}>
            <input
              type="search"
              className={styles.searchInput}
              placeholder="Search cases, tags, or themes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Continue playing</h2>
            <p className={styles.empty}>No active investigations.</p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>The shelf</h2>
            {loading ? (
              <p className={styles.subtitle}>Loading cases…</p>
            ) : filtered.length === 0 ? (
              <p className={styles.empty}>No cases match your search.</p>
            ) : (
              <div className={styles.caseGrid}>
                {filtered.map((c) => (
                  <article key={c.id} className={styles.caseCard}>
                    <div className={styles.caseImage}>
                      <img
                        src={
                          CASE_IMAGES[c.id] ??
                          "/images/cases/blackwood-inheritance.jpg"
                        }
                        alt=""
                      />
                    </div>
                    <div className={styles.caseBody}>
                      <div className={styles.caseTitleRow}>
                        <h3 className={styles.caseTitle}>{c.meta.title}</h3>
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
                          {starting === c.id ? "Starting…" : "Play"}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Completed</h2>
            <p className={styles.empty}>No cases closed yet.</p>
          </section>

          {error ? <p className={styles.subtitle}>{error}</p> : null}
        </div>
      </main>
    </>
  );
}
