import { db } from "./db";
import type { Player, PlayerGroup, Session, Court, Match } from "@/types";
import { isDesktopApp } from "./platform";

export interface Backup {
  app: "paddlebai";
  formatVersion: 1;
  schemaVersion: 5;
  exportedAt: string;
  players: Player[];
  groups: PlayerGroup[];
  sessions: Session[];
  courts: Court[];
  matches: Match[];
}
const tables = [db.players, db.groups, db.sessions, db.courts, db.matches];
export async function createBackup(): Promise<Backup> {
  return db.transaction("r", tables, async () => ({
    app: "paddlebai",
    formatVersion: 1,
    schemaVersion: 5,
    exportedAt: new Date().toISOString(),
    players: await db.players.toArray(),
    groups: await db.groups.toArray(),
    sessions: await db.sessions.toArray(),
    courts: await db.courts.toArray(),
    matches: await db.matches.toArray(),
  }));
}
export async function downloadBackup(
  backup: Backup,
  name = "paddlebai-backup.json",
) {
  if (isDesktopApp()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    const path = await save({
      title: "Save PaddleBai backup",
      defaultPath: name,
      filters: [{ name: "PaddleBai backup", extensions: ["json"] }],
    });
    if (!path) return false;
    await writeTextFile(path, JSON.stringify(backup, null, 2));
    await recordBackupSaved();
    return true;
  }
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  await recordBackupSaved();
  return true;
}

export async function recordBackupSaved() {
  await db.safety.put({
    id: "last-export",
    createdAt: Date.now(),
    payload: "exported",
  });
}

