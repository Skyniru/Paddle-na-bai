"use client";
import { useState } from "react";
import type {
  Player,
  PlayerGroup,
  Session,
  Match,
  PlayerStatus,
} from "@/types";
import { changeAttendance, updateSessionPlayers } from "@/lib/db";
import { opportunities, lastPlayed } from "@/lib/rotation";
import { isCheckedIn, venueTime, sessionPlayerState } from "@/lib/reservations";
import PlayerPicker from "./PlayerPicker";
import { storageError } from "@/lib/storage";

export default function SessionRoster({
  session,
  players,
  groups,
  matches,
  initialGroupId = "",
}: {
  session: Session;
  players: Player[];
  groups: PlayerGroup[];
  matches: Match[];
  initialGroupId?: string;
}) {
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [adding, setAdding] = useState(!!initialGroupId);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  async function update(
    ids: string[],
    statuses: Record<string, PlayerStatus> = {},
  ) {
    setError("");
    setSaved(false);
    setBusy(true);
    try {
      await updateSessionPlayers(session.id, ids, statuses);
      setSaved(true);
      return true;
    } catch (e) {
      setError(storageError(e));
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function attendance(
    id: string,
    action: "check-in" | "check-out" | "undo-check-out",
  ) {
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      await changeAttendance(session.id, id, action);
      setSaved(true);
    } catch (e) {
      setError(storageError(e));
    } finally {
      setBusy(false);
    }
  }
  const busyIds = new Set(
    matches
      .filter((m) => m.status === "playing")
      .flatMap((m) => [...m.teamA, ...m.teamB]),
  );
  const roster = players
    .filter((p) => session.playerIds.includes(p.id))
    .sort(
      (a, b) =>
        opportunities(a.id, matches) - opportunities(b.id, matches) ||
        lastPlayed(a.id, matches) - lastPlayed(b.id, matches) ||
        a.name.localeCompare(b.name),
    );
  return (
    <section className="roster-section" aria-label="Session playing list">
      <div className="section-heading">
        <div>
          <h2>
            Playing list <span className="count">{roster.length}</span>
          </h2>
          <p>
            Fair rotation gives priority to fewer games, then the longest rest.
            Availability changes apply to this session.
          </p>
        </div>
        <button
          type="button"
          className="secondary"
          disabled={busy || addingPlayer}
          onClick={() => {
            setAdding(!adding);
            setSelected([]);
          }}
        >
          {" "}
          {adding ? "Close player search" : "Add saved players"}
        </button>
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <p role="status">
        {busy
          ? "Saving playing list…"
          : saved
            ? "Playing list saved on device."
            : ""}
      </p>
      {adding && (
        <div className="group-editor">
          <PlayerPicker
            players={players.filter((p) => !session.playerIds.includes(p.id))}
            groups={groups}
            selected={selected}
            onChange={setSelected}
            initialGroupId={initialGroupId}
            onPendingChange={setAddingPlayer}
            disabled={busy}
          />
          <button
            type="button"
            className="primary"
            disabled={busy || addingPlayer || !selected.length}
            onClick={async () => {
              if (await update([...session.playerIds, ...selected])) {
                setAdding(false);
                setSelected([]);
              }
            }}
          >
            Add to playing list
          </button>
        </div>
      )}
      <div className="roster-list">
        {roster.map((p) => (
          <div className="roster-row" key={p.id}>
            <span>
              <strong>{p.name}</strong>
              <small>
                {opportunities(p.id, matches)} games assigned ·{" "}
                {sessionPlayerState(session, p, matches)}
              </small>
            </span>
            <div>
              <span className="pill">
                {sessionPlayerState(session, p, matches)}
              </span>
              <button
                className="secondary"
                disabled={busy || busyIds.has(p.id)}
                onClick={() =>
                  attendance(
                    p.id,
                    isCheckedIn(session, p.id) ? "check-out" : "check-in",
                  )
                }
              >
                {isCheckedIn(session, p.id)
                  ? "Check out"
                  : session.continuous
                    ? "Return to play"
                    : "Check in"}
              </button>
              {session.attendance?.[p.id]?.at(-1)?.action === "check-out" && (
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => attendance(p.id, "undo-check-out")}
                >
                  Undo Check-Out
                </button>
              )}
              <details>
                <summary>Attendance history</summary>
                {session.attendance?.[p.id]?.map((e, i) => (
                  <small key={i}>
                    {e.action === "check-in"
                      ? "Checked in"
                      : e.action === "check-out"
                        ? "Checked out"
                        : "Check-out undone"}{" "}
                    · {venueTime(e.at)}
                  </small>
                ))}
              </details>
            </div>
            <label>
              <span className="sr-only">Availability for {p.name}</span>
              <select
                aria-label={`Availability for ${p.name}`}
                disabled={busy || (!session.continuous && busyIds.has(p.id))}
                value={session.playerStatuses?.[p.id] ?? p.status}
                onChange={(e) =>
                  update(session.playerIds, {
                    [p.id]: e.target.value as PlayerStatus,
                  })
                }
              >
                <option value="active">Ready to play</option>
                <option value="resting">Taking a rest</option>
                <option value="unavailable">Finished for today</option>
              </select>
              {session.continuous && busyIds.has(p.id) && (
                <small className="muted">Applies after this match.</small>
              )}
            </label>
          </div>
        ))}
      </div>
    </section>
  );
}
