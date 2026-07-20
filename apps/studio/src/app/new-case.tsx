"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function NewCaseButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function create() {
    const id = prompt(
      "New mystery id (kebab-case, becomes the folder name):"
    )?.trim();
    if (!id) return;
    setBusy(true);
    const res = await fetch("/api/cases", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setBusy(false);
    const body = await res.json();
    if (!res.ok) {
      alert(body.error ?? "failed");
      return;
    }
    router.push(`/case/${body.dir}/edit`);
    router.refresh();
  }

  return (
    <button className="btn" onClick={create} disabled={busy}>
      + New mystery
    </button>
  );
}
