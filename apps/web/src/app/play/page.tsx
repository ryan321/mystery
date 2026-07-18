"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Atmosphere from "../../components/Atmosphere";
import { listCases } from "../../lib/api";
import { difficultyClass, difficultyLabel } from "../../lib/format";
import { getAllPlayStates } from "../../lib/playState";
import type { CaseSummary } from "../../lib/types";
import styles from "./page.module.css";

const CASE_IMAGES: Record<string, string> = {
  "blackwood-inheritance": "/images/cases/blackwood-inheritance.jpg",
  "pier-at-low-tide": "/images/cases/pier-at-low-tide.jpg",
  "last-broadcast": "/images/cases/last-broadcast.jpg",
  "dead-air": "/images/cases/dead-air.jpg",
  "london-1888": "/images/cases/london-1888.jpg",
  "snowbound-lodge": "/images/cases/snowbound-lodge.jpg",
  "the-white-room": "/images/cases/the-white-room.jpg",
  "hostile-takeover": "/images/cases/hostile-takeover.jpg",
  "cant-trick-rick": "/images/cases/cant-trick-rick.jpg",
};

type StatusFilter = "all" | "being_played" | "completed" | "not_started";

export default function ShelfPage() {
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [playStates, setPlayStates] = useState<Record<string, { status: string }>>({});

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

  useEffect(() => {
    setPlayStates(getAllPlayStates());
  }, []);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    for (const c of cases) {
      for (const t of c.meta.tags) tags.add(t);
    }
    return [...tags].sort();
  }, [cases]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return cases.filter((c) => {
      const matchesSearch =
        c.meta.title.toLowerCase().includes(q) ||
        c.meta.premise.toLowerCase().includes(q) ||
        c.meta.tags.some((t) => t.toLowerCase().includes(q));
      const matchesTag = !activeTag || c.meta.tags.includes(activeTag);

      const status = playStates[c.id]?.status;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "being_played" && status === "being_played") ||
        (statusFilter === "completed" && status === "completed") ||
        (statusFilter === "not_started" && !status);

      return matchesSearch && matchesTag && matchesStatus;
    });
  }, [cases, search, activeTag, statusFilter, playStates]);

  return (
    <>
      <Atmosphere />
      <main className={styles.lobby}>
        <div className={styles.lobbyInner}>
          <header className={styles.header}>
            <p className={styles.eyebrow}>The shelf</p>
            <h1 className={styles.title}>Choose your mystery</h1>
            <p className={styles.subtitle}>
              Each mystery is authored with a fixed solution. Question
              suspects, explore the scene, and find the truth.
            </p>
          </header>

          <div className={styles.filters}>
            <input
              type="search"
              className={styles.searchInput}
              placeholder="Search mysteries, tags, or themes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className={styles.tagFilters}>
              <button
                type="button"
                className={`${styles.tagFilter} ${statusFilter === "all" ? styles.tagFilterActive : ""}`}
                onClick={() => setStatusFilter("all")}
              >
                All
              </button>
              <button
                type="button"
                className={`${styles.tagFilter} ${statusFilter === "being_played" ? styles.tagFilterActive : ""}`}
                onClick={() => setStatusFilter(statusFilter === "being_played" ? "all" : "being_played")}
              >
                Being played
              </button>
              <button
                type="button"
                className={`${styles.tagFilter} ${statusFilter === "completed" ? styles.tagFilterActive : ""}`}
                onClick={() => setStatusFilter(statusFilter === "completed" ? "all" : "completed")}
              >
                Completed
              </button>
              <button
                type="button"
                className={`${styles.tagFilter} ${statusFilter === "not_started" ? styles.tagFilterActive : ""}`}
                onClick={() => setStatusFilter(statusFilter === "not_started" ? "all" : "not_started")}
              >
                Not started
              </button>
            </div>
            {allTags.length > 0 ? (
              <div className={styles.tagFilters}>
                {allTags.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`${styles.tagFilter} ${activeTag === t ? styles.tagFilterActive : ""}`}
                    onClick={() => setActiveTag(activeTag === t ? null : t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {loading ? (
            <p className={styles.subtitle}>Loading mysteries…</p>
          ) : filtered.length === 0 ? (
            <p className={styles.empty}>No mysteries match your search.</p>
          ) : (
            <div className={styles.caseGrid}>
              {filtered.map((c) => {
                const status = playStates[c.id]?.status;
                return (
                  <Link key={c.id} href={`/mystery/${c.id}`} className={styles.caseCardLink}>
                    <article className={styles.caseCard}>
                      {status === "being_played" ? (
                        <span className={`${styles.statusBanner} ${styles.statusBeingPlayed}`}>
                          Being played
                        </span>
                      ) : status === "completed" ? (
                        <span className={`${styles.statusBanner} ${styles.statusCompleted}`}>
                          Completed
                        </span>
                      ) : null}
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
                        </div>
                      </div>
                    </article>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
