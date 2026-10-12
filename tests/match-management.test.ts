import { matchElapsed } from "../src/lib/match-time";
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
  saveScoreDraft,
  correctMatchResult,
  undoResultCorrection,
  endSession,
} from "../src/lib/db";
import {
  createBackup,
  validateBackup,
  recordBackupSaved,
} from "../src/lib/backup";
import { statistics } from "../src/lib/statistics";
import { freeCourts, sessionPlayerState } from "../src/lib/reservations";

beforeEach(async () => {
  await db.transaction("rw", db.tables, async () => {
    for (const table of db.tables) await table.clear();
  });
});
after(() => db.close());
async function setup() {
  const players = Array.from({ length: 8 }, (_, i) => ({
    ...base(),
    id: "p" + i,
    name: "Player " + i,
    status: "active" as const,
  }));
  await db.players.bulkAdd(players);
  const sessionId = await createSession({
    name: "Match test",
    venue: "Davao",
    courtCount: 2,
    playerIds: players.map((p) => p.id),
  });
  for (const p of players) await changeAttendance(sessionId, p.id, "check-in");
  await startSession(sessionId);
  await generateRound(sessionId, "fair");
  return { sessionId, players, matches: await db.matches.toArray() };
}
test("unfinished scores belong to a match, survive reopening and do not carry into another round", async () => {
  const { sessionId, matches } = await setup();
  await Promise.all([
    saveScoreDraft(matches[0].id, { a: "6" }),
    saveScoreDraft(matches[0].id, { b: "3" }),
    saveScoreDraft(matches[1].id, { a: "2", b: "1" }),
  ]);
  db.close();
  await db.open();
  assert.deepEqual((await db.matches.get(matches[0].id))!.scoreDraft, {
    a: "6",
    b: "3",
  });
  assert.deepEqual((await db.matches.get(matches[1].id))!.scoreDraft, {
    a: "2",
    b: "1",
  });
  const draftBackup = await createBackup();
  assert.doesNotThrow(() =>
    validateBackup(JSON.parse(JSON.stringify(draftBackup))),
  );
  await finishMatch(matches[0].id, "A", 6, 3);
  await assert.rejects(() => finishMatch(matches[0].id, "A", 6, 3));
  await saveScoreDraft(matches[0].id, { a: "9" });
  assert.equal((await db.matches.get(matches[0].id))!.scoreDraft, undefined);
  await generateRound(sessionId, "fair");
  const next = (await db.matches.toArray()).find(
    (m) => !matches.some((old) => old.id === m.id),
  )!;
  assert.equal(next.scoreDraft, undefined);
  assert.deepEqual((await db.matches.get(matches[1].id))!.scoreDraft, {
    a: "2",
    b: "1",
  });
});
test("correction and undo update the same match, preserve chronology and recalculate statistics", async () => {
  const { matches } = await setup();
  const match = matches[0];
  await finishMatch(match.id, "A", 6, 3);
  const finished = (await db.matches.get(match.id))!;
  const playerId = match.teamA[0];
  const correctionId = await correctMatchResult(
    match.id,
    { winner: "B", scoreA: 3, scoreB: 6 },
    finished.updatedAt,
  );
  const corrected = (await db.matches.get(match.id))!;
  assert.equal(corrected.endedAt, finished.endedAt);
  assert.equal(await db.matches.count(), 2);
  assert.equal(statistics(playerId, await db.matches.toArray()).wins, 0);
  assert.equal(statistics(playerId, await db.matches.toArray()).losses, 1);
  assert.equal(statistics(playerId, await db.matches.toArray()).rate, 0);
  assert.equal(statistics(playerId, await db.matches.toArray()).streak, 0);
  await assert.rejects(() =>
    correctMatchResult(match.id, { winner: "A" }, finished.updatedAt),
  );
  await assert.rejects(() =>
    correctMatchResult(
      match.id,
      { winner: "B", scoreA: 6, scoreB: 3 },
      corrected.updatedAt,
    ),
  );
  const backup = await createBackup();
  assert.doesNotThrow(() => validateBackup(JSON.parse(JSON.stringify(backup))));
  const invalid = structuredClone(backup);
  invalid.matches.find(
    (m) => m.id === match.id,
  )!.resultHistory![0].after.winner = "A";
  assert.throws(() => validateBackup(invalid));
  await undoResultCorrection(match.id, correctionId);
  assert.equal(statistics(playerId, await db.matches.toArray()).wins, 1);
  assert.equal(statistics(playerId, await db.matches.toArray()).rate, 100);
  assert.equal(statistics(playerId, await db.matches.toArray()).streak, 1);
  assert.equal((await db.matches.get(match.id))!.resultHistory!.length, 2);
  await assert.rejects(() => undoResultCorrection(match.id, correctionId));
});
test("status definitions distinguish waiting, resting, checked out and busy courts", async () => {
  const { sessionId, players, matches } = await setup();
  let session = (await db.sessions.get(sessionId))!;
  assert.equal(sessionPlayerState(session, players[0], matches), "Playing");
  assert.equal(freeCourts(await db.courts.toArray(), matches).length, 0);
  await finishMatch(matches[0].id, "A");
  const p = players.find((p) => matches[0].teamA.includes(p.id))!;
  assert.equal(
    sessionPlayerState(session, p, await db.matches.toArray()),
    "Waiting",
  );
  session = {
    ...session,
    playerStatuses: { ...session.playerStatuses, [p.id]: "resting" },
  };
  assert.equal(
    sessionPlayerState(session, p, await db.matches.toArray()),
    "Resting",
  );
  await changeAttendance(sessionId, p.id, "check-out");
  assert.equal(
    sessionPlayerState(
      (await db.sessions.get(sessionId))!,
      p,
      await db.matches.toArray(),
    ),
    "Checked Out",
  );
});
test("backup timestamp is independent of exports, persists, and invalid drafts are rejected", async () => {
  const { matches } = await setup();
  await assert.rejects(() => saveScoreDraft(matches[0].id, { a: "-1" }));
  await createBackup();
  assert.equal(await db.safety.get("last-export"), undefined);
  await recordBackupSaved();
  const at = (await db.safety.get("last-export"))!.createdAt;
  db.close();
  await db.open();
  assert.equal((await db.safety.get("last-export"))!.createdAt, at);
  const backup = await createBackup();
  backup.matches[0].scoreDraft = { a: "bad", b: "3" };
  assert.throws(() => validateBackup(backup));
});

