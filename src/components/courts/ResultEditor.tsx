"use client";
import { useRef, useState } from "react";
import type { Match } from "@/types";
import { correctMatchResult, undoResultCorrection } from "@/lib/db";
import { storageError } from "@/lib/storage";

export default function ResultEditor({ match }: { match: Match }) {
  const [editing, setEditing] = useState(false);
  const [editingVersion, setEditingVersion] = useState(match.updatedAt);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const latest = match.resultHistory?.at(-1);
  async function run(fn: () => Promise<unknown>, success: string) {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setMessage("");
    try {
      await fn();
      setEditing(false);
      setMessage(success);
    } catch (error) {
      setMessage(storageError(error));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="result-editor">
      <button
        className="text-button"
        disabled={busy}
        onClick={() => {
          setEditing(!editing);
          setEditingVersion(match.updatedAt);
          setMessage("");
        }}
      >
        {editing ? "Cancel correction" : "Correct Result"}
      </button>
      {latest?.kind === "correction" && (
        <button
          className="text-button"
          disabled={busy}
          onClick={() =>
            run(
              () => undoResultCorrection(match.id, latest.id),
              "Correction undone. Results updated.",
            )
          }
        >
          Undo correction
        </button>
      )}
      {editing && (
        <form
          key={match.id}
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const value = (name: string) =>
              form.get(name) === "" ? undefined : Number(form.get(name));
            // The hidden timestamp belongs to the form that was opened, not a later live update.
            void run(
              () =>
                correctMatchResult(
                  match.id,
                  {
                    winner: form.get("winner") as "A" | "B",
                    scoreA: value("scoreA"),
                    scoreB: value("scoreB"),
                  },
                  Number(form.get("version")),
                ),
              "Result corrected. Standings updated.",
            );
          }}
        >
          <input type="hidden" name="version" value={editingVersion} />
          <label>
            Winning team
            <select name="winner" defaultValue={match.winner}>
              <option value="A">Team A</option>
              <option value="B">Team B</option>
            </select>
          </label>
          <div className="form-row">
            <label>
              Corrected Team A score
              <input
                name="scoreA"
                type="number"
                min="0"
                step="1"
                defaultValue={match.scoreA ?? ""}
              />
            </label>
            <label>
              Corrected Team B score
              <input
                name="scoreB"
                type="number"
                min="0"
                step="1"
                defaultValue={match.scoreB ?? ""}
              />
            </label>
          </div>
          <p className="muted">
            Scores are optional. This updates the existing match.
          </p>
          <button className="primary" disabled={busy}>
            Save correction
          </button>
        </form>
      )}
      {message && <p role="status">{message}</p>}
    </div>
  );
}
