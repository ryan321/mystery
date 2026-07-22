"use client";

import { useRef, type ReactNode } from "react";
import styles from "./SideDrawer.module.css";

export default function SideDrawer({
  side = "left",
  title,
  open,
  onClose,
  children,
}: {
  side?: "left" | "right";
  title: string;
  open: boolean;
  onClose?: () => void;
  children: ReactNode;
}) {
  // Mobile pinch-zoom synthesizes a click after the gesture (at the
  // midpoint or the first finger) — that stray click must not read as
  // "tap outside to close". Only a real single-finger tap that began on
  // the scrim closes the drawer.
  const downOnScrim = useRef(false);
  const pinched = useRef(false);

  return (
    <>
      {open ? (
        <button
          type="button"
          className={styles.scrim}
          aria-label="Close panel"
          onPointerDown={() => {
            downOnScrim.current = true;
            pinched.current = false;
          }}
          onTouchStart={(e) => {
            if (e.touches.length > 1) pinched.current = true;
          }}
          onTouchMove={(e) => {
            if (e.touches.length > 1) pinched.current = true;
          }}
          onClick={(e) => {
            // Keyboard activation (no pointer) is always a genuine tap.
            const genuineTap =
              e.detail === 0 || (downOnScrim.current && !pinched.current);
            downOnScrim.current = false;
            pinched.current = false;
            if (genuineTap) onClose?.();
          }}
        />
      ) : null}
      <aside
        className={`${styles.drawer} ${
          side === "right" ? styles.right : styles.left
        } ${open ? styles.open : ""}`}
        aria-hidden={!open}
      >
        <div className={styles.header}>
          <h3 className={styles.title}>{title}</h3>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className={styles.body}>{children}</div>
      </aside>
    </>
  );
}
