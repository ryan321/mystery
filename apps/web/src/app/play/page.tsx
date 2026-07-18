"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

export default function PlayLobbyPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function startCase() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/v1/playthroughs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: "blackwood-inheritance" }),
      });
      if (!res.ok) {
        throw new Error(`API ${res.status}`);
      }
      const data = (await res.json()) as {
        playthrough: { id: string };
        openingNarration?: string;
      };
      sessionStorage.setItem(
        `mystery:opening:${data.playthrough.id}`,
        data.openingNarration ?? ""
      );
      router.push(`/play/${data.playthrough.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start");
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 640, margin: "3rem auto", padding: "0 1.25rem" }}>
      <h1>Case files</h1>
      <p style={{ color: "#9aafc4" }}>
        Free case: <strong>The Blackwood Inheritance</strong>
      </p>
      <button
        type="button"
        onClick={startCase}
        disabled={loading}
        style={{
          background: "#b83a3a",
          color: "#fff",
          border: "none",
          padding: "0.75rem 1.25rem",
          borderRadius: 4,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        {loading ? "Starting…" : "Play free case"}
      </button>
      {error ? (
        <p style={{ color: "#ff8a7a" }}>
          {error}. Is the API running on {API}?
        </p>
      ) : null}
    </main>
  );
}
