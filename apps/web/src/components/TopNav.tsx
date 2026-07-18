"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./TopNav.module.css";

export default function TopNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <nav className={styles.nav}>
      <Link href="/" className={styles.brand}>
        <span className={styles.brandMark}>◆</span>
        Mystery
      </Link>

      <div className={styles.right}>
        <Link
          href="/play"
          className={`${styles.link} ${isActive("/play") ? styles.active : ""}`}
        >
          Shelf
        </Link>

        <div className={styles.avatarWrap} ref={ref}>
          <button
            type="button"
            className={styles.avatarBtn}
            onClick={() => setOpen((v) => !v)}
            aria-label="Account menu"
            aria-expanded={open}
          >
            I
          </button>
          {open ? (
            <div className={styles.dropdown} role="menu">
              <Link href="/account" onClick={() => setOpen(false)}>
                Account
              </Link>
              <Link href="/settings" onClick={() => setOpen(false)}>
                Settings
              </Link>
              <hr />
              <button type="button" onClick={() => setOpen(false)}>
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </nav>
  );
}
