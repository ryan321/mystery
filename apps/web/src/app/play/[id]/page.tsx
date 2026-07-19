"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Atmosphere from "../../../components/Atmosphere";
import GameShell from "../../../components/GameShell";
import StatusBar from "../../../components/StatusBar";
import Log, { type LogItem } from "../../../components/Log";
import Composer from "../../../components/Composer";
import DenouementBanner from "../../../components/DenouementBanner";
import EndingOverlay from "../../../components/EndingOverlay";
import ProgressToast from "../../../components/ProgressToast";
import PlayProgressSettings from "../../../components/PlayProgressSettings";
import { assetUrl, getPlaythrough, sendTurn } from "../../../lib/api";
import { markCompleted } from "../../../lib/playState";
import {
  defaultPlayProgressMode,
  effectiveProgressMode,
  getPlayProgressPref,
  setPlayProgressPref,
  type ProgressUiMode,
} from "../../../lib/progressPrefs";
import type {
  DialogueLine,
  MysteryBriefing,
  MysteryProgress,
  PlaythroughState,
  ProgressPulse,
  TurnLogEntry,
} from "../../../lib/types";
import { CASE_TITLES } from "../../../lib/content";
import styles from "./page.module.css";

function portraitFor(
  playthrough: PlaythroughState | null | undefined,
  characterId: string
): string | undefined {
  if (!playthrough) return undefined;
  const fromState = playthrough.characters[characterId]?.portraitUrl;
  if (fromState) return assetUrl(fromState);
  const fromCast = playthrough.cast?.find((c) => c.id === characterId)
    ?.portraitUrl;
  return assetUrl(fromCast);
}

function buildLog(
  opening: string | undefined,
  turns: TurnLogEntry[] | undefined,
  playthrough?: PlaythroughState | null,
  briefing?: MysteryBriefing | null
): LogItem[] {
  const items: LogItem[] = [];
  if (opening) {
    items.push({ kind: "narration", text: opening });
  }
  // Slim start card only (full dossier is on the mystery detail page).
  // Opening narration already sets scene + who's here; don't restate it.
  const hasBriefing =
    briefing &&
    (briefing.theMystery || briefing.objective || briefing.displayName);
  if (hasBriefing && !(turns && turns.length > 0)) {
    items.push({
      kind: "briefing",
      theMystery: briefing.theMystery,
      objective: briefing.objective,
      displayName: briefing.displayName,
    });
  }
  for (const t of turns ?? []) {
    items.push({ kind: "you", text: t.playerInput });
    items.push({ kind: "narration", text: t.narration });
    for (const d of t.dialogue ?? []) {
      items.push({
        kind: "npc",
        name: d.characterName ?? d.characterId,
        text: d.text,
        avatarUrl: portraitFor(playthrough, d.characterId),
      });
    }
  }
  return items;
}

