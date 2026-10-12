import "fake-indexeddb/auto";
import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import Dexie from "dexie";
import {
  db,
  base,
  createSession,
  startSession,
  generateRound,
  changeAttendance,
  assignMatch,
} from "../src/lib/db";
import { createBackup, restoreBackup, validateBackup } from "../src/lib/backup";
beforeEach(async () => {
  await db.transaction("rw", db.tables, async () => {
    for (const table of db.tables) await table.clear();
  });
});
after(() => db.close());
test("photo backup round trip, legacy import and pre-restore snapshot", async () => {
  const p = {
    ...base(),
    name: "Original",
    status: "active" as const,
    photo: "data:image/png;base64,YWJj",
  };
  await db.players.add(p);
  const b = await createBackup();
  assert.equal(b.app, "paddlebai");
  assert.equal(
    validateBackup({ ...b, app: "Paddle Na Bai!" }).app,
    "paddlebai",
  );
  await db.players.update(p.id, { name: "Changed" });
  await restoreBackup(JSON.parse(JSON.stringify(b)));
  assert.deepEqual(await db.players.get(p.id), p);
  assert.equal(
    JSON.parse((await db.safety.get("before-restore"))!.payload).players[0]
      .name,
    "Changed",
  );
  const { app, formatVersion, ...legacy } = b;
  void app;
  void formatVersion;
  assert.equal(
    validateBackup({ ...legacy, schemaVersion: 4 }).schemaVersion,
    5,
  );
});
test("invalid backups leave data and safety snapshot untouched", async () => {
  await db.players.add({ ...base(), name: "Keep me", status: "active" });
  const b = await createBackup();
  for (const invalid of [
    null,
    { ...b, schemaVersion: 99 },
    { ...b, players: [...b.players, b.players[0]] },
    { ...b, groups: [{ ...base(), name: "Bad", playerIds: ["missing"] }] },
    { ...b, players: [{ ...b.players[0], photo: "https://remote/image.png" }] },
  ]) {
    await assert.rejects(restoreBackup(invalid));
    assert.equal((await db.players.toArray())[0].name, "Keep me");
    assert.equal(await db.safety.count(), 0);
  }
});
test("restore failure rolls back cleared tables and pre-restore snapshot", async () => {
  const p = { ...base(), name: "Keep", status: "active" as const };
  await db.players.add(p);
  const b = await createBackup();
  const bad = structuredClone(b);
  bad.players[0].name = "Trigger write failure";
  const reject = () => {
    throw Error("Simulated quota failure");
  };
  db.players.hook("creating", reject);
  try {
    await assert.rejects(restoreBackup(bad), /Simulated quota/);
  } finally {
    db.players.hook("creating").unsubscribe(reject);
  }
  assert.deepEqual(await db.players.toArray(), [p]);
  assert.equal(await db.safety.count(), 0);
});
test("active session recovers after closing database and prevents restore; concurrent manual assignments cannot overlap", async () => {
  const players = Array.from({ length: 8 }, (_, i) => ({
    ...base(),
    name: "P" + i,
    status: "active" as const,
  }));
  await db.players.bulkAdd(players);
  const id = await createSession({
    name: "Recovery",
    venue: "Local",
    courtCount: 2,
    playerIds: players.map((p) => p.id),
  });
  await startSession(id);
  for (const p of players) await changeAttendance(id, p.id, "check-in");
  const courts = await db.courts.toArray();
  const ids = players.slice(0, 4).map((p) => p.id);
  const results = await Promise.allSettled(
    courts.map((c) => assignMatch(id, c.id, ids)),
  );
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  await generateRound(id, "balanced");
  const before = await createBackup();
  db.close();
  await db.open();
  assert.deepEqual((await createBackup()).sessions, before.sessions);
  assert.deepEqual((await createBackup()).matches, before.matches);
  await assert.rejects(restoreBackup(before), /Finish the live session/);
});
test("v4 to v5 migration preserves records and creates safety storage", async () => {
  await db.delete();
  const name = db.name;
  const old = new Dexie(name);
  old.version(4).stores({
    players: "id,status,updatedAt",
    sessions: "id,status,createdAt,updatedAt",
    courts: "id,sessionId,reservationEnd",
    matches: "id,sessionId,courtId,status,updatedAt",
    groups: "id,name,updatedAt",
  });
  await old
    .table("players")
    .add({ ...base(), id: "existing", name: "Saved", status: "resting" });
  old.close();
  await db.open();
  assert.equal((await db.players.get("existing"))!.name, "Saved");
  assert.equal(await db.safety.count(), 0);
});
