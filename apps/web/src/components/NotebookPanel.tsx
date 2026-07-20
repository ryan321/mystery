import { useState } from "react";
import type { NotebookEntry } from "../lib/types";
import styles from "./NotebookPanel.module.css";

/**
 * Notebook (PLAYER_SURFACES.md §5.6): auto entries (✦ — the case's own
 * record, immutable) and the player's private scratchpad (✎). Player notes
 * are deliberately inert — never parsed by the engine, never sent to any
 * prompt — so anything written here is safe theorizing space.
 */
export default function NotebookPanel({
  notebook,
  disabled,
  onAdd,
  onUpdate,
  onDelete,
}: {
  notebook: NotebookEntry[];
  /** Turn in flight — note writes pause to avoid clobbering state. */
  disabled?: boolean;
  onAdd: (text: string) => Promise<void>;
  onUpdate: (noteId: string, text: string) => Promise<void>;
  onDelete: (noteId: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const busy = disabled || saving;

  async function run(fn: () => Promise<void>) {
    setSaving(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Note failed");
    } finally {
      setSaving(false);
    }
  }

  async function submitAdd() {
    const text = draft.trim();
    if (!text) return;
    await run(async () => {
      await onAdd(text);
      setDraft("");
    });
  }

  async function submitEdit() {
    if (!editingId) return;
    const text = editDraft.trim();
    if (!text) return;
    await run(async () => {
      await onUpdate(editingId, text);
      setEditingId(null);
    });
  }

  return (
    <div className={styles.wrap}>
      {notebook.length === 0 ? (
        <p className={styles.empty}>
          Nothing noted yet. Jot your own theories below — the game never
          reads them.
        </p>
      ) : (
        <ul className={styles.list}>
          {notebook.map((e) => (
            <li key={e.id} className={styles.entry}>
              <span
                className={e.source === "auto" ? styles.markAuto : styles.markPlayer}
                aria-hidden
              >
                {e.source === "auto" ? "✦" : "✎"}
              </span>
              <div className={styles.entryBody}>
                {editingId === e.id ? (
                  <>
                    <textarea
                      className={styles.textarea}
                      value={editDraft}
                      onChange={(ev) => setEditDraft(ev.target.value)}
                      rows={3}
                      maxLength={2000}
                      disabled={busy}
                      autoFocus
                    />
                    <div className={styles.actions}>
                      <button
                        type="button"
                        className={styles.actionBtn}
                        onClick={submitEdit}
                        disabled={busy || !editDraft.trim()}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className={styles.actionBtn}
                        onClick={() => setEditingId(null)}
                        disabled={busy}
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className={styles.text}>{e.text}</p>
                    {e.source === "player" ? (
                      <div className={styles.actions}>
                        <button
                          type="button"
                          className={styles.actionBtn}
                          onClick={() => {
                            setEditingId(e.id);
                            setEditDraft(e.text);
                          }}
                          disabled={busy}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className={`${styles.actionBtn} ${styles.deleteBtn}`}
                          onClick={() => void run(() => onDelete(e.id))}
                          disabled={busy}
                        >
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.composer}>
        <textarea
          className={styles.textarea}
          placeholder="A private note — the game never reads these…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          maxLength={2000}
          disabled={busy}
        />
        <button
          type="button"
          className={styles.addBtn}
          onClick={submitAdd}
          disabled={busy || !draft.trim()}
        >
          Add note
        </button>
      </div>
      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );
}
