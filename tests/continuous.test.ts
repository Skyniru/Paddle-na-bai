import "fake-indexeddb/auto";
import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import {
  db,
  base,
  createSession,
  startSession,
  finishMatch,
  updateSessionPlayers,
  changeAttendance,
  syncContinuousQueue,
  endSession,
  resumeContinuousSession,
} from "../src/lib/db";
import { createBackup, validateBackup } from "../src/lib/backup";
import { sessionStandings } from "../src/lib/standings";

beforeEach(async () => {
  await db.transaction("rw", db.tables, async () => {
    for (const table of db.tables) await table.clear();
  });
});
after(() => db.close());
async function setup(count = 16, courts = 2) {
  const players = Array.from({ length: count }, (_, i) => ({
    ...base(),
    id: "p" + i,
    name: "Player " + i,
    status: "active" as const,
  }));
  await db.players.bulkAdd(players);
  const id = await createSession({
    name: "Continuous crew",
    venue: "Cebu",
    courtCount: courts,
    playerIds: players.map((p) => p.id),
    continuous: true,
    mode: "fair",
  });
  await startSession(id);
  return { id, players };
}
const members = (m: { teamA: string[]; teamB: string[] }) => [
  ...m.teamA,
  ...m.teamB,
];
async function assertExclusive(id: string) {
  const session = (await db.sessions.get(id))!;
  const active = await db.matches
    .where("sessionId")
    .equals(id)
    .filter((m) => m.status === "playing")
    .toArray();
  const all = [
    ...active.flatMap(members),
    ...session.queue!.upNext,
    ...session.queue!.standby,
  ];
  assert.equal(new Set(all).size, all.length);
}

test("initial matches and stable queue persist; one finishing court consumes the confirmed group only", async () => {
  const { id } = await setup();
  const active = await db.matches.where("status").equals("playing").toArray();
  assert.equal(active.length, 2);
  const queue = (await db.sessions.get(id))!.queue!;
  assert.equal(queue.upNext.length, 4);
  assert.equal(queue.standby.length, 4);
  db.close();
  await db.open();
  await Promise.all([syncContinuousQueue(id), syncContinuousQueue(id)]);
  assert.deepEqual((await db.sessions.get(id))!.queue, queue);
  await finishMatch(active[0].id, "A", 6, 3);
  assert.deepEqual(await db.matches.get(active[1].id), active[1]);
  const next = (await db.matches
    .where("courtId")
    .equals(active[0].courtId)
    .filter((m) => m.status === "playing")
    .first())!;
  assert.deepEqual(members(next), queue.upNext);
  assert.deepEqual(
    [...(await db.sessions.get(id))!.queue!.upNext].sort(),
    [...queue.standby].sort(),
  );
  await assertExclusive(id);
  assert.equal(
    sessionStandings(
      await db.players.toArray(),
      await db.matches.toArray(),
    ).filter((r) => r.s.games > 0).length,
    4,
  );
});

test("departure replaces one queue member; late arrivals never displace a confirmed group", async () => {
  const { id } = await setup();
  const before = (await db.sessions.get(id))!;
  const missing = before.queue!.upNext[1];
  await changeAttendance(id, missing, "check-out");
  const replacement = (await db.sessions.get(id))!.queue!.upNext;
  assert.equal(replacement.length, 4);
  for (const index of [0, 2, 3])
    assert.equal(replacement[index], before.queue!.upNext[index]);
  assert.equal(replacement[1], before.queue!.standby[0]);
  await db.players.add({
    ...base(),
    id: "late",
    name: "Late arrival",
    status: "active",
  });
  await updateSessionPlayers(id, [...before.playerIds, "late"]);
  const after = (await db.sessions.get(id))!;
  assert.deepEqual(after.queue!.upNext, replacement);
  assert.ok(after.queue!.standby.includes("late"));
  assert.equal(after.attendance!.late.at(-1)!.action, "check-in");
  await updateSessionPlayers(id, after.playerIds, {
    [replacement[2]]: "resting",
  });
  const changed = (await db.sessions.get(id))!.queue!.upNext;
  assert.equal(changed[0], replacement[0]);
  assert.equal(changed[1], replacement[1]);
  assert.equal(changed[3], replacement[3]);
  assert.ok(!changed.includes(replacement[2]));
  await assertExclusive(id);
});

