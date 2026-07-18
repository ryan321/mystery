"use client";

import type { ReactNode } from "react";
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
  return (
    <>
      {open ? (
        <button
          type="button"
          className={styles.scrim}
          aria-label="Close panel"
          onClick={onClose}
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
