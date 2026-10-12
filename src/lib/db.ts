import { prepareQueue } from "./queue";
import Dexie, { type EntityTable } from "dexie";
import type {
  Player,
  Session,
  Court,
  Match,
  Mode,
  PlayerGroup,
  PlayerStatus,
  MatchResult,
} from "@/types";
import {
  isCheckedIn,
  courtAvailable,
  validateReservation,
} from "./reservations";
import { id } from "./utils";
import { generateTeams } from "./matchmaking";
export const db = new Dexie("paddle-na-bai") as Dexie & {
  players: EntityTable<Player, "id">;
  groups: EntityTable<PlayerGroup, "id">;
  sessions: EntityTable<Session, "id">;
  courts: EntityTable<Court, "id">;
  matches: EntityTable<Match, "id">;
  safety: EntityTable<{ id: string; createdAt: number; payload: string }, "id">;
};
db.version(1).stores({
  players: "id,status,updatedAt",
  sessions: "id,status,updatedAt",
  courts: "id,sessionId",
  matches: "id,sessionId,courtId,status,updatedAt",
});
db.version(2).stores({ sessions: "id,status,createdAt,updatedAt" });
db.version(3).stores({ groups: "id,name,updatedAt" });
db.version(4).stores({ courts: "id,sessionId,reservationEnd" });
// Additive migration: existing records and database identity remain unchanged.
db.version(5).stores({ safety: "id,createdAt" });
export const base = () => ({
  id: id(),
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

export async function addSavedPlayer(name: string): Promise<Player> {
  const clean = name.trim().replace(/\s+/g, " ");
  if (!clean || clean.length > 60)
    throw Error("Enter a player name up to 60 characters.");
  return db.transaction("rw", db.players, async () => {
    const existing = await db.players
      .filter(
        (p) =>
          p.name.trim().replace(/\s+/g, " ").toLocaleLowerCase() ===
          clean.toLocaleLowerCase(),
      )
      .first();
    if (existing) return existing;
    const player: Player = { ...base(), name: clean, status: "active" };
    await db.players.add(player);
    return player;
  });
}
export async function startSession(sessionId: string) {
  await db.transaction(
    "rw",
    db.sessions,
    db.courts,
    db.players,
    db.matches,
    async () => {
      const session = await db.sessions.get(sessionId);
      if (session?.status !== "draft")
        throw Error("Only a draft session can be started.");
      await db.sessions.update(sessionId, {
        status: "active",
        startedAt: Date.now(),
        updatedAt: Date.now(),
      });
      if (session.continuous) await syncContinuousQueue(sessionId);
    },
  );
}
export async function createSession(
  data: Pick<
    Session,
    | "name"
    | "venue"
    | "courtCount"
    | "playerIds"
    | "duration"
    | "continuous"
    | "bannerPhoto"
    | "mode"
  > & { reservations?: { number: number; start: number; end: number }[] },
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
  if (data.reservations) {
    if (
      data.reservations.length !== data.courtCount ||
      new Set(data.reservations.map((r) => r.number)).size !== data.courtCount
    )
      throw Error("Each court needs a unique reservation.");
    for (const r of data.reservations) {
      validateReservation(r.start, r.end);
      if (!Number.isInteger(r.number) || r.number < 1)
        throw Error("Invalid court number.");
    }
  }
  return db.transaction("rw", db.sessions, db.courts, db.players, async () => {
    if (await db.sessions.where("status").anyOf("draft", "active").count())
      throw Error("Finish your current session first.");
    const players = await db.players.bulkGet(data.playerIds);
    if (players.some((p) => !p))
      throw Error("A selected player no longer exists.");
    const session: Session = {
      ...base(),
      ...data,
      playerIds: [...new Set(data.playerIds)],
      playerStatuses: Object.fromEntries(
        players.map((p) => [p!.id, p!.status]),
      ),
      name: data.name.trim(),
      venue: data.venue.trim(),
      status: "draft",
      attendance: data.continuous
        ? Object.fromEntries(
            data.playerIds.map((id) => [
              id,
              [{ action: "check-in" as const, at: Date.now() }],
            ]),
          )
        : {},
      round: 0,
    };
    await db.sessions.add(session);
    await db.courts.bulkAdd(
      Array.from({ length: data.courtCount }, (_, i) => ({
        ...base(),
        sessionId: session.id,
        number: data.reservations?.[i].number ?? i + 1,
        reservationStart: data.reservations?.[i].start,
        reservationEnd: data.reservations?.[i].end,
        reservationHistory: data.reservations
          ? [
              {
                start: data.reservations[i].start,
                end: data.reservations[i].end,
                changedAt: Date.now(),
              },
            ]
          : [],
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
      if (session.continuous) {
        const before = await db.matches
          .where("sessionId")
          .equals(sessionId)
          .filter((m) => m.status === "playing")
          .count();
        await syncContinuousQueue(sessionId, mode);
        const after = await db.matches
          .where("sessionId")
          .equals(sessionId)
          .filter((m) => m.status === "playing")
          .count();
        return after - before;
      }
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
          courtAvailable(c) &&
          !matches.some((m) => m.courtId === c.id && m.status === "playing"),
      );
      if (!free.length)
        throw Error("No court is currently available. Finish a match first.");
      const players = (await db.players.bulkGet(session.playerIds))
        .filter((p): p is Player => !!p)
        .map((p) => ({
          ...p,
          status: isCheckedIn(session, p.id)
            ? (session.playerStatuses?.[p.id] ?? p.status)
            : "unavailable",
        }));
      const groups = generateTeams(
        players,
        matches,
        mode,
        free.length,
        free.map((c) => c.id),
        session,
      );
      if (!groups.length)
        throw Error("At least four active, available players are needed.");
      const roundAt = Date.now();
      await db.matches.bulkAdd(
        groups.map((g, i) => ({
          ...base(),
          ...g,
          createdAt: roundAt,
          eligiblePlayerIds: players
            .filter(
              (p) =>
                p.status === "active" &&
                !matches.some(
                  (m) =>
                    m.status === "playing" &&
                    [...m.teamA, ...m.teamB].includes(p.id),
                ),
            )
            .map((p) => p.id),
          sessionId,
          courtId: free[i].id,
          status: "playing" as const,
        })),
      );
      await db.sessions.update(sessionId, {
        round: (session.round ?? 0) + 1,
        updatedAt: Date.now(),
      });
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
  await db.transaction(
    "rw",
    db.matches,
    db.sessions,
    db.courts,
    db.players,
    async () => {
      const m = await db.matches.get(matchId);
      if (!m || m.status !== "playing")
        throw Error("This match has already been finalized.");
      validateResult(winner, scoreA, scoreB);
      await db.matches.update(matchId, {
        status: "completed",
        winner,
        scoreA,
        scoreB,
        scoreDraft: undefined,
        endedAt: Date.now(),
        updatedAt: Date.now(),
      });
      await syncContinuousQueue(m.sessionId);
    },
  );
}

function validateResult(winner: "A" | "B", scoreA?: number, scoreB?: number) {
  if (!["A", "B"].includes(winner)) throw Error("Choose the winning team.");
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
}

export async function saveScoreDraft(
  matchId: string,
  draft: { a?: string; b?: string },
) {
  await db.transaction("rw", db.matches, async () => {
    const match = await db.matches.get(matchId);
    if (!match || match.status !== "playing") return;
    const scoreDraft = { a: "", b: "", ...match.scoreDraft, ...draft };
    if (
      Object.values(scoreDraft).some(
        (value) => value.length > 12 || (value !== "" && !/^\d+$/.test(value)),
      )
    )
      throw Error("Enter a whole-number score.");
    await db.matches.update(matchId, { scoreDraft, updatedAt: Date.now() });
  });
}

function matchResult(match: Match): MatchResult {
  return { winner: match.winner!, scoreA: match.scoreA, scoreB: match.scoreB };
}

export async function correctMatchResult(
  matchId: string,
  result: MatchResult,
  expectedUpdatedAt: number,
) {
  validateResult(result.winner, result.scoreA, result.scoreB);
  return db.transaction("rw", db.matches, async () => {
    const match = await db.matches.get(matchId);
    if (!match || match.status !== "completed")
      throw Error("Only a finished match can be corrected.");
    if (match.updatedAt !== expectedUpdatedAt)
      throw Error("This result changed. Close the form and try again.");
    const at = Math.max(Date.now(), match.updatedAt + 1);
    const change = {
      id: id(),
      at,
      kind: "correction" as const,
      before: matchResult(match),
      after: result,
    };
    await db.matches.update(matchId, {
      ...result,
      updatedAt: at,
      resultHistory: [...(match.resultHistory ?? []), change],
    });
    return change.id;
  });
}

export async function undoResultCorrection(matchId: string, changeId: string) {
  await db.transaction("rw", db.matches, async () => {
    const match = await db.matches.get(matchId);
    const change = match?.resultHistory?.at(-1);
    if (
      !match ||
      match.status !== "completed" ||
      change?.id !== changeId ||
      change.kind !== "correction"
    )
      throw Error("This correction can no longer be undone.");
    const at = Math.max(Date.now(), match.updatedAt + 1);
    await db.matches.update(matchId, {
      ...change.before,
      updatedAt: at,
      resultHistory: [
        ...match.resultHistory!,
        {
          id: id(),
          at,
          kind: "undo",
          before: matchResult(match),
          after: change.before,
        },
      ],
    });
  });
}
export async function endSession(sessionId: string) {
  await db.transaction("rw", db.sessions, db.matches, async () => {
    const session = await db.sessions.get(sessionId);
    if (!session || session.status === "completed")
      throw Error("This session has ended.");
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
      elapsedDuration: session.startedAt ? Date.now() - session.startedAt : 0,
      queue: session.continuous ? { upNext: [], standby: [] } : session.queue,
      endedAt: Date.now(),
      updatedAt: Date.now(),
    });
  });
}
export async function removePlayer(playerId: string) {
  await db.transaction(
    "rw",
    db.players,
    db.sessions,
    db.matches,
    db.groups,
    async () => {
      if (
        (await db.matches
          .filter((m) => [...m.teamA, ...m.teamB].includes(playerId))
          .count()) ||
        (await db.sessions
          .filter((s) => s.playerIds.includes(playerId))
          .count())
      )
        throw Error(
          "This player has session records. Mark them unavailable to preserve history.",
        );
      await db.groups.toCollection().modify((group) => {
        group.playerIds = group.playerIds.filter((id) => id !== playerId);
      });
      await db.players.delete(playerId);
    },
  );
}

export async function saveGroup(
  name: string,
  playerIds: string[],
  groupId?: string,
  photo?: string | null,
) {
  const clean = name.trim();
  if (!clean || clean.length > 60)
    throw Error("Enter a group name up to 60 characters.");
  const ids = [...new Set(playerIds)];
  return db.transaction("rw", db.groups, db.players, async () => {
    if ((await db.players.bulkGet(ids)).some((p) => !p))
      throw Error("A selected player no longer exists.");
    const existing = groupId ? await db.groups.get(groupId) : undefined;
    if (groupId && !existing) throw Error("This group no longer exists.");
    const group = {
      ...(existing ?? base()),
      name: clean,
      playerIds: ids,
      photo: photo === undefined ? existing?.photo : (photo ?? undefined),
      updatedAt: Date.now(),
    };
    await db.groups.put(group);
    return group.id;
  });
}

export async function updateSessionPlayers(
  sessionId: string,
  playerIds: string[],
  statuses: Record<string, PlayerStatus> = {},
) {
  return db.transaction(
    "rw",
    db.sessions,
    db.players,
    db.matches,
    db.courts,
    async () => {
      const session = await db.sessions.get(sessionId);
      if (!session || session.status === "completed")
        throw Error("This session has ended.");
      const ids = [...new Set(playerIds)];
      if (ids.length < 4)
        throw Error("Keep at least four players in the playing list.");
      const players = await db.players.bulkGet(ids);
      if (players.some((p) => !p))
        throw Error("A selected player no longer exists.");
      if (
        Object.values(statuses).some(
          (s) => !["active", "resting", "unavailable"].includes(s),
        )
      )
        throw Error("Choose a valid player status.");
      const matches = await db.matches
        .where("sessionId")
        .equals(sessionId)
        .toArray();
      const recorded = new Set(
        matches
          .filter((m) => m.status !== "cancelled")
          .flatMap((m) => [...m.teamA, ...m.teamB]),
      );
      if ([...recorded].some((id) => !ids.includes(id)))
        throw Error(
          "Players with matches must stay in the list. Mark them unavailable instead.",
        );
      const busy = new Set(
        matches
          .filter((m) => m.status === "playing")
          .flatMap((m) => [...m.teamA, ...m.teamB]),
      );
      if (
        !session.continuous &&
        [...busy].some((id) => statuses[id] && statuses[id] !== "active")
      )
        throw Error(
          "Finish this player's match before changing their availability.",
        );
      const playerStatuses = Object.fromEntries(
        players.map((p) => [
          p!.id,
          statuses[p!.id] ?? session.playerStatuses?.[p!.id] ?? p!.status,
        ]),
      );
      await db.sessions.update(sessionId, {
        playerIds: ids,
        playerStatuses,
        attendance: session.continuous
          ? {
              ...session.attendance,
              ...Object.fromEntries(
                ids
                  .filter((id) => !session.playerIds.includes(id))
                  .map((id) => [
                    id,
                    [{ action: "check-in" as const, at: Date.now() }],
                  ]),
              ),
            }
          : session.attendance,
        updatedAt: Date.now(),
      });
      await syncContinuousQueue(sessionId);
    },
  );
}

export async function changeAttendance(
  sessionId: string,
  playerId: string,
  action: "check-in" | "check-out" | "undo-check-out",
) {
  await db.transaction(
    "rw",
    db.sessions,
    db.matches,
    db.players,
    db.courts,
    async () => {
      const s = await db.sessions.get(sessionId);
      if (!s || s.status === "completed" || !s.playerIds.includes(playerId))
        throw Error("Player is not in an open session.");
      const events = s.attendance?.[playerId] ?? [];
      if (action === "check-in" && isCheckedIn(s, playerId))
        throw Error("Already checked in.");
      if (action === "check-out" && !isCheckedIn(s, playerId))
        throw Error("Not checked in.");
      if (action === "undo-check-out" && events.at(-1)?.action !== "check-out")
        throw Error("No check-out to undo.");
      if (
        action === "check-out" &&
        (await db.matches
          .where("sessionId")
          .equals(sessionId)
          .filter(
            (m) =>
              m.status === "playing" &&
              [...m.teamA, ...m.teamB].includes(playerId),
          )
          .count())
      )
        throw Error("Resolve the active match before checking out.");
      await db.sessions.update(sessionId, {
        attendance: {
          ...s.attendance,
          [playerId]: [...events, { action, at: Date.now() }],
        },
        updatedAt: Date.now(),
      });
      await syncContinuousQueue(sessionId);
    },
  );
}
export async function extendReservation(courtId: string, end: number) {
  await db.transaction("rw", db.courts, db.sessions, async () => {
    const c = await db.courts.get(courtId);
    const s = c && (await db.sessions.get(c.sessionId));
    if (!c || !s || s.status === "completed")
      throw Error("This court is closed.");
    const start = c.reservationStart ?? Date.now();
    validateReservation(start, end);
    if (end <= Math.max(Date.now(), c.reservationEnd ?? 0))
      throw Error("Choose a later end time.");
    await db.courts.update(courtId, {
      reservationStart: start,
      reservationEnd: end,
      reservationHistory: [
        ...(c.reservationHistory ?? []),
        { start, end, changedAt: Date.now() },
      ],
      updatedAt: Date.now(),
    });
  });
}

export async function assignMatch(
  sessionId: string,
  courtId: string,
  playerIds: string[],
) {
  await db.transaction(
    "rw",
    db.sessions,
    db.courts,
    db.matches,
    db.players,
    async () => {
      const s = await db.sessions.get(sessionId);
      const c = await db.courts.get(courtId);
      if (
        !s ||
        s.status !== "active" ||
        !c ||
        c.sessionId !== sessionId ||
        !courtAvailable(c)
      )
        throw Error("Choose an available court.");
      if (playerIds.length !== 4 || new Set(playerIds).size !== 4)
        throw Error("Choose four different players.");
      const ms = await db.matches
        .where("sessionId")
        .equals(sessionId)
        .toArray();
      if (
        ms.some(
          (m) =>
            m.status === "playing" &&
            (m.courtId === courtId ||
              [...m.teamA, ...m.teamB].some((id) => playerIds.includes(id))),
        )
      )
        throw Error("Court or player is already playing.");
      const ps = await db.players.bulkGet(playerIds);
      if (
        ps.some(
          (p) =>
            !p ||
            !s.playerIds.includes(p.id) ||
            !isCheckedIn(s, p.id) ||
            (s.playerStatuses?.[p.id] ?? p.status) !== "active",
        )
      )
        throw Error("Choose checked-in, available players.");
      await db.matches.add({
        ...base(),
        sessionId,
        courtId,
        teamA: playerIds.slice(0, 2),
        teamB: playerIds.slice(2),
        status: "playing",
      });
      await db.sessions.update(sessionId, {
        round: (s.round ?? 0) + 1,
        updatedAt: Date.now(),
      });
    },
  );
}

export async function syncContinuousQueue(sessionId: string, mode?: Mode) {
  return db.transaction(
    "rw",
    db.sessions,
    db.matches,
    db.courts,
    db.players,
    async () => {
      const session = await db.sessions.get(sessionId);
      if (!session?.continuous || session.status === "completed") return;
      if (session.status === "draft") {
        if (mode)
          await db.sessions.update(sessionId, { mode, updatedAt: Date.now() });
        return;
      }
      if (mode) session.mode = mode;
      const players = (await db.players.bulkGet(session.playerIds)).filter(
        (p): p is Player => !!p,
      );
      const matches = await db.matches
        .where("sessionId")
        .equals(sessionId)
        .toArray();
      const courts = (
        await db.courts.where("sessionId").equals(sessionId).sortBy("number")
      ).slice(0, session.courtCount);
      let queue = prepareQueue(session, players, matches);
      const free = courts.filter(
        (c) =>
          !matches.some((m) => m.courtId === c.id && m.status === "playing"),
      );
      for (const court of free) {
        if (queue.upNext.length !== 4) break;
        const match: Match = {
          ...base(),
          sessionId,
          courtId: court.id,
          teamA: queue.upNext.slice(0, 2),
          teamB: queue.upNext.slice(2),
          eligiblePlayerIds: players
            .filter(
              (p) =>
                isCheckedIn(session, p.id) &&
                (session.playerStatuses?.[p.id] ?? p.status) === "active" &&
                !matches.some(
                  (m) =>
                    m.status === "playing" &&
                    [...m.teamA, ...m.teamB].includes(p.id),
                ),
            )
            .map((p) => p.id),
          status: "playing",
        };
        await db.matches.add(match);
        matches.push(match);
        session.round = (session.round ?? 0) + 1;
        queue = prepareQueue(
          { ...session, queue: { upNext: [], standby: queue.standby } },
          players,
          matches,
        );
      }
      if (
        JSON.stringify(session.queue) !== JSON.stringify(queue) ||
        free.some((c) =>
          matches.some((m) => m.courtId === c.id && m.status === "playing"),
        ) ||
        mode
      ) {
        await db.sessions.update(sessionId, {
          queue,
          mode: session.mode ?? "fair",
          round: session.round ?? 0,
          updatedAt: Date.now(),
        });
      }
    },
  );
}

export async function resumeContinuousSession(sessionId: string) {
  return db.transaction(
    "rw",
    db.sessions,
    db.courts,
    db.matches,
    db.players,
    async () => {
      const session = await db.sessions.get(sessionId);
      if (
        !session ||
        session.status !== "active" ||
        session.continuous === false
      )
        return;
      if (!session.continuous) {
        // Upgrade legacy open sessions without changing recorded matches or explicit departures.
        const attendance = { ...session.attendance };
        for (const id of session.playerIds) {
          if (!attendance[id]?.length)
            attendance[id] = [{ action: "check-in", at: Date.now() }];
        }
        await db.sessions.update(sessionId, {
          continuous: true,
          mode: session.mode ?? "fair",
          attendance,
          updatedAt: Date.now(),
        });
      }
      await syncContinuousQueue(sessionId);
    },
  );
}
