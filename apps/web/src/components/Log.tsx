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
      theMystery?: string;
      objective?: string;
      startingKnowledge?: string;
      setting?: string;
      role?: string;
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
          case "briefing":
            return (
              <SystemCard key={i}>
                <div className={styles.briefing}>
                  <p className={styles.briefingTitle}>Your briefing</p>
                  {item.setting ? (
                    <p>
                      <strong>Setting.</strong> {item.setting}
                    </p>
                  ) : null}
                  {item.role ? (
                    <p>
                      <strong>You.</strong> {item.role}
                    </p>
                  ) : null}
                  {item.theMystery ? (
                    <p>
                      <strong>The mystery.</strong> {item.theMystery}
                    </p>
                  ) : null}
                  {item.objective ? (
                    <p>
                      <strong>Your job.</strong> {item.objective}
                    </p>
                  ) : null}
                  {item.startingKnowledge ? (
                    <p>
                      <strong>What you know.</strong> {item.startingKnowledge}
                    </p>
                  ) : null}
                  <p className={styles.briefingHint}>
                    Explore, question people, examine the scene, and present
                    evidence. When you are ready, accuse with a name — and if
                    you can, method and motive.
                  </p>
                </div>
              </SystemCard>
            );
        }
      })}
      {busy ? <ThinkingIndicator /> : null}
      <div ref={endRef} className={styles.end} />
    </div>
  );
}
