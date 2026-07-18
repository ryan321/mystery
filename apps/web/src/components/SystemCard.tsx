import type { ReactNode } from "react";
import styles from "./SystemCard.module.css";

export default function SystemCard({
  children,
  icon = "✦",
}: {
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
        <span className={styles.text}>{children}</span>
      </div>
    </div>
  );
}
