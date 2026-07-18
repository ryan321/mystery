import type { ReactNode } from "react";
import styles from "./GameShell.module.css";

export default function GameShell({
  left,
  center,
  right,
}: {
  left?: ReactNode;
  center: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className={styles.shell}>
      <div className={styles.shellInner}>
        <div className={styles.desk}>
          {left ? <aside className={styles.leftRail}>{left}</aside> : null}
          <section className={styles.center}>{center}</section>
          {right ? <aside className={styles.rightRail}>{right}</aside> : null}
        </div>
      </div>
    </div>
  );
}

export function Panel({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <h3 className={styles.panelTitle}>{title}</h3>
        {action}
      </div>
      <div className={styles.panelBody}>{children}</div>
    </div>
  );
}
