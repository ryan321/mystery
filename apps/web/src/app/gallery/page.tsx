"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Atmosphere from "../../components/Atmosphere";
import { coverSrc, listCases } from "../../lib/api";
import { difficultyClass, difficultyLabel, lockLabel, themeTags } from "../../lib/format";
import { getAllPlayStates } from "../../lib/playState";
import type { CaseSummary } from "../../lib/types";
import styles from "./page.module.css";

type StatusFilter = "all" | "being_played" | "completed" | "not_started";
type DifficultyFilter = "all" | "easy" | "medium" | "hard";

export default function GalleryPage() {
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [themesOpen, setThemesOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>("all");
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
      for (const t of themeTags(c.meta.tags)) tags.add(t);
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
      // OR: case matches if it has any selected theme
      const caseTags = themeTags(c.meta.tags);
      const matchesTags =
        selectedTags.length === 0 ||
        selectedTags.some((t) => caseTags.includes(t));

      const status = playStates[c.id]?.status;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "being_played" && status === "being_played") ||
        (statusFilter === "completed" && status === "completed") ||
        (statusFilter === "not_started" && !status);

      const matchesDifficulty =
        difficultyFilter === "all" || c.meta.difficulty === difficultyFilter;

      return matchesSearch && matchesTags && matchesStatus && matchesDifficulty;
    });
  }, [cases, search, selectedTags, statusFilter, difficultyFilter, playStates]);

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  function removeTag(tag: string) {
    setSelectedTags((prev) => prev.filter((t) => t !== tag));
  }

  return (
    <>
      <Atmosphere />
      <main className={styles.lobby}>
        <div className={styles.lobbyInner}>
          <header className={styles.header}>
            <p className={styles.eyebrow}>The gallery</p>
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
              placeholder="Search mysteries or themes…"
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
                Started
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
            <div className={styles.tagFilters}>
              <button
                type="button"
                className={`${styles.tagFilter} ${difficultyFilter === "all" ? styles.tagFilterActive : ""}`}
                onClick={() => setDifficultyFilter("all")}
              >
                Any difficulty
              </button>
              <button
                type="button"
                className={`${styles.tagFilter} ${difficultyFilter === "easy" ? styles.tagFilterActive : ""}`}
                onClick={() => setDifficultyFilter(difficultyFilter === "easy" ? "all" : "easy")}
              >
                Easy
              </button>
              <button
                type="button"
                className={`${styles.tagFilter} ${difficultyFilter === "medium" ? styles.tagFilterActive : ""}`}
                onClick={() => setDifficultyFilter(difficultyFilter === "medium" ? "all" : "medium")}
              >
                Medium
              </button>
              <button
                type="button"
                className={`${styles.tagFilter} ${difficultyFilter === "hard" ? styles.tagFilterActive : ""}`}
                onClick={() => setDifficultyFilter(difficultyFilter === "hard" ? "all" : "hard")}
              >
                Difficult
              </button>
            </div>
            {allTags.length > 0 ? (
              <div className={styles.themesBlock}>
                <div className={styles.themesBar}>
                  <button
                    type="button"
                    className={`${styles.themesToggle} ${themesOpen ? styles.themesToggleOpen : ""} ${selectedTags.length > 0 ? styles.themesToggleActive : ""}`}
                    onClick={() => setThemesOpen((o) => !o)}
                    aria-expanded={themesOpen}
                  >
                    <span>
                      Themes
                      {selectedTags.length > 0
                        ? ` · ${selectedTags.length}`
                        : ""}
                    </span>
                    <span className={styles.themesChevron} aria-hidden>
                      {themesOpen ? "▴" : "▾"}
                    </span>
                  </button>
                  {selectedTags.length > 0 ? (
                    <button
                      type="button"
                      className={styles.clearThemes}
                      onClick={() => setSelectedTags([])}
                    >
                      Clear
                    </button>
                  ) : null}
                </div>

                {selectedTags.length > 0 ? (
                  <div className={styles.selectedTags} aria-label="Selected themes">
                    {selectedTags.map((t) => (
                      <button
                        key={t}
                        type="button"
                        className={styles.selectedChip}
                        onClick={() => removeTag(t)}
                        title={`Remove ${t}`}
                      >
                        <span>{t}</span>
                        <span className={styles.selectedChipX} aria-hidden>
                          ×
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}

                {themesOpen ? (
                  <div className={styles.themesPanel}>
                    <p className={styles.themesHint}>
                      Match any selected theme
                    </p>
                    <div className={styles.tagFilters}>
                      {allTags.map((t) => {
                        const on = selectedTags.includes(t);
                        return (
                          <button
                            key={t}
                            type="button"
                            className={`${styles.tagFilter} ${on ? styles.tagFilterActive : ""}`}
                            onClick={() => toggleTag(t)}
                            aria-pressed={on}
                          >
                            {t}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
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
                          Started
                        </span>
                      ) : status === "completed" ? (
                        <span className={`${styles.statusBanner} ${styles.statusCompleted}`}>
                          Completed
                        </span>
                      ) : null}
                      <div
                        className={`${styles.caseImage} ${c.locked ? styles.caseImageLocked : ""}`}
                      >
                        <img src={coverSrc(c)} alt="" />
                        {c.locked ? (
                          <span
                            className={styles.lockBadge}
                            title={lockLabel(c)}
                          >
                            <svg
                              viewBox="0 0 24 24"
                              aria-hidden
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <rect x="4" y="11" width="16" height="9" rx="2" />
                              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                            </svg>
                            {lockLabel(c)}
                          </span>
                        ) : null}
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
                          {themeTags(c.meta.tags).map((t) => (
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