test("concurrent court finishes and duplicate submissions cannot duplicate queue assignments", async () => {
  const { id } = await setup(20, 2);
  const matches = await db.matches.where("status").equals("playing").toArray();
  await Promise.all(matches.map((m) => finishMatch(m.id, "A")));
  await assertExclusive(id);
  const active = await db.matches.where("status").equals("playing").toArray();
  const results = await Promise.allSettled([
    finishMatch(active[0].id, "B"),
    finishMatch(active[0].id, "A"),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  await assertExclusive(id);
});

test("queue and banner backups validate, end clears queue, and no match restarts after ending", async () => {
  const { id } = await setup();
  const banner = "data:image/png;base64,iVBORw0KGgo=";
  await db.sessions.update(id, { bannerPhoto: banner });
  const backup = validateBackup(await createBackup());
  assert.equal(backup.sessions[0].bannerPhoto, banner);
  const invalid = structuredClone(backup);
  invalid.sessions[0].queue!.standby.push(invalid.sessions[0].queue!.upNext[0]);
  assert.throws(() => validateBackup(invalid));
  const busy = structuredClone(backup);
  busy.sessions[0].queue!.upNext[0] = busy.matches.find(
    (m) => m.status === "playing",
  )!.teamA[0];
  assert.throws(() => validateBackup(busy));
  await endSession(id);
  await syncContinuousQueue(id);
  assert.equal(await db.matches.where("status").equals("playing").count(), 0);
  assert.deepEqual((await db.sessions.get(id))!.queue, {
    upNext: [],
    standby: [],
  });
  validateBackup(await createBackup());
});

test("legacy recovery enables automatic rotation without rewriting completed results or explicit departures", async () => {
  const { id } = await setup(12, 1);
  const session = (await db.sessions.get(id))!;
  const leaving = session.queue!.upNext[0];
  await changeAttendance(id, leaving, "check-out");
  await db.sessions.update(id, { continuous: undefined, queue: undefined });
  const original = await db.matches.toArray();
  await resumeContinuousSession(id);
  assert.deepEqual(await db.matches.toArray(), original);
  assert.equal(
    (await db.sessions.get(id))!.attendance![leaving].at(-1)!.action,
    "check-out",
  );
  assert.ok(!(await db.sessions.get(id))!.queue!.upNext.includes(leaving));
  await assertExclusive(id);
});

test("rest chosen during a match applies afterward and automatic assignment failure rolls back the result", async () => {
  const { id } = await setup();
  const original = (
    await db.matches.where("status").equals("playing").toArray()
  )[0];
  const session = (await db.sessions.get(id))!;
  await updateSessionPlayers(id, session.playerIds, {
    [original.teamA[0]]: "resting",
  });
  assert.deepEqual(await db.matches.get(original.id), original);
  const queue = (await db.sessions.get(id))!.queue;
  const fail = () => {
    throw Error("Simulated storage failure");
  };
  db.matches.hook("creating").subscribe(fail);
  try {
    await assert.rejects(() => finishMatch(original.id, "A"));
  } finally {
    db.matches.hook("creating").unsubscribe(fail);
  }
  assert.deepEqual(await db.matches.get(original.id), original);
  assert.deepEqual((await db.sessions.get(id))!.queue, queue);
  await finishMatch(original.id, "A");
  const after = (await db.sessions.get(id))!;
  assert.ok(
    ![...after.queue!.upNext, ...after.queue!.standby].includes(
      original.teamA[0],
    ),
  );
  await assertExclusive(id);
});
