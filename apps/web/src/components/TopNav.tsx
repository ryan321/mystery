"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAmbience } from "./AmbienceProvider";
import { useAtmosphereTheme } from "./AtmosphereThemeProvider";
import { AMBIENCE_PACKS, MUSIC_AUTO, MUSIC_TRACKS } from "../lib/ambience";
import type { ThemeSelection } from "../lib/themes";
import {
  getSession,
  refreshSession,
  signOut,
  subscribeAuth,
  type AuthSession,
} from "../lib/auth";
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

const UI_THEMES: { id: ThemeSelection; name: string }[] = [
  { id: "auto", name: "Match the case" },
  { id: "manor", name: "Manor Night" },
  { id: "station", name: "Starlit Station" },
  { id: "noir", name: "Noir" },
  { id: "snowfall", name: "Snowfall" },
  { id: "daylight", name: "Daylight" },
];

export default function TopNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [ambienceOpen, setAmbienceOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [session, setSession] = useState<AuthSession | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const ambienceRef = useRef<HTMLDivElement>(null);
  const themeRef = useRef<HTMLDivElement>(null);
  const mobileRef = useRef<HTMLDivElement>(null);

  const { selection: themeId, setSelection: setThemeId } = useAtmosphereTheme();

  const {
    packId,
    soundsEnabled,
    musicEnabled,
    musicId,
    setSoundsEnabled,
    setMusicEnabled,
    setPackId,
    setMusicId,
  } = useAmbience();

  useEffect(() => {
    setSession(getSession());
    // Reconcile the local mirror with the real API session.
    void refreshSession();
    return subscribeAuth(() => setSession(getSession()));
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
      if (ambienceRef.current && !ambienceRef.current.contains(e.target as Node)) {
        setAmbienceOpen(false);
      }
      if (themeRef.current && !themeRef.current.contains(e.target as Node)) {
        setThemeOpen(false);
      }
      if (mobileRef.current && !mobileRef.current.contains(e.target as Node)) {
        setMobileOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  // Shared by the desktop ambience dropdown and the mobile hamburger menu.
  const ambienceSection = (
    <DropdownSection title="Sounds & Music">
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
      <div className={styles.dropdownSectionTitle}>Music</div>
      <div className={styles.dropdownScroll}>
        <button
          type="button"
          className={`${styles.dropdownItem} ${musicId === MUSIC_AUTO ? styles.dropdownItemActive : ""}`}
          onClick={() => setMusicId(MUSIC_AUTO)}
        >
          Match the scene
        </button>
        {MUSIC_TRACKS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`${styles.dropdownItem} ${musicId === t.id ? styles.dropdownItemActive : ""}`}
            onClick={() => setMusicId(t.id)}
          >
            {t.name}
          </button>
        ))}
      </div>
    </DropdownSection>
  );

  // Shared by the desktop theme dropdown and the mobile hamburger menu.
  const themeSection = (
    <DropdownSection title="UI Theme">
      {UI_THEMES.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`${styles.dropdownItem} ${themeId === t.id ? styles.dropdownItemActive : ""}`}
          onClick={() => setThemeId(t.id)}
        >
          {t.name}
        </button>
      ))}
    </DropdownSection>
  );

  // Account links, closed via whichever menu opened them.
  const accountLinks = (closeMenu: () => void) =>
    session ? (
      <>
        <div className={styles.dropdownUser}>
          <span className={styles.dropdownUserName}>
            {session.displayName}
          </span>
          <span className={styles.dropdownUserEmail}>{session.email}</span>
        </div>
        <Link href="/account" onClick={closeMenu}>
          Account
        </Link>
        <Link href="/account/billing" onClick={closeMenu}>
          Subscription
        </Link>
        <Link href="/settings" onClick={closeMenu}>
          Settings
        </Link>
        <hr />
        <button
          type="button"
          onClick={() => {
            signOut();
            closeMenu();
          }}
        >
          Sign out
        </button>
      </>
    ) : (
      <>
        <Link href="/signin" onClick={closeMenu}>
          Sign in
        </Link>
        <Link href="/signup" onClick={closeMenu}>
          Sign up
        </Link>
        <hr />
        <Link href="/settings" onClick={closeMenu}>
          Settings
        </Link>
      </>
    );

  return (
    <nav className={styles.nav}>
      <Link href="/" className={styles.brand} aria-label="MysteryTrove home">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className={styles.brandLogo}
          src="/brand/logo-one-line.webp"
          alt="MysteryTrove"
        />
      </Link>

      <div className={styles.right}>
        <Link
          href="/gallery"
          className={`${styles.link} ${styles.collapseItem} ${isActive("/gallery") ? styles.active : ""}`}
        >
          Gallery
        </Link>
        {session ? (
          <Link
            href="/my-mysteries"
            className={`${styles.link} ${styles.collapseItem} ${isActive("/my-mysteries") ? styles.active : ""}`}
          >
            My mysteries
          </Link>
        ) : null}
        <Link
          href="/help"
          className={`${styles.iconBtn} ${styles.collapseItem} ${isActive("/help") ? styles.iconBtnActive : ""}`}
          aria-label="Help"
          title="Help"
        >
          ?
        </Link>

        <div className={`${styles.avatarWrap} ${styles.collapseItem}`} ref={themeRef}>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => setThemeOpen((v) => !v)}
            aria-label="Theme settings"
            aria-expanded={themeOpen}
            title="Theme"
          >
            ◐
          </button>
          {themeOpen ? (
            <div className={styles.dropdown} role="menu">
              {themeSection}
            </div>
          ) : null}
        </div>

        <div className={`${styles.avatarWrap} ${styles.collapseItem}`} ref={ambienceRef}>
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
              {ambienceSection}
            </div>
          ) : null}
        </div>

        <div className={`${styles.avatarWrap} ${styles.collapseItem}`} ref={ref}>
          <button
            type="button"
            className={styles.avatarBtn}
            onClick={() => setOpen((v) => !v)}
            aria-label="Account menu"
            aria-expanded={open}
          >
            {session
              ? session.displayName.trim().charAt(0).toUpperCase() || "?"
              : "?"}
          </button>
          {open ? (
            <div className={styles.dropdown} role="menu">
              {accountLinks(() => setOpen(false))}
            </div>
          ) : null}
        </div>

        {/* Small screens: everything above collapses into one menu. */}
        <div className={`${styles.avatarWrap} ${styles.hamburgerWrap}`} ref={mobileRef}>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Menu"
            aria-expanded={mobileOpen}
            title="Menu"
          >
            ☰
          </button>
          {mobileOpen ? (
            <div
              className={`${styles.dropdown} ${styles.mobileMenu}`}
              role="menu"
            >
              <Link href="/gallery" onClick={() => setMobileOpen(false)}>
                Gallery
              </Link>
              {session ? (
                <Link
                  href="/my-mysteries"
                  onClick={() => setMobileOpen(false)}
                >
                  My mysteries
                </Link>
              ) : null}
              <Link href="/help" onClick={() => setMobileOpen(false)}>
                Help
              </Link>
              <hr />
              {ambienceSection}
              {themeSection}
              <hr />
              {accountLinks(() => setMobileOpen(false))}
            </div>
          ) : null}
        </div>
      </div>
    </nav>
  );
}
