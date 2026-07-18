"use client";

import { useEffect, useRef } from "react";
import MessageBubble from "./MessageBubble";
import SystemCard from "./SystemCard";
import styles from "./Log.module.css";

export type LogItem =
  | { kind: "narration"; text: string }
  | { kind: "you"; text: string }
  | { kind: "npc"; name: string; text: string; avatarUrl?: string }
  | { kind: "system"; text: string };

export default function Log({ items }: { items: LogItem[] }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [items.length]);

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
        }
      })}
      <div ref={endRef} className={styles.end} />
    </div>
  );
}
