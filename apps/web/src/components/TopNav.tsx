"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAmbience } from "./AmbienceProvider";
import { AMBIENCE_PACKS } from "../lib/ambience";
import styles from "./TopNav.module.css";

function DropdownSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.dropdownSection}>
      <div className={styles.dropdownSectionTitle}>{title}</div>
      {children}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`${styles.toggleRow} ${disabled ? styles.toggleDisabled : ""}`}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      role="switch"
      aria-checked={checked}
    >
      <span className={styles.toggleLabel}>{label}</span>
      <span className={`${styles.toggleTrack} ${checked ? styles.toggleOn : ""}`}>
        <span className={styles.toggleThumb} />
      </span>
    </button>
  );
}

export default function TopNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [ambienceOpen, setAmbienceOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const ambienceRef = useRef<HTMLDivElement>(null);

  const {
    packId,
    soundsEnabled,
    musicEnabled,
    setSoundsEnabled,
    setMusicEnabled,
    setPackId,
  } = useAmbience();

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
      if (ambienceRef.current && !ambienceRef.current.contains(e.target as Node)) {
        setAmbienceOpen(false);
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

        <div className={styles.avatarWrap} ref={ambienceRef}>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => setAmbienceOpen((v) => !v)}
            aria-label="Ambience settings"
            aria-expanded={ambienceOpen}
            title="Ambience"
          >
            ♪
          </button>
          {ambienceOpen ? (
            <div className={styles.dropdown} role="menu">
              <DropdownSection title="Ambience">
                <Toggle
                  label="Ambient sounds"
                  checked={soundsEnabled}
                  onChange={setSoundsEnabled}
                />
                <Toggle
                  label="Ambient music"
                  checked={musicEnabled}
                  onChange={setMusicEnabled}
                />
                <div className={styles.dropdownSectionTitle}>Sound pack</div>
                {AMBIENCE_PACKS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`${styles.dropdownItem} ${packId === p.id ? styles.dropdownItemActive : ""}`}
                    onClick={() => setPackId(p.id)}
                  >
                    {p.name}
                  </button>
                ))}
              </DropdownSection>
              <hr />
              <DropdownSection title="Theme">
                <button type="button" className={styles.dropdownItemDisabled} disabled>
                  Manor night (only theme)
                </button>
              </DropdownSection>
            </div>
          ) : null}
        </div>

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
