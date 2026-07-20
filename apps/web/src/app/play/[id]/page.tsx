"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Atmosphere from "../../../components/Atmosphere";
import GameShell, { Panel } from "../../../components/GameShell";
import StatusBar from "../../../components/StatusBar";
import Log, { type LogItem } from "../../../components/Log";
import Composer from "../../../components/Composer";
import DenouementBanner from "../../../components/DenouementBanner";
import EndingOverlay from "../../../components/EndingOverlay";
import ProgressToast from "../../../components/ProgressToast";
import PlayProgressSettings from "../../../components/PlayProgressSettings";
import SideDrawer from "../../../components/SideDrawer";
import ScenePanel from "../../../components/ScenePanel";
import PresenceStrip from "../../../components/PresenceStrip";
import MapSketch from "../../../components/MapSketch";
import CastList from "../../../components/CastList";
import InventoryPanel from "../../../components/InventoryPanel";
import NotebookPanel from "../../../components/NotebookPanel";
import DossierContent from "../../../components/DossierContent";
import {
  addNote,
  assetUrl,
  deleteNote,
  getPlaythrough,
  sendTurn,
  updateNote,
} from "../../../lib/api";
import { markCompleted } from "../../../lib/playState";
import {
  defaultPlayProgressMode,
  effectiveProgressMode,
  getPlayProgressPref,
  setPlayProgressPref,
  type ProgressUiMode,
} from "../../../lib/progressPrefs";
import type {
  MapLocation,
  MysteryBriefing,
  MysteryProgress,
  NotebookEntry,
  PlayerView,
  PlaythroughState,
  ProgressPulse,
  TurnLogEntry,
} from "../../../lib/types";
import styles from "./page.module.css";

type DrawerKind = "room" | "dossier" | "map" | "cast" | "inventory" | "notebook";

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
    items.push({ id: "opening", kind: "narration", text: opening });
  }
  // Slim start card only (full dossier is on the mystery detail page).
  // Opening narration already sets scene + who's here; don't restate it.
  const hasBriefing =
    briefing &&
    (briefing.theMystery || briefing.objective || briefing.displayName);
  if (hasBriefing && !(turns && turns.length > 0)) {
    items.push({
      id: "briefing",
      kind: "briefing",
      theMystery: briefing.theMystery,
      objective: briefing.objective,
      displayName: briefing.displayName,
    });
  }
  (turns ?? []).forEach((t, ti) => {
    items.push({ id: `t${ti}-you`, kind: "you", text: t.playerInput });
    items.push({ id: `t${ti}-n`, kind: "narration", text: t.narration });
    (t.dialogue ?? []).forEach((d, di) => {
      items.push({
        id: `t${ti}-d${di}`,
        kind: "npc",
        name: d.characterName ?? d.characterId,
        text: d.text,
        avatarUrl: portraitFor(playthrough, d.characterId),
      });
    });
  });
  return items;
}

const SURFACE_BUTTONS: {
  kind: DrawerKind;
  label: string;
  icon: React.ReactNode;
  /** Shown only when the left rail is hidden (≤860px) — the rail already
   *  presents this surface on desktop. */
  mobileOnly?: boolean;
}[] = [
  {
    kind: "room",
    label: "Current room",
    mobileOnly: true,
    icon: (
      <>
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
        <circle cx="12" cy="10" r="3" />
      </>
    ),
  },
  {
    kind: "dossier",
    label: "Dossier",
    icon: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <path d="M9 13h6M9 17h6" />
      </>
    ),
  },
  {
    kind: "map",
    label: "Map",
    icon: (
      <>
        <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" />
        <path d="M9 4v14M15 6v14" />
      </>
    ),
  },
  {
    kind: "cast",
    label: "Cast",
    icon: (
      <>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
  },
  {
    kind: "inventory",
    label: "Your belongings",
    icon: (
      <>
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
      </>
    ),
  },
  {
    kind: "notebook",
    label: "Notebook",
    icon: (
      <>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </>
    ),
  },
];

