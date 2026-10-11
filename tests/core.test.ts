import "fake-indexeddb/auto";
import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import {
  db,
  base,
  createSession,
  changeAttendance,
  startSession,
  generateRound,
  finishMatch,
  endSession,
  saveGroup,
  addSavedPlayer,
  updateSessionPlayers,
  removePlayer,
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
    db.groups.clear(),
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
  for (const id of (await db.sessions.get(s))!.playerIds)
    await changeAttendance(s, id, "check-in");
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

test("groups save reusable players, deduplicate members and preserve players on deletion", async () => {
  await db.players.bulkAdd([player(0), player(1)]);
  const id = await saveGroup(" Friday crew ", ["p0", "p0", "p1"]);
  assert.equal((await db.groups.get(id))?.name, "Friday crew");
  assert.deepEqual((await db.groups.get(id))?.playerIds, ["p0", "p1"]);
  await assert.rejects(() => saveGroup("Invalid", ["missing"]));
  await saveGroup("Weekend crew", ["p0"], id);
  assert.equal(await db.groups.count(), 1);
  await removePlayer("p0");
  assert.deepEqual((await db.groups.get(id))?.playerIds, []);
  await db.groups.delete(id);
  assert.ok(await db.players.get("p1"));
});

test("late arrivals and session rest persist without changing saved player availability", async () => {
  const ps = Array.from({ length: 6 }, (_, i) => player(i));
  await db.players.bulkAdd(ps);
  const s = await createSession({
    name: "Evening",
    venue: "Club",
    courtCount: 1,
    playerIds: ps.slice(0, 4).map((p) => p.id),
  });
  for (const id of (await db.sessions.get(s))!.playerIds)
    await changeAttendance(s, id, "check-in");
  await startSession(s);
  await generateRound(s, "fair");
  await assert.rejects(() =>
    updateSessionPlayers(
      s,
      ps.map((p) => p.id),
      { p0: "resting" },
    ),
  );
  await assert.rejects(() => updateSessionPlayers(s, ["p1", "p2", "p3", "p4"]));
  const first = (await db.matches.toArray())[0];
  await finishMatch(first.id, "A");
  await updateSessionPlayers(
    s,
    ps.map((p) => p.id),
    { p0: "resting" },
  );
  await changeAttendance(s, "p4", "check-in");
  await changeAttendance(s, "p5", "check-in");
  assert.equal((await db.players.get("p0"))?.status, "active");
  assert.equal((await db.sessions.get(s))?.playerStatuses?.p0, "resting");
  await generateRound(s, "fair");
  const second = (await db.matches.toArray()).find(
    (m) => m.status === "playing",
  )!;
  const selected = [...second.teamA, ...second.teamB];
  assert.ok(selected.includes("p4") && selected.includes("p5"));
  assert.ok(!selected.includes("p0"));
  await finishMatch(second.id, "A");
  await updateSessionPlayers(
    s,
    ps.map((p) => p.id),
    { p0: "active" },
  );
  await endSession(s);
  await assert.rejects(() =>
    updateSessionPlayers(
      s,
      ps.map((p) => p.id),
    ),
  );
});

test("fair rotation shares games and rest over repeated rounds on multiple courts", () => {
  for (const [people, courts] of [
    [6, 1],
    [10, 2],
    [13, 2],
  ]) {
    const ps = Array.from({ length: people }, (_, i) => player(i));
    const history: Match[] = [];
    for (let round = 0; round < 24; round++) {
      const groups = generateTeams(
        ps,
        history,
        "fair",
        courts,
        Array.from({ length: courts }, (_, i) => "court" + i),
      );
      const assigned = groups.flatMap((g) => [...g.teamA, ...g.teamB]);
      assert.equal(new Set(assigned).size, courts * 4);
      groups.forEach((g, i) =>
        history.push({
          ...match(g.teamA, g.teamB, "A", history.length),
          courtId: "court" + i,
          createdAt: round * 100,
          endedAt: round * 100 + 50,
        }),
      );
      const counts = ps.map(
        (p) =>
          history.filter((m) => [...m.teamA, ...m.teamB].includes(p.id)).length,
      );
      assert.ok(Math.max(...counts) - Math.min(...counts) <= 1);
    }
  }
});

test("rest priority follows match end time rather than start time", () => {
  const ps = Array.from({ length: 8 }, (_, i) => player(i));
  const history = [
    { ...match(["p0", "p1"], ["p2", "p3"], "A", 1), createdAt: 1, endedAt: 30 },
    {
      ...match(["p4", "p5"], ["p6", "p7"], "A", 2),
      createdAt: 10,
      endedAt: 20,
    },
  ];
  const g = generateTeams(ps, history, "fair", 1)[0];
  assert.deepEqual(
    new Set([...g.teamA, ...g.teamB]),
    new Set(["p4", "p5", "p6", "p7"]),
  );
});

test("group photos survive membership edits and can be explicitly replaced or removed", async () => {
  await db.players.bulkAdd([player(0), player(1)]);
  const original = "data:image/png;base64,original";
  const id = await saveGroup("Photo club", ["p0"], undefined, original);
  assert.equal((await db.groups.get(id))?.photo, original);
  await saveGroup("Renamed club", ["p0", "p1"], id);
  assert.equal((await db.groups.get(id))?.photo, original);
  await saveGroup(
    "Renamed club",
    ["p1"],
    id,
    "data:image/png;base64,replacement",
  );
  assert.equal(
    (await db.groups.get(id))?.photo,
    "data:image/png;base64,replacement",
  );
  await saveGroup("Renamed club", ["p1"], id, null);
  assert.equal((await db.groups.get(id))?.photo, undefined);
  assert.deepEqual((await db.groups.get(id))?.playerIds, ["p1"]);
});

test("inline names are validated, reusable and safe from duplicate concurrent adds", async () => {
  await assert.rejects(() => addSavedPlayer("   "));
  await assert.rejects(() => addSavedPlayer("x".repeat(61)));
  const [first, again] = await Promise.all([
    addSavedPlayer(" Alex   Santos "),
    addSavedPlayer("alex santos"),
  ]);
  assert.equal(first.id, again.id);
  assert.equal(first.name, "Alex Santos");
  assert.equal(await db.players.count(), 1);
  assert.equal(first.status, "active");
});

test("a group can be planned before adding players or starting a session", async () => {
  const id = await saveGroup("Future games", []);
  assert.deepEqual((await db.groups.get(id))?.playerIds, []);
  assert.equal(await db.sessions.count(), 0);
  const p = await addSavedPlayer("New member");
  await saveGroup("Future games", [p.id], id);
  assert.deepEqual((await db.groups.get(id))?.playerIds, [p.id]);
  assert.equal(await db.sessions.count(), 0);
});
