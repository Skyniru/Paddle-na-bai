import type { Player, Match, Mode, Session } from "@/types";
import { statistics } from "./statistics";
import { opportunities, lastPlayed } from "./rotation";
export function generateTeams(
  players: Player[],
  matches: Match[],
  mode: Mode,
  count: number,
  courtIds: string[] = [],
  session?: Session,
) {
  const busy = new Set(
    matches
      .filter((m) => m.status === "playing")
      .flatMap((m) => [...m.teamA, ...m.teamB]),
  );
  const pool = players
    .filter((p) => p.status === "active" && !busy.has(p.id))
    .map((p) => ({ p, tie: Math.random() }));
  const eligibleHistory = (id: string) => {
    const events = session?.attendance?.[id];
    if (!events) return matches;
    return matches.filter(
      (m) =>
        (m.eligiblePlayerIds === undefined ||
          m.eligiblePlayerIds.includes(id)) &&
        events.filter((e) => e.at <= m.createdAt).at(-1)?.action !==
          "check-out" &&
        events.some((e) => e.at <= m.createdAt),
    );
  };
  const rests = (id: string) =>
    session
      ? new Set(
          eligibleHistory(id)
            .filter(
              (m) =>
                m.status !== "cancelled" &&
                ![...m.teamA, ...m.teamB].includes(id),
            )
            .map((m) => m.createdAt),
        ).size
      : 0;
  const consecutiveRests = (id: string) => {
    if (!session) return 0;
    const rounds = [
      ...new Set(
        eligibleHistory(id)
          .filter((m) => m.status !== "cancelled")
          .map((m) => m.createdAt),
      ),
    ].sort((a, b) => b - a);
    let count = 0;
    for (const at of rounds) {
      if (
        matches.some(
          (m) =>
            m.createdAt === at &&
            m.status !== "cancelled" &&
            [...m.teamA, ...m.teamB].includes(id),
        )
      )
        break;
      count++;
    }
    return count;
  };
  const restingTime = (id: string) => {
    const events = session?.attendance?.[id];
    if (!events) return Date.now() - lastPlayed(id, matches);
    let total = 0;
    for (let i = 0; i < events.length; i++) {
      if (events[i].action === "check-out") continue;
      const start = events[i].at;
      const end = events[i + 1]?.at ?? Date.now();
      const playing = matches
        .filter(
          (m) =>
            m.status !== "cancelled" && [...m.teamA, ...m.teamB].includes(id),
        )
        .reduce(
          (sum, m) =>
            sum +
            Math.max(
              0,
              Math.min(end, m.endedAt ?? Date.now()) -
                Math.max(start, m.createdAt),
            ),
          0,
        );
      total += Math.max(0, end - start - playing);
    }
    return total;
  };
  pool.sort((a, b) =>
    mode === "random"
      ? a.tie - b.tie
      : opportunities(a.p.id, eligibleHistory(a.p.id)) -
          opportunities(b.p.id, eligibleHistory(b.p.id)) ||
        consecutiveRests(b.p.id) - consecutiveRests(a.p.id) ||
        rests(b.p.id) - rests(a.p.id) ||
        restingTime(b.p.id) - restingTime(a.p.id) ||
        lastPlayed(a.p.id, matches) - lastPlayed(b.p.id, matches) ||
        a.tie - b.tie,
  );
  const selected = pool.slice(0, count * 4).map((x) => x.p);
  const groups: { teamA: string[]; teamB: string[] }[] = [];
  for (let i = 0; i + 3 < selected.length; i += 4) {
    let four = selected.slice(i, i + 4);
    const courtId = courtIds[groups.length];
    if (mode !== "random" && courtId) {
      const remaining = selected.slice(i);
      remaining.sort(
        (a, b) =>
          matches.filter(
            (m) =>
              m.courtId === courtId && [...m.teamA, ...m.teamB].includes(a.id),
          ).length -
          matches.filter(
            (m) =>
              m.courtId === courtId && [...m.teamA, ...m.teamB].includes(b.id),
          ).length,
      );
      four = remaining.slice(0, 4);
      selected.splice(
        i,
        selected.length - i,
        ...four,
        ...remaining.filter((p) => !four.includes(p)),
      );
    }
    const options = [
      [
        [0, 1],
        [2, 3],
      ],
      [
        [0, 2],
        [1, 3],
      ],
      [
        [0, 3],
        [1, 2],
      ],
    ];
    const cost = (o: number[][]) => {
      const a = o[0].map((n) => four[n].id),
        b = o[1].map((n) => four[n].id);
      let c = 0;
      for (const m of matches.filter((m) => m.status !== "cancelled")) {
        for (const t of [a, b])
          if (
            [m.teamA, m.teamB].some((old) => t.every((id) => old.includes(id)))
          )
            c += 8;
        for (const x of a)
          for (const y of b)
            if (
              (m.teamA.includes(x) && m.teamB.includes(y)) ||
              (m.teamB.includes(x) && m.teamA.includes(y))
            )
              c += 1;
      }
      if (mode === "balanced")
        c +=
          Math.abs(
            a.reduce((s, id) => s + statistics(id, matches).rate, 0) -
              b.reduce((s, id) => s + statistics(id, matches).rate, 0),
          ) / 10;
      return c;
    };
    if (mode !== "random") options.sort((a, b) => cost(a) - cost(b));
    const o = options[0];
    groups.push({
      teamA: o[0].map((n) => four[n].id),
      teamB: o[1].map((n) => four[n].id),
    });
  }
  return groups;
}