test("ending a session preserves cancelled-match drafts and keeps backups valid", async () => {
  const { sessionId, matches } = await setup();
  await saveScoreDraft(matches[0].id, { a: "4", b: "2" });
  await endSession(sessionId);
  const match = (await db.matches.get(matches[0].id))!;
  assert.equal(match.status, "cancelled");
  assert.deepEqual(match.scoreDraft, { a: "4", b: "2" });
  assert.equal(statistics(match.teamA[0], await db.matches.toArray()).games, 0);
  const backup = await createBackup();
  assert.doesNotThrow(() => validateBackup(JSON.parse(JSON.stringify(backup))));
});

test("one and four courts are sequential, unscheduled and preserved in backups", async () => {
  const { players, sessionId } = await setup();
  await endSession(sessionId);
  for (const count of [1, 4]) {
    const id = await createSession({
      name: "Simple open play",
      venue: "Cebu",
      courtCount: count,
      playerIds: players.map((p) => p.id),
    });
    const courts = await db.courts
      .where("sessionId")
      .equals(id)
      .sortBy("number");
    assert.deepEqual(
      courts.map((c) => c.number),
      Array.from({ length: count }, (_, i) => i + 1),
    );
    assert.ok(
      courts.every(
        (c) =>
          c.reservationStart === undefined && c.reservationEnd === undefined,
      ),
    );
    const backup = validateBackup(await createBackup());
    assert.equal(backup.courts.filter((c) => c.sessionId === id).length, count);
    await endSession(id);
  }
});


test("match duration uses hours for long matches and remains frozen after completion", async () => {
  const { matches } = await setup();
  const match = matches[0];
  assert.equal(matchElapsed(match, match.createdAt), "00:00");
  assert.equal(matchElapsed(match, match.createdAt + 3725000), "01:02:05");
  assert.equal(matchElapsed({ ...match, endedAt: match.createdAt + 65000 }, match.createdAt + 9999999), "01:05");
});
