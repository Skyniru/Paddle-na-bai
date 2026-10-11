"use client";
import { useEffect, useState } from "react";
import { Flag, Check } from "lucide-react";
import type { Court, Match, Player } from "@/types";
import { assignMatch, extendReservation } from "@/lib/db";
import { courtStatus, venueTime } from "@/lib/reservations";
import { Avatar } from "@/components/players/PlayerCard";
export default function CourtCard({
  court,
  match,
  players,
  onResult,
}: {
  court: Court;
  match?: Match;
  players: Player[];
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
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [busy, setBusy] = useState(false);
  const live = match?.status === "playing";
  async function finish(w: "A" | "B") {
    if (!match) return;
    setBusy(true);
    try {
      await onResult(
        match.id,
        w,
        a === "" ? undefined : Number(a),
        b === "" ? undefined : Number(b),
      );
    } finally {
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
        <span className={live ? "pill lime" : "pill"}>
          {live
            ? "● Playing"
            : match?.status === "completed"
              ? "Completed"
              : "Ready to play"}
        </span>
      </div>
      <div className="court-controls">
        <span className="pill">{courtStatus(court, now, !!live)}</span>
        {court.reservationStart !== undefined &&
          court.reservationEnd !== undefined && (
            <p>
              {venueTime(court.reservationStart)} ?{" "}
              {venueTime(court.reservationEnd)} ?{" "}
              {Math.max(0, Math.ceil((court.reservationEnd - now) / 60000))} min
              remaining
            </p>
          )}
        <button
          className="text-button"
          onClick={async () => {
            try {
              await extendReservation(
                court.id,
                Math.max(now, court.reservationEnd ?? now) + 1800000,
              );
              setError("");
            } catch (e) {
              setError(e instanceof Error ? e.message : "Could not extend.");
            }
          }}
        >
          Extend reservation 30 min
        </button>
        {error && <p role="alert">{error}</p>}
      </div>
      {!live && (
        <>
          <button className="text-button" onClick={() => setManual(!manual)}>
            Manual assignment
          </button>
          {manual && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
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
                  setError(
                    e instanceof Error ? e.message : "Could not assign.",
                  );
                }
              }}
            >
              <p>First two players: Team A. Last two: Team B.</p>
              {[0, 1, 2, 3].map((i) => (
                <label key={i}>
                  Player {i + 1}
                  <select name="assigned" required defaultValue="">
                    <option value="" disabled>
                      Select player
                    </option>
                    {players.map((p) => (
                      <option value={p.id} key={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              <button className="primary">Assign match</button>
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
                    onChange={(e) => setA(e.target.value)}
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
                    onChange={(e) => setB(e.target.value)}
                  />
                </label>
              </div>
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
            <p className="result">
              <Check size={16} />
              Team {match.winner} won{" "}
              {match.scoreA !== undefined
                ? match.scoreA + " – " + match.scoreB
                : ""}
            </p>
          )}
        </>
      ) : (
        <div className="court-empty">
          <span>＋</span>
          <strong>A fresh game awaits</strong>
          <p>Generate a round to fill this court.</p>
        </div>
      )}
    </article>
  );
}
