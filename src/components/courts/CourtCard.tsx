"use client";
import { storageError } from "@/lib/storage";
import { useEffect, useRef, useState } from "react";
import { Flag, Check, Clock } from "lucide-react";
import { matchElapsed } from "@/lib/match-time";
import type { Court, Match, Player } from "@/types";
import { assignMatch, saveScoreDraft } from "@/lib/db";
import { courtStatus } from "@/lib/reservations";
import ResultEditor from "./ResultEditor";
import { Avatar } from "@/components/players/PlayerCard";
export default function CourtCard({
  court,
  match,
  players,
  onResult,
  eligiblePlayers,
  canAssign = false,
}: {
  court: Court;
  match?: Match;
  players: Player[];
  eligiblePlayers: Player[];
  canAssign?: boolean;
  onResult: (
    id: string,
    winner: "A" | "B",
    a?: number,
    b?: number,
  ) => Promise<void>;
}) {
  const [manual, setManual] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState("");
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const [a, setA] = useState(match?.scoreDraft?.a ?? "");
  const [b, setB] = useState(match?.scoreDraft?.b ?? "");
  const submission = useRef(false);
  const [assignment, setAssignment] = useState(["", "", "", ""]);
  const draftWrites = useRef<Promise<void>>(Promise.resolve());
  const [draftStatus, setDraftStatus] = useState("");
  function draft(team: "a" | "b", value: string) {
    if (!match || !/^\d*$/.test(value)) return;
    if (team === "a") setA(value);
    else setB(value);
    setDraftStatus("Saving score...");
    draftWrites.current = draftWrites.current
      .then(() => saveScoreDraft(match.id, { [team]: value }))
      .then(() => setDraftStatus("Score saved on this device."))
      .catch((error) => {
        setError(storageError(error));
        setDraftStatus("Score could not be saved. Try entering it again.");
      });
  }
  const [busy, setBusy] = useState(false);
  const live = match?.status === "playing";
  async function finish(w: "A" | "B") {
    if (!match || submission.current) return;
    submission.current = true;
    setBusy(true);
    try {
      await draftWrites.current;
      await onResult(
        match.id,
        w,
        a === "" ? undefined : Number(a),
        b === "" ? undefined : Number(b),
      );
    } finally {
      submission.current = false;
      setBusy(false);
    }
  }
  return (
    <article className="court-card">
      <div className="card-top">
        <h3>
          <span className="court-number">
            {String(court.number).padStart(2, "0")}
          </span>
          Court {court.number}
        </h3>
        <div className="court-match-status">
          <span className={live ? "pill lime" : "pill"}>
            {live
              ? "● Playing"
              : match?.status === "completed"
                ? "Completed"
                : courtStatus(court, now)}
          </span>
          {live && match && (
            <span
              className="court-match-timer"
              aria-label={`Match elapsed time ${matchElapsed(match, now)}`}
            >
              <Clock size={14} aria-hidden="true" />
              {matchElapsed(match, now)}
            </span>
          )}
        </div>
      </div>
      {error && <p role="alert">{error}</p>}
      {!live && canAssign && (
        <>
          <button className="text-button" onClick={() => setManual(!manual)}>
            Manual assignment
          </button>
          {manual && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (submission.current) return;
                submission.current = true;
                setBusy(true);
                const f = new FormData(e.currentTarget);
                try {
                  await assignMatch(
                    court.sessionId,
                    court.id,
                    f.getAll("assigned").map(String),
                  );
                  setManual(false);
                  setError("");
                } catch (e) {
                  setError(storageError(e));
                } finally {
                  submission.current = false;
                  setBusy(false);
                }
              }}
            >
              <p>First two players: Team A. Last two: Team B.</p>
              {[0, 1, 2, 3].map((i) => (
                <label key={i}>
                  Player {i + 1}
                  <select
                    name="assigned"
                    required
                    value={assignment[i]}
                    onChange={(event) =>
                      setAssignment((values) =>
                        values.map((value, index) =>
                          index === i ? event.target.value : value,
                        ),
                      )
                    }
                  >
                    <option value="" disabled>
                      Select player
                    </option>
                    {eligiblePlayers
                      .filter(
                        (p) =>
                          !assignment.some(
                            (id, index) => index !== i && id === p.id,
                          ),
                      )
                      .map((p) => (
                        <option value={p.id} key={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                </label>
              ))}
              <p className="muted">Choose four different checked-in players.</p>
              <button
                className="primary"
                disabled={
                  busy ||
                  assignment.some(
                    (id) => !eligiblePlayers.some((p) => p.id === id),
                  ) ||
                  new Set(assignment).size !== 4
                }
              >
                Assign match
              </button>
            </form>
          )}
        </>
      )}
      {match && match.status !== "cancelled" ? (
        <>
          <div className="court-field">
            {(["A", "B"] as const).map((team, i) => (
              <div className="team" key={team}>
                <small>
                  TEAM {team}
                  {match.winner === team ? " · WINNER" : ""}
                </small>
                {(i ? match.teamB : match.teamA).map((id) => {
                  const p = players.find((p) => p.id === id);
                  return (
                    <div key={id}>
                      <Avatar player={p} />
                      <strong>{p?.name ?? "Former player"}</strong>
                    </div>
                  );
                })}
              </div>
            ))}
            <span className="vs">VS</span>
            <div className="court-line" />
          </div>
          {live ? (
            <div className="court-controls">
              <div className="scores">
                <label>
                  Team A score
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="—"
                    value={a}
                    onChange={(e) => draft("a", e.target.value)}
                  />
                </label>
                <span>:</span>
                <label>
                  Team B score
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="—"
                    value={b}
                    onChange={(e) => draft("b", e.target.value)}
                  />
                </label>
              </div>
              <p className="score-save-status" role="status">
                {draftStatus}
              </p>
              <small className="muted">
                Optional scores · Select the winning team
              </small>
              <div className="two-buttons">
                <button
                  disabled={busy}
                  className="secondary"
                  onClick={() => finish("A")}
                >
                  <Flag size={14} />
                  Team A wins
                </button>
                <button
                  disabled={busy}
                  className="secondary"
                  onClick={() => finish("B")}
                >
                  <Flag size={14} />
                  Team B wins
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="result">
                <Check size={16} />
                Team {match.winner} won{" "}
                {match.scoreA !== undefined
                  ? match.scoreA + " – " + match.scoreB
                  : ""}
              </p>
              {match.endedAt !== undefined && (
                <p className="muted">Duration: {matchElapsed(match)}</p>
              )}
              <ResultEditor match={match} />
            </>
          )}
        </>
      ) : (
        <div className="court-empty">
          <span>＋</span>
          <strong>A fresh game awaits</strong>
          <p>Waiting for four ready players.</p>
        </div>
      )}
    </article>
  );
}
