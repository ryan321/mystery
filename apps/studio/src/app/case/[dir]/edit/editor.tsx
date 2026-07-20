"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type ValidateResult = { valid: boolean; errors: string[] };

export function Editor({
  dir,
  initialText,
  initialErrors,
}: {
  dir: string;
  initialText: string;
  initialErrors: string[];
}) {
  const router = useRouter();
  const [text, setText] = useState(initialText);
  const [errors, setErrors] = useState<string[]>(initialErrors);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Live validation, debounced.
  useEffect(() => {
    if (!dirty) return;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      const res = await fetch("/api/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const body = (await res.json()) as ValidateResult;
      setErrors(body.errors);
    }, 500);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [text, dirty]);

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/cases/${encodeURIComponent(dir)}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) {
      setErrors(body.errors ?? [body.error ?? "save failed"]);
      return;
    }
    setErrors([]);
    setDirty(false);
    setSavedAt(new Date().toLocaleTimeString());
    router.refresh();
  }

  function format() {
    try {
      setText(JSON.stringify(JSON.parse(text), null, 2) + "\n");
      setDirty(true);
    } catch {
      setErrors(["not parseable JSON — cannot format"]);
    }
  }

  const valid = errors.length === 0;

  return (
    <>
      <div className="toolbar">
        <button className="btn" onClick={save} disabled={!valid || saving || !dirty}>
          {saving ? "Saving…" : "Save to disk"}
        </button>
        <button className="btn ghost" onClick={format}>
          Format
        </button>
        {valid ? (
          <span className="status-ok">
            ✓ valid MysteryDefinition
            {savedAt ? ` · saved ${savedAt}` : ""}
            {dirty ? " · unsaved changes" : ""}
          </span>
        ) : (
          <span className="status-err">{errors.length} problem{errors.length === 1 ? "" : "s"}</span>
        )}
      </div>
      {!valid && (
        <div className="panel" style={{ marginBottom: 12 }}>
          <div className="status-err">{errors.slice(0, 12).join("\n")}</div>
        </div>
      )}
      <textarea
        className="editor"
        value={text}
        spellCheck={false}
        onChange={(e) => {
          setText(e.target.value);
          setDirty(true);
        }}
      />
      <p className="subtitle" style={{ marginTop: 8 }}>
        Writes content/cases/{dir}/definition.json — the dev API auto-imports
        it on restart; the running game picks it up as a new bundle version.
      </p>
    </>
  );
}
