"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

type LogItem =
  | { kind: "narration"; text: string }
  | { kind: "you"; text: string }
  | { kind: "npc"; name: string; text: string }
  | { kind: "system"; text: string };

type Playthrough = {
  id: string;
  caseId: string;
  status: string;
  locationId: string;
  evidenceIds: string[];
  turnCount: number;
  phaseId?: string;
  endingId?: string;
  time?: { slotId: string; minutesFromStart: number };
  environment?: {
    weather?: string;
    light?: string;
    crowd?: string;
    ambient?: string;
  };
};

export default function PlaythroughPage() {
  const params = useParams();
  const id = String(params.id);
  const [locationName, setLocationName] = useState("");
  const [playthrough, setPlaythrough] = useState<Playthrough | null>(null);
  const [log, setLog] = useState<LogItem[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [narratorMode, setNarratorMode] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`${API}/v1/playthroughs/${id}`);
      if (!res.ok) {
        setError("Playthrough not found");
        return;
      }
      const data = await res.json();
      if (cancelled) return;
      setPlaythrough(data.playthrough);
      setLocationName(data.locationName ?? data.playthrough.locationId);
      const items: LogItem[] = [];
      const opening =
        sessionStorage.getItem(`mystery:opening:${id}`) ??
        data.openingNarration ??
        "";
      if (opening) {
        items.push({ kind: "narration", text: opening });
      }
      for (const t of data.turns ?? []) {
        items.push({ kind: "you", text: t.playerInput });
        items.push({ kind: "narration", text: t.narration });
        for (const d of t.dialogue ?? []) {
          items.push({
            kind: "npc",
            name: d.characterName ?? d.characterId,
            text: d.text,
          });
        }
        if (t.evidenceAdded?.length) {
          items.push({
            kind: "system",
            text: `Evidence added: ${t.evidenceAdded.join(", ")}`,
          });
        }
      }
      setLog(items);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || busy || !playthrough) return;
    setBusy(true);
    setError(null);
    setInput("");
    setLog((prev) => [...prev, { kind: "you", text }]);
    try {
      const res = await fetch(`${API}/v1/playthroughs/${id}/turns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? `API ${res.status}`);
      }
      setPlaythrough(data.playthrough);
      setLocationName(data.locationName ?? data.playthrough.locationId);
      if (data._debug?.model) setNarratorMode(data._debug.model);
      setLog((prev) => {
        const next: LogItem[] = [
          ...prev,
          { kind: "narration", text: data.narration },
        ];
        for (const d of data.dialogue ?? []) {
          next.push({
            kind: "npc",
            name: d.characterName ?? d.characterId,
            text: d.text,
          });
        }
        if (data.evidenceAdded?.length) {
          next.push({
            kind: "system",
            text: `Evidence added: ${data.evidenceAdded.join(", ")}`,
          });
        }
        if (data.justHappened?.length) {
          for (const j of data.justHappened) {
            if (j.id?.startsWith("pulse_") || j.id === "ending" || j.id === "midnight_strikes" || j.summary?.includes("Phase")) {
              next.push({
                kind: "system",
                text: j.narrationHints ?? j.summary,
              });
            }
          }
        }
        if (data.playthrough?.status === "solved") {
          next.push({
            kind: "system",
            text: "Case closed.",
          });
        }
        if (data.playthrough?.status === "failed") {
          next.push({
            kind: "system",
            text: "Case closed — the accusation did not hold.",
          });
        }
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Turn failed");
    } finally {
      setBusy(false);
    }
  }, [busy, id, input, playthrough]);

  if (error && !playthrough) {
    return (
      <main style={{ padding: "2rem" }}>
        <p style={{ color: "#ff8a7a" }}>{error}</p>
      </main>
    );
  }

  return (
    <main
      style={{
        maxWidth: 720,
        margin: "0 auto",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        padding: "1rem",
      }}
    >
      <header
        style={{
          borderBottom: "1px solid #2a3a4a",
          paddingBottom: "0.75rem",
          marginBottom: "1rem",
        }}
      >
        <div style={{ fontSize: 12, letterSpacing: "0.08em", color: "#9aafc4" }}>
          THE BLACKWOOD INHERITANCE
        </div>
        <div>
          <span style={{ color: "#d4b56a", fontSize: 12, marginRight: 8 }}>
            LOCATION
          </span>
          {locationName}
        </div>
        {playthrough ? (
          <div style={{ fontSize: 13, color: "#9aafc4" }}>
            Evidence:{" "}
            {playthrough.evidenceIds.length
              ? playthrough.evidenceIds.join(", ")
              : "none yet"}{" "}
            · Turns: {playthrough.turnCount} · {playthrough.status}
            {playthrough.phaseId ? ` · phase: ${playthrough.phaseId}` : ""}
            {playthrough.time?.slotId
              ? ` · time: ${playthrough.time.slotId}`
              : ""}
            {playthrough.environment?.weather
              ? ` · ${playthrough.environment.weather}`
              : ""}
          </div>
        ) : null}
      </header>

      <div style={{ flex: 1, overflowY: "auto", marginBottom: "1rem" }}>
        {log.map((item, i) => (
          <div
            key={i}
            style={{
              marginBottom: "0.85rem",
              color:
                item.kind === "you"
                  ? "#f0c0c0"
                  : item.kind === "npc"
                    ? "#e6eef6"
                    : item.kind === "system"
                      ? "#d4b56a"
                      : "#c5d0de",
              lineHeight: 1.55,
            }}
          >
            {item.kind === "you" ? (
              <strong style={{ display: "block", fontSize: 11, opacity: 0.8 }}>
                YOU
              </strong>
            ) : null}
            {item.kind === "npc" ? (
              <strong
                style={{
                  display: "block",
                  fontSize: 11,
                  opacity: 0.8,
                  color: "#d4b56a",
                }}
              >
                {item.name.toUpperCase()}
              </strong>
            ) : null}
            {item.kind === "npc" ? item.text : item.text}
          </div>
        ))}
      </div>

      {error ? <p style={{ color: "#ff8a7a" }}>{error}</p> : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        style={{ display: "flex", gap: 8 }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type what you say or do…"
          disabled={busy || playthrough?.status !== "active"}
          style={{
            flex: 1,
            padding: "0.75rem 1rem",
            background: "#121a24",
            border: "1px solid #2a3a4a",
            color: "#e6eef6",
            borderRadius: 4,
          }}
        />
        <button
          type="submit"
          disabled={busy || !input.trim() || playthrough?.status !== "active"}
          style={{
            background: "#b83a3a",
            color: "#fff",
            border: "none",
            padding: "0 1.25rem",
            borderRadius: 4,
            fontWeight: 600,
          }}
        >
          {busy ? "…" : "Send"}
        </button>
      </form>
      <p style={{ fontSize: 12, color: "#5c6b80", marginTop: 8 }}>
        Free text · engine-validated state
        {narratorMode ? ` · narrator: ${narratorMode}` : ""}
      </p>
    </main>
  );
}
