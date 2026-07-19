"use client";

import { useEffect, useRef } from "react";
import MessageBubble from "./MessageBubble";
import SystemCard from "./SystemCard";
import ThinkingIndicator from "./ThinkingIndicator";
import styles from "./Log.module.css";

export type LogItem =
  | { kind: "narration"; text: string }
  | { kind: "you"; text: string }
  | { kind: "npc"; name: string; text: string; avatarUrl?: string }
  | { kind: "system"; text: string }
  | {
      kind: "briefing";
      /** Short in-play card only — full dossier lives on the mystery page. */
      theMystery?: string;
      objective?: string;
      displayName?: string;
    };

export default function Log({
  items,
  busy = false,
}: {
  items: LogItem[];
  busy?: boolean;
}) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [items.length, busy]);

  return (
    <div className={styles.log}>
      {items.map((item, i) => {
        switch (item.kind) {
          case "narration":
            return (
              <p key={i} className={styles.narration}>
                {item.text}
              </p>
            );
          case "you":
            return (
              <MessageBubble
                key={i}
                variant="player"
                name="You"
                text={item.text}
              />
            );
          case "npc":
            return (
              <MessageBubble
                key={i}
                variant="npc"
                name={item.name}
                text={item.text}
                avatarUrl={item.avatarUrl}
              />
            );
          case "system":
            return <SystemCard key={i}>{item.text}</SystemCard>;
          case "briefing": {
            // Prefer the central question; fall back to objective.
            const goal = item.theMystery || item.objective;
            return (
              <SystemCard key={i}>
                <div className={styles.briefing}>
                  {item.displayName ? (
                    <p className={styles.briefingYou}>
                      You are <em>{item.displayName}</em>
                    </p>
                  ) : null}
                  {goal ? <p className={styles.briefingGoal}>{goal}</p> : null}
                  <p className={styles.briefingHint}>
                    Look around, talk to people, examine the scene. Accuse when
                    ready.
                  </p>
                </div>
              </SystemCard>
            );
          }
        }
      })}
      {busy ? <ThinkingIndicator /> : null}
      <div ref={endRef} className={styles.end} />
    </div>
  );
}
