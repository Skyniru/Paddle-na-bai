"use client";
import { useState } from "react";
import { Flag, Check } from "lucide-react";
import type { Court, Match, Player } from "@/types";
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