export default function PlaythroughPage() {
  const params = useParams();
  const id = String(params.id);
  const [playthrough, setPlaythrough] = useState<PlaythroughState | null>(null);
  const [log, setLog] = useState<LogItem[]>([]);
  const [locationName, setLocationName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const settingsBtnRef = useRef<HTMLButtonElement>(null);
  const [settingsPos, setSettingsPos] = useState<{
    top: number;
    right: number;
  }>({ top: 0, right: 0 });
  const [progress, setProgress] = useState<MysteryProgress | null>(null);
  const [toastPulses, setToastPulses] = useState<ProgressPulse[]>([]);
  const [toastKey, setToastKey] = useState(0);
  /** Progress UI for this playthrough only */
  const [playProgressMode, setPlayProgressMode] =
    useState<ProgressUiMode>("off");

  const placeSettingsPanel = useCallback(() => {
    const btn = settingsBtnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    setSettingsPos({
      top: rect.bottom + 6,
      right: Math.max(8, window.innerWidth - rect.right),
    });
  }, []);

  const toggleSettings = useCallback(() => {
    if (settingsOpen) {
      setSettingsOpen(false);
      return;
    }
    placeSettingsPanel();
    setSettingsOpen(true);
  }, [settingsOpen, placeSettingsPanel]);

  useEffect(() => {
    if (!settingsOpen) return;
    function onDocClick(e: MouseEvent) {
      if (
        settingsRef.current &&
        !settingsRef.current.contains(e.target as Node)
      ) {
        setSettingsOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSettingsOpen(false);
    }
    function onReposition() {
      placeSettingsPanel();
    }
    // Defer so the opening click does not immediately close the panel.
    const timer = window.setTimeout(() => {
      document.addEventListener("mousedown", onDocClick);
    }, 0);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [settingsOpen, placeSettingsPanel]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getPlaythrough(id);
        if (cancelled) return;
        setPlaythrough(data.playthrough);
        setLocationName(data.locationName ?? data.playthrough.locationId);
        if (data.progress) setProgress(data.progress);
        const caseMode =
          data.progress?.caseMode ?? data.playthrough.progressUi ?? "off";
        const stored = getPlayProgressPref(data.playthrough.id);
        setPlayProgressMode(
          stored ?? defaultPlayProgressMode(caseMode)
        );
        const opening =
          sessionStorage.getItem(`mystery:opening:${id}`) ??
          data.openingNarration ??
          "";
        let briefing = data.briefing;
        const briefKey = `mystery:briefing:${id}`;
        if (briefing) {
          sessionStorage.setItem(briefKey, JSON.stringify(briefing));
        } else {
          try {
            const raw = sessionStorage.getItem(briefKey);
            if (raw) briefing = JSON.parse(raw) as MysteryBriefing;
          } catch {
            /* ignore */
          }
        }
        setLog(buildLog(opening, data.turns, data.playthrough, briefing));
      } catch {
        if (!cancelled) setError("Playthrough not found");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!playthrough) return;
    if (playthrough.status === "solved" || playthrough.status === "failed") {
      markCompleted(playthrough.caseId, playthrough.id);
    }
  }, [playthrough]);

  const appendDialogue = useCallback(
    (
      dialogue: DialogueLine[] | undefined,
      pt?: PlaythroughState | null
    ) => {
      if (!dialogue?.length) return;
      setLog((prev) => [
        ...prev,
        ...dialogue.map((d) => ({
          kind: "npc" as const,
          name: d.characterName ?? d.characterId,
          text: d.text,
          avatarUrl: portraitFor(pt ?? playthrough, d.characterId),
        })),
      ]);
    },
    [playthrough]
  );

  const send = useCallback(
    async (text: string) => {
      if (busy || !playthrough) return;
      setBusy(true);
      setError(null);
      setLog((prev) => [...prev, { kind: "you", text }]);
      try {
        const data = await sendTurn(id, text);
        setPlaythrough(data.playthrough);
        setLocationName(data.locationName ?? data.playthrough.locationId);
        if (data.progress) {
          setProgress(data.progress);
          const mode = effectiveProgressMode(
            data.progress.caseMode ?? data.playthrough.progressUi,
            getPlayProgressPref(data.playthrough.id) ??
              defaultPlayProgressMode(
                data.progress.caseMode ?? data.playthrough.progressUi
              )
          );
          if (mode !== "off" && data.progress.pulses?.length) {
            setToastPulses(data.progress.pulses);
            setToastKey((k) => k + 1);
          }
        }
        setLog((prev) => [...prev, { kind: "narration", text: data.narration }]);
        appendDialogue(data.dialogue, data.playthrough);
        if (data.justHappened?.length) {
          for (const j of data.justHappened) {
            // Phase / engine bookkeeping — never in the player log.
            if (
              j.id?.startsWith("phase") ||
              j.summary?.toLowerCase().includes("phase")
            ) {
              continue;
            }
            // Status changes (threat, harm, hold, assault) are for the AI
            // performer + StatusBar only. Do NOT echo as system chips in the
            // log — they should read as narrator prose, not a HUD.
            if (
              j.id?.startsWith("player_threat_") ||
              j.id?.startsWith("player_harm_") ||
              j.id?.startsWith("player_control_") ||
              j.id?.startsWith("assault_attempt_") ||
              j.id?.startsWith("assault_default_") ||
              j.id?.startsWith("world_to_player") ||
              j.id?.startsWith("social_pushback_") ||
              j.id?.startsWith("misconduct_default_") ||
              j.id?.startsWith("hazard_") ||
              j.id?.startsWith("will_") ||
              j.id?.startsWith("move_char_")
            ) {
              continue;
            }
            // Rare log-worthy beats: boundaries, endings, force-moves that
            // might need a short cue if prose is thin.
            const playerFacing =
              j.id?.startsWith("pulse_") ||
              j.id?.startsWith("player_moved_") ||
              j.id?.startsWith("stolen_") ||
              j.id?.startsWith("item_damaged_") ||
              j.id?.startsWith("lost_ev_") ||
              j.id?.startsWith("boundary_") ||
              j.id === "safe_haven_compromised" ||
              j.id === "ending" ||
              j.id === "midnight_strikes" ||
              j.id === "denouement_start" ||
              j.id === "denouement_end";
            if (playerFacing && j.summary) {
              setLog((prev) => [
                ...prev,
                {
                  kind: "system",
                  text: j.summary,
                },
              ]);
            }
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Turn failed");
      } finally {
        setBusy(false);
      }
    },
    [busy, id, playthrough, appendDialogue]
  );

  const closed = playthrough
    ? playthrough.status !== "active" && playthrough.status !== "denouement"
    : true;

  const caseProgressMode =
    progress?.caseMode ?? playthrough?.progressUi ?? "off";
  const progressMode = effectiveProgressMode(
    caseProgressMode,
    caseProgressMode === "off" ? null : playProgressMode
  );

  function onPlayProgressChange(mode: ProgressUiMode) {
    if (!playthrough) return;
    setPlayProgressPref(playthrough.id, mode);
    setPlayProgressMode(mode);
  }

  if (error && !playthrough) {
    return (
      <>
        <Atmosphere />
        <main className={styles.errorPage}>
          <p className={styles.errorText}>{error}</p>
        </main>
      </>
    );
  }

  const center = (
    <>
      <header className={styles.chrome}>
        <div className={styles.chromeTop}>
          <div className={styles.caseEyebrow}>
            {CASE_TITLES[playthrough?.caseId ?? ""] ?? "Case"}
          </div>
          <div className={styles.chromeActions} ref={settingsRef}>
            <button
              ref={settingsBtnRef}
              type="button"
              className={
                settingsOpen
                  ? `${styles.iconBtn} ${styles.iconBtnActive}`
                  : styles.iconBtn
              }
              onClick={toggleSettings}
              aria-label="Play settings for this investigation"
              aria-expanded={settingsOpen}
              aria-haspopup="dialog"
              title="Play settings"
            >
              <svg
                className={styles.iconSvg}
                viewBox="0 0 24 24"
                width="18"
                height="18"
                aria-hidden
              >
                <path
                  fill="currentColor"
                  d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.03 7.03 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 13.9 2h-3.8a.5.5 0 0 0-.49.42l-.36 2.54c-.59.24-1.13.55-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 8.08a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.83 14.7a.5.5 0 0 0-.12.64l1.92 3.32c.13.23.4.32.6.22l2.39-.96c.5.39 1.04.7 1.63.94l.36 2.54c.05.24.25.42.49.42h3.8c.24 0 .44-.18.49-.42l.36-2.54c.59-.24 1.13-.55 1.63-.94l2.39.96c.22.09.48 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z"
                />
              </svg>
            </button>
            {settingsOpen ? (
              <div
                className={styles.settingsPanel}
                role="dialog"
                aria-label="Play settings"
                style={{ top: settingsPos.top, right: settingsPos.right }}
              >
                <div className={styles.settingsHeader}>
                  <span className={styles.settingsTitle}>Play settings</span>
                  <button
                    type="button"
                    className={styles.settingsClose}
                    onClick={() => setSettingsOpen(false)}
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>
                <PlayProgressSettings
                  mode={progressMode}
                  caseAllowsProgress={caseProgressMode !== "off"}
                  onChange={onPlayProgressChange}
                />
              </div>
            ) : null}
          </div>
        </div>
        <StatusBar
          locationName={locationName}
          time={playthrough?.time}
          environment={playthrough?.environment}
          clocks={playthrough?.clocks}
          turnCount={playthrough?.turnCount ?? 0}
          progress={progress}
          showProgressMeter={progressMode === "full"}
          progressCompact={progressMode === "subtle"}
        />
        {playthrough?.status === "denouement" ? (
          <DenouementBanner
            ending={playthrough.ending}
            resolution={playthrough.resolution}
            denouement={playthrough.denouement}
          />
        ) : null}
      </header>

      <div className={styles.logWrap}>
        <Log items={log} busy={busy} />
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      <Composer
        busy={busy}
        closed={closed}
        onSend={send}
      />

      {progressMode !== "off" ? (
        <ProgressToast pulses={toastPulses} pulseKey={toastKey} />
      ) : null}
    </>
  );

  return (
    <>
      <Atmosphere />
      <GameShell center={center} />

      {playthrough?.status === "solved" || playthrough?.status === "failed" ? (
        <EndingOverlay
          status={playthrough.status}
          ending={playthrough.ending}
          resolution={playthrough.resolution}
        />
      ) : null}
    </>
  );
}