export default function PlaythroughPage() {
  const params = useParams();
  const id = String(params.id);
  const [playthrough, setPlaythrough] = useState<PlaythroughState | null>(null);
  const [playerView, setPlayerView] = useState<PlayerView | null>(null);
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
  const [openDrawer, setOpenDrawer] = useState<DrawerKind | null>(null);
  const [castFocusId, setCastFocusId] = useState<string | undefined>(undefined);

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

  const toggleDrawer = useCallback((kind: DrawerKind) => {
    // Opening cast via the header always lands on the list; only a
    // presence-strip tap deep-links into a profile (it sets castFocusId).
    if (kind === "cast") setCastFocusId(undefined);
    setOpenDrawer((cur) => (cur === kind ? null : kind));
  }, []);

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

  // Escape closes the open surface drawer (scrim click also closes).
  useEffect(() => {
    if (!openDrawer) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenDrawer(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openDrawer]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getPlaythrough(id);
        if (cancelled) return;
        setPlaythrough(data.playthrough);
        if (data.playerView) {
          setPlayerView(data.playerView);
          // The opening package greets a fresh investigation (reopenable).
          if (data.playerView.turnCount === 0) setOpenDrawer("dossier");
        }
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

  const send = useCallback(
    async (text: string) => {
      if (busy || !playthrough) return;
      const ti = playthrough.turnCount;
      setBusy(true);
      setError(null);
      setLog((prev) => [
        ...prev,
        { id: `t${ti}-you`, kind: "you", text },
      ]);
      try {
        const data = await sendTurn(id, text);
        setPlaythrough(data.playthrough);
        if (data.playerView) setPlayerView(data.playerView);
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
        const dialogue = data.dialogue ?? [];
        setLog((prev) => [
          ...prev,
          { id: `t${ti}-n`, kind: "narration", text: data.narration },
          ...dialogue.map((d, di) => ({
            id: `t${ti}-d${di}`,
            kind: "npc" as const,
            name: d.characterName ?? d.characterId,
            text: d.text,
            avatarUrl: portraitFor(data.playthrough, d.characterId),
          })),
        ]);
        if (data.justHappened?.length) {
          for (const j of data.justHappened) {
            // Default-deny: engine status (hold, harm, threat, restraint, assault,
            // force-moves, hazards) is for the AI performer only. Stage it in
            // narration — never as HUD/system chips in the log.
            const jid = j.id ?? "";
            const summary = (j.summary ?? "").trim();
            if (!summary) continue;
            if (
              jid.startsWith("phase") ||
              jid.startsWith("player_") ||
              jid.startsWith("assault_") ||
              jid.startsWith("world_to_player") ||
              jid.startsWith("social_pushback_") ||
              jid.startsWith("misconduct_") ||
              jid.startsWith("hazard_") ||
              jid.startsWith("will_") ||
              jid.startsWith("move_char_") ||
              jid.startsWith("move_obj_") ||
              jid === "moved" ||
              /phase/i.test(summary) ||
              // Safety net: AI/director may put HUD-like control lines in summary
              /\b(held|restrained|unconscious|knocked down|escape actions?|blocked until free|chemical restraint)\b/i.test(
                summary
              )
            ) {
              continue;
            }
            // Rare log-worthy cues only (boundaries, endings, theft).
            const playerFacing =
              jid.startsWith("pulse_") ||
              jid.startsWith("stolen_") ||
              jid.startsWith("item_damaged_") ||
              jid.startsWith("lost_ev_") ||
              jid.startsWith("boundary_") ||
              jid === "safe_haven_compromised" ||
              jid === "ending" ||
              jid === "midnight_strikes" ||
              jid === "denouement_start" ||
              jid === "denouement_end";
            if (playerFacing) {
              setLog((prev) => [
                ...prev,
                {
                  id: `t${ti}-sys-${jid}`,
                  kind: "system",
                  text: summary,
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
    [busy, id, playthrough]
  );

  /** Click a sketched room to walk there — the engine validates the move. */
  const travel = useCallback(
    (loc: MapLocation) => {
      setOpenDrawer(null);
      void send(
        loc.visited
          ? `Return to the ${loc.name}.`
          : `Head to the ${loc.name}.`
      );
    },
    [send]
  );

  const applyNotebook = useCallback((notebook: NotebookEntry[]) => {
    setPlayerView((pv) => (pv ? { ...pv, notebook } : pv));
  }, []);

  const handleAddNote = useCallback(
    async (text: string) => {
      applyNotebook((await addNote(id, text)).notebook);
    },
    [id, applyNotebook]
  );
  const handleUpdateNote = useCallback(
    async (noteId: string, text: string) => {
      applyNotebook((await updateNote(id, noteId, text)).notebook);
    },
    [id, applyNotebook]
  );
  const handleDeleteNote = useCallback(
    async (noteId: string) => {
      applyNotebook((await deleteNote(id, noteId)).notebook);
    },
    [id, applyNotebook]
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

  const presentIds = new Set(
    playerView?.scene.present.map((p) => p.id) ?? []
  );

  const left = playerView ? (
    <>
      <Panel title={playerView.scene.name}>
        <ScenePanel scene={playerView.scene} />
      </Panel>
      <Panel title="In the room">
        <PresenceStrip
          present={playerView.scene.present}
          caseId={playerView.caseId}
          onSelect={(cid) => {
            setCastFocusId(cid);
            setOpenDrawer("cast");
          }}
        />
      </Panel>
    </>
  ) : null;

  const center = (
    <>
      <header className={styles.chrome}>
        <div className={styles.chromeTop}>
          <div className={styles.caseEyebrow}>
            {playerView?.title ?? "Case"}
          </div>
          <div className={styles.chromeActions} ref={settingsRef}>
            {SURFACE_BUTTONS.map(({ kind, label, icon, mobileOnly }) => (
              <button
                key={kind}
                type="button"
                className={`${
                  openDrawer === kind
                    ? `${styles.iconBtn} ${styles.iconBtnActive}`
                    : styles.iconBtn
                }${mobileOnly ? ` ${styles.mobileOnly}` : ""}`}
                onClick={() => toggleDrawer(kind)}
                aria-label={label}
                aria-expanded={openDrawer === kind}
                aria-haspopup="dialog"
                title={label}
              >
                <svg
                  className={styles.iconSvg}
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  {icon}
                </svg>
              </button>
            ))}
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
        <Log items={log} busy={busy} resetKey={id} />
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
      <GameShell left={left} center={center} />

      <SideDrawer
        side="right"
        title={playerView?.scene.name ?? "Current room"}
        open={openDrawer === "room"}
        onClose={() => setOpenDrawer(null)}
      >
        {playerView ? (
          <div className={styles.roomDrawer}>
            <ScenePanel scene={playerView.scene} />
            <h4 className={styles.roomDrawerHeading}>In the room</h4>
            <PresenceStrip
              present={playerView.scene.present}
              caseId={playerView.caseId}
              onSelect={(cid) => {
                setCastFocusId(cid);
                setOpenDrawer("cast");
              }}
            />
          </div>
        ) : null}
      </SideDrawer>

      <SideDrawer
        side="right"
        title="Dossier"
        open={openDrawer === "dossier"}
        onClose={() => setOpenDrawer(null)}
      >
        {playerView ? (
          <DossierContent
            openingPackage={playerView.openingPackage}
            player={playerView.player}
          />
        ) : null}
      </SideDrawer>

      <SideDrawer
        side="right"
        title="Map"
        open={openDrawer === "map"}
        onClose={() => setOpenDrawer(null)}
      >
        {playerView ? (
          <MapSketch
            map={playerView.map}
            disabled={busy || closed}
            onTravel={travel}
          />
        ) : null}
      </SideDrawer>

      <SideDrawer
        side="right"
        title="List of Characters"
        open={openDrawer === "cast"}
        onClose={() => setOpenDrawer(null)}
      >
        {playerView ? (
          <CastList
            cast={playerView.cast}
            caseId={playerView.caseId}
            presentIds={presentIds}
            focusId={castFocusId}
          />
        ) : null}
      </SideDrawer>

      <SideDrawer
        side="right"
        title="Your belongings"
        open={openDrawer === "inventory"}
        onClose={() => setOpenDrawer(null)}
      >
        {playerView ? (
          <InventoryPanel inventory={playerView.inventory} />
        ) : null}
      </SideDrawer>

      <SideDrawer
        side="right"
        title="Notebook"
        open={openDrawer === "notebook"}
        onClose={() => setOpenDrawer(null)}
      >
        {playerView ? (
          <NotebookPanel
            notebook={playerView.notebook}
            disabled={busy}
            onAdd={handleAddNote}
            onUpdate={handleUpdateNote}
            onDelete={handleDeleteNote}
          />
        ) : null}
      </SideDrawer>

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
