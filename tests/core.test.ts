import "fake-indexeddb/auto";
import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import {
  db,
  base,
  createSession,
  startSession,
  generateRound,
  finishMatch,
  endSession,
} from "../src/lib/db";
import { generateTeams } from "../src/lib/matchmaking";
import { statistics } from "../src/lib/statistics";
import type { Player, Match } from "../src/types";
const player = (n: number): Player => ({
  ...base(),
  id: "p" + n,
  name: "Player " + n,
  status: "active",
});
const match = (
  a: string[],
  b: string[],
  winner: "A" | "B",
  n: number,
): Match => ({
  ...base(),
  id: "m" + n,
  sessionId: "s",
  courtId: "c",
  teamA: a,
  teamB: b,
  status: "completed",
  winner,
  endedAt: n,
});
beforeEach(async () => {
  await Promise.all([
    db.players.clear(),
    db.sessions.clear(),
    db.courts.clear(),
    db.matches.clear(),
  ]);
});
after(() => db.close());
test("statistics use completed games, chronological streaks and zero-game rate", () => {
  const ms = [
    match(["p1", "p2"], ["p3", "p4"], "A", 1),
    match(["p1", "p3"], ["p2", "p4"], "A", 2),
    match(["p1", "p4"], ["p2", "p3"], "B", 3),
  ];
  assert.deepEqual(statistics("p1", ms), {
    id: "p1",
    games: 3,
    wins: 2,
    losses: 1,
    rate: (2 / 3) * 100,
    streak: 0,
    best: 2,
  });
  assert.equal(statistics("new", ms).rate, 0);
  assert.equal(
    statistics("p1", [...ms, { ...ms[0], id: "unfinished", status: "playing" }])
      .games,
    3,
  );
});
test("fair rotation selects fewer games regardless of win rate and avoids busy players", () => {
  const ps = Array.from({ length: 8 }, (_, i) => player(i));
  const previous = match(["p0", "p1"], ["p2", "p3"], "A", 1);
  const groups = generateTeams(ps, [previous], "fair", 1);
  assert.deepEqual(
    new Set([...groups[0].teamA, ...groups[0].teamB]),
    new Set(["p4", "p5", "p6", "p7"]),
  );
  const live = { ...previous, status: "playing" as const };
  assert.equal(generateTeams(ps, [live], "balanced", 2).length, 1);
});
test("fair teams avoid a repeated partner when alternatives exist", () => {
  const ps = Array.from({ length: 4 }, (_, i) => player(i));
  const previous = match(["p0", "p1"], ["p2", "p3"], "A", 1);
  const group = generateTeams(ps, [previous], "fair", 1)[0];
  assert.ok(
    ![group.teamA, group.teamB].some(
      (t) => t.includes("p0") && t.includes("p1"),
    ),
  );
});
test("transactions prevent simultaneous assignment, repeat results and session restarts", async () => {
  const ps = Array.from({ length: 8 }, (_, i) => player(i));
  await db.players.bulkAdd(ps);
  const s = await createSession({
    name: "Test",
    venue: "Local",
    courtCount: 2,
    playerIds: ps.map((p) => p.id),
  });
  await startSession(s);
  await assert.rejects(() => startSession(s));
  await Promise.allSettled([
    generateRound(s, "fair"),
    generateRound(s, "fair"),
  ]);
  const ms = await db.matches.toArray();
  assert.equal(ms.length, 2);
  assert.equal(new Set(ms.flatMap((m) => [...m.teamA, ...m.teamB])).size, 8);
  await finishMatch(ms[0].id, "A", 6, 3);
  await assert.rejects(() => finishMatch(ms[0].id, "B"));
  assert.equal(statistics(ms[0].teamA[0], await db.matches.toArray()).wins, 1);
  await endSession(s);
  assert.equal((await db.matches.get(ms[1].id))?.status, "cancelled");
  assert.equal((await db.sessions.get(s))?.status, "completed");
});
test("validation rejects too few players and contradictory scores", async () => {
  await assert.rejects(() =>
    createSession({
      name: "Test",
      venue: "Local",
      courtCount: 1,
      playerIds: ["x"],
    }),
  );
  const m = match(["p0", "p1"], ["p2", "p3"], "A", 1);
  await db.matches.add({ ...m, status: "playing" });
  await assert.rejects(() => finishMatch(m.id, "A", 2, 6));
  assert.equal((await db.matches.get(m.id))?.status, "playing");
});
