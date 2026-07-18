"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Atmosphere from "../../../components/Atmosphere";
import GameShell, { Panel } from "../../../components/GameShell";
import StatusBar from "../../../components/StatusBar";
import Log, { type LogItem } from "../../../components/Log";
import Composer from "../../../components/Composer";
import DenouementBanner from "../../../components/DenouementBanner";
import EndingOverlay from "../../../components/EndingOverlay";
import SideDrawer from "../../../components/SideDrawer";
import EvidencePanel, {
  type EvidenceItem,
} from "../../../components/EvidencePanel";
import { assetUrl, getPlaythrough, sendTurn } from "../../../lib/api";
import type {
  DialogueLine,
  PlaythroughState,
  TurnLogEntry,
} from "../../../lib/types";
import {
  CASE_TITLES,
  EVIDENCE_DESCRIPTIONS,
} from "../../../lib/content";
import styles from "./page.module.css";

type Drawer = "evidence" | null;

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
  playthrough?: PlaythroughState | null
): LogItem[] {
  const items: LogItem[] = [];
  if (opening) {
    items.push({ kind: "narration", text: opening });
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
    if (t.evidenceAdded?.length) {
      items.push({
        kind: "system",
        text: `Evidence added: ${t.evidenceAdded.join(", ")}`,
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
  const [drawer, setDrawer] = useState<Drawer>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getPlaythrough(id);
        if (cancelled) return;
        setPlaythrough(data.playthrough);
        setLocationName(data.locationName ?? data.playthrough.locationId);
        const opening =
          sessionStorage.getItem(`mystery:opening:${id}`) ??
          data.openingNarration ??
          "";
        setLog(buildLog(opening, data.turns, data.playthrough));
      } catch {
        if (!cancelled) setError("Playthrough not found");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

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
        setLog((prev) => [...prev, { kind: "narration", text: data.narration }]);
        appendDialogue(data.dialogue, data.playthrough);
        if (data.evidenceAdded?.length) {
          setLog((prev) => [
            ...prev,
            {
              kind: "system",
              text: `Evidence added: ${data.evidenceAdded.join(", ")}`,
            },
          ]);
        }
        if (data.justHappened?.length) {
          for (const j of data.justHappened) {
            if (
              j.id?.startsWith("pulse_") ||
              j.id === "ending" ||
              j.id === "midnight_strikes" ||
              j.summary?.includes("Phase")
            ) {
              setLog((prev) => [
                ...prev,
                { kind: "system", text: j.narrationHints ?? j.summary },
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

  const evidenceItems = useMemo<EvidenceItem[]>(() => {
    if (!playthrough) return [];
    return playthrough.evidenceIds.map((eid) => ({
      id: eid,
      name:
        EVIDENCE_DESCRIPTIONS[eid]?.name ??
        eid
          .split("-")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" "),
      description: EVIDENCE_DESCRIPTIONS[eid]?.description,
    }));
  }, [playthrough]);

  const closed = playthrough
    ? playthrough.status !== "active" && playthrough.status !== "denouement"
    : true;

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
          <button
            type="button"
            className={styles.linkBtn}
            onClick={() => setDrawer("evidence")}
          >
            Evidence
          </button>
        </div>
        <StatusBar
          locationName={locationName}
          phaseId={playthrough?.phaseId}
          time={playthrough?.time}
          environment={playthrough?.environment}
          playerStatus={playthrough?.playerStatus}
          clocks={playthrough?.clocks}
          turnCount={playthrough?.turnCount ?? 0}
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
    </>
  );

  return (
    <>
      <Atmosphere />
      <GameShell center={center} />

      <nav className={styles.mobileBar} aria-label="Investigation panels">
        <button
          type="button"
          onClick={() => setDrawer("evidence")}
          className={drawer === "evidence" ? styles.mobileBarActive : ""}
        >
          Evidence
        </button>
      </nav>

      <SideDrawer
        side="left"
        title="Evidence"
        open={drawer === "evidence"}
        onClose={() => setDrawer(null)}
      >
        <EvidencePanel items={evidenceItems} />
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
