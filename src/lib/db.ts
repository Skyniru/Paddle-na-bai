import Dexie, { type EntityTable } from "dexie";
import type { Player, Session, Court, Match, Mode } from "@/types";
import { id } from "./utils";
import { generateTeams } from "./matchmaking";
export const db = new Dexie("paddle-na-bai") as Dexie & {
  players: EntityTable<Player, "id">;
  sessions: EntityTable<Session, "id">;
  courts: EntityTable<Court, "id">;
  matches: EntityTable<Match, "id">;
};
db.version(1).stores({
  players: "id,status,updatedAt",
  sessions: "id,status,updatedAt",
  courts: "id,sessionId",
  matches: "id,sessionId,courtId,status,updatedAt",
});
db.version(2).stores({ sessions: "id,status,createdAt,updatedAt" });
export const base = () => ({
  id: id(),
  createdAt: Date.now(),
  updatedAt: Date.now(),
});
export async function startSession(sessionId: string) {
  await db.transaction("rw", db.sessions, async () => {
    const session = await db.sessions.get(sessionId);
    if (session?.status !== "draft")
      throw Error("Only a draft session can be started.");
    await db.sessions.update(sessionId, {
      status: "active",
      startedAt: Date.now(),
      updatedAt: Date.now(),
    });
  });
}
export async function createSession(
  data: Pick<
    Session,
    "name" | "venue" | "courtCount" | "playerIds" | "duration"
  >,
) {
  if (!data.name.trim() || !data.venue.trim())
    throw Error("Enter a session name and venue.");
  if (
    !Number.isInteger(data.courtCount) ||
    data.courtCount < 1 ||
    data.courtCount > 12
  )
    throw Error("Choose between 1 and 12 courts.");
  if (new Set(data.playerIds).size < 4)
    throw Error("Select at least four players.");
  if (
    data.duration !== undefined &&
    (!Number.isFinite(data.duration) || data.duration < 1)
  )
    throw Error("Duration must be a positive number of minutes.");
  return db.transaction("rw", db.sessions, db.courts, db.players, async () => {
    if (await db.sessions.where("status").anyOf("draft", "active").count())
      throw Error("Finish your current session first.");
    const players = await db.players.bulkGet(data.playerIds);
    if (players.some((p) => !p))
      throw Error("A selected player no longer exists.");
    const session: Session = {
      ...base(),
      ...data,
      name: data.name.trim(),
      venue: data.venue.trim(),
      status: "draft",
    };
    await db.sessions.add(session);
    await db.courts.bulkAdd(
      Array.from({ length: data.courtCount }, (_, i) => ({
        ...base(),
        sessionId: session.id,
        number: i + 1,
      })),
    );
    return session.id;
  });
}
export async function generateRound(sessionId: string, mode: Mode) {
  return db.transaction(
    "rw",
    db.sessions,
    db.courts,
    db.players,
    db.matches,
    async () => {
      const session = await db.sessions.get(sessionId);
      if (session?.status !== "active") throw Error("Start the session first.");
      const matches = await db.matches
        .where("sessionId")
        .equals(sessionId)
        .toArray();
      const courts = await db.courts
        .where("sessionId")
        .equals(sessionId)
        .sortBy("number");
      const free = courts.filter(
        (c) =>
          !matches.some((m) => m.courtId === c.id && m.status === "playing"),
      );
      if (!free.length) throw Error("All courts have a match in progress.");
      const players = (await db.players.bulkGet(session.playerIds)).filter(
        (p): p is Player => !!p,
      );
      const groups = generateTeams(
        players,
        matches,
        mode,
        free.length,
        free.map((c) => c.id),
      );
      if (!groups.length)
        throw Error("At least four active, available players are needed.");
      await db.matches.bulkAdd(
        groups.map((g, i) => ({
          ...base(),
          ...g,
          sessionId,
          courtId: free[i].id,
          status: "playing" as const,
        })),
      );
      return groups.length;
    },
  );
}
export async function finishMatch(
  matchId: string,
  winner: "A" | "B",
  scoreA?: number,
  scoreB?: number,
) {
  await db.transaction("rw", db.matches, async () => {
    const m = await db.matches.get(matchId);
    if (!m || m.status !== "playing")
      throw Error("This match has already been finalized.");
    if ((scoreA === undefined) !== (scoreB === undefined))
      throw Error("Enter both scores or leave both blank.");
    if (scoreA !== undefined && scoreB !== undefined) {
      if (
        !Number.isInteger(scoreA) ||
        !Number.isInteger(scoreB) ||
        scoreA < 0 ||
        scoreB < 0
      )
        throw Error("Scores must be non-negative whole numbers.");
      if (winner === "A" ? scoreA <= scoreB : scoreB <= scoreA)
        throw Error("The winning team must have the higher score.");
    }
    await db.matches.update(matchId, {
      status: "completed",
      winner,
      scoreA,
      scoreB,
      endedAt: Date.now(),
      updatedAt: Date.now(),
    });
  });
}
export async function endSession(sessionId: string) {
  await db.transaction("rw", db.sessions, db.matches, async () => {
    await db.matches
      .where("sessionId")
      .equals(sessionId)
      .filter((m) => m.status === "playing")
      .modify({
        status: "cancelled",
        endedAt: Date.now(),
        updatedAt: Date.now(),
      });
    await db.sessions.update(sessionId, {
      status: "completed",
      endedAt: Date.now(),
      updatedAt: Date.now(),
    });
  });
}
export async function removePlayer(playerId: string) {
  await db.transaction("rw", db.players, db.sessions, db.matches, async () => {
    if (
      (await db.matches
        .filter((m) => [...m.teamA, ...m.teamB].includes(playerId))
        .count()) ||
      (await db.sessions.filter((s) => s.playerIds.includes(playerId)).count())
    )
      throw Error(
        "This player has session records. Mark them unavailable to preserve history.",
      );
    await db.players.delete(playerId);
  });
}
