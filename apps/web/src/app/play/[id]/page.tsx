"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

type LogItem =
  | { kind: "narration"; text: string }
  | { kind: "you"; text: string }
  | { kind: "system"; text: string };

type Playthrough = {
  id: string;
  caseId: string;
  status: string;
  locationId: string;
  evidenceIds: string[];
  turnCount: number;
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
      const opening =
        sessionStorage.getItem(`mystery:opening:${id}`) ??
        data.openingNarration ??
        "";
      if (opening) {
        setLog([{ kind: "narration", text: opening }]);
      }
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
      setLog((prev) => {
        const next: LogItem[] = [
          ...prev,
          { kind: "narration", text: data.narration },
        ];
        if (data.evidenceAdded?.length) {
          next.push({
            kind: "system",
            text: `Evidence added: ${data.evidenceAdded.join(", ")}`,
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
            {item.text}
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
          disabled={busy || !input.trim()}
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
        Dev slice: mock narrator until OpenRouter is wired. Engine still
        validates state patches.
      </p>
    </main>
  );
}