export function validateBackup(input: unknown): Backup {
  const fail = (): never => {
    throw Error(
      "Invalid or unsupported backup. Your saved data has not changed.",
    );
  };
  const obj = (v: unknown): Record<string, unknown> =>
    v && typeof v === "object" && !Array.isArray(v)
      ? (v as Record<string, unknown>)
      : fail();
  const b = obj(input);
  const legacy =
    b.schemaVersion === 4 &&
    b.formatVersion === undefined &&
    b.app === undefined;
  if (
    !legacy &&
    (!["paddlebai", "Paddle Na Bai!"].includes(String(b.app)) ||
      b.formatVersion !== 1 ||
      b.schemaVersion !== 5)
  )
    fail();
  if (
    typeof b.exportedAt !== "string" ||
    !Number.isFinite(Date.parse(b.exportedAt))
  )
    fail();
  const num = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) && v >= 0;
  const text = (v: unknown) => typeof v === "string" && v.trim().length > 0;
  const strings = (v: unknown): v is string[] =>
    Array.isArray(v) && v.every(text) && new Set(v).size === v.length;
  const optionalNumber = (r: Record<string, unknown>, keys: string[]) =>
    keys.every((k) => r[k] === undefined || num(r[k]));
  const status = (v: unknown) =>
    ["active", "resting", "unavailable"].includes(String(v));
  const photo = (v: unknown) =>
    v === undefined ||
    (typeof v === "string" &&
      v.length <= 2800000 &&
      /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(v));
  const rows: Record<string, Record<string, unknown>[]> = {};
  for (const key of ["players", "groups", "sessions", "courts", "matches"]) {
    if (!Array.isArray(b[key]) || b[key].length > 100000) fail();
    rows[key] = (b[key] as unknown[]).map(obj);
    const ids = new Set();
    for (const r of rows[key]) {
      if (
        !text(r.id) ||
        ids.has(r.id) ||
        !num(r.createdAt) ||
        !num(r.updatedAt)
      )
        fail();
      ids.add(r.id);
    }
  }
  const ids = (key: string) => new Set(rows[key].map((r) => r.id));
  const players = ids("players"),
    sessions = ids("sessions");
  for (const p of rows.players)
    if (
      !text(p.name) ||
      String(p.name).length > 60 ||
      !status(p.status) ||
      !photo(p.photo)
    )
      fail();
  for (const g of rows.groups)
    if (
      !text(g.name) ||
      String(g.name).length > 60 ||
      !strings(g.playerIds) ||
      !g.playerIds.every((id) => players.has(id)) ||
      !photo(g.photo)
    )
      fail();
  const sessionMap = new Map(rows.sessions.map((s) => [s.id, s]));
  if (rows.sessions.filter((s) => s.status !== "completed").length > 1) fail();
  for (const s of rows.sessions) {
    if (
      !photo(s.bannerPhoto) ||
      (s.continuous !== undefined && typeof s.continuous !== "boolean") ||
      (s.mode !== undefined &&
        !["fair", "random", "balanced"].includes(String(s.mode)))
    )
      fail();
    if (s.queue !== undefined) {
      const queue = obj(s.queue);
      if (
        !strings(queue.upNext) ||
        !strings(queue.standby) ||
        queue.upNext.length > 4 ||
        !Array.isArray(s.playerIds)
      )
        fail();
      const queued = [
        ...(queue.upNext as string[]),
        ...(queue.standby as string[]),
      ];
      if (
        new Set(queued).size !== queued.length ||
        queued.some((id) => !(s.playerIds as string[]).includes(id))
      )
        fail();
      if (s.status === "completed" && queued.length) fail();
    }
    if (
      !text(s.name) ||
      !text(s.venue) ||
      !["draft", "active", "completed"].includes(String(s.status)) ||
      !strings(s.playerIds) ||
      !s.playerIds.every((id) => players.has(id)) ||
      !Number.isInteger(s.courtCount) ||
      Number(s.courtCount) < 1 ||
      Number(s.courtCount) > 12 ||
      !optionalNumber(s, [
        "startedAt",
        "endedAt",
        "duration",
        "elapsedDuration",
        "round",
      ]) ||
      (s.status === "active" && !num(s.startedAt))
    )
      fail();
    if (s.playerStatuses !== undefined)
      for (const [id, value] of Object.entries(obj(s.playerStatuses)))
        if (!(s.playerIds as string[]).includes(id) || !status(value)) fail();
    if (s.attendance !== undefined)
      for (const [id, events] of Object.entries(obj(s.attendance))) {
        // Removed, unassigned attendees can still have historical attendance.
        if (!text(id) || !Array.isArray(events)) fail();
        let previous = 0;
        for (const value of events as unknown[]) {
          const e = obj(value);
          if (
            !["check-in", "check-out", "undo-check-out"].includes(
              String(e.action),
            ) ||
            !num(e.at) ||
            Number(e.at) < previous
          )
            fail();
          previous = Number(e.at);
        }
      }
  }
  const courtMap = new Map(rows.courts.map((c) => [c.id, c]));
  const courtNumbers = new Set();
  for (const c of rows.courts) {
    const key = JSON.stringify([c.sessionId, c.number]);
    if (
      !sessions.has(c.sessionId) ||
      !Number.isInteger(c.number) ||
      Number(c.number) < 1 ||
      courtNumbers.has(key) ||
      !optionalNumber(c, ["reservationStart", "reservationEnd"]) ||
      (c.reservationStart !== undefined &&
        c.reservationEnd !== undefined &&
        Number(c.reservationEnd) <= Number(c.reservationStart))
    )
      fail();
    courtNumbers.add(key);
    if (c.reservationHistory !== undefined) {
      if (!Array.isArray(c.reservationHistory)) fail();
      for (const value of c.reservationHistory as unknown[]) {
        const r = obj(value);
        if (
          !num(r.start) ||
          !num(r.end) ||
          Number(r.end) <= Number(r.start) ||
          !num(r.changedAt)
        )
          fail();
      }
    }
  }
  for (const s of rows.sessions)
    if (rows.courts.filter((c) => c.sessionId === s.id).length !== s.courtCount)
      fail();
  const busyPlayers = new Set(),
    busyCourts = new Set();
  for (const m of rows.matches) {
    const s = sessionMap.get(m.sessionId),
      c = courtMap.get(m.courtId);
    if (!s || !c) return fail();
    if (
      !s ||
      !c ||
      c.sessionId !== m.sessionId ||
      !strings(m.teamA) ||
      !strings(m.teamB) ||
      m.teamA.length !== 2 ||
      m.teamB.length !== 2 ||
      !strings([...m.teamA, ...m.teamB]) ||
      ![...m.teamA, ...m.teamB].every((id) =>
        (s.playerIds as string[]).includes(id),
      ) ||
      !["playing", "completed", "cancelled"].includes(String(m.status)) ||
      !optionalNumber(m, ["endedAt", "scoreA", "scoreB"])
    )
      fail();
    if (m.scoreDraft !== undefined) {
      const draft = obj(m.scoreDraft);
      if (
        m.status === "completed" ||
        ![draft.a, draft.b].every(
          (value) =>
            typeof value === "string" &&
            value.length <= 12 &&
            (value === "" || /^\d+$/.test(value)),
        )
      )
        fail();
    }
    if (m.resultHistory !== undefined) {
      if (m.status !== "completed" || !Array.isArray(m.resultHistory)) fail();
      let previous = 0;
      const changes = new Set();
      for (const item of m.resultHistory as unknown[]) {
        const change = obj(item);
        if (
          !text(change.id) ||
          changes.has(change.id) ||
          !num(change.at) ||
          Number(change.at) < previous ||
          !["correction", "undo"].includes(String(change.kind))
        )
          fail();
        changes.add(change.id);
        previous = Number(change.at);
        for (const value of [change.before, change.after]) {
          const result = obj(value);
          if (
            !["A", "B"].includes(String(result.winner)) ||
            !optionalNumber(result, ["scoreA", "scoreB"]) ||
            (result.scoreA === undefined) !== (result.scoreB === undefined)
          )
            fail();
          if (
            result.scoreA !== undefined &&
            (!Number.isInteger(result.scoreA) ||
              !Number.isInteger(result.scoreB) ||
              (result.winner === "A"
                ? Number(result.scoreA) <= Number(result.scoreB)
                : Number(result.scoreB) <= Number(result.scoreA)))
          )
            fail();
        }
      }
      const last = (m.resultHistory as unknown[]).at(-1) as
        Record<string, unknown> | undefined;
      if (last) {
        const result = obj(last.after);
        if (
          result.winner !== m.winner ||
          result.scoreA !== m.scoreA ||
          result.scoreB !== m.scoreB
        )
          fail();
      }
    }
    if (m.eligiblePlayerIds !== undefined && !strings(m.eligiblePlayerIds))
      fail();
    if (m.status === "completed" && !["A", "B"].includes(String(m.winner)))
      fail();
    if ((m.scoreA === undefined) !== (m.scoreB === undefined)) fail();
    if (
      m.scoreA !== undefined &&
      (!Number.isInteger(m.scoreA) ||
        !Number.isInteger(m.scoreB) ||
        (m.winner === "A"
          ? Number(m.scoreA) <= Number(m.scoreB)
          : Number(m.scoreB) <= Number(m.scoreA)))
    )
      fail();
    if (m.status === "playing") {
      if (s.status !== "active" || busyCourts.has(m.courtId)) fail();
      busyCourts.add(m.courtId);
      for (const id of [...(m.teamA as string[]), ...(m.teamB as string[])]) {
        if (busyPlayers.has(id)) fail();
        busyPlayers.add(id);
      }
    }
  }
  for (const s of rows.sessions) {
    if (s.queue === undefined) continue;
    const queue = obj(s.queue);
    for (const id of [
      ...(queue.upNext as string[]),
      ...(queue.standby as string[]),
    ]) {
      if (busyPlayers.has(id)) fail();
      const events =
        s.attendance === undefined
          ? undefined
          : (obj(s.attendance)[id] as { action: string }[] | undefined);
      if (
        s.attendance !== undefined &&
        (!events?.length || events.at(-1)?.action === "check-out")
      )
        fail();
      const availability =
        s.playerStatuses === undefined ? undefined : obj(s.playerStatuses)[id];
      if (availability !== undefined && availability !== "active") fail();
    }
  }
  return {
    ...b,
    app: "paddlebai",
    formatVersion: 1,
    schemaVersion: 5,
  } as unknown as Backup;
}
export async function restoreBackup(input: unknown) {
  const b = validateBackup(input);
  await db.transaction("rw", [...tables, db.safety], async () => {
    if (await db.sessions.where("status").equals("active").count())
      throw Error("Finish the live session before replacing device data.");
    const current = await createBackup();
    await db.safety.put({
      id: "before-restore",
      createdAt: Date.now(),
      payload: JSON.stringify(current),
    });
    for (const table of tables) await table.clear();
    await db.players.bulkAdd(b.players);
    await db.groups.bulkAdd(b.groups);
    await db.sessions.bulkAdd(b.sessions);
    await db.courts.bulkAdd(b.courts);
    await db.matches.bulkAdd(b.matches);
  });
}
