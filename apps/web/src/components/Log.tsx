"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import MessageBubble from "./MessageBubble";
import SystemCard from "./SystemCard";
import ThinkingIndicator from "./ThinkingIndicator";
import styles from "./Log.module.css";

export type LogItem =
  | { id: string; kind: "narration"; text: string }
  | { id: string; kind: "you"; text: string }
  | {
      id: string;
      kind: "npc";
      name: string;
      text: string;
      avatarUrl?: string;
    }
  | { id: string; kind: "system"; text: string }
  | {
      id: string;
      kind: "briefing";
      /** Short in-play card only — full dossier lives on the mystery page. */
      theMystery?: string;
      objective?: string;
      displayName?: string;
    };

/** ~one screen of typical turns; start with 3× this. */
const INITIAL_TAIL = 24;
/** Older items loaded per scroll-up. */
const CHUNK = 14;
/** Grow initial window until content ≥ this many viewports (or all items). */
const VIEWPORT_MULT = 3;
const TOP_LOAD_PX = 96;
const BOTTOM_STICK_PX = 140;

function renderItem(item: LogItem) {
  switch (item.kind) {
    case "narration":
      return <p className={styles.narration}>{item.text}</p>;
    case "you":
      return <MessageBubble variant="player" name="You" text={item.text} />;
    case "npc":
      return (
        <MessageBubble
          variant="npc"
          name={item.name}
          text={item.text}
          avatarUrl={item.avatarUrl}
        />
      );
    case "system":
      return <SystemCard>{item.text}</SystemCard>;
    case "briefing": {
      const goal = item.theMystery || item.objective;
      return (
        <SystemCard>
          <div className={styles.briefing}>
            {item.displayName ? (
              <p className={styles.briefingYou}>
                You are <em>{item.displayName}</em>
              </p>
            ) : null}
            {goal ? <p className={styles.briefingGoal}>{goal}</p> : null}
            <p className={styles.briefingHint}>
              Look around, talk to people, examine the scene. Accuse when ready.
            </p>
          </div>
        </SystemCard>
      );
    }
  }
}

export default function Log({
  items,
  busy = false,
  /** Changes when the playthrough (or full log rebuild) changes. */
  resetKey = "",
}: {
  items: LogItem[];
  busy?: boolean;
  resetKey?: string;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [start, setStart] = useState(0);
  const stickRef = useRef(true);
  const [showJump, setShowJump] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const loadingOlderRef = useRef(false);
  const prevLenRef = useRef(0);
  const prevResetRef = useRef<string | null>(null);
  const pendingScrollRestore = useRef<number | null>(null);
  const growInitialRef = useRef(false);

  const visible = items.slice(start);
  const olderCount = start;

  const scrollToBottom = useCallback((smooth = false) => {
    const el = scrollerRef.current;
    if (!el) return;
    if (smooth) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    } else {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  const updateStickFromScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = dist <= BOTTOM_STICK_PX;
    stickRef.current = atBottom;
    setShowJump(!atBottom && items.length > 0);
  }, [items.length]);

  const loadOlder = useCallback(() => {
    if (loadingOlderRef.current) return;
    if (start <= 0) return;
    const el = scrollerRef.current;
    if (!el) return;

    loadingOlderRef.current = true;
    pendingScrollRestore.current = el.scrollHeight - el.scrollTop;
    const next = Math.max(0, start - CHUNK);
    setStart(next);
  }, [start]);

  // New playthrough / full rebuild: window the tail.
  useLayoutEffect(() => {
    if (prevResetRef.current === resetKey && prevLenRef.current > 0) {
      // Same session — handle appends only
      if (items.length > prevLenRef.current) {
        prevLenRef.current = items.length;
        if (stickRef.current) {
          requestAnimationFrame(() => scrollToBottom(false));
        } else {
          setShowJump(true);
        }
      } else {
        prevLenRef.current = items.length;
      }
      return;
    }

    prevResetRef.current = resetKey;
    const nextStart = Math.max(0, items.length - INITIAL_TAIL);
    setStart(nextStart);
    stickRef.current = true;
    setShowJump(false);
    growInitialRef.current = true;
    prevLenRef.current = items.length;
  }, [items, resetKey, scrollToBottom]);

  // After prepending older items, restore scroll position.
  useLayoutEffect(() => {
    const restore = pendingScrollRestore.current;
    if (restore == null) return;
    const el = scrollerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight - restore;
    }
    pendingScrollRestore.current = null;
    loadingOlderRef.current = false;
  }, [start, visible.length]);

  // Grow initial window to ~3 viewports of content.
  useLayoutEffect(() => {
    if (!growInitialRef.current) return;
    const el = scrollerRef.current;
    if (!el) return;

    const target = el.clientHeight * VIEWPORT_MULT;
    if (el.scrollHeight < target && start > 0) {
      const next = Math.max(0, start - CHUNK);
      if (next !== start) {
        setStart(next);
        return;
      }
    }
    growInitialRef.current = false;
    scrollToBottom(false);
  }, [start, visible.length, items.length, scrollToBottom]);

  useEffect(() => {
    setHasOlder(start > 0);
  }, [start]);

  // Stick to bottom while thinking indicator appears.
  useEffect(() => {
    if (busy && stickRef.current) {
      scrollToBottom(true);
    }
  }, [busy, scrollToBottom]);

  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    updateStickFromScroll();
    if (el.scrollTop < TOP_LOAD_PX && start > 0) {
      loadOlder();
    }
  };

  const jumpToLatest = () => {
    stickRef.current = true;
    setShowJump(false);
    scrollToBottom(true);
  };

  return (
    <div className={styles.root}>
      <div
        ref={scrollerRef}
        className={styles.scroller}
        onScroll={onScroll}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        {hasOlder ? (
          <div className={styles.topHint} aria-hidden={olderCount === 0}>
            <button
              type="button"
              className={styles.loadOlderBtn}
              onClick={loadOlder}
            >
              Load earlier ({olderCount} more)
            </button>
          </div>
        ) : items.length > 0 ? (
          <div className={styles.topEdge} aria-hidden />
        ) : null}

        <div className={styles.content}>
          {visible.map((item) => (
            <div key={item.id} className={styles.item}>
              {renderItem(item)}
            </div>
          ))}
          {busy ? <ThinkingIndicator /> : null}
          <div className={styles.end} />
        </div>
      </div>

      {showJump ? (
        <button
          type="button"
          className={styles.jumpLatest}
          onClick={jumpToLatest}
        >
          Jump to latest
        </button>
      ) : null}
    </div>
  );
}
