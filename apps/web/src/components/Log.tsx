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
      displayName?: string;
      addressAs?: string;
      appearance?: string;
      age?: string;
      gender?: string;
      background?: string;
      publicPerception?: string;
      authority?: string;
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
                  {item.displayName || item.role ? (
                    <p>
                      <strong>You are.</strong>{" "}
                      {item.displayName ? (
                        <>
                          <em>{item.displayName}</em>
                          {item.role ? ` — ${item.role}` : ""}
                        </>
                      ) : (
                        item.role
                      )}
                      {item.age || item.gender || item.appearance ? (
                        <>
                          {" "}
                          (
                          {[item.age, item.gender, item.appearance]
                            .filter(Boolean)
                            .join("; ")}
                          )
                        </>
                      ) : null}
                    </p>
                  ) : null}
                  {item.background ? (
                    <p>
                      <strong>Background.</strong> {item.background}
                    </p>
                  ) : null}
                  {item.publicPerception ? (
                    <p>
                      <strong>How they see you.</strong> {item.publicPerception}
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
                    you can, method and motive. Stay in character: the world
                    treats you as this persona, not a generic blank detective.
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
