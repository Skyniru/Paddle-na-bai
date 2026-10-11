import "fake-indexeddb/auto";
import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import {
  db,
  base,
  createSession,
  startSession,
  changeAttendance,
  generateRound,
  finishMatch,
  endSession,
  extendReservation,
  assignMatch,
} from "../src/lib/db";
import {
  courtStatus,
  courtAvailable,
  isCheckedIn,
  validateReservation,
} from "../src/lib/reservations";
beforeEach(async () => {
  await db.matches.clear();
  await db.courts.clear();
  await db.sessions.clear();
  await db.players.clear();
});
after(() => db.close());
async function setup(count = 4) {
  const players = Array.from({ length: count }, (_, i) => ({
    ...base(),
    id: "p" + i,
    name: "Player " + i,
    status: "active" as const,
  }));
  await db.players.bulkAdd(players);
  const now = Date.now();
  const id = await createSession({
    name: "Attendance",
    venue: "Davao",
    courtCount: 2,
    playerIds: players.map((p) => p.id),
    reservations: [
      { number: 1, start: now - 60000, end: now + 3600000 },
      { number: 2, start: now + 3600000, end: now + 7200000 },
    ],
  });
  await startSession(id);
  return id;
}
test("attendance, active checkout validation, undo, reentry, completion and persistence", async () => {
  const id = await setup();
  await assert.rejects(() => generateRound(id, "fair"));
  for (let i = 0; i < 4; i++) await changeAttendance(id, "p" + i, "check-in");
  await generateRound(id, "fair");
  await assert.rejects(() => changeAttendance(id, "p0", "check-out"));
  const m = (await db.matches.toArray())[0];
  await finishMatch(m.id, "A");
  await changeAttendance(id, "p0", "check-out");
  assert.equal(isCheckedIn((await db.sessions.get(id))!, "p0"), false);
  await assert.rejects(() => generateRound(id, "fair"));
  await changeAttendance(id, "p0", "undo-check-out");
  await changeAttendance(id, "p0", "check-out");
  await changeAttendance(id, "p0", "check-in");
  db.close();
  await db.open();
  assert.equal((await db.sessions.get(id))!.attendance!.p0.length, 5);
  await endSession(id);
  assert.equal((await db.sessions.get(id))!.status, "completed");
  assert.equal((await db.matches.get(m.id))!.winner, "A");
  await assert.rejects(() => changeAttendance(id, "p0", "check-out"));
});
test("different windows, expiry, extension and manual assignment validation", async () => {
  const id = await setup();
  for (let i = 0; i < 4; i++) await changeAttendance(id, "p" + i, "check-in");
  const cs = await db.courts.toCollection().sortBy("number");
  assert.equal(courtAvailable(cs[1]), false);
  await assert.rejects(() =>
    assignMatch(id, cs[1].id, ["p0", "p1", "p2", "p3"]),
  );
  await db.courts.update(cs[0].id, { reservationEnd: Date.now() - 1 });
  assert.equal(
    courtStatus((await db.courts.get(cs[0].id))!),
    "Reservation Expired",
  );
  await assert.rejects(() => generateRound(id, "fair"));
  await extendReservation(cs[0].id, Date.now() + 3600000);
  await assignMatch(id, cs[0].id, ["p0", "p1", "p2", "p3"]);
  await db.courts.update(cs[0].id, { reservationEnd: Date.now() - 1 });
  assert.equal((await db.matches.toArray())[0].status, "playing");
  assert.equal((await db.courts.get(cs[0].id))!.reservationHistory!.length, 2);
  assert.throws(() => validateReservation(2, 1));
});
test("late arrivals receive a turn without prearrival rest credit", async () => {
  const id = await setup(8);
  for (let i = 0; i < 4; i++) await changeAttendance(id, "p" + i, "check-in");
  await generateRound(id, "fair");
  await finishMatch((await db.matches.toArray())[0].id, "A");
  for (let i = 4; i < 8; i++) await changeAttendance(id, "p" + i, "check-in");
  await generateRound(id, "fair");
  const m = (await db.matches.where("status").equals("playing").toArray())[0];
  assert.deepEqual(
    new Set([...m.teamA, ...m.teamB]),
    new Set(["p4", "p5", "p6", "p7"]),
  );
});
