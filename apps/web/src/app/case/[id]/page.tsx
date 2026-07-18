"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Atmosphere from "../../../components/Atmosphere";
import { startCase } from "../../../lib/api";
import { difficultyLabel } from "../../../lib/format";
import styles from "./page.module.css";

const CASE_IMAGES: Record<string, string> = {
  "blackwood-inheritance": "/images/cases/blackwood-inheritance.jpg",
};

const CASE_DETAILS: Record<
  string,
  {
    title: string;
    premise: string;
    description: string;
    tags: string[];
    difficulty: "easy" | "medium" | "hard";
    estimatedMinutes?: number;
    contentWarnings: string[];
    tone?: string;
  }
> = {
  "blackwood-inheritance": {
    title: "The Blackwood Inheritance",
    premise:
      "A stormy night, a locked manor, and violence at the foot of the stairs. The family was already at each other’s throats.",
    description:
      "You are a police inspector called to Blackwood Manor after a crash and a body. Mr. Blackwood lies dead at the foot of the main stairs. The storm has cut the road; no one left the grounds after ten. Butler Henshaw has put you in a small guest room upstairs — a place to leave your coat and notebook. Question the household, search the manor, and find the truth before the storm lifts.",
    tags: ["Manor", "Family", "Storm", "Classic"],
    difficulty: "easy",
    estimatedMinutes: 40,
    contentWarnings: ["murder", "violence"],
    tone: "gothic manor whodunit, tense and formal",
  },
};

export default function CaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);
  const detail = CASE_DETAILS[id];
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!detail) {
      router.replace("/play");
    }
  }, [detail, router]);

  if (!detail) {
    return null;
  }

  async function handleStart() {
    setStarting(true);
    setError(null);
    try {
      const data = await startCase(id);
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

  const difficultyClass =
    detail.difficulty === "hard"
      ? styles.badgeHard
      : detail.difficulty === "medium"
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
              <p className={styles.eyebrow}>Case file</p>
              <h1 className={styles.title}>{detail.title}</h1>
              <div className={styles.metaRow}>
                <span className={`${styles.badge} ${difficultyClass}`}>
                  {difficultyLabel(detail.difficulty)}
                </span>
                {detail.estimatedMinutes ? (
                  <span className={`${styles.badge} ${styles.badgeNeutral}`}>
                    ~{detail.estimatedMinutes} min
                  </span>
                ) : null}
                {detail.tone ? (
                  <span className={`${styles.badge} ${styles.badgeNeutral}`}>
                    {detail.tone}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className={styles.content}>
            <div className={styles.main}>
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Premise</h2>
                <p className={styles.premise}>{detail.premise}</p>
              </section>

              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>About this case</h2>
                <p className={styles.description}>{detail.description}</p>
              </section>

              {detail.contentWarnings.length > 0 ? (
                <div className={styles.warning}>
                  <strong>Content warnings:</strong>{" "}
                  {detail.contentWarnings.join(", ")}
                </div>
              ) : null}
            </div>

            <aside className={styles.sidebar}>
              <div className={styles.playCard}>
                <h2 className={styles.playTitle}>Start investigating</h2>
                <p className={styles.playMeta}>
                  Free case · Plays in your browser · No download
                </p>
                <button
                  type="button"
                  className={styles.btnPrimary}
                  onClick={handleStart}
                  disabled={starting}
                >
                  {starting ? "Starting…" : "Play free case"}
                </button>
                {error ? <p className={styles.playMeta}>{error}</p> : null}
              </div>

              <div className={styles.section}>
                <h2 className={styles.sectionTitle}>Tags</h2>
                <div className={styles.tags}>
                  {detail.tags.map((t) => (
                    <span key={t} className={styles.tag}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>
    </>
  );
}
